"""API for CodeMirror."""
from __future__ import annotations

import logging
from typing import cast
from pathlib import Path

from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import BINARY_EXTENSIONS
from .util import json_message, json_response
from .syntax_checker import SyntaxChecker
from .file_manager import FileManager

_LOGGER = logging.getLogger(__name__)

class CodeMirrorApiView(HomeAssistantView):
    """View to handle API requests for CodeMirror."""

    url = "/api/code_mirror"
    name = "api:code_mirror"
    requires_auth = False # We handle auth manually to support WebSockets via query param

    def __init__(self, config_dir: Path, store: Store, data: dict) -> None:
        """Initialize the view."""
        self.config_dir = config_dir
        self.store = store
        self.data = data

        self.syntax_checker = SyntaxChecker(None, data)
        self.file = FileManager(None, config_dir)

    async def _authenticate(self, request):
        """Authenticate request via header or token query param."""
        # 1. Header auth (handled by HA middleware)
        if request.get("hass_user"):
            return request["hass_user"]
        
        # 2. Query param auth (for WebSockets)
        token = request.query.get("token")
        if token:
            refresh_token = request.app["hass"].auth.async_validate_access_token(token)
            if refresh_token:
                return refresh_token.user
            else:
                _LOGGER.warning("CodeMirror: Invalid access token provided in query param")
        else:
            _LOGGER.warning("CodeMirror: No auth header or token provided")
        
        return None

    def _update_hass(self, hass: HomeAssistant) -> None:
        """Update hass instance in managers."""
        self.syntax_checker.hass = hass
        self.file.hass = hass

    async def get(self, request: web.Request) -> web.StreamResponse:
        """Handle GET requests."""
        user = await self._authenticate(request)
        if not user:
            return web.Response(status=401, text="Unauthorized")

        params = request.query
        action = params.get("action")
        if not action: return json_message("Missing action", status_code=400)
        
        hass = request.app["hass"]
        self._update_hass(hass)

        if action == "search_files":
            query = params.get("query", "")
            show_hidden = params.get("show_hidden", "false").lower() == "true"
            files = await hass.async_add_executor_job(self.file.search_files, query, show_hidden)
            return json_response(files)
        if action == "list_directory":
            path = params.get("path", "")  # Empty string = root
            show_hidden = params.get("show_hidden", "false").lower() == "true"
            result = await hass.async_add_executor_job(self.file.list_directory, path, show_hidden)
            return json_response(result)
        if action == "read_file":
            path = params.get("path")
            if not path: return json_message("Missing path", status_code=400)
            return await self.file.read_file(path)
        if action == "serve_file":
            path = params.get("path")
            if not path: return web.Response(status=400, text="Missing path")
            return await self.file.serve_file(path)
        if action == "global_search":
            results = await hass.async_add_executor_job(
                self.file.global_search, 
                params.get("query"), 
                params.get("case_sensitive", "false").lower() == "true", 
                params.get("use_regex", "false").lower() == "true",
                params.get("match_word", "false").lower() == "true",
                params.get("include", ""),
                params.get("exclude", "")
            )
            return json_response(results)
        if action == "get_file_stat":
            path = params.get("path")
            if not path: return json_message("Missing path", status_code=400)
            return await self.file.get_file_stat(path)
        if action == "download_folder":
            path = params.get("path")
            if not path: return json_message("Missing path", status_code=400)
            return await self.file.download_folder(path, request)
        if action == "get_settings":
            return json_response(self.data.get("settings", {}))
        if action == "get_version":
            from homeassistant.const import __version__ as ha_version_const
            integration_version = "Unknown"
            try:
                def get_manifest_version():
                    manifest_path = Path(__file__).parent / "manifest.json"
                    import json
                    with open(manifest_path, "r") as f:
                        manifest = json.load(f)
                        return manifest.get("version", "Unknown")
                
                integration_version = await hass.async_add_executor_job(get_manifest_version)
            except: pass
            
            return json_response({
                "ha_version": ha_version_const,
                "integration_version": integration_version
            })
        if action == "get_entities":
            query = params.get("query", "").lower()
            entities = []
            for s in hass.states.async_all():
                eid = s.entity_id.lower()
                fname = str(s.attributes.get("friendly_name", "")).lower()
                if not query or query in eid or query in fname:
                    entities.append({
                        "entity_id": s.entity_id,
                        "friendly_name": s.attributes.get("friendly_name"), 
                        "icon": s.attributes.get("icon"),
                        "state": s.state
                    })
            # Limit results to avoid massive payloads if query is empty/broad
            return json_response({"entities": entities[:1000]})
        
        return json_message("Unknown action", status_code=400)

    async def post(self, request: web.Request) -> web.Response:
        """Handle POST requests."""
        user = await self._authenticate(request)
        if not user:
            return web.Response(status=401, text="Unauthorized")
        
        if request.content_type == 'application/json':
            try: data = await request.json()
            except Exception: return json_message("Invalid JSON", status_code=400)
        elif request.content_type == 'multipart/form-data':
            data = await request.post()
        else:
            return json_message("Unsupported Content-Type", status_code=415)
        
        action = data.get("action")
        if not action: return json_message("Missing action", status_code=400)
        
        hass = request.app["hass"]
        self._update_hass(hass)

        # Settings
        if action == "save_settings":
            self.data["settings"] = data.get("settings", {})
            await self.store.async_save(self.data)
            return json_response({"success": True})

        # Files
        if action == "write_file":
            path = cast(str, data.get("path"))
            content = cast(str, data.get("content"))
            response = await self.file.write_file(path, content)
            
            # Auto-reload logic
            if path and "/" not in path: # Only root files
                if path == "automations.yaml":
                    await hass.services.async_call("automation", "reload")
                elif path == "scripts.yaml":
                    await hass.services.async_call("script", "reload")
                elif path == "scenes.yaml":
                    await hass.services.async_call("scene", "reload")
                elif path == "groups.yaml":
                    await hass.services.async_call("group", "reload")
            
            return response

        if action == "create_file":
            path = cast(str, data.get("path"))
            content = cast(str, data.get("content", ""))
            return await self.file.create_file(path, content)
        if action == "create_folder":
            path = cast(str, data.get("path"))
            return await self.file.create_folder(path)
        if action == "delete":
            path = cast(str, data.get("path"))
            return await self.file.delete(path)
        if action == "copy":
            source = cast(str, data.get("source"))
            destination = cast(str, data.get("destination"))
            return await self.file.copy(source, destination)
        if action == "rename":
            source = cast(str, data.get("source"))
            destination = cast(str, data.get("destination"))
            return await self.file.rename(source, destination)
        if action == "upload_file":
            path = cast(str, data.get("path"))
            file = cast(web.FileField, data.get("file"))
            overwrite = cast(bool, data.get("overwrite", False))
            return await self.file.upload_file(path, file.file, overwrite)
        if action == "upload_folder":
            path = cast(str, data.get("path"))
            file = cast(web.FileField, data.get("file"))
            return await self.file.upload_folder(path, file.file)
        if action == "check_yaml":
            content = cast(str, data.get("content", ""))
            return await hass.async_add_executor_job(self.syntax_checker.check_yaml, content)
        if action == "check_jinja":
            content = cast(str, data.get("content", ""))
            return await hass.async_add_executor_job(self.syntax_checker.check_jinja, content)

        # Misc
        if action == "restart_home_assistant":
            await hass.services.async_call("homeassistant", "restart")
            return json_response({"success": True, "message": "Restarting..."})

        return json_message("Unknown action", status_code=400)
