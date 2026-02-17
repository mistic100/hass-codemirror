/**
 * ============================================================================
 * SPLIT VIEW MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Manages VS Code-style split view functionality for Blueprint Studio.
 * Handles dual pane editing, pane management, tab distribution, and
 * coordinating multiple CodeMirror instances.
 *
 * EXPORTED FUNCTIONS:
 * - registerSplitViewCallbacks(cb) - Register dependencies from app.js
 * - enableSplitView() - Enable split view (vertical layout only)
 * - disableSplitView() - Close split view, return to single pane
 * - setActivePaneFromPosition(pane) - Set active pane ('primary' or 'secondary')
 * - moveToPrimaryPane(tabIndex) - Move tab to primary pane
 * - moveToSecondaryPane(tabIndex) - Move tab to secondary pane
 * - getPaneForTab(tabIndex) - Get which pane a tab is in
 * - getActivePaneEditor() - Get the active pane's editor instance
 * - updatePaneSizes(primaryPercent) - Resize panes
 * - initSplitResize() - Initialize resize handle functionality
 * - handleTabDragStart(e) - Handle tab drag start
 * - handleTabDragOver(e) - Handle tab drag over
 * - handleTabDrop(e) - Handle tab drop
 * - handleTabDragEnd(e) - Handle tab drag end
 * - updatePaneActiveState() - Update visual active state of panes
 *
 * REQUIRED CALLBACKS (from app.js):
 * - createEditor: Create CodeMirror instance
 * - createSecondaryEditor: Create secondary editor
 * - destroySecondaryEditor: Destroy secondary editor
 * - activateTab: Activate a tab
 * - renderTabs: Re-render tab bar
 * - saveSettings: Save workspace settings
 *
 * HOW IT WORKS:
 * 1. Split view creates two panes: primary (left) and secondary (right)
 * 2. Each pane has its own CodeMirror editor instance
 * 3. Tabs are assigned to panes via primaryTabs and secondaryTabs arrays (tab indices)
 * 4. state.editor always points to the active pane's editor for compatibility
 * 5. Both editors share the same configuration and features
 *
 * ARCHITECTURE NOTES:
 * - Primary pane is always visible (left side)
 * - Secondary pane can be shown/hidden (right side)
 * - Vertical layout only (side-by-side)
 * - Tabs can be moved between panes via drag-drop or context menu
 * - Same file can be open in both panes simultaneously
 * - Each pane has its own active tab
 * - Resize handle allows adjusting pane sizes (20-80% range)
 *
 * ============================================================================
 */
import { state, elements } from './state.js';
import { rafThrottle } from './utils.js';

// Callbacks for cross-module functions
let callbacks = {
  createEditor: null,
  createSecondaryEditor: null,
  destroySecondaryEditor: null,
  activateTab: null,
  renderTabs: null,
  saveSettings: null,
  renderFileTree: null,
};

export function registerSplitViewCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

// Drag-and-drop state
let draggedTabIndex = null;

/**
 * Enables split view (vertical layout only)
 * @param {string} orientation - Always 'vertical' (kept for backwards compatibility)
 * @param {boolean} skipInitialization - If true, don't initialize tab distribution (for restoring from saved state)
 */
