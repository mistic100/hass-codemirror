/**
 * ============================================================================
 * CONTEXT MENU MODULE
 * ============================================================================
 *
 * PURPOSE: Right-click context menus for files, folders, and tabs.
 * Provides contextual actions based on what was clicked.
 *
 * EXPORTED FUNCTIONS:
 * - showContextMenu(x, y, item, type) - Show context menu at position
 * - showTabContextMenu(x, y, tab) - Show tab context menu
 * - hideContextMenu() - Hide context menu
 *
 * HOW TO ADD FEATURES:
 * 1. Add menu item: Add to menu HTML, add click handler
 * 2. Add context type: Check item type and show relevant actions
 *
 * INTEGRATION: file-tree.js, tabs.js, event-handlers.js
 * ============================================================================
 */
import { state, elements } from './state.js';

/**
 * Shows context menu for files/folders at specified position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} target - Target file/folder object
 */
export function showContextMenu(x, y, target) {
  state.contextMenuTarget = target;

  const menu = elements.contextMenu;
  menu.classList.add("visible");

  // Position menu
  const menuRect = menu.getBoundingClientRect();
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;

  let posX = x;
  let posY = y;

  if (x + menuRect.width > viewWidth) {
    posX = viewWidth - menuRect.width - 10;
  }
  if (y + menuRect.height > viewHeight) {
    posY = viewHeight - menuRect.height - 10;
  }

  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;
}

/**
 * Shows context menu for tabs at specified position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} tab - Target tab object
 * @param {number} tabIndex - Index of the tab in openTabs array
 */
export function showTabContextMenu(x, y, tab, tabIndex) {
  state.tabContextMenuTarget = tab;
  state.tabContextMenuTargetIndex = tabIndex;
  const menu = elements.tabContextMenu;
  if (!menu) return;

  menu.classList.add("visible");

  // Position menu
  const menuRect = menu.getBoundingClientRect();
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;

  let posX = x;
  let posY = y;

  if (x + menuRect.width > viewWidth) {
    posX = viewWidth - menuRect.width - 10;
  }
  if (y + menuRect.height > viewHeight) {
    posY = viewHeight - menuRect.height - 10;
  }

  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;
}

/**
 * Hides all context menus
 */
export function hideContextMenu() {
  elements.contextMenu.classList.remove("visible");
  if (elements.tabContextMenu) elements.tabContextMenu.classList.remove("visible");
  state.contextMenuTarget = null;
  state.tabContextMenuTarget = null;
}
