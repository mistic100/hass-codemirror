"""File management for CodeMirror."""
from __future__ import annotations

import io
import logging
import os
import shutil
import zipfile
import mimetypes
from pathlib import Path

from aiohttp import web
from homeassistant.core import HomeAssistant

from .const import (
    ALLOWED_EXTENSIONS, BINARY_EXTENSIONS, ALLOWED_FILENAMES,
    EXCLUDED_PATTERNS, PROTECTED_PATHS
)
from .util import json_response, json_message, get_safe_path

_LOGGER = logging.getLogger(__name__)

class FileManager:
    """Class to handle file operations."""

    def __init__(self, hass: HomeAssistant, config_dir: Path) -> None:
        """Initialize file manager.

        Args:
            hass: Home Assistant instance
            config_dir: Base configuration directory
        """
        self.hass = hass
        self.config_dir = config_dir

    def _get_root_dir(self) -> Path:
        """Get the root directory (always config_dir).

        Returns:
            self.config_dir
        """
        return self.config_dir

    def _is_file_allowed(self, path: Path) -> bool:
        """Check if file type/name is allowed."""
        try:
            if ".storage" in path.relative_to(self._get_root_dir()).parts:
                return True
        except ValueError:
            pass
        return (path.suffix.lower() in ALLOWED_EXTENSIONS or path.name in ALLOWED_FILENAMES)

    def _is_protected(self, path: str) -> bool:
        """Check if path is protected."""
        parts = path.strip("/").split("/")
        return parts[0] in PROTECTED_PATHS or path.strip("/") in PROTECTED_PATHS

    def _get_dir_size(self, path: Path) -> int:
        """Get directory size."""
        total = 0
        try:
            for entry in os.scandir(path):
                if entry.is_file(): total += entry.stat().st_size
                elif entry.is_dir(): total += self._get_dir_size(Path(entry.path))
        except (OSError, PermissionError): pass
        return total

    def search_files(self, query: str, show_hidden: bool = False) -> list[str]:
        """Search files recursively."""
        if not query:
            return []
        res = []
        root_dir = self._get_root_dir()
        for root, dirs, files in os.walk(root_dir):
            if not show_hidden: dirs[:] = [d for d in dirs if d not in EXCLUDED_PATTERNS and not d.startswith(".")]
            else: dirs[:] = [d for d in dirs if d not in EXCLUDED_PATTERNS]
            rel_root = Path(root).relative_to(root_dir)
            for name in sorted(files):
                file_path = Path(root) / name
                if (not show_hidden and name.startswith(".")) or not self._is_file_allowed(file_path): continue
                rel_path = str(rel_root / name if str(rel_root) != "." else name)
                if query in rel_path.lower():
                    res.append(rel_path)
        return sorted(res)

    def list_directory(self, path: str = "", show_hidden: bool = False) -> dict:
        """
        List contents of a single directory (non-recursive).

        Args:
            path: Relative path to directory (empty string = root)
            show_hidden: Whether to show hidden files/folders

        Returns:
            {
                "path": "relative/path",
                "folders": [{"name": "folder1", "path": "relative/path/folder1", "size": 0}],
                "files": [{"name": "file.yaml", "path": "relative/path/file.yaml", "size": 1234}]
            }
        """
        try:
            # Get root directory
            root_dir = self._get_root_dir()

            # Get safe path (validates path is allowed)
            if path:
                # Use root_dir as base for path resolution
                target_path = get_safe_path(root_dir, path)
                if target_path is None:
                    _LOGGER.error("Path blocked by safety check: %s", path)
                    return {"path": path, "folders": [], "files": [], "error": f"Access denied: {path}"}
            else:
                # Empty path = root directory
                target_path = root_dir

            if not target_path or not target_path.exists():
                return {"path": path, "folders": [], "files": [], "error": "Directory not found"}

            if not target_path.is_dir():
                return {"path": path, "folders": [], "files": [], "error": "Not a directory"}

            folders = []
            files = []

            # Standard exclusions only
            all_exclusions = EXCLUDED_PATTERNS

            # List directory contents (NON-RECURSIVE - just immediate children)
            for item in sorted(target_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                item_name = item.name

                # Skip hidden files if not showing hidden
                if not show_hidden and item_name.startswith("."):
                    continue

                # Skip excluded patterns
                if item_name in all_exclusions:
                    continue

                # Calculate relative path
                try:
                    if path:
                        rel_path = f"{path}/{item_name}"
                    else:
                        # Root level - relative to root_dir
                        rel_path = str(item.relative_to(root_dir))
                except (ValueError, OSError):
                    rel_path = item_name

                try:
                    # Check if item is a symlink
                    is_symlink = item.is_symlink()
                    symlink_target = None
                    if is_symlink:
                        try:
                            # Get symlink target (relative or absolute)
                            symlink_target = str(item.readlink())
                        except (OSError, ValueError, AttributeError):
                            try:
                                import os
                                symlink_target = os.readlink(str(item))
                            except OSError:
                                symlink_target = None
                    if item.is_dir():
                        # Count immediate children for folder badge (fast)
                        try:
                            child_count = sum(1 for _ in item.iterdir())
                        except (PermissionError, OSError):
                            child_count = 0

                        folder_data = {
                            "name": item_name,
                            "path": rel_path,
                            "size": 0,  # Don't calculate size for lazy loading (too slow)
                            "childCount": child_count
                        }
                        if is_symlink:
                            folder_data["isSymlink"] = True
                            if symlink_target:
                                folder_data["symlinkTarget"] = symlink_target
                        folders.append(folder_data)
                    elif item.is_file():
                        # Check if file is allowed (symlinks always shown regardless of extension)
                        if is_symlink or self._is_file_allowed(item):
                            try:
                                size = item.stat().st_size
                            except (PermissionError, OSError):
                                size = 0

                            file_data = {
                                "name": item_name,
                                "path": rel_path,
                                "size": size,
                                "type": "file"
                            }
                            if is_symlink:
                                file_data["isSymlink"] = True
                                if symlink_target:
                                    file_data["symlinkTarget"] = symlink_target
                            files.append(file_data)
                    elif is_symlink:
                        # Broken symlink - show it as a file with broken indicator
                        files.append({
                            "name": item_name,
                            "path": rel_path,
                            "size": 0,
                            "type": "file",
                            "isSymlink": True,
                            "symlinkTarget": symlink_target or "",
                            "isBroken": True
                        })
                except (PermissionError, OSError) as e:
                    _LOGGER.debug("Permission denied or error accessing %s: %s", item, e)
                    continue

            return {
                "path": path,
                "folders": folders,
                "files": files
            }

        except PermissionError:
            _LOGGER.warning("Permission denied accessing directory: %s", path)
            return {"path": path, "folders": [], "files": [], "error": "Permission denied"}
        except Exception as e:
            _LOGGER.error("list_directory() failed for path '%s': %s", path, e)
            return {"path": path, "folders": [], "files": [], "error": str(e)}

    def global_search(self, query: str, case_sensitive: bool = False, use_regex: bool = False, match_word: bool = False, include: str = "", exclude: str = "") -> list[dict]:
        """Perform global search across allowed config files."""
        import re
        import fnmatch
        import concurrent.futures

        results = []
        try:
            # Prepare pattern
            flags = 0 if case_sensitive else re.IGNORECASE
            search_pattern = query
            if not use_regex:
                search_pattern = re.escape(query)
            if match_word:
                search_pattern = rf"\b{search_pattern}\b"
            
            pattern = re.compile(search_pattern, flags)

            # Prepare include/exclude filters
            include_patterns = [p.strip() for p in include.split(',') if p.strip()]
            exclude_patterns = [p.strip() for p in exclude.split(',') if p.strip()]

            # Collect files first
            search_files = []
            root_dir = self._get_root_dir()
            for root, dirs, files in os.walk(root_dir):
                dirs[:] = [d for d in dirs if not d.startswith(".") and d not in EXCLUDED_PATTERNS]
                for name in files:
                    file_path = Path(root) / name
                    rel_path = str(file_path.relative_to(root_dir))

                    # 1. Filter allowed files
                    if not self._is_file_allowed(file_path): continue
                    if file_path.suffix.lower() in BINARY_EXTENSIONS: continue

                    # 2. Filter Include
                    if include_patterns:
                        if not any(fnmatch.fnmatch(rel_path, p) or fnmatch.fnmatch(name, p) for p in include_patterns):
                            continue
                    
                    # 3. Filter Exclude
                    if exclude_patterns:
                        if any(fnmatch.fnmatch(rel_path, p) or fnmatch.fnmatch(name, p) for p in exclude_patterns):
                            continue
                    
                    search_files.append((file_path, rel_path))

            # Helper for single file search
            def search_single_file(args):
                f_path, r_path = args
                local_results = []
                try:
                    with open(f_path, "r", encoding="utf-8", errors="ignore") as f:
                        for i, line in enumerate(f):
                            if pattern.search(line):
                                local_results.append({
                                    "path": r_path,
                                    "line": i + 1,
                                    "content": line.strip()
                                })
                                if len(local_results) > 100: break # Limit matches per file
                except: pass
                return local_results

            # Execute in parallel
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(search_single_file, f) for f in search_files]
                for future in concurrent.futures.as_completed(futures):
                    res = future.result()
                    if res:
                        results.extend(res)
                        if len(results) >= 2000: break # Hard limit total results

        except Exception as e:
            _LOGGER.error("Global search error: %s", e)
        return results[:2000]

    async def read_file(self, path: str) -> web.Response:
        """Read file content."""
        safe_path = get_safe_path(self._get_root_dir(), path)
        if not safe_path or not safe_path.is_file(): return json_message("File not found", status_code=404)
        if not self._is_file_allowed(safe_path): return json_message("Not allowed", status_code=403)
        try:
            if safe_path.suffix.lower() in BINARY_EXTENSIONS:
                raise Exception("Cannot read binary file content")
            content = await self.hass.async_add_executor_job(safe_path.read_text, "utf-8")
            return json_response({"content": content, "mime_type": mimetypes.guess_type(safe_path.name)[0] or "text/plain;charset=utf-8", "mtime": safe_path.stat().st_mtime})
        except Exception as e: return json_message(str(e), status_code=500)

    async def serve_file(self, path: str) -> web.StreamResponse:
        """Serve raw file content with correct MIME type."""
        safe_path = get_safe_path(self._get_root_dir(), path)
        if not safe_path or not safe_path.is_file(): return web.Response(status=404, text="File not found")
        if not self._is_file_allowed(safe_path): return web.Response(status=403, text="Not allowed")
        try:
            mime_type = mimetypes.guess_type(safe_path.name)[0] or "application/octet-stream"
            headers = {
                "Content-Type": mime_type,
                "Content-Disposition": f'inline; filename="{safe_path.name}"'
            }
            return web.FileResponse(safe_path, headers=headers)
        except Exception as e: return web.Response(status=500, text=str(e))

    async def get_file_stat(self, path: str) -> web.Response:
        """Get file statistics."""
        safe_path = get_safe_path(self._get_root_dir(), path)
        if not safe_path or not safe_path.is_file(): return json_message("File not found", status_code=404)
        if not self._is_file_allowed(safe_path): return json_message("Not allowed", status_code=403)
        try:
            stat = safe_path.stat()
            return json_response({"success": True, "mtime": stat.st_mtime, "size": stat.st_size})
        except Exception as e: return json_message(str(e), status_code=500)

    async def write_file(self, path: str, content: str) -> web.Response:
        """Write file content."""
        safe_path = get_safe_path(self._get_root_dir(), path)
        if not safe_path or not self._is_file_allowed(safe_path): return json_message("Not allowed", status_code=403)
        try:
            await self.hass.async_add_executor_job(safe_path.write_text, content, "utf-8")
            return json_response({"success": True, "mtime": safe_path.stat().st_mtime})
        except Exception as e: return json_message(str(e), status_code=500)

    async def create_file(self, path: str, content: str) -> web.Response:
        """Create a new file."""
        safe_path = get_safe_path(self._get_root_dir(), path)
        if not safe_path or not self._is_file_allowed(safe_path): return json_message("Not allowed", status_code=403)
        if safe_path.exists(): return json_message("Exists", status_code=409)
        try:
            # Create parent directories if they don't exist
            if not safe_path.parent.exists():
                await self.hass.async_add_executor_job(safe_path.parent.mkdir, 0o755, True, True)

            await self.hass.async_add_executor_job(safe_path.write_text, content, "utf-8")
            return json_response({"success": True, "path": path})
        except Exception as e: return json_message(str(e), status_code=500)

    async def create_folder(self, path: str) -> web.Response:
        """Create a new folder."""
        safe_path = get_safe_path(self._get_root_dir(), path)
        if not safe_path or safe_path.exists(): return json_message("Not allowed or exists", status_code=403)
        try:
            await self.hass.async_add_executor_job(safe_path.mkdir, 0o755, True, True)
            return json_response({"success": True, "path": path})
        except Exception as e: return json_message(str(e), status_code=500)

    async def delete(self, path: str) -> web.Response:
        """Delete a file or folder."""
        if self._is_protected(path): return json_message("Protected", status_code=403)
        safe_path = get_safe_path(self._get_root_dir(), path)
        if not safe_path or not safe_path.exists() or safe_path == self._get_root_dir(): return json_message("Not found or not allowed", status_code=404)
        try:
            if safe_path.is_dir(): await self.hass.async_add_executor_job(shutil.rmtree, safe_path)
            else: await self.hass.async_add_executor_job(safe_path.unlink)
            return json_response({"success": True})
        except Exception as e: return json_message(str(e), status_code=500)

    async def copy(self, source: str, destination: str) -> web.Response:
        """Copy a file or folder."""
        src, dest = get_safe_path(self._get_root_dir(), source), get_safe_path(self._get_root_dir(), destination)
        if not src or not dest or not src.exists() or dest.exists(): return json_message("Invalid path or exists", status_code=403)
        try:
            if src.is_dir(): await self.hass.async_add_executor_job(shutil.copytree, src, dest)
            else: await self.hass.async_add_executor_job(shutil.copy2, src, dest)
            return json_response({"success": True, "path": destination})
        except Exception as e: return json_message(str(e), status_code=500)

    async def rename(self, source: str, destination: str) -> web.Response:
        """Rename a file or folder."""
        if self._is_protected(source): return json_message("Protected", status_code=403)
        src, dest = get_safe_path(self._get_root_dir(), source), get_safe_path(self._get_root_dir(), destination)
        if not src or not dest or not src.exists() or dest.exists(): return json_message("Invalid path or exists", status_code=403)
        try:
            await self.hass.async_add_executor_job(src.rename, dest)
            return json_response({"success": True, "path": destination})
        except Exception as e: return json_message(str(e), status_code=500)

    async def download_folder(self, path: str, request: web.Request) -> web.StreamResponse:
        """Download folder as ZIP."""
        safe_path = get_safe_path(self._get_root_dir(), path)
        if not safe_path or not safe_path.is_dir(): return json_message("Not found", status_code=404)
        try:
            headers = {
                'Content-Type': 'application/zip',
                "Content-Disposition": f'attachment; filename="{safe_path.name}.zip"'
            }
            response = web.StreamResponse(headers=headers)
            await response.prepare(request)
            zip_data = await self.hass.async_add_executor_job(self._create_zip, safe_path)
            await response.write(zip_data.getvalue())
            await response.write_eof()
            return response
        except Exception as e: return json_message(str(e), status_code=500)

    def _create_zip(self, folder_path: Path) -> io.BytesIO:
        """Create ZIP from folder."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(folder_path):
                dirs[:] = [d for d in dirs if d not in EXCLUDED_PATTERNS and not d.startswith(".")]
                for f in files:
                    if f.startswith(".") or not self._is_file_allowed(Path(root) / f): continue
                    zf.write(Path(root) / f, (Path(root) / f).relative_to(folder_path))
        buf.seek(0)
        return buf

    async def upload_file(self, path: str, file: io.BufferedReader, overwrite: bool) -> web.Response:
        """Upload/create a file with content."""
        safe_path = get_safe_path(self._get_root_dir(), path)
        if not safe_path or not self._is_file_allowed(safe_path): return json_message("Not allowed", status_code=403)
        if safe_path.exists() and not overwrite: return json_message("File already exists", status_code=409)
        try:
            await self.hass.async_add_executor_job(safe_path.write_bytes, file.read())
            return json_response({"success": True, "path": path})
        except Exception as e: return json_message(str(e), status_code=500)

    async def upload_folder(self, path: str, file: io.BufferedReader) -> web.Response:
        """Upload ZIP and extract to folder."""
        safe_path = get_safe_path(self._get_root_dir(), path)
        if not safe_path: return json_message("Invalid path", status_code=400)

        # Create the folder if it doesn't exist
        if not safe_path.exists():
            try:
                await self.hass.async_add_executor_job(safe_path.mkdir, True, True)  # parents=True, exist_ok=True
            except Exception as e:
                return json_message(f"Failed to create folder: {str(e)}", status_code=500)

        try:
            buf = io.BytesIO(file.read())
            files_extracted = 0
            with zipfile.ZipFile(buf) as zf:
                for member in zf.namelist():
                    if not member.endswith("/") and self._is_file_allowed(safe_path / member):
                        zf.extract(member, safe_path)
                        files_extracted += 1
            return json_response({"success": True, "files_extracted": files_extracted})
        except Exception as e: return json_message(str(e), status_code=500)