export function enableSplitView(orientation = 'vertical', skipInitialization = false) {
  if (state.splitView.enabled) {
    return; // Already enabled
  }

  state.splitView.enabled = true;
  state.splitView.orientation = 'vertical'; // Always vertical
  state.splitView.activePane = 'primary';

  // Update DOM
  const splitContainer = document.getElementById('split-container');
  const secondaryPane = document.getElementById('secondary-pane');
  const resizeHandle = document.getElementById('split-resize-handle');

  console.log('[ENABLE SPLIT] DOM elements:', {
    splitContainer: !!splitContainer,
    secondaryPane: !!secondaryPane,
    resizeHandle: !!resizeHandle,
    skipInitialization
  });

  if (splitContainer) {
    splitContainer.className = 'split-container'; // No orientation class needed
  }

  if (secondaryPane) {
    secondaryPane.style.display = 'flex';
    console.log('[ENABLE SPLIT] Set secondary pane display to flex');
  }

  if (resizeHandle) {
    resizeHandle.style.display = 'block';
  }

  // Create secondary editor if it doesn't exist
  if (!state.secondaryEditor && callbacks.createSecondaryEditor) {
    console.log('[ENABLE SPLIT] Creating secondary editor');
    callbacks.createSecondaryEditor();
    console.log('[ENABLE SPLIT] Secondary editor created:', !!state.secondaryEditor);
  } else {
    console.log('[ENABLE SPLIT] Secondary editor already exists:', !!state.secondaryEditor);
  }

  // Initialize tab distribution only if not restoring from saved state
  if (!skipInitialization && state.openTabs.length > 0) {
    state.splitView.primaryTabs = [0]; // First tab in primary
    if (state.activeTab) {
      const activeIndex = state.openTabs.indexOf(state.activeTab);
      state.splitView.primaryTabs = [activeIndex];
    }

    // Put same file in secondary pane or next file if available
    const secondaryIndex = state.openTabs.length > 1 ?
      (state.splitView.primaryTabs[0] + 1) % state.openTabs.length :
      state.splitView.primaryTabs[0];
    state.splitView.secondaryTabs = [secondaryIndex];

    state.splitView.primaryActiveTab = state.openTabs[state.splitView.primaryTabs[0]];
    state.splitView.secondaryActiveTab = state.openTabs[state.splitView.secondaryTabs[0]];
  }

  // Update pane sizes
  updatePaneSizes(state.splitView.primaryPaneSize);

  // Initialize resize handle
  initSplitResize();

  // Update UI
  updatePaneActiveState();
  if (callbacks.renderTabs) callbacks.renderTabs();

  // Load content in secondary editor - use activateTab for proper initialization
  if (state.secondaryEditor && state.splitView.secondaryActiveTab) {
    const tab = state.splitView.secondaryActiveTab;

    // Set the active pane to secondary temporarily to load content
    const previousActivePane = state.splitView.activePane;
    state.splitView.activePane = 'secondary';
    state.editor = state.secondaryEditor;

    // Load content with proper mode and settings
    const ext = tab.path.split('.').pop().toLowerCase();
    const modeMap = {
      'yaml': 'ha-yaml',
      'yml': 'ha-yaml',
      'js': 'javascript',
      'json': 'application/json',
      'py': 'python',
      'html': 'htmlmixed',
      'css': 'css',
      'xml': 'xml',
      'md': 'markdown',
    };
    const mode = modeMap[ext] || null;

    if (mode) {
      state.secondaryEditor.setOption('mode', mode);
    }

    // Set content
    state.secondaryEditor.setValue(tab.content || tab.originalContent || "");

    // Restore cursor and scroll if available
    if (tab.cursor) {
      state.secondaryEditor.setCursor(tab.cursor);
    }
    if (tab.scroll) {
      state.secondaryEditor.scrollTo(tab.scroll.left, tab.scroll.top);
    }

    state.secondaryEditor.refresh();

    // Restore active pane to primary
    state.splitView.activePane = previousActivePane;
    state.editor = state.primaryEditor;
  }

  // Save state
  if (callbacks.saveSettings) {
    callbacks.saveSettings();
  }
}

/**
 * Disables split view and returns to single pane
 */
export function disableSplitView() {
  if (!state.splitView.enabled) return;

  // Save secondary editor state before destroying
  if (state.splitView.secondaryActiveTab && state.secondaryEditor) {
    const tab = state.splitView.secondaryActiveTab;
    tab.cursor = state.secondaryEditor.getCursor();
    tab.scroll = state.secondaryEditor.getScrollInfo();
    const content = state.secondaryEditor.getValue();
    if (content !== tab.originalContent) {
      tab.content = content;
      tab.modified = true;
    }
  }

  // Clear all split view state
  state.splitView.enabled = false;
  state.splitView.activePane = 'primary';
  state.splitView.primaryTabs = [];
  state.splitView.secondaryTabs = [];
  state.splitView.primaryActiveTab = null;
  state.splitView.secondaryActiveTab = null;

  // Update DOM
  const primaryPane = document.getElementById('primary-pane');
  const secondaryPane = document.getElementById('secondary-pane');
  const resizeHandle = document.getElementById('split-resize-handle');

  // Reset primary pane to take full width
  if (primaryPane) {
    primaryPane.style.flex = '1';
  }

  if (secondaryPane) {
    secondaryPane.style.display = 'none';
  }

  if (resizeHandle) {
    resizeHandle.style.display = 'none';
  }

  // Destroy secondary editor
  if (callbacks.destroySecondaryEditor) {
    callbacks.destroySecondaryEditor();
  }

  // Ensure state.editor points to primary editor
  if (state.primaryEditor) {
    state.editor = state.primaryEditor;
    // Refresh primary editor to ensure it renders properly at full width
    state.primaryEditor.refresh();
  }

  // Update UI
  updatePaneActiveState();
  if (callbacks.renderTabs) callbacks.renderTabs();
  if (callbacks.renderFileTree) callbacks.renderFileTree();

  // Save state
  if (callbacks.saveSettings) {
    callbacks.saveSettings();
  }
}


