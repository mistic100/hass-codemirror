"""The CodeMirror integration."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend
try:
    from homeassistant.components.http import StaticPathConfig
except ImportError:
    # Fallback for HA < 2024.7
    class StaticPathConfig:
        """Shim for StaticPathConfig for older HA versions."""
        def __init__(self, url_path: str, path: str, cache_headers: bool) -> None:
            self.url_path = url_path
            self.path = path
            self.cache_headers = cache_headers

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.storage import Store

from .const import DOMAIN, NAME
from .api import CodeMirrorApiView
from .websocket import async_register_websockets, async_stop_watcher

_LOGGER = logging.getLogger(__name__)

# Storage version for credentials
STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.credentials"

# This integration is configured via config entries (UI)
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the CodeMirror component."""
    hass.data.setdefault(DOMAIN, {})
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up CodeMirror from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {}

    # Initialize credential storage
    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    data = await store.async_load() or {}

    config_dir = Path(hass.config.config_dir)
    api_view = CodeMirrorApiView(config_dir, store, data)
    hass.http.register_view(api_view)
    
    # Register WebSocket commands
    async_register_websockets(hass)

    # Register Static Paths with fallback for different HA versions
    url_path = f"/local/{DOMAIN}"
    path_on_disk = str(hass.config.path("custom_components", DOMAIN))
    
    if hasattr(hass.http, "async_register_static_paths"):
        await hass.http.async_register_static_paths([
            StaticPathConfig(
                url_path=url_path,
                path=path_on_disk,
                cache_headers=False,
            )
        ])
    elif hasattr(hass.http, "register_static_path"):
        hass.http.register_static_path(url_path, path_on_disk, False)
    else:
        _LOGGER.error("Failed to register static path: No registration method found on hass.http")

    frontend.async_register_built_in_panel(
        hass,
        component_name="iframe",
        sidebar_title=NAME,
        sidebar_icon="mdi:file-document-edit",
        frontend_url_path=DOMAIN,
        config={"url": f"/local/{DOMAIN}/panels/panel_custom.html"},
        require_admin=True,
    )

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    frontend.async_remove_panel(hass, DOMAIN)
    async_stop_watcher(hass)
    hass.data[DOMAIN].pop(entry.entry_id, None)
    return True