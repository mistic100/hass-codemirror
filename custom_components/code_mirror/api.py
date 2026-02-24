"""API for CodeMirror."""
from __future__ import annotations

import logging
import os
import asyncio
import signal
from typing import Any
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

    async def get(self, request: web.Request) -> web.Response:
        """Handle GET requests."""
        user = await self._authenticate(request)
        if not user:
            return web.Response(status=401, text="Unauthorized")

        params = request.query
        action = params.get("action")
        if not action: return json_message("Missing action", status_code=400)
        
        hass = request.app["hass"]
        self._update_hass(hass)

        if action == "list_files":
            show_hidden = params.get("show_hidden", "false").lower() == "true"
            files = await hass.async_add_executor_job(self.file.list_files, show_hidden)
            return json_response(files)
        if action == "list_all":
            show_hidden = params.get("show_hidden", "false").lower() == "true"
            force_refresh = params.get("force", "false").lower() == "true"
            items = await hass.async_add_executor_job(self.file.list_all, show_hidden, force_refresh)
            return json_response(items)
        if action == "list_directory":
            # LAZY LOADING: List only one directory (non-recursive)
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
            return await self.file.download_folder(path)
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
        
        return json_message("Unknown action", status_code=400)

    async def post(self, request: web.Request) -> web.Response:
        """Handle POST requests."""
        user = await self._authenticate(request)
        if not user:
            return web.Response(status=401, text="Unauthorized")

        try: data = await request.json()
        except: return json_message("Invalid JSON", status_code=400)
        
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
            path = data.get("path")
            content = data.get("content")
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

        if action == "create_file": return await self.file.create_file(data.get("path"), data.get("content", ""), data.get("is_base64", False))
        if action == "create_folder": return await self.file.create_folder(data.get("path"))
        if action == "delete": return await self.file.delete(data.get("path"))
        if action == "copy": return await self.file.copy(data.get("source"), data.get("destination"))
        if action == "rename": return await self.file.rename(data.get("source"), data.get("destination"))
        if action == "upload_file": return await self.file.upload_file(data.get("path"), data.get("content"), data.get("overwrite", False), data.get("is_base64", False))
        if action == "upload_folder": return await self.file.upload_folder(data.get("path"), data.get("zip_data"))
        if action == "download_multi": return await self.file.download_multi(data.get("paths", []))
        if action == "delete_multi": return await self.file.delete_multi(data.get("paths", []))
        if action == "move_multi": return await self.file.move_multi(data.get("paths", []), data.get("destination"))
        if action == "check_yaml":
            result = await hass.async_add_executor_job(self.syntax_checker.check_yaml, data.get("content", ""))
            return result
        if action == "check_jinja":
            result = await hass.async_add_executor_job(self.syntax_checker.check_jinja, data.get("content", ""))
            return result

        # Misc
        if action == "restart_home_assistant":
            await hass.services.async_call("homeassistant", "restart")
            return json_response({"success": True, "message": "Restarting..."})
        if action == "get_entities":
            query = data.get("query", "").lower()
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
        if action == "global_search":
            results = await hass.async_add_executor_job(
                self.file.global_search, 
                data.get("query"), 
                data.get("case_sensitive", False), 
                data.get("use_regex", False),
                data.get("match_word", False),
                data.get("include", ""),
                data.get("exclude", "")
            )
            return json_response(results)
        if action == "global_replace":
            results = await hass.async_add_executor_job(
                self.file.global_replace,
                data.get("query"),
                data.get("replacement"),
                data.get("case_sensitive", False),
                data.get("use_regex", False),
                data.get("match_word", False),
                data.get("include", ""),
                data.get("exclude", "")
            )
            return json_response(results)

        return json_message("Unknown action", status_code=400)
