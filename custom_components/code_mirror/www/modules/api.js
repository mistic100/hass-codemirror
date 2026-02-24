/**
 * ============================================================================
 * API MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Provides the core API communication layer for CodeMirror. Handles
 * authenticated requests to the backend server and WebSocket connections for
 * real-time updates. This is the foundation for all server communication.
 *
 * EXPORTED FUNCTIONS:
 * - fetchWithAuth(url, options) - Make authenticated API request
 * - initWebSocket() - Initialize WebSocket connection for real-time updates
 * - closeWebSocket() - Close WebSocket connection
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new API endpoint:
 *    - Use fetchWithAuth(API_BASE, { method, headers, body })
 *    - Pass action in body: { action: "new_action", params }
 *    - Handle response: const data = await fetchWithAuth(...)
 *    - Add error handling with try/catch
 *    - Example: { action: "get_file", path: "..." }
 *
 * 2. Adding WebSocket message handling:
 *    - Modify initWebSocket() message handler
 *    - Add case for new message type
 *    - Update relevant state
 *    - Trigger UI updates
 *    - Example: case 'new_event': handleEvent(data); break;
 *
 * 3. Adding authentication methods:
 *    - Modify fetchWithAuth() auth detection
 *    - Add new auth provider check
 *    - Retrieve token from new source
 *    - Add to headers
 *
 * 4. Adding request retry logic:
 *    - Wrap fetchWithAuth in retry function
 *    - Detect transient errors (network, timeout)
 *    - Retry with exponential backoff
 *    - Max retry attempts
 *
 * 5. Adding request caching:
 *    - Create cache map for responses
 *    - Check cache before fetch
 *    - Store responses with TTL
 *    - Invalidate on updates
 *
 * INTEGRATION POINTS:
 * - All modules use this for server communication
 * - constants.js: API_BASE constant
 * - state.js: Updates state based on responses
 * - Home Assistant: Integrates with HA auth system
 *
 * AUTHENTICATION:
 * - Automatically detects Home Assistant environment
 * - Uses HA auth tokens when available
 * - Refreshes expired tokens automatically
 * - Falls back to standalone auth if needed
 * - Adds Authorization header to all requests
 *
 * ARCHITECTURE NOTES:
 * - All API calls go through fetchWithAuth (never use raw fetch)
 * - Handles HA iframe integration automatically
 * - WebSocket provides real-time updates from server
 * - Responses are JSON by default
 * - Errors are thrown and should be caught by callers
 *
 * COMMON PATTERNS:
 * - Simple GET: const data = await fetchWithAuth(API_BASE + "?action=get_data")
 * - POST with body: await fetchWithAuth(API_BASE, { method: "POST", headers: {...}, body: JSON.stringify({action, params}) })
 * - Error handling: try { await fetchWithAuth(...) } catch (e) { showToast(error) }
 * - Check success: if (data.success) { ... } else { handle error }
 *
 * REQUEST FORMAT:
 * {
 *   action: "action_name",
 *   param1: value1,
 *   param2: value2
 * }
 *
 * RESPONSE FORMAT:
 * {
 *   success: true/false,
 *   message: "Success/error message",
 *   data: { ... response data ... }
 * }
 *
 * WEBSOCKET MESSAGES:
 * - file_changed: File was modified
 * - server_reload: Server restarted
 * - Custom messages can be added
 *
 * ERROR HANDLING:
 * - Network errors: Thrown as exceptions
 * - HTTP errors (4xx, 5xx): Thrown as exceptions
 * - API errors: Returned in response.success = false
 * - Always use try/catch when calling fetchWithAuth
 *
 * ============================================================================
 */
import { state } from './state.js';

export async function fetchWithAuth(url, options = {}) {
  let headers = { ...options.headers };
  let token = null;
  let isHassEnvironment = false;

  try {
    if (window.parent && window.parent.hassConnection) {
      isHassEnvironment = true;
      const conn = await window.parent.hassConnection;
      if (conn && conn.auth) {
          if (conn.auth.expired) {
              await conn.auth.refreshAccessToken();
          }
          token = conn.auth.accessToken;
      }
    }
  } catch (e) {
    console.error("❌ Auth Error:", e);
    if (isHassEnvironment) {
        throw new Error("Auth refresh failed: " + e.message);
    }
  }

  if (token) {
      headers["Authorization"] = `Bearer ${token}`;
  } else if (isHassEnvironment) {
      console.error("❌ No token available in Hass environment");
      throw new Error("No authentication token available");
  }

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  });

  if (response.status === 401) {
      try {
          if (window.parent && window.parent.hassConnection) {
              const conn = await window.parent.hassConnection;
              if (conn && conn.auth) {
                  await conn.auth.refreshAccessToken();
                  token = conn.auth.accessToken;
                  if (token) {
                      headers["Authorization"] = `Bearer ${token}`;
                      response = await fetch(url, {
                          ...options,
                          headers,
                          credentials: "same-origin",
                      });
                  }
              }
          }
      } catch (e) {
          console.error("❌ Failed to refresh token:", e);
      }
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch (e) {}
    throw new Error(errorMessage);
  }

  return response.json();
}

// These functions will be defined in other modules but we need to trigger them here
// We'll use a registry pattern or global event bus if needed, but for now we'll 
// just import them when main.js ties everything together.
let updateCallbacks = {
    checkFileUpdates: null,
    loadFiles: null
};

export function registerUpdateCallbacks(callbacks) {
    updateCallbacks = { ...updateCallbacks, ...callbacks };
}

export async function initWebSocketSubscription(retries = 0) {
  try {
    if (window.parent && window.parent.hassConnection) {
      const result = await window.parent.hassConnection;
      const conn = result.conn || (typeof result.subscribeMessage === 'function' ? result : null);
      
      if (!conn || typeof conn.subscribeMessage !== 'function') {
          throw new Error("WebSocket connection not found");
      }

      // Try to subscribe
      try {
          await conn.subscribeMessage(
            (event) => {
              if (state._wsUpdateTimer) clearTimeout(state._wsUpdateTimer);
              state._wsUpdateTimer = setTimeout(() => {
                  if (updateCallbacks.checkFileUpdates) updateCallbacks.checkFileUpdates();
                  
                  if (event && ["create", "delete", "rename", "create_folder", "upload", "upload_folder"].includes(event.action)) {
                      if (updateCallbacks.loadFiles) updateCallbacks.loadFiles();
                  }
              }, 500);
            },
            { type: "code_mirror/subscribe_updates" }
          );
          console.log("CodeMirror: Real-time updates active");
      } catch (subError) {
          // If the integration is still loading, it might not know the command yet
          if (subError.code === 'unknown_command' && retries < 5) {
              console.warn(`CodeMirror: Backend not ready yet (retry ${retries + 1}/5)...`);
              setTimeout(() => initWebSocketSubscription(retries + 1), 2000);
              return;
          }
          throw subError;
      }
    }
  } catch (e) {
    console.error("CodeMirror: WebSocket subscription failed", e);
  }
}
