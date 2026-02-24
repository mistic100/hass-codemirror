"""WebSocket API for CodeMirror."""
from __future__ import annotations

import logging
import asyncio
import time
from typing import Any
import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

_LOGGER = logging.getLogger(__name__)

async def _async_start_watcher(hass: HomeAssistant):
    """Start the filesystem watcher task."""
    if "code_mirror_watcher" not in hass.data:
        _LOGGER.debug("Starting CodeMirror filesystem watcher")
        hass.data["code_mirror_watcher"] = hass.async_create_task(
            async_watch_filesystem(hass)
        )

@callback
def async_register_websockets(hass: HomeAssistant):
    """Register websocket commands."""
    _LOGGER.debug("Registering CodeMirror websocket commands")
    websocket_api.async_register_command(hass, websocket_subscribe_updates)
    
    @callback
    def async_start_watcher_callback(_: Any = None):
        """Start watcher callback."""
        hass.async_create_task(_async_start_watcher(hass))

    # If HA is already running, start immediately
    from homeassistant.core import CoreState
    if hass.state == CoreState.running:
        async_start_watcher_callback()
    else:
        from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, async_start_watcher_callback)

@callback
def async_stop_watcher(hass: HomeAssistant):
    """Stop the filesystem watcher task."""
    if watcher := hass.data.get("code_mirror_watcher"):
        _LOGGER.debug("Stopping CodeMirror filesystem watcher")
        watcher.cancel()
        hass.data.pop("code_mirror_watcher", None)

async def async_watch_filesystem(hass: HomeAssistant):
    """Background task to watch for filesystem changes."""
    import time
    # Local changes fire immediately via FileManager
    
    try:
        while True:
            # We fire a heartbeat/check event every 10 seconds for external changes
            await asyncio.sleep(10)
            
            hass.bus.async_fire("code_mirror_update", {
                "action": "poll",
                "timestamp": time.time()
            })
    except asyncio.CancelledError:
        _LOGGER.debug("CodeMirror filesystem watcher stopped")
    except Exception as e:
        _LOGGER.error("Error in CodeMirror watcher: %s", e)

@websocket_api.require_admin
@websocket_api.async_response
@websocket_api.websocket_command({
    vol.Required("type"): "code_mirror/subscribe_updates",
})
async def websocket_subscribe_updates(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]):
    """Subscribe to CodeMirror updates."""
    
    @callback
    def forward_update(event):
        """Forward custom event to websocket."""
        connection.send_message(websocket_api.event_message(msg["id"], event.data))

    # Standard subscription pattern
    connection.subscriptions[msg["id"]] = hass.bus.async_listen(
        "code_mirror_update", forward_update
    )
    
    connection.send_result(msg["id"])