/**
 * Sets the active pane
 */
export function setActivePaneFromPosition(pane) {
  if (!state.splitView.enabled) return;
  if (pane !== 'primary' && pane !== 'secondary') return;

  state.splitView.activePane = pane;

  // Update state.editor to point to active pane's editor
  if (pane === 'primary' && state.primaryEditor) {
    state.editor = state.primaryEditor;
  } else if (pane === 'secondary' && state.secondaryEditor) {
    state.editor = state.secondaryEditor;
  }

  updatePaneActiveState();
}

/**
 * Moves a tab to the primary pane
 */
export function moveToPrimaryPane(tabIndex) {
  if (!state.splitView.enabled) return;
  if (tabIndex < 0 || tabIndex >= state.openTabs.length) return;

  // Remove from secondary if it's there
  const secondaryIdx = state.splitView.secondaryTabs.indexOf(tabIndex);
  if (secondaryIdx !== -1) {
    state.splitView.secondaryTabs.splice(secondaryIdx, 1);
  }

  // Add to primary if not already there
  if (!state.splitView.primaryTabs.includes(tabIndex)) {
    state.splitView.primaryTabs.push(tabIndex);
  }

  // Auto-balance: If secondary pane is empty, move one tab back from primary
  if (state.splitView.secondaryTabs.length === 0 && state.splitView.primaryTabs.length > 1) {
    // Find a tab in primary pane that's not the one we just moved
    const tabToMoveBack = state.splitView.primaryTabs.find(idx => idx !== tabIndex);

    if (tabToMoveBack !== undefined) {
      const backIdx = state.splitView.primaryTabs.indexOf(tabToMoveBack);
      state.splitView.primaryTabs.splice(backIdx, 1);
      state.splitView.secondaryTabs.push(tabToMoveBack);
      state.splitView.secondaryActiveTab = state.openTabs[tabToMoveBack];

      // Load the auto-moved tab's content into secondary editor
      if (state.secondaryEditor) {
        const movedTab = state.openTabs[tabToMoveBack];
        state.secondaryEditor.setValue(movedTab.content || movedTab.originalContent || "");

        // Set correct mode
        const ext = movedTab.path.split('.').pop().toLowerCase();
        const modeMap = {
          'yaml': 'ha-yaml', 'yml': 'ha-yaml', 'js': 'javascript',
          'json': 'application/json', 'py': 'python', 'html': 'htmlmixed',
          'css': 'css', 'xml': 'xml', 'md': 'markdown',
        };
        const mode = modeMap[ext] || null;
        if (mode) state.secondaryEditor.setOption('mode', mode);

        // Restore cursor and scroll
        if (movedTab.cursor) state.secondaryEditor.setCursor(movedTab.cursor);
        if (movedTab.scroll) state.secondaryEditor.scrollTo(movedTab.scroll.left, movedTab.scroll.top);
        state.secondaryEditor.refresh();
      }
    }
  }

  // Make it the active tab in primary pane
  state.splitView.primaryActiveTab = state.openTabs[tabIndex];
  state.splitView.activePane = 'primary';
  state.editor = state.primaryEditor;

  // Load the moved tab's content into primary editor
  if (state.primaryEditor) {
    const movedTab = state.openTabs[tabIndex];
    state.primaryEditor.setValue(movedTab.content || movedTab.originalContent || "");

    // Set correct mode
    const ext = movedTab.path.split('.').pop().toLowerCase();
    const modeMap = {
      'yaml': 'ha-yaml', 'yml': 'ha-yaml', 'js': 'javascript',
      'json': 'application/json', 'py': 'python', 'html': 'htmlmixed',
      'css': 'css', 'xml': 'xml', 'md': 'markdown',
    };
    const mode = modeMap[ext] || null;
    if (mode) state.primaryEditor.setOption('mode', mode);

    // Restore cursor and scroll
    if (movedTab.cursor) state.primaryEditor.setCursor(movedTab.cursor);
    if (movedTab.scroll) state.primaryEditor.scrollTo(movedTab.scroll.left, movedTab.scroll.top);
    state.primaryEditor.refresh();
    state.primaryEditor.focus();
  }

  // Update UI
  updatePaneActiveState();
  if (callbacks.renderTabs) callbacks.renderTabs();
  if (callbacks.renderFileTree) callbacks.renderFileTree();

  // Save state
  if (callbacks.saveSettings) {
    callbacks.saveSettings();
  }
}

