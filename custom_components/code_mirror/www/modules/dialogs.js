/**
 * ============================================================================
 * DIALOGS MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Specialized dialog utilities for issue reporting, feature requests, and
 * help dialogs (shortcuts, about). Provides user feedback and help mechanisms.
 *
 * EXPORTED FUNCTIONS:
 * - showShortcuts() - Show keyboard shortcuts dialog
 * - hideShortcuts() - Hide shortcuts dialog
 *
 * HOW TO ADD NEW FEATURES:
 * 1. Add new dialog: Create show/hide functions, add HTML, handle keyboard
 * 2. Add feedback type: Use fetchWithAuth() to server, validate, show toast
 * 3. Update shortcuts: Add to showShortcuts() grouped by category
 *
 * INTEGRATION: event-handlers.js, api.js, ui.js
 * COMMON PATTERNS: showShortcuts()
 *
 * ============================================================================
 */
import { elements } from './state.js';

/**
 * Shows keyboard shortcuts overlay
 */
export function showShortcuts() {
  if (elements.shortcutsOverlay) {
    elements.shortcutsOverlay.classList.add("visible");
  }
}

/**
 * Hides keyboard shortcuts overlay
 */
export function hideShortcuts() {
  if (elements.shortcutsOverlay) {
    elements.shortcutsOverlay.classList.remove("visible");
  }
}
