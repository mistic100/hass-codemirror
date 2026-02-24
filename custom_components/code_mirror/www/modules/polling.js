/**
 * ============================================================================
 * POLLING MODULE
 * ============================================================================
 *
 * PURPOSE: Background polling for file changes.
 * Periodically checks server for updates without user action.
 *
 * HOW TO ADD FEATURES:
 * 1. Add smart polling: Slow down when inactive, speed up when active
 * 2. Add selective polling: Only poll for specific features
 * 3. Add polling indicators: Show when polling is active
 * ============================================================================
 */
import { state } from './state.js';
import { fetchWithAuth } from './api.js';
import { API_BASE } from './constants.js';
import { showToast } from './ui.js';

// Callbacks for cross-module functions
let callbacks = {
  openFile: null
};

export function registerPollingCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Checks if the active file has been modified externally
 * Auto-reloads the file if it hasn't been modified locally
 */
export async function checkFileUpdates() {
  // Only check if window is focused to save resources
  if (document.visibilityState !== 'visible' || !document.hasFocus()) return;

  if (!state.activeTab || !state.activeTab.path) return;

  // Skip polling for virtual paths
  if (state.activeTab.path.includes("://")) return;

  try {
    const response = await fetchWithAuth(`${API_BASE}?action=get_file_stat&path=${encodeURIComponent(state.activeTab.path)}&_t=${Date.now()}`);
    if (response.success && response.mtime) {
      // Initialize mtime if missing (first run or legacy tab)
      if (!state.activeTab.mtime) {
        state.activeTab.mtime = response.mtime;
        return;
      }

      // If we have a stored mtime and the new one is different
      if (state.activeTab.mtime !== response.mtime) {
        // If user hasn't modified, auto-reload
        if (!state.activeTab.modified) {
          showToast(`File updated externally: ${state.activeTab.path.split('/').pop()}`, "info");
          // We update mtime in openFile(..., true)
          if (callbacks.openFile) {
            callbacks.openFile(state.activeTab.path, true);
          }
        }
      }
    }
  } catch (e) {
    // Silent fail
  }
}
