"""Utility functions for CodeMirror."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from aiohttp import web

_LOGGER = logging.getLogger(__name__)

def json_response(data: Any, status_code: int = 200) -> web.Response:
    """Return a JSON response."""
    return web.json_response(data, status=status_code)

def json_message(message: str, success: bool = False, status_code: int = 200) -> web.Response:
    """Return a JSON message response."""
    return web.json_response({"success": success, "message": message}, status=status_code)

def is_path_safe(config_dir: Path, path: str) -> bool:
    """Check if the path is safe (no path traversal).

    Args:
        config_dir: The base configuration directory
        path: The path to check

    Returns:
        True if the path is safe to access, False otherwise
    """
    try:
        full_path = (config_dir / path.lstrip("/")).resolve()
        # Must be within config_dir
        return full_path.is_relative_to(config_dir)
    except (ValueError, OSError):
        return False

def get_safe_path(config_dir: Path, path: str) -> Path | None:
    """Get a safe, resolved path.

    Args:
        config_dir: The base configuration directory
        path: The path to resolve

    Returns:
        Resolved Path if safe, None otherwise
    """
    if not is_path_safe(config_dir, path):
        _LOGGER.warning(
            "Path blocked by safety check: %s (config_dir: %s)",
            path, config_dir
        )
        return None

    full_path = (config_dir / path.lstrip("/")).resolve()
    return full_path
    _LOGGER.debug("Resolved safe path: %s -> %s", path, full_path)
    return full_path
