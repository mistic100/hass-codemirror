/**
 * ============================================================================
 * TABS MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Handles tab bar rendering, tab navigation, and tab-related UI operations.
 * Manages the visual representation of open files and tab interactions.
 *
 * EXPORTED FUNCTIONS:
 * - registerTabsCallbacks(cb) - Register dependencies from app.js
 * - renderTabs() - Render the tab bar with all open tabs
 * - closeAllTabs() - Close all open tabs
 * - closeOtherTabs(tab) - Close all tabs except the specified one
 * - closeTabsToRight(tab) - Close all tabs to the right of specified tab
 * - nextTab() - Switch to next tab
 * - previousTab() - Switch to previous tab
 *
 * REQUIRED CALLBACKS (from app.js):
 * - activateTab: Switch to a specific tab
 * - closeTab: Close a specific tab
 * - renderFileTree: Refresh file tree (to update active file highlight)
 * - showTabContextMenu: Show context menu for tab right-click
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new tab display element:
 *    - Modify renderTabs() function
 *    - Add new HTML element to tab HTML structure
 *    - Access tab properties: tab.path, tab.name, tab.modified, etc.
 *    - Update CSS if needed
 *
 * 2. Adding a new tab operation:
 *    - Create new exported function
 *    - Operate on state.openTabs array
 *    - Call callbacks.activateTab() or callbacks.closeTab() as needed
 *    - Call renderTabs() to update UI
 *    - Export function and add to app.js
 *
 * 3. Adding tab indicators (icons, badges, etc.):
 *    - Modify renderTabs() tab HTML
 *    - Add conditional rendering based on tab state
 *    - Examples: modified dot, read-only badge
 *
 * 4. Adding tab context menu items:
 *    - Add to showTabContextMenu in context-menu.js
 *    - Call tab operation functions from menu handlers
 *
 * INTEGRATION POINTS:
 * - state.js: state.openTabs (array), state.activeTab (object)
 * - elements: elements.tabs (tab bar container)
 * - utils.js: getFileIcon() for file type icons
 * - app.js: Provides all tab operation callbacks
 * - context-menu.js: Tab right-click menu
 *
 * STATE MANAGEMENT:
 * - state.openTabs: Array of tab objects
 *   - Each tab: { path, name, content, modified, cursor, scroll, ... }
 * - state.activeTab: Reference to currently active tab object
 * - Tab position is based on index in openTabs array
 *
 * ARCHITECTURE NOTES:
 * - This module only handles tab UI rendering
 * - Actual tab operations (open, close, activate) are in app.js
 * - Tab content management is in editor.js
 * - Tab state is persisted in settings.js
 * - Tabs can be dragged (future feature - hook in renderTabs)
 *
 * COMMON PATTERNS:
 * - Check if tab exists: const tabIndex = state.openTabs.indexOf(tab);
 * - Activate tab: await callbacks.activateTab(tab);
 * - Close tab: await callbacks.closeTab(tab);
 * - Update UI: renderTabs(); callbacks.renderFileTree();
 * - Active tab styling: tab === state.activeTab ? 'active' : ''
 *
 * TAB DISPLAY:
 * - Shows file icon, file name, modified indicator (•)
 * - Active tab is highlighted
 * - Close button (×) on hover
 * - Right-click opens context menu
 * - Middle-click closes tab (handled in event-handlers.js)
 *
 * ============================================================================
 */
import { state, elements } from './state.js';
import { getFileIcon } from './utils.js';

// Callbacks for cross-module functions
let callbacks = {
  activateTab: null,
  closeTab: null,
  renderFileTree: null,
  showTabContextMenu: null
};

export function registerTabsCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Renders the tab bar UI
 * Shows tabs separately for each pane when split view is enabled
 * Optimized with DocumentFragment for better performance
 */
export function renderTabs() {
  const primaryContainer = document.getElementById('primary-tabs-container');
  const secondaryContainer = document.getElementById('secondary-tabs-container');

  if (!primaryContainer) return;

  // Clear both containers
  primaryContainer.innerHTML = "";
  if (secondaryContainer) {
    secondaryContainer.innerHTML = "";
  }

  if (state.splitView && state.splitView.enabled) {
    // Split view mode - render tabs separately for each pane

    // Use DocumentFragment for batch DOM insertion (performance optimization)
    const primaryFragment = document.createDocumentFragment();
    const secondaryFragment = document.createDocumentFragment();

    // Render primary pane tabs
    state.splitView.primaryTabs.forEach((tabIndex) => {
      if (tabIndex >= 0 && tabIndex < state.openTabs.length) {
        const tab = state.openTabs[tabIndex];
        const isActive = tab === state.splitView.primaryActiveTab;
        const tabEl = createTabElement(tab, tabIndex, isActive, 'primary');
        primaryFragment.appendChild(tabEl);
      }
    });
    primaryContainer.appendChild(primaryFragment); // Single DOM operation

    // Render secondary pane tabs
    if (secondaryContainer) {
      state.splitView.secondaryTabs.forEach((tabIndex) => {
        if (tabIndex >= 0 && tabIndex < state.openTabs.length) {
          const tab = state.openTabs[tabIndex];
          const isActive = tab === state.splitView.secondaryActiveTab;
          const tabEl = createTabElement(tab, tabIndex, isActive, 'secondary');
          secondaryFragment.appendChild(tabEl);
        }
      });
      secondaryContainer.appendChild(secondaryFragment); // Single DOM operation
    }
  } else {
    // Normal single pane mode - render all tabs in primary container
    // Use DocumentFragment for batch DOM insertion (performance optimization)
    const fragment = document.createDocumentFragment();
    state.openTabs.forEach((tab, tabIndex) => {
      const isActive = tab === state.activeTab;
      const tabEl = createTabElement(tab, tabIndex, isActive, null);
      fragment.appendChild(tabEl);
    });
    primaryContainer.appendChild(fragment); // Single DOM operation instead of N operations
  }
}

