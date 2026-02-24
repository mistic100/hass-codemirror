/**
 * ============================================================================
 * RESIZE MODULE
 * ============================================================================
 *
 * PURPOSE: Sidebar drag-to-resize functionality. Allows user to adjust
 * sidebar width by dragging the resize handle.
 *
 * EXPORTED FUNCTIONS:
 * - setupResizeHandle(saveCallback) - Initialize resize handle
 *
 * HOW TO ADD FEATURES:
 * 1. Add resize limits: Min/max sidebar width constraints
 * 2. Add double-click reset: Double-click to reset to default width
 * 3. Add resize for other panels: Apply to bottom panel, etc.
 *
 * INTEGRATION: settings.js (sidebarWidth), sidebar.js, state.js
 * ============================================================================
 */
import { state, elements } from './state.js';
import { isMobile } from './utils.js';

// Callback for saving settings
let saveSettingsCallback = null;

export function registerResizeCallbacks(callbacks) {
  saveSettingsCallback = callbacks.saveSettings;
}

/**
 * Initialize the sidebar resize handle
 * Sets up drag handlers for resizing the sidebar
 */
export function initResizeHandle() {
  if (!elements.resizeHandle || isMobile()) return;

  let isResizing = false;

  elements.resizeHandle.addEventListener("mousedown", (e) => {
    isResizing = true;
    elements.resizeHandle.classList.add("active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 500) {
      elements.sidebar.style.width = `${newWidth}px`;
    }
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      elements.resizeHandle.classList.remove("active");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      // Save sidebar width
      state.sidebarWidth = parseInt(elements.sidebar.style.width);
      if (saveSettingsCallback) {
        saveSettingsCallback();
      }

      // Refresh editor after resize
      if (state.editor) {
        state.editor.refresh();
      }
    }
  });
}