/**
 * Moves a tab to the secondary pane
 */
export function moveToSecondaryPane(tabIndex) {
  if (!state.splitView.enabled) {
    // Enable split view first
    enableSplitView('vertical');
  }

  if (tabIndex < 0 || tabIndex >= state.openTabs.length) return;

  // Remove from primary if it's there
  const primaryIdx = state.splitView.primaryTabs.indexOf(tabIndex);
  if (primaryIdx !== -1) {
    state.splitView.primaryTabs.splice(primaryIdx, 1);
  }

  // Add to secondary if not already there
  if (!state.splitView.secondaryTabs.includes(tabIndex)) {
    state.splitView.secondaryTabs.push(tabIndex);
  }

  // Auto-balance: If primary pane is empty, move one tab back from secondary
  if (state.splitView.primaryTabs.length === 0 && state.splitView.secondaryTabs.length > 1) {
    // Find a tab in secondary pane that's not the one we just moved
    const tabToMoveBack = state.splitView.secondaryTabs.find(idx => idx !== tabIndex);
    if (tabToMoveBack !== undefined) {
      const backIdx = state.splitView.secondaryTabs.indexOf(tabToMoveBack);
      state.splitView.secondaryTabs.splice(backIdx, 1);
      state.splitView.primaryTabs.push(tabToMoveBack);
      state.splitView.primaryActiveTab = state.openTabs[tabToMoveBack];

      // Load the auto-moved tab's content into primary editor
      if (state.primaryEditor) {
        const movedTab = state.openTabs[tabToMoveBack];
        state.primaryEditor.setValue(movedTab.content || movedTab.originalContent || "");

        // Set correct mode
        const ext = movedTab.path.split('.').pop().toLowerCase();
        const modeMap = {
          'yaml': 'ha-yaml', 'yml': 'ha-yaml', 'js': 'javascript',
          'json': 'application/json', 'py': 'python', 'html': 'htmlmixed',
          'css': 'css', 'xml': 'xml', 'md': 'markdown',
        };
        const mode = modeMap[ext] || null;
        if (mode) state.primaryEditor.setOption('mode', mode);

        // Restore cursor and scroll
        if (movedTab.cursor) state.primaryEditor.setCursor(movedTab.cursor);
        if (movedTab.scroll) state.primaryEditor.scrollTo(movedTab.scroll.left, movedTab.scroll.top);
        state.primaryEditor.refresh();
      }
    }
  }

  // Make it the active tab in secondary pane
  state.splitView.secondaryActiveTab = state.openTabs[tabIndex];
  state.splitView.activePane = 'secondary';
  state.editor = state.secondaryEditor;

  // Load the moved tab's content into secondary editor
  if (state.secondaryEditor) {
    const movedTab = state.openTabs[tabIndex];
    state.secondaryEditor.setValue(movedTab.content || movedTab.originalContent || "");

    // Set correct mode
    const ext = movedTab.path.split('.').pop().toLowerCase();
    const modeMap = {
      'yaml': 'ha-yaml', 'yml': 'ha-yaml', 'js': 'javascript',
      'json': 'application/json', 'py': 'python', 'html': 'htmlmixed',
      'css': 'css', 'xml': 'xml', 'md': 'markdown',
    };
    const mode = modeMap[ext] || null;
    if (mode) state.secondaryEditor.setOption('mode', mode);

    // Restore cursor and scroll
    if (movedTab.cursor) state.secondaryEditor.setCursor(movedTab.cursor);
    if (movedTab.scroll) state.secondaryEditor.scrollTo(movedTab.scroll.left, movedTab.scroll.top);
    state.secondaryEditor.refresh();
    state.secondaryEditor.focus();
  }

  // Update UI
  updatePaneActiveState();
  if (callbacks.renderTabs) callbacks.renderTabs();
  if (callbacks.renderFileTree) callbacks.renderFileTree();

  // Save state
  if (callbacks.saveSettings) {
    callbacks.saveSettings();
  }
}

/**
 * Gets which pane a tab is in
 */
export function getPaneForTab(tabIndex) {
  if (!state.splitView.enabled) return null;

  if (state.splitView.primaryTabs.includes(tabIndex)) {
    return 'primary';
  } else if (state.splitView.secondaryTabs.includes(tabIndex)) {
    return 'secondary';
  }

  return null;
}

/**
 * Gets the active pane's editor instance
 */
export function getActivePaneEditor() {
  if (!state.splitView.enabled) {
    return state.editor || state.primaryEditor;
  }

  return state.splitView.activePane === 'primary' ?
    state.primaryEditor :
    state.secondaryEditor;
}