/**
 * Creates a tab element
 */
function createTabElement(tab, tabIndex, isActive, pane) {
  const tabEl = document.createElement("div");
  tabEl.className = `tab ${isActive ? "active" : ""}`;
  tabEl.setAttribute('data-tab-index', tabIndex);
  tabEl.setAttribute('draggable', 'true');

  if (pane) {
    tabEl.setAttribute('data-pane', pane);
  }

  const icon = getFileIcon(tab.path);
  
  const fileName = tab.path.split("/").pop();

  tabEl.innerHTML = `
    <span class="tab-icon material-icons" style="color: var(--icon-${icon.class})">${icon.icon}</span>
    <span class="tab-name">${fileName}</span>
    ${tab.modified ? '<div class="tab-modified"></div>' : ""}
    <div class="tab-close"><span class="material-icons">close</span></div>
  `;

  tabEl.addEventListener("click", (e) => {
    if (!e.target.closest(".tab-close")) {
      // Set active pane if split view is enabled
      if (state.splitView && state.splitView.enabled && pane && callbacks.setActivePaneFromPosition) {
        callbacks.setActivePaneFromPosition(pane);
      }
      if (callbacks.activateTab) callbacks.activateTab(tab);
      renderTabs();
      if (callbacks.renderFileTree) callbacks.renderFileTree();
    }
  });

  // Drag-drop handlers
  if (callbacks.handleTabDragStart) {
    tabEl.addEventListener('dragstart', callbacks.handleTabDragStart);
  }
  if (callbacks.handleTabDragOver) {
    tabEl.addEventListener('dragover', callbacks.handleTabDragOver);
  }
  if (callbacks.handleTabDrop) {
    tabEl.addEventListener('drop', callbacks.handleTabDrop);
  }
  if (callbacks.handleTabDragEnd) {
    tabEl.addEventListener('dragend', callbacks.handleTabDragEnd);
  }

  tabEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (callbacks.showTabContextMenu) {
      callbacks.showTabContextMenu(e.clientX, e.clientY, tab, tabIndex);
    }
  });

  const closeBtn = tabEl.querySelector(".tab-close");
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (callbacks.closeTab) callbacks.closeTab(tab);
  });

  return tabEl;
}

/**
 * Finds a tab by path
 */
export function findTabByPath(path) {
  return state.openTabs.find((t) => t.path === path);
}

/**
 * Gets the index of a tab
 */
export function getTabIndex(tab) {
  return state.openTabs.indexOf(tab);
}

/**
 * Gets the next tab after closing current one
 */
export function getNextTab(closingTab) {
  const index = getTabIndex(closingTab);
  if (state.openTabs.length > 1) {
    const newIndex = Math.min(index, state.openTabs.length - 2); // -2 because we're about to remove one
    return state.openTabs[newIndex === index ? newIndex + 1 : newIndex];
  }
  return null;
}

/**
 * Checks if any tabs have unsaved changes
 */
export function hasUnsavedTabs() {
  return state.openTabs.some(tab => tab.modified);
}

/**
 * Gets all modified tabs
 */
export function getModifiedTabs() {
  return state.openTabs.filter(tab => tab.modified);
}

/**
 * Closes all tabs
 */
export async function closeAllTabs(force = false) {
  if (!force && hasUnsavedTabs()) {
    const modifiedCount = getModifiedTabs().length;
    if (!confirm(`${modifiedCount} tab(s) have unsaved changes. Close all anyway?`)) {
      return false;
    }
  }

  // Revoke all blob URLs
  state.openTabs.forEach(tab => {
    if (tab._blobUrl) {
      URL.revokeObjectURL(tab._blobUrl);
    }
  });

  state.openTabs = [];
  state.activeTab = null;

  // Clear editor and show welcome screen
  if (state.editor) {
    state.editor.setValue("");
    // Hide the editor wrapper to show welcome screen
    state.editor.getWrapperElement().style.display = "none";
  }
  if (elements.welcomeScreen) {
    elements.welcomeScreen.style.display = "flex";
  }
  if (elements.assetPreview) {
    elements.assetPreview.classList.remove("visible");
    elements.assetPreview.innerHTML = "";
  }
  if (elements.filePath) {
    elements.filePath.textContent = "";
  }
  if (elements.breadcrumb) {
    elements.breadcrumb.innerHTML = "";
  }

  renderTabs();
  if (callbacks.renderFileTree) callbacks.renderFileTree();

  return true;
}

