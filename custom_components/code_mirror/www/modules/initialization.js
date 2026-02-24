/**
 * ============================================================================
 * INITIALIZATION MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Handles complete application initialization including DOM element caching,
 * module setup, onboarding flow, and WebSocket subscriptions. This is called
 * during app startup to prepare the application for use.
 *
 * EXPORTED FUNCTIONS:
 * - registerInitializationCallbacks(cb) - Register dependencies
 * - initializeApp() - Main initialization function
 * - setupOnboarding() - Setup onboarding flow for new users
 * - cacheElements() - Cache DOM element references
 * - setupWebSocket() - Initialize real-time updates
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding initialization step:
 *    - Add to initializeApp() function
 *    - Ensure proper order (DOM first, then data, then UI)
 *    - Handle errors gracefully
 *    - Show loading state during init
 *
 * 2. Adding DOM element caching:
 *    - Add to cacheElements() function
 *    - Store in elements object from state.js
 *    - Use getElementById for better performance
 *    - Check if element exists before caching
 *
 * 3. Adding onboarding steps:
 *    - Modify setupOnboarding() function
 *    - Add step HTML and logic
 *    - Update step counter
 *    - Save completion state
 *
 * 4. Adding module initialization:
 *    - Import module
 *    - Call initialization function
 *    - Register callbacks if needed
 *    - Handle initialization errors
 *
 * INTEGRATION POINTS:
 * - state.js: Updates elements object with DOM references
 * - api.js: WebSocket subscriptions
 * - settings.js: Load saved settings
 * - All modules: Initialize each module
 * - main.js: Called from app entry point
 *
 * INITIALIZATION ORDER:
 * 1. Cache DOM elements
 * 2. Load settings from server/localStorage
 * 3. Initialize modules (editor, file tree, etc.)
 * 4. Setup event listeners
 * 5. Load initial data (files)
 * 6. Setup WebSocket for real-time updates
 * 7. Show onboarding if first time
 * 8. Hide loading, show app
 *
 * ARCHITECTURE NOTES:
 * - Single initialization call from main.js
 * - Handles all app setup in correct order
 * - Error handling prevents partial init
 * - Loading states keep user informed
 * - Onboarding only shows once
 *
 * COMMON PATTERNS:
 * - Init: await initializeApp()
 * - Cache element: elements.myElement = document.getElementById('myId')
 * - Handle error: try { init() } catch (e) { showError() }
 *
 * ERROR HANDLING:
 * - Graceful degradation if modules fail
 * - Show user-friendly error messages
 * - Log detailed errors to console
 * - Allow app to continue if non-critical failure
 *
 * ============================================================================
 */

import { API_BASE } from './constants.js';

import {
  fetchWithAuth,
  initWebSocketSubscription,
  registerUpdateCallbacks
} from './api.js';

import {
  loadEntities,
  defineHAYamlMode,
  defineCSVMode,
  defineShowWhitespaceMode
} from './ha-autocomplete.js';

import {
  state,
  elements
} from './state.js';

import {
  initElements,
  showToast,
  hideGlobalLoading,
  showModal,
  applyTheme,
  applyCustomSyntaxColors,
  applyLayoutSettings,
  applyEditorSettings,
  registerUICallbacks,
  resetModalToDefault,
  showConfirmDialog,
  hideModal
} from './ui.js';

import {
  isMobile
} from './utils.js';

import {
  initQuickSwitcherEvents,
  registerQuickSwitcherCallbacks
} from './quick-switcher.js';

import {
  registerFavoritesCallbacks
} from './favorites.js';

import {
  registerRecentFilesCallbacks
} from './recent-files.js';

import {
  initResizeHandle,
  registerResizeCallbacks
} from './resize.js';

import {
  registerStatusBarCallbacks,
  initStatusBarEvents
} from './status-bar.js';

import {
  registerAutoSaveCallbacks
} from './autosave.js';

import {
  checkFileUpdates,
  registerPollingCallbacks
} from './polling.js';

import {
  registerDownloadsUploadsCallbacks
} from './downloads-uploads.js';

import {
  loadSettings,
  saveSettings,
  updateShowHiddenButton,
  registerSettingsCallbacks
} from './settings.js';

import {
  registerSettingsUICallbacks
} from './settings-ui.js';

import {
  registerSelectionCallbacks
} from './selection.js';

import {
  registerFileOperationsCallbacks
} from './file-operations.js';

import {
  registerFileTreeCallbacks,
  navigateBack,
  navigateToFolder
} from './file-tree.js';

import {
  initEventListeners,
  registerEventHandlerCallbacks
} from './event-handlers.js';

// Import functions from app.js that are needed
// These will need to be imported from app.js when we refactor
let loadFiles, openFile, saveFile, saveCurrentFile, renderTabs, renderFileTree;
let closeTab, loadFile, setButtonLoading;
let restoreOpenTabs, copyToClipboard;
let updateToolbarState, updateStatusBar, updateSplitViewButtons;
let isTextFile, toggleSelectionMode, processUploads;
let renderRecentFilesPanel, renderFavoritesPanel, handleSelectionChange;
let showContextMenu, toggleFavorite, hideSidebar;

/**
 * Register callbacks that connect initialization to app.js functions
 */