/**
 * Updates pane sizes
 */
export function updatePaneSizes(primaryPercent) {
  state.splitView.primaryPaneSize = primaryPercent;
  const secondaryPercent = 100 - primaryPercent;

  const primaryPane = document.getElementById('primary-pane');
  const secondaryPane = document.getElementById('secondary-pane');

  if (primaryPane) {
    primaryPane.style.flex = `0 0 ${primaryPercent}%`;
  }
  if (secondaryPane) {
    secondaryPane.style.flex = `0 0 ${secondaryPercent}%`;
  }
}

/**
 * Initializes the split resize functionality
 * Optimized with RAF throttling for smooth 60fps performance
 */
export function initSplitResize() {
  const handle = document.getElementById('split-resize-handle');
  if (!handle) return;

  let isResizing = false;
  let startPos = 0;
  let startPrimarySize = 0;

  const handleMouseDown = (e) => {
    isResizing = true;
    startPos = e.clientX;
    startPrimarySize = state.splitView.primaryPaneSize;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  // Throttle mouse move with requestAnimationFrame for smooth 60fps updates
  const throttledUpdatePaneSizes = rafThrottle((newSize) => {
    updatePaneSizes(newSize);
  });

  const handleMouseMove = (e) => {
    if (!isResizing) return;

    const container = document.getElementById('split-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const delta = e.clientX - startPos;
    const deltaPercent = (delta / containerRect.width) * 100;
    const newSize = Math.max(20, Math.min(80, startPrimarySize + deltaPercent));

    // Use throttled update for smooth performance
    throttledUpdatePaneSizes(newSize);
  };

  const handleMouseUp = () => {
    if (!isResizing) return;

    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Save split state
    if (callbacks.saveSettings) {
      callbacks.saveSettings();
    }

    // Refresh both editors
    if (state.primaryEditor) state.primaryEditor.refresh();
    if (state.secondaryEditor) state.secondaryEditor.refresh();
  };

  // Remove existing listeners
  handle.removeEventListener('mousedown', handleMouseDown);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);

  // Add new listeners
  handle.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

/**
 * Updates visual active state of panes
 */
export function updatePaneActiveState() {
  const primaryPane = document.getElementById('primary-pane');
  const secondaryPane = document.getElementById('secondary-pane');

  if (!state.splitView.enabled) {
    if (primaryPane) primaryPane.classList.remove('active');
    if (secondaryPane) secondaryPane.classList.remove('active');
    return;
  }

  if (primaryPane) {
    if (state.splitView.activePane === 'primary') {
      primaryPane.classList.add('active');
    } else {
      primaryPane.classList.remove('active');
    }
  }

  if (secondaryPane) {
    if (state.splitView.activePane === 'secondary') {
      secondaryPane.classList.add('active');
    } else {
      secondaryPane.classList.remove('active');
    }
  }
}

// ============================================================================
// Drag and Drop Handlers
// ============================================================================

/**
 * Handles tab drag start
 */
export function handleTabDragStart(e) {
  draggedTabIndex = parseInt(e.currentTarget.getAttribute('data-tab-index'));
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}

/**
 * Handles tab drag over
 */
export function handleTabDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const dropTarget = e.currentTarget;
  if (!dropTarget) return;

  const dropTabIndex = parseInt(dropTarget.getAttribute('data-tab-index'));

  if (dropTabIndex !== draggedTabIndex) {
    // Visual indicator
    dropTarget.classList.add('drop-target');
  }
}

/**
 * Handles tab drop
 */
export function handleTabDrop(e) {
  e.preventDefault();

  const dropTarget = e.currentTarget;
  if (!dropTarget) return;

  const dropTabIndex = parseInt(dropTarget.getAttribute('data-tab-index'));
  const dropPane = dropTarget.getAttribute('data-pane');

  if (draggedTabIndex !== null && dropTabIndex !== draggedTabIndex) {
    // Move tab to same pane as drop target
    if (dropPane === 'primary') {
      moveToPrimaryPane(draggedTabIndex);
    } else if (dropPane === 'secondary') {
      moveToSecondaryPane(draggedTabIndex);
    }
  }

  cleanupDragState();
}

/**
 * Handles tab drag end
 */
export function handleTabDragEnd(e) {
  cleanupDragState();
}

/**
 * Cleans up drag state
 */
function cleanupDragState() {
  document.querySelectorAll('.tab.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.tab.drop-target').forEach(el => el.classList.remove('drop-target'));
  draggedTabIndex = null;
}
