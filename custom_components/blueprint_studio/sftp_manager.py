"""SFTP Manager for Blueprint Studio."""
from __future__ import annotations

import io
import logging
import os
import stat
import base64
import mimetypes
from typing import Any

_LOGGER = logging.getLogger(__name__)

# Allowed text file extensions (mirrors frontend TEXT_FILE_EXTENSIONS)
_ALLOWED_EXTENSIONS = {
    ".yaml", ".yml", ".json", ".txt", ".csv", ".conf", ".cfg", ".ini", ".toml",
    ".sh", ".bash", ".zsh", ".py", ".js", ".ts", ".jsx", ".tsx", ".css",
    ".html", ".htm", ".xml", ".md", ".rst", ".log", ".env", ".gitignore",
    ".dockerignore", ".lua", ".sql", ".rb", ".php", ".go", ".rs",
    ".c", ".cpp", ".h", ".java", ".kt", ".swift", ".cs", ".r",
    ".properties", ".gradle", ".plist", ".service", ".rules", ".conf",
    ".list", ".sources", ".repo", ".htaccess", ".nginx", ".vhost",
}

# Binary file extensions (mirrors const.py BINARY_EXTENSIONS)
_BINARY_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".ico", ".pdf", ".zip",
    ".db", ".sqlite",
    ".der", ".bin", ".ota", ".tar", ".gz",
    ".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv", ".wmv", ".m4v",
}


def _is_text_file(filename: str) -> bool:
    """Return True if the file extension is considered a text/edit-able file."""
    ext = os.path.splitext(filename)[1].lower()
    return ext in _ALLOWED_EXTENSIONS


