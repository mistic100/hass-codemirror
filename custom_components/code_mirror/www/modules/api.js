/**
 * ============================================================================
 * API MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Provides the core API communication layer for CodeMirror. Handles
 * authenticated requests to the backend server.
 * This is the foundation for all server communication.
 *
 * EXPORTED FUNCTIONS:
 * - fetchWithAuth(url, options) - Make authenticated API request
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
 * ERROR HANDLING:
 * - Network errors: Thrown as exceptions
 * - HTTP errors (4xx, 5xx): Thrown as exceptions
 * - API errors: Returned in response.success = false
 * - Always use try/catch when calling fetchWithAuth
 *
 * ============================================================================
 */
import { state } from './state.js';
import { API_BASE } from './constants.js';

export async function urlWithToken(url) {
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

  if (!token) {
      console.error("❌ No token available in Hass environment");
      throw new Error("No authentication token available");
  }

  return `${url}&token=${token}`;
}

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

export async function serveFileUrl(path) {
  return await urlWithToken(
    `${API_BASE}?action=serve_file&path=${encodeURIComponent(path)}&_t=${Date.now()}`
  );
}