export function registerInitializationCallbacks(callbacks) {
  loadFiles = callbacks.loadFiles;
  openFile = callbacks.openFile;
  saveFile = callbacks.saveFile;
  saveCurrentFile = callbacks.saveCurrentFile;
  renderTabs = callbacks.renderTabs;
  renderFileTree = callbacks.renderFileTree;
  closeTab = callbacks.closeTab;
  loadFile = callbacks.loadFile;
  setButtonLoading = callbacks.setButtonLoading;
  restoreOpenTabs = callbacks.restoreOpenTabs;
  copyToClipboard = callbacks.copyToClipboard;
  updateToolbarState = callbacks.updateToolbarState;
  updateStatusBar = callbacks.updateStatusBar;
  updateSplitViewButtons = callbacks.updateSplitViewButtons;
  isTextFile = callbacks.isTextFile;
  toggleSelectionMode = callbacks.toggleSelectionMode;
  processUploads = callbacks.processUploads;
  renderRecentFilesPanel = callbacks.renderRecentFilesPanel;
  renderFavoritesPanel = callbacks.renderFavoritesPanel;
  handleSelectionChange = callbacks.handleSelectionChange;
  showContextMenu = callbacks.showContextMenu;
  toggleFavorite = callbacks.toggleFavorite;
  hideSidebar = callbacks.hideSidebar;
}

/**
 * Main initialization function
 * Initializes the entire CodeMirror application
 */
export async function init() {
  try {
    initElements();

    // Register UI callbacks
    registerUICallbacks({
        saveSettings: saveSettings
    });

    // Register custom CodeMirror modes
    defineHAYamlMode();
    defineCSVMode();
    defineShowWhitespaceMode();

    await loadSettings();
    applyTheme();
    applyLayoutSettings();
    applyEditorSettings();

    updateShowHiddenButton();

    // Register event handler callbacks (folder navigation)
    registerEventHandlerCallbacks({
      navigateBack
    });

    initEventListeners();
    initResizeHandle();

    // Initialize status bar interactions
    registerStatusBarCallbacks({
      saveSettings,
      showToast
    });
    initStatusBarEvents();

    // Initialize quick switcher
    registerQuickSwitcherCallbacks({ openFile });
    initQuickSwitcherEvents();

    // Initialize favorites and recent files
    registerFavoritesCallbacks({
      openFile,
      hideSidebar,
      saveSettings,
      renderFileTree
    });

    registerRecentFilesCallbacks({
      openFile,
      hideSidebar,
      showContextMenu
    });

    // Initialize resize and autosave
    registerResizeCallbacks({ saveSettings });

    registerAutoSaveCallbacks({
      saveFile,
      saveCurrentFile,
      renderTabs,
      renderFileTree,
      updateToolbarState,
      setButtonLoading
    });

    registerPollingCallbacks({
      openFile,
    });

    registerDownloadsUploadsCallbacks({
      showConfirmDialog,
      showModal,
      loadFiles,
      renderFileTree,
      toggleSelectionMode
    });

    registerSettingsCallbacks({
      applyTheme,
      applyCustomSyntaxColors
    });

    registerSettingsUICallbacks({
      loadFiles,
      applyTheme,
      applyCustomSyntaxColors,
      applyLayoutSettings,
      applyEditorSettings,
      renderFileTree,
      resetModalToDefault,
      hideModal
    });

    registerSelectionCallbacks({
      renderFileTree,
      loadFiles
    });

    registerFileOperationsCallbacks({
      loadFiles,
      openFile,
      closeTab,
      renderFileTree,
      renderTabs,
      updateToolbarState
    });

    registerFileTreeCallbacks({
      toggleFavorite,
      renderRecentFilesPanel,
      renderFavoritesPanel,
      handleSelectionChange,
      showContextMenu,
      openFile,
      hideSidebar,
      loadFiles,
      toggleSelectionMode,
      processUploads
    });

    // Register WebSocket update callbacks for real-time updates
    registerUpdateCallbacks({
      checkFileUpdates,
      loadFiles,
    });

    // Set initial sidebar state
    if (isMobile()) {
      elements.sidebar.classList.remove("visible");
      state.sidebarVisible = false;
    }

    // ⚡ PARALLEL INITIALIZATION - Run independent operations concurrently
    const [versionData] = await Promise.all([
      // Fetch version (independent)
      fetchWithAuth(`${API_BASE}?action=get_version`).catch(e => {
        console.warn("Failed to fetch version for display");
        return null;
      }),

      // Initialize WebSocket (independent)
      initWebSocketSubscription().catch(e => {
        console.warn("Failed to init WebSocket:", e);
      }),

      // Load entities for autocomplete (independent)
      Promise.resolve().then(() => loadEntities()),

      // Load files (needed for file tree)
      loadFiles()
    ]);

    // Display version if fetched successfully
    if (versionData && versionData.integration_version && elements.appVersionDisplay) {
      elements.appVersionDisplay.textContent = `v${versionData.integration_version}`;
    }

    // Don't auto-expand folders - let users expand what they need
    renderFileTree();

    // Restore file tree collapsed state
    if (state.fileTreeCollapsed) {
      const fileTree = document.getElementById("file-tree");
      const btn = document.getElementById("btn-file-tree-collapse");
      if (fileTree) fileTree.style.display = "none";
      if (btn) {
        const icon = btn.querySelector(".material-icons");
        if (icon) icon.textContent = "expand_more";
        btn.title = "Expand file tree";
      }
    }

    // ⚡ PARALLEL POST-LOAD - Run remaining operations concurrently
    await Promise.all([
      // Restore open tabs (depends on files being loaded, which is done above)
      restoreOpenTabs(),
    ]);

    updateToolbarState();
    updateStatusBar();
    updateSplitViewButtons();
  } catch (error) {
    console.error("CodeMirror: Critical initialization error:", error);
    // Even if it fails, try to show the UI
    if (typeof showToast === 'function') {
        showToast("Initialization error. Some features may be limited.", "error");
    }
  } finally {
    // ALWAYS dismiss initial loading screen
    hideGlobalLoading();

    // Initialize haCodeMirror namespace if not already
    window.haCodeMirror = window.haCodeMirror || {};
  }
}

// Export init as default
export default init;
