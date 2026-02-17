"""SFTP Manager for Blueprint Studio."""
from __future__ import annotations

import io
import logging
import os
import stat
from typing import Any

_LOGGER = logging.getLogger(__name__)

# Allowed text file extensions (mirrors frontend TEXT_FILE_EXTENSIONS)
_ALLOWED_EXTENSIONS = {
    ".yaml", ".yml", ".json", ".txt", ".conf", ".cfg", ".ini", ".toml",
    ".sh", ".bash", ".zsh", ".py", ".js", ".ts", ".jsx", ".tsx", ".css",
    ".html", ".htm", ".xml", ".md", ".rst", ".log", ".env", ".gitignore",
    ".dockerignore", ".lua", ".sql", ".rb", ".php", ".go", ".rs",
    ".c", ".cpp", ".h", ".java", ".kt", ".swift", ".cs", ".r",
    ".properties", ".gradle", ".plist", ".service", ".rules", ".conf",
    ".list", ".sources", ".repo", ".htaccess", ".nginx", ".vhost",
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

        _LOGGER.warning(
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

    def list_directory(self, host: str, port: int, username: str, auth: dict, path: str) -> dict:
        """List a remote directory. Returns {success, folders, files}."""
        transport = None
        try:
            transport, sftp = self._make_client(host, port, username, auth)
            entries = sftp.listdir_attr(path)
            folders = []
            files = []
            for entry in sorted(entries, key=lambda e: e.filename.lower()):
                if entry.filename.startswith("."):
                    continue  # skip hidden by default
                is_dir = stat.S_ISDIR(entry.st_mode)
                item = {
                    "name": entry.filename,
                    "path": os.path.join(path, entry.filename).replace("\\", "/"),
                    "size": entry.st_size or 0,
                }
                if is_dir:
                    folders.append(item)
                else:
                    item["is_text"] = _is_text_file(entry.filename)
                    files.append(item)
            sftp.close()
            return {"success": True, "folders": folders, "files": files, "path": path}
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        finally:
            if transport:
                transport.close()

    def read_file(self, host: str, port: int, username: str, auth: dict, path: str) -> dict:
        """Read a remote text file. Returns {success, content}."""
        transport = None
        try:
            transport, sftp = self._make_client(host, port, username, auth)
            with sftp.open(path, "r") as fh:
                content = fh.read()
            sftp.close()
            if isinstance(content, bytes):
                content = content.decode("utf-8", errors="replace")
            return {"success": True, "content": content}
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
        """Delete a remote file or (empty) directory. Returns {success}."""
        transport = None
        try:
            transport, sftp = self._make_client(host, port, username, auth)
            attr = sftp.stat(path)
            if stat.S_ISDIR(attr.st_mode):
                sftp.rmdir(path)
            else:
                sftp.remove(path)
            sftp.close()
            return {"success": True}
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        finally:
            if transport:
                transport.close()

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