class SftpManager:
    """Stateless SFTP client. Each public method opens a fresh connection."""

    def _make_client(self, host: str, port: int, username: str, auth: dict):
        """Open and return a (transport, sftp_client) pair.

        The caller is responsible for closing both objects when done.
        Raises on connection / authentication failure.
        """
        import paramiko  # lazy import – installed by HA requirements

        _LOGGER.info(
            "Blueprint Studio SFTP: connecting to %s:%s as %s. "
            "Host keys are auto-accepted (AutoAddPolicy). "
            "Credentials are NOT logged.",
            host, port, username,
        )

        transport = paramiko.Transport((host, int(port)))
        transport.connect()  # bare TCP connect first

        # Authenticate
        auth_type = auth.get("type", "password")
        if auth_type == "password":
            transport.auth_password(username, auth.get("password", ""))
        else:
            key_text = auth.get("private_key", "")
            passphrase = auth.get("passphrase") or None
            # Try RSA first, then Ed25519, then ECDSA, then DSS
            pkey = None
            for key_class_name in ("RSAKey", "Ed25519Key", "ECDSAKey", "DSSKey"):
                try:
                    key_class = getattr(paramiko, key_class_name)
                    pkey = key_class.from_private_key(
                        io.StringIO(key_text), password=passphrase
                    )
                    break
                except Exception:
                    continue
            if pkey is None:
                raise ValueError("Could not parse private key (tried RSA, Ed25519, ECDSA, DSS)")
            transport.auth_publickey(username, pkey)

        sftp = paramiko.SFTPClient.from_transport(transport)
        return transport, sftp

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    def test_connection(self, host: str, port: int, username: str, auth: dict) -> dict:
        """Test connectivity and authentication. Returns {success, message}."""
        transport = None
        try:
            transport, sftp = self._make_client(host, port, username, auth)
            sftp.listdir("/")
            sftp.close()
            return {"success": True, "message": f"Connected to {host}:{port} as {username}"}
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        finally:
            if transport:
                transport.close()

    def list_directory(self, host: str, port: int, username: str, auth: dict, path: str, show_hidden: bool = False) -> dict:
        """List a remote directory. Returns {success, folders, files}."""
        transport = None
        try:
            transport, sftp = self._make_client(host, port, username, auth)
            entries = sftp.listdir_attr(path)
            folders = []
            files = []
            for entry in sorted(entries, key=lambda e: e.filename.lower()):
                if not show_hidden and entry.filename.startswith("."):
                    continue
                is_dir = stat.S_ISDIR(entry.st_mode)
                item = {
                    "name": entry.filename,
                    "path": os.path.join(path, entry.filename).replace("\\", "/"),
                    "size": entry.st_size or 0,
                }
                if is_dir:
                    folders.append(item)
                else:
                    ext = os.path.splitext(entry.filename)[1].lower()
                    item["is_text"] = _is_text_file(entry.filename)
                    item["is_binary"] = ext in _BINARY_EXTENSIONS
                    files.append(item)
            sftp.close()
            return {"success": True, "folders": folders, "files": files, "path": path}
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        finally:
            if transport:
                transport.close()

    def read_file(self, host: str, port: int, username: str, auth: dict, path: str) -> dict:
        """Read a remote file. Returns {success, content, is_base64, mime_type}."""
        transport = None
        try:
            transport, sftp = self._make_client(host, port, username, auth)
            ext = os.path.splitext(path)[1].lower()
            is_binary = ext in _BINARY_EXTENSIONS
            
            mode = "rb" if is_binary else "r"
            with sftp.open(path, mode) as fh:
                content = fh.read()
            
            attr = sftp.stat(path)
            sftp.close()
            
            mime_type = mimetypes.guess_type(path)[0]
            
            if is_binary:
                return {
                    "success": True, 
                    "content": base64.b64encode(content).decode(), 
                    "is_base64": True, 
                    "mime_type": mime_type or "application/octet-stream",
                    "mtime": attr.st_mtime
                }
            
            if isinstance(content, bytes):
                content = content.decode("utf-8", errors="replace")
                
            return {
                "success": True, 
                "content": content, 
                "is_base64": False, 
                "mime_type": mime_type or "text/plain;charset=utf-8",
                "mtime": attr.st_mtime
            }
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        finally:
            if transport:
                transport.close()

    def write_file(self, host: str, port: int, username: str, auth: dict, path: str, content: str) -> dict:
        """Write content to a remote file. Returns {success}."""
        transport = None
        try:
            transport, sftp = self._make_client(host, port, username, auth)
            encoded = content.encode("utf-8") if isinstance(content, str) else content
            with sftp.open(path, "w") as fh:
                fh.write(encoded)
            sftp.close()
            return {"success": True}
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        finally:
            if transport:
                transport.close()

    def create_file(self, host: str, port: int, username: str, auth: dict, path: str, content: str = "") -> dict:
        """Create a new remote file (fails if it already exists). Returns {success}."""
        transport = None
        try:
            transport, sftp = self._make_client(host, port, username, auth)
            # Check existence
            try:
                sftp.stat(path)
                sftp.close()
                return {"success": False, "message": f"File already exists: {path}"}
            except FileNotFoundError:
                pass
            encoded = content.encode("utf-8") if isinstance(content, str) else content
            with sftp.open(path, "w") as fh:
                fh.write(encoded)
            sftp.close()
            return {"success": True}
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        finally:
            if transport:
                transport.close()

    def delete_path(self, host: str, port: int, username: str, auth: dict, path: str) -> dict:
        """Delete a remote file or directory (recursively). Returns {success}."""
        transport = None
        try:
            transport, sftp = self._make_client(host, port, username, auth)
            attr = sftp.stat(path)
            if stat.S_ISDIR(attr.st_mode):
                self._rmtree(sftp, path)
            else:
                sftp.remove(path)
            sftp.close()
            return {"success": True}
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        finally:
            if transport:
                transport.close()

    def _rmtree(self, sftp, path):
        """Recursively delete a remote directory."""
        for entry in sftp.listdir_attr(path):
            full_path = os.path.join(path, entry.filename).replace("\\", "/")
            if stat.S_ISDIR(entry.st_mode):
                self._rmtree(sftp, full_path)
            else:
                sftp.remove(full_path)
        sftp.rmdir(path)

    def rename_path(self, host: str, port: int, username: str, auth: dict, src: str, dest: str) -> dict:
        """Rename/move a remote path. Returns {success}."""
        transport = None
        try:
            transport, sftp = self._make_client(host, port, username, auth)
            sftp.rename(src, dest)
            sftp.close()
            return {"success": True}
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        finally:
            if transport:
                transport.close()

    def copy_path(self, host: str, port: int, username: str, auth: dict, src: str, dest: str) -> dict:
        """Copy a remote path (file or directory). Returns {success}."""
        transport = None
        try:
            transport, sftp = self._make_client(host, port, username, auth)
            attr = sftp.stat(src)
            if stat.S_ISDIR(attr.st_mode):
                self._copytree(sftp, src, dest)
            else:
                self._copyfile(sftp, src, dest)
            sftp.close()
            return {"success": True}
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        finally:
            if transport:
                transport.close()

    def _copyfile(self, sftp, src, dest):
        """Copy a remote file."""
        with sftp.open(src, "rb") as fsrc:
            with sftp.open(dest, "wb") as fdest:
                shutil.copyfileobj(fsrc, fdest)

    def _copytree(self, sftp, src, dest):
        """Recursively copy a remote directory."""
        try:
            sftp.mkdir(dest)
        except OSError:
            pass # Already exists
        for entry in sftp.listdir_attr(src):
            s_path = os.path.join(src, entry.filename).replace("\\", "/")
            d_path = os.path.join(dest, entry.filename).replace("\\", "/")
            if stat.S_ISDIR(entry.st_mode):
                self._copytree(sftp, s_path, d_path)
            else:
                self._copyfile(sftp, s_path, d_path)

    def make_directory(self, host: str, port: int, username: str, auth: dict, path: str) -> dict:
        """Create a remote directory (including parents). Returns {success}."""
        transport = None
        try:
            transport, sftp = self._make_client(host, port, username, auth)
            # Create parent directories if they don't exist
            parts = [p for p in path.split('/') if p]
            current = ''
            for part in parts:
                current += '/' + part
                try:
                    sftp.stat(current)
                except FileNotFoundError:
                    sftp.mkdir(current)
            sftp.close()
            return {"success": True}
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        finally:
            if transport:
                transport.close()
