"""API for Blueprint Studio."""
from __future__ import annotations

import logging
import os
from typing import Any
from pathlib import Path

from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import BINARY_EXTENSIONS
from .util import json_message, json_response
from .git_manager import GitManager
from .ai_manager import AIManager
from .file_manager import FileManager
from .sftp_manager import SftpManager

_LOGGER = logging.getLogger(__name__)

class BlueprintStudioApiView(HomeAssistantView):
    """View to handle API requests for Blueprint Studio."""

    url = "/api/blueprint_studio"
    name = "api:blueprint_studio"
    requires_auth = True

    def __init__(self, config_dir: Path, store: Store, data: dict) -> None:
        """Initialize the view."""
        self.config_dir = config_dir
        self.store = store
        self.data = data

        self.git = GitManager(None, config_dir, data, store)
        self.ai = AIManager(None, data)
        self.file = FileManager(None, config_dir)
        self.sftp = SftpManager()

    def _update_hass(self, hass: HomeAssistant) -> None:
        """Update hass instance in managers."""
        self.git.hass = hass
        self.ai.hass = hass
        self.file.hass = hass

    async def get(self, request: web.Request) -> web.Response:
        """Handle GET requests."""
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
        if action == "list_git_files":
            items = await hass.async_add_executor_job(self.file.list_git_files)
            return json_response(items)
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
            result = await hass.async_add_executor_job(self.ai.check_yaml, data.get("content", ""))
            return result
        if action == "check_jinja":
            result = await hass.async_add_executor_job(self.ai.check_jinja, data.get("content", ""))
            return result

        # Git
        if action == "git_status": return await self.git.get_status(data.get("fetch", False))
        if action == "git_log": return await self.git.get_log(data.get("count", 20))
        if action == "git_diff_commit": return await self.git.diff_commit(data.get("hash"))
        if action == "git_pull":
            response = await self.git.pull()
            if response.status == 200: self.file.clear_cache()  # 🔒 Thread-safe cache clear
            return response
        if action == "git_push": return await self.git.push(data.get("commit_message", "Update via Blueprint Studio"))
        if action == "git_push_only": return await self.git.push_only()
        if action == "git_commit": return await self.git.commit(data.get("commit_message", "Update via Blueprint Studio"))
        if action == "git_show": return await self.git.show(data.get("path"))
        if action == "git_init":
            response = await self.git.init()
            if response.status == 200: self.file.clear_cache()  # 🔒 Thread-safe cache clear
            return response
        if action == "git_add_remote": return await self.git.add_remote(data.get("name", "origin"), data.get("url"))
        if action == "git_remove_remote": return await self.git.remove_remote(data.get("name"))
        if action == "git_delete_repo": return await self.git.delete_repo()
        if action == "git_repair_index": return await self.git.repair_index()
        if action == "git_rename_branch": return await self.git.rename_branch(data.get("old_name"), data.get("new_name"))
        if action == "git_merge_unrelated": return await self.git.merge_unrelated(data.get("remote", "origin"), data.get("branch", "main"))
        if action == "git_force_push": 
            remote = data.get("remote", "origin")
            auth = "gitea" if remote == "gitea" else "github"
            return await self.git.force_push(remote, auth_provider=auth)
        if action == "git_hard_reset":
            remote = data.get("remote", "origin")
            auth = "gitea" if remote == "gitea" else "github"
            response = await self.git.hard_reset(remote, data.get("branch", "main"), auth_provider=auth)
            if response.status == 200: self.file.clear_cache()  # 🔒 Thread-safe cache clear
            return response
        if action == "git_delete_remote_branch": return await self.git.delete_remote_branch(data.get("branch"))
        if action == "git_abort": return await self.git.abort()
        if action == "git_stage": return await self.git.stage(data.get("files", []))
        if action == "git_unstage": return await self.git.unstage(data.get("files", []))
        if action == "git_reset": return await self.git.reset(data.get("files", []))
        if action == "git_clean_locks": return await self.git.clean_locks()
        if action == "git_stop_tracking": return await self.git.stop_tracking(data.get("files", []))
        if action == "git_get_remotes": return await self.git.get_remotes()
        if action == "git_get_credentials": return self.git.get_credentials()
        if action == "git_set_credentials": return await self.git.set_credentials(data.get("username"), data.get("token"), data.get("remember_me", True))
        if action == "git_clear_credentials": return await self.git.clear_credentials()
        if action == "git_test_connection": return await self.git.test_connection()
        
        # Gitea Specific
        if action == "gitea_status": return await self.git.get_status(data.get("fetch", False), remote="gitea", auth_provider="gitea")
        if action == "gitea_pull": return await self.git.pull(remote="gitea", auth_provider="gitea")
        if action == "gitea_push": return await self.git.push(data.get("commit_message", "Update via Blueprint Studio"), remote="gitea", auth_provider="gitea")
        if action == "gitea_push_only": return await self.git.push_only(remote="gitea", auth_provider="gitea")
        # Commit/Stage/Unstage/Reset are local operations, so we reuse git_commit etc. or assume they share the same repo state.
        # But we might want gitea_commit just for consistency in frontend calls?
        # Ideally, local operations are provider-agnostic. The frontend can just call git_commit.
        
        if action == "gitea_get_credentials": return self.git.get_credentials(provider="gitea")
        if action == "gitea_set_credentials": return await self.git.set_credentials(data.get("username"), data.get("token"), data.get("remember_me", True), provider="gitea")
        if action == "gitea_clear_credentials": return await self.git.clear_credentials(provider="gitea")
        if action == "gitea_test_connection": return await self.git.test_connection(remote="gitea", auth_provider="gitea")
        if action == "gitea_add_remote": return await self.git.add_remote(data.get("name", "gitea"), data.get("url"))
        if action == "gitea_remove_remote": return await self.git.remove_remote("gitea")
        if action == "gitea_create_repo": return await self.git.gitea_create_repo(data.get("repo_name"), data.get("description", ""), data.get("is_private", True), data.get("gitea_url"))

        # AI
        if action == "ai_query": return await self.ai.query(
            data.get("query"),
            data.get("current_file"),
            data.get("file_content"),
            data.get("ai_type"),
            data.get("cloud_provider"),
            data.get("ai_model")
        )

        # GitHub Specific
        if action == "github_create_repo": return await self.git.github_create_repo(data.get("repo_name"), data.get("description", ""), data.get("is_private", True))
        if action == "github_set_default_branch": return await self.git.github_set_default_branch(data.get("branch"))
        if action == "github_device_flow_start": return await self.git.github_device_flow_start(data.get("client_id"))
        if action == "github_device_flow_poll": return await self.git.github_device_flow_poll(data.get("client_id"), data.get("device_code"))
        if action == "github_star": return await self.git.github_star()
        if action == "github_follow": return await self.git.github_follow()

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

        # SFTP
        if action in ("sftp_test", "sftp_list", "sftp_read", "sftp_write",
                       "sftp_create", "sftp_delete", "sftp_rename", "sftp_mkdir"):
            return await self._sftp_action(action, data, hass)

        return json_message("Unknown action", status_code=400)

    async def _sftp_action(self, action: str, data: dict, hass) -> web.Response:
        """Dispatch an SFTP action to SftpManager via executor."""
        conn = data.get("connection", {})
        host = conn.get("host", "")
        port = int(conn.get("port", 22))
        username = conn.get("username", "")
        auth = conn.get("auth", {})

        if not host or not username:
            return json_message("Missing connection parameters", status_code=400)

        try:
            if action == "sftp_test":
                result = await hass.async_add_executor_job(
                    self.sftp.test_connection, host, port, username, auth
                )
            elif action == "sftp_list":
                path = data.get("path", "/")
                result = await hass.async_add_executor_job(
                    self.sftp.list_directory, host, port, username, auth, path
                )
            elif action == "sftp_read":
                path = data.get("path")
                if not path:
                    return json_message("Missing path", status_code=400)
                result = await hass.async_add_executor_job(
                    self.sftp.read_file, host, port, username, auth, path
                )
            elif action == "sftp_write":
                path = data.get("path")
                content = data.get("content", "")
                if not path:
                    return json_message("Missing path", status_code=400)
                result = await hass.async_add_executor_job(
                    self.sftp.write_file, host, port, username, auth, path, content
                )
            elif action == "sftp_create":
                path = data.get("path")
                content = data.get("content", "")
                if not path:
                    return json_message("Missing path", status_code=400)
                result = await hass.async_add_executor_job(
                    self.sftp.create_file, host, port, username, auth, path, content
                )
            elif action == "sftp_delete":
                path = data.get("path")
                if not path:
                    return json_message("Missing path", status_code=400)
                result = await hass.async_add_executor_job(
                    self.sftp.delete_path, host, port, username, auth, path
                )
            elif action == "sftp_rename":
                src = data.get("source")
                dest = data.get("destination")
                if not src or not dest:
                    return json_message("Missing source or destination", status_code=400)
                result = await hass.async_add_executor_job(
                    self.sftp.rename_path, host, port, username, auth, src, dest
                )
            elif action == "sftp_mkdir":
                path = data.get("path")
                if not path:
                    return json_message("Missing path", status_code=400)
                result = await hass.async_add_executor_job(
                    self.sftp.make_directory, host, port, username, auth, path
                )
            else:
                return json_message("Unknown SFTP action", status_code=400)

            return json_response(result)
        except Exception as exc:
            _LOGGER.error("SFTP action %s failed: %s", action, exc)
            return json_response({"success": False, "message": str(exc)})

