/**
 * ============================================================================
 * SELECTION MODULE
 * ============================================================================
 *
 * PURPOSE: Multi-file/folder selection mode for bulk operations.
 * Allows selecting multiple items for download, delete, move, etc.
 *
 * EXPORTED FUNCTIONS:
 * - registerSelectionCallbacks(cb) - Register dependencies
 * - toggleSelectionMode() - Enter/exit selection mode
 * - toggleItemSelection(path) - Select/deselect item
 * - selectAllItems() - Select all visible items
 * - clearSelection() - Deselect all items
 * - deleteSelectedItems() - Delete all selected items
 *
 * HOW TO ADD FEATURES:
 * 1. Add bulk operations: Move, copy, compress selected items
 * 2. Add selection filters: Select by type, date, size
 * 3. Add keyboard selection: Shift-click for range selection
 *
 * INTEGRATION: file-tree.js, file-operations.js, ui.js
 * ============================================================================
 */
import { state, elements } from './state.js';
import { fetchWithAuth } from './api.js';
import { API_BASE } from './constants.js';
import { showGlobalLoading, hideGlobalLoading, showToast, showConfirmDialog } from './ui.js';

// Callbacks for cross-module functions
let callbacks = {
  renderFileTree: null,
  loadFiles: null
};

export function registerSelectionCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Toggle selection mode on/off
 */
export function toggleSelectionMode() {
  state.selectionMode = !state.selectionMode;
  if (!state.selectionMode) {
    state.selectedItems.clear();
  }

  // Update toolbar visibility
  if (elements.selectionToolbar) {
    elements.selectionToolbar.style.display = state.selectionMode ? "flex" : "none";
  }

  // Update button active state
  if (elements.btnToggleSelect) {
    elements.btnToggleSelect.classList.toggle("active", state.selectionMode);
  }

  updateSelectionCount();
  if (callbacks.renderFileTree) callbacks.renderFileTree();
}

/**
 * Handle selection change for a file/folder
 */
export function handleSelectionChange(path, isSelected) {
  if (isSelected) {
    state.selectedItems.add(path);
  } else {
    state.selectedItems.delete(path);
  }
  updateSelectionCount();
}

/**
 * Update the selection count display and button states
 */
export function updateSelectionCount() {
  if (elements.selectionCount) {
    const count = state.selectedItems.size;
    elements.selectionCount.textContent = `${count} selected`;

    if (elements.btnDownloadSelected) {
      elements.btnDownloadSelected.disabled = count === 0;
    }
    if (elements.btnDeleteSelected) {
      elements.btnDeleteSelected.disabled = count === 0;
    }
  }
}

/**
 * Delete all selected items
 */
export async function deleteSelectedItems() {
  if (state.selectedItems.size === 0) return;

  const paths = Array.from(state.selectedItems);

  const confirmed = await showConfirmDialog({
    title: "Delete Selected Items?",
    message: `Are you sure you want to permanently delete <b>${paths.length} items</b>? This action cannot be undone.`,
    confirmText: "Delete All",
    cancelText: "Cancel",
    isDanger: true
  });

  if (confirmed) {
    try {
      showGlobalLoading(`Deleting ${paths.length} items...`);

      await fetchWithAuth(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_multi", paths }),
      });

      hideGlobalLoading();
      showToast(`Deleted ${paths.length} items`, "success");

      // Exit selection mode and refresh
      toggleSelectionMode();
      if (callbacks.loadFiles) await callbacks.loadFiles();
    } catch (error) {
      hideGlobalLoading();
      showToast("Failed to delete items: " + error.message, "error");
    }
  }
}
