/**
 * ============================================================================
 * TOOLBAR MODULE
 * ============================================================================
 *
 * PURPOSE: Manages toolbar button states (enabled/disabled) based on context.
 * Updates buttons when editor state changes (file open, modified, can undo/redo).
 *
 * EXPORTED FUNCTIONS:
 * - updateToolbarState() - Update all toolbar button states
 *
 * HOW TO ADD FEATURES:
 * 1. Add new button: Add HTML, update state check in updateToolbarState()
 * 2. Add context-aware buttons: Check state and enable/disable accordingly
 *
 * INTEGRATION: state.js, elements, event-handlers.js
 * ============================================================================
 */
import { state, elements } from './state.js';

/**
 * Updates toolbar button states based on current editor state
 * Enables/disables save, undo, redo, and download buttons
 */
export function updateToolbarState() {
  const tab = state.activeTab;
  const hasEditor = !!state.editor && !!tab;
  const hasModified = state.openTabs.some((t) => t.modified);

  // Save current file
  if (elements.btnSave) {
    elements.btnSave.disabled = !tab || !tab.modified;
  }

  // Save all modified files
  if (elements.btnSaveAll) {
    elements.btnSaveAll.disabled = !hasModified;
  }

  // Undo/Redo
  if (elements.btnUndo) {
    elements.btnUndo.disabled = !hasEditor || !state.editor?.historySize().undo;
  }
  if (elements.btnRedo) {
    elements.btnRedo.disabled = !hasEditor || !state.editor?.historySize().redo;
  }

  // Download file - should be enabled when any file is open
  if (elements.btnDownload) {
    if (hasEditor) {
      elements.btnDownload.disabled = false;
      elements.btnDownload.removeAttribute('disabled');
    } else {
      elements.btnDownload.disabled = true;
      elements.btnDownload.setAttribute('disabled', 'disabled');
    }
  }
}
