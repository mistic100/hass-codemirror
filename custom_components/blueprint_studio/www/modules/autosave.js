/**
 * ============================================================================
 * AUTOSAVE MODULE
 * ============================================================================
 *
 * PURPOSE: Automatic saving of modified files after configurable delay.
 * Prevents data loss from browser crashes or accidental tab closure.
 *
 * EXPORTED FUNCTIONS:
 * - setupAutoSave(saveCallback) - Initialize autosave with callback
 * - triggerAutoSave() - Trigger autosave (debounced)
 * - cancelAutoSave() - Cancel pending autosave
 *
 * HOW TO ADD FEATURES:
 * 1. Add save indicators: Show "Saving..." / "Saved" status
 * 2. Add save conflicts: Detect external file modifications
 * 3. Add save history: Keep autosave snapshots
 *
 * INTEGRATION: settings.js (autoSave, autoSaveDelay), editor.js
 * ============================================================================
 */
import { state, elements } from './state.js';
import { showToast } from './ui.js';

// Auto-save timer reference
export let autoSaveTimer = null;

// Callbacks for cross-module functions
let callbacks = {
  saveFile: null,
  saveCurrentFile: null,
  renderTabs: null,
  renderFileTree: null,
  updateToolbarState: null,
  setButtonLoading: null
};

export function registerAutoSaveCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Triggers auto-save for the current file
 * Called from handleEditorChange when content changes
 */
export function triggerAutoSave() {
  if (state.autoSave && state.activeTab && state.activeTab.modified) {
    // Clear existing timer
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    // Set new timer
    autoSaveTimer = setTimeout(() => {
      // Double-check state before saving
      if (state.autoSave && state.activeTab && state.activeTab.modified) {
        if (callbacks.saveCurrentFile) {
          callbacks.saveCurrentFile(true); // true = isAutoSave
        }
      }
    }, state.autoSaveDelay);
  } else if (autoSaveTimer) {
    // If auto-save disabled OR not modified, clear any pending timer
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

/**
 * Clears the auto-save timer
 */
export function clearAutoSaveTimer() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

/**
 * Saves all modified files
 */
export async function saveAllFiles() {
  const modifiedTabs = state.openTabs.filter((t) => t.modified);

  if (callbacks.setButtonLoading && elements.btnSaveAll) {
    callbacks.setButtonLoading(elements.btnSaveAll, true);
  }

  for (const tab of modifiedTabs) {
    if (callbacks.saveFile) {
      const success = await callbacks.saveFile(tab.path, tab.content);
      if (success) {
        tab.originalContent = tab.content;
        tab.modified = false;
      }
    }
  }

  if (callbacks.setButtonLoading && elements.btnSaveAll) {
    callbacks.setButtonLoading(elements.btnSaveAll, false);
  }

  if (callbacks.renderTabs) callbacks.renderTabs();
  if (callbacks.renderFileTree) callbacks.renderFileTree();
  if (callbacks.updateToolbarState) callbacks.updateToolbarState();

  showToast(`Saved ${modifiedTabs.length} file(s)`, "success");
}
