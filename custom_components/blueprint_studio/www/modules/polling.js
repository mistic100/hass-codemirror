/**
 * ============================================================================
 * POLLING MODULE
 * ============================================================================
 *
 * PURPOSE: Background polling for git status and file changes.
 * Periodically checks server for updates without user action.
 *
 * EXPORTED FUNCTIONS:
 * - startPolling(callbacks) - Start background polling
 * - stopPolling() - Stop background polling
 * - setPollingInterval(ms) - Change polling frequency
 *
 * HOW TO ADD FEATURES:
 * 1. Add smart polling: Slow down when inactive, speed up when active
 * 2. Add selective polling: Only poll for specific features
 * 3. Add polling indicators: Show when polling is active
 *
 * INTEGRATION: git-operations.js, settings.js (pollingInterval)
 * ============================================================================
 */
import { state } from './state.js';
import { fetchWithAuth } from './api.js';
import { API_BASE } from './constants.js';
import { showToast } from './ui.js';

// Polling interval reference
export let gitStatusPollingInterval = null;
let pollCount = 0; // Track poll cycles for fetch timing

// Callbacks for cross-module functions
let callbacks = {
  openFile: null,
  gitStatus: null,
  giteaStatus: null
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

/**
 * Starts polling for git status and file updates
 * Polls every 10 seconds when window is focused (optimized)
 * Fetches from remote every 30 seconds (every 3rd poll) - Balanced mode
 */
export function startGitStatusPolling() {
  // Clear any existing interval
  if (gitStatusPollingInterval) {
    clearInterval(gitStatusPollingInterval);
  }

  // Reset poll count
  pollCount = 0;

  // Poll every 10 seconds (reduced from 5s for better performance)
  gitStatusPollingInterval = setInterval(async () => {
    // Only poll if window is focused
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return;

    pollCount++;
    // Fetch from remote every 3rd poll (30 seconds) - Balanced mode
    const shouldFetch = (pollCount % 3 === 0);

    try {
      checkFileUpdates(); // Check for external file changes

      // Poll GitHub if enabled
      if (state.gitIntegrationEnabled && callbacks.gitStatus) {
        await callbacks.gitStatus(shouldFetch, true); // silent = true
      }

      // Poll Gitea if enabled
      if (state.giteaIntegrationEnabled && callbacks.giteaStatus) {
        await callbacks.giteaStatus(shouldFetch, true); // silent = true
      }
    } catch (error) {
      // Silently fail
    }
  }, 10000); // 10 seconds (optimized from 5s)
}

/**
 * Stops git status polling
 */
export function stopGitStatusPolling() {
  if (gitStatusPollingInterval) {
    clearInterval(gitStatusPollingInterval);
    gitStatusPollingInterval = null;
  }
}
