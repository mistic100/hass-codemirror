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

  // Update menu items visibility based on split view state
  const moveToLeft = document.getElementById('tab-menu-move-to-left');
  const moveToRight = document.getElementById('tab-menu-move-to-right');
  const openRight = document.getElementById('tab-menu-open-right');
  const openBelow = document.getElementById('tab-menu-open-below');
  const splitDivider = document.getElementById('tab-menu-split-divider');

  // Check if split view feature is enabled in settings
  if (!state.enableSplitView) {
    // Feature is disabled - hide all split view options
    if (moveToLeft) moveToLeft.style.display = 'none';
    if (moveToRight) moveToRight.style.display = 'none';
    if (openRight) openRight.style.display = 'none';
    if (openBelow) openBelow.style.display = 'none';
    if (splitDivider) splitDivider.style.display = 'none';
  } else if (state.splitView && state.splitView.enabled) {
    // Split view is enabled - show move options based on current pane
    const pane = state.splitView.primaryTabs.includes(tabIndex) ? 'primary' :
                 state.splitView.secondaryTabs.includes(tabIndex) ? 'secondary' : null;

    if (pane === 'primary') {
      // In left/top pane - show "Move to Right/Bottom"
      if (moveToLeft) moveToLeft.style.display = 'none';
      if (moveToRight) {
        moveToRight.style.display = 'flex';
        moveToRight.querySelector('.material-icons').textContent =
          state.splitView.orientation === 'vertical' ? 'arrow_forward' : 'arrow_downward';
        moveToRight.innerHTML = `
          <span class="material-icons">${state.splitView.orientation === 'vertical' ? 'arrow_forward' : 'arrow_downward'}</span>
          Move to ${state.splitView.orientation === 'vertical' ? 'Right' : 'Bottom'} Pane
        `;
      }
      if (splitDivider) splitDivider.style.display = 'block';
    } else if (pane === 'secondary') {
      // In right/bottom pane - show "Move to Left/Top"
      if (moveToRight) moveToRight.style.display = 'none';
      if (moveToLeft) {
        moveToLeft.style.display = 'flex';
        moveToLeft.querySelector('.material-icons').textContent =
          state.splitView.orientation === 'vertical' ? 'arrow_back' : 'arrow_upward';
        moveToLeft.innerHTML = `
          <span class="material-icons">${state.splitView.orientation === 'vertical' ? 'arrow_back' : 'arrow_upward'}</span>
          Move to ${state.splitView.orientation === 'vertical' ? 'Left' : 'Top'} Pane
        `;
      }
      if (splitDivider) splitDivider.style.display = 'block';
    }
    // Hide "open" options when split is already enabled
    if (openRight) openRight.style.display = 'none';
    if (openBelow) openBelow.style.display = 'none';
  } else {
    // Split view is disabled - show "Open to Right/Below" options
    if (moveToLeft) moveToLeft.style.display = 'none';
    if (moveToRight) moveToRight.style.display = 'none';
    if (openRight) openRight.style.display = 'flex';
    if (openBelow) openBelow.style.display = 'flex';
    if (splitDivider) splitDivider.style.display = 'block';
  }

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