/**
 * Closes tabs other than the specified tab
 */
export async function closeOtherTabs(keepTab, force = false) {
  const otherTabs = state.openTabs.filter(t => t !== keepTab);
  const modifiedOthers = otherTabs.filter(t => t.modified);

  if (!force && modifiedOthers.length > 0) {
    if (!confirm(`${modifiedOthers.length} other tab(s) have unsaved changes. Close them anyway?`)) {
      return false;
    }
  }

  // Revoke blob URLs for tabs being closed
  otherTabs.forEach(tab => {
    if (tab._blobUrl) {
      URL.revokeObjectURL(tab._blobUrl);
    }
  });

  state.openTabs = [keepTab];

  if (state.activeTab !== keepTab) {
    if (callbacks.activateTab) callbacks.activateTab(keepTab);
  }

  renderTabs();
  if (callbacks.renderFileTree) callbacks.renderFileTree();

  return true;
}

/**
 * Closes tabs to the right of the specified tab
 */
export async function closeTabsToRight(tab, force = false) {
  const index = getTabIndex(tab);
  if (index === -1 || index === state.openTabs.length - 1) return true;

  const tabsToClose = state.openTabs.slice(index + 1);
  const modifiedTabs = tabsToClose.filter(t => t.modified);

  if (!force && modifiedTabs.length > 0) {
    if (!confirm(`${modifiedTabs.length} tab(s) to the right have unsaved changes. Close them anyway?`)) {
      return false;
    }
  }

  // Revoke blob URLs
  tabsToClose.forEach(t => {
    if (t._blobUrl) {
      URL.revokeObjectURL(t._blobUrl);
    }
  });

  state.openTabs = state.openTabs.slice(0, index + 1);

  // If active tab was closed, activate the last remaining tab
  if (!state.openTabs.includes(state.activeTab)) {
    if (callbacks.activateTab) callbacks.activateTab(state.openTabs[state.openTabs.length - 1]);
  }

  renderTabs();
  if (callbacks.renderFileTree) callbacks.renderFileTree();

  return true;
}

/**
 * Moves to next tab (with split view support)
 */
export function nextTab() {
  if (state.openTabs.length === 0) return;

  // Get available tabs based on split view state
  let availableTabs;
  if (state.splitView && state.splitView.enabled) {
    const activePane = state.splitView.activePane;
    const tabIndices = activePane === 'primary'
      ? state.splitView.primaryTabs
      : state.splitView.secondaryTabs;
    availableTabs = tabIndices.map(idx => state.openTabs[idx]).filter(t => t);
  } else {
    availableTabs = state.openTabs;
  }

  if (availableTabs.length <= 1) return; // No other tab to switch to

  const currentIndex = availableTabs.indexOf(state.activeTab);
  if (currentIndex === -1) {
    // Active tab not in available tabs, activate first available
    if (callbacks.activateTab) callbacks.activateTab(availableTabs[0]);
  } else {
    // Move to next tab (wrap around)
    const nextIndex = (currentIndex + 1) % availableTabs.length;
    if (callbacks.activateTab) callbacks.activateTab(availableTabs[nextIndex]);
  }

  renderTabs();
  if (callbacks.renderFileTree) callbacks.renderFileTree();
}

/**
 * Moves to previous tab (with split view support)
 */
export function previousTab() {
  if (state.openTabs.length === 0) return;

  // Get available tabs based on split view state
  let availableTabs;
  if (state.splitView && state.splitView.enabled) {
    const activePane = state.splitView.activePane;
    const tabIndices = activePane === 'primary'
      ? state.splitView.primaryTabs
      : state.splitView.secondaryTabs;
    availableTabs = tabIndices.map(idx => state.openTabs[idx]).filter(t => t);
  } else {
    availableTabs = state.openTabs;
  }

  if (availableTabs.length <= 1) return; // No other tab to switch to

  const currentIndex = availableTabs.indexOf(state.activeTab);
  if (currentIndex === -1) {
    // Active tab not in available tabs, activate last available
    if (callbacks.activateTab) callbacks.activateTab(availableTabs[availableTabs.length - 1]);
  } else {
    // Move to previous tab (wrap around)
    const prevIndex = (currentIndex - 1 + availableTabs.length) % availableTabs.length;
    if (callbacks.activateTab) callbacks.activateTab(availableTabs[prevIndex]);
  }

  renderTabs();
  if (callbacks.renderFileTree) callbacks.renderFileTree();
}
