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
 * 5. Load initial data (files, git status)
 * 6. Setup WebSocket for real-time updates
 * 7. Show onboarding if first time
 * 8. Hide loading, show app
 *
 * ONBOARDING FLOW:
 * - Check if onboardingCompleted in settings
 * - Show welcome screen
 * - Guide through key features
 * - Mark completed and save
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
 * - Check onboarding: if (!state.onboardingCompleted) setupOnboarding()
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
  elements,
  gitState,
  giteaState
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
  startGitStatusPolling,
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
  registerGitDiffCallbacks
} from './git-diff.js';

import {
  registerGitOperationsCallbacks,
  isGitEnabled,
  checkGitStatusIfEnabled,
  gitStatus,
  gitInit,
  gitGetRemotes,
  gitSetCredentials
} from './git-operations.js';

import {
  registerGithubIntegrationCallbacks,
  showGithubDeviceFlowLogin,
  showGitExclusions,
  showGitSettings,
  showCreateGithubRepoDialog,
  githubCreateRepo
} from './github-integration.js';

import {
  registerGiteaIntegrationCallbacks,
  giteaStatus,
  showGiteaSettings,
  giteaCreateRepo
} from './gitea-integration.js';

import {
  initEventListeners,
  registerEventHandlerCallbacks
} from './event-handlers.js';

// Import functions from app.js that are needed
// These will need to be imported from app.js when we refactor
let loadFiles, openFile, saveFile, saveCurrentFile, renderTabs, renderFileTree;
let closeTab, loadFile, gitStage, gitUnstage, setButtonLoading;
let restoreOpenTabs, copyToClipboard, applyVersionControlVisibility;
let updateGitPanel, updateToolbarState, updateStatusBar, updateSplitViewButtons;
let isTextFile, toggleSelectionMode, processUploads;
let renderRecentFilesPanel, renderFavoritesPanel, handleSelectionChange;
let showContextMenu, toggleFavorite, hideSidebar, showDiffModal, gitCleanLocks;

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
  gitStage = callbacks.gitStage;
  gitUnstage = callbacks.gitUnstage;
  setButtonLoading = callbacks.setButtonLoading;
  restoreOpenTabs = callbacks.restoreOpenTabs;
  copyToClipboard = callbacks.copyToClipboard;
  applyVersionControlVisibility = callbacks.applyVersionControlVisibility;
  updateGitPanel = callbacks.updateGitPanel;
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
  showDiffModal = callbacks.showDiffModal;
  gitCleanLocks = callbacks.gitCleanLocks;
}

/**
 * Main initialization function
 * Initializes the entire Blueprint Studio application
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
    applyVersionControlVisibility(); // Apply version control visibility setting

    // We wrap non-critical initializations in their own try-catches
    try { gitStatus(true, true); } catch(e) {}
    try { giteaStatus(true, true); } catch(e) {}

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
      gitStatus,
      giteaStatus
    });

    registerDownloadsUploadsCallbacks({
      showConfirmDialog,
      showModal,
      loadFiles,
      renderFileTree,
      checkGitStatusIfEnabled,
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
      applyVersionControlVisibility,
      renderFileTree,
      showGitExclusions,
      resetModalToDefault,
      hideModal
    });

    registerSelectionCallbacks({
      renderFileTree,
      loadFiles,
      checkGitStatusIfEnabled
    });

    registerFileOperationsCallbacks({
      loadFiles,
      openFile,
      checkGitStatusIfEnabled,
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
      showDiffModal,
      loadFiles,
      checkGitStatusIfEnabled,
      toggleSelectionMode,
      processUploads
    });

    registerGitDiffCallbacks({
      loadFile,
      isGitEnabled
    });

    registerGitOperationsCallbacks({
      updateGitPanel,
      loadFiles,
      openFile,
      giteaStatus
    });

    registerGithubIntegrationCallbacks({
      gitStatus,
      gitSetCredentials,
      gitInit,
      loadFile,
      isTextFile,
      copyToClipboard,
      isMobile,
      loadFiles,
      openFile,
      saveFile,
      gitGetRemotes,
      gitCleanLocks
    });

    registerGiteaIntegrationCallbacks({
      gitStatus,
      gitStage,
      gitUnstage,
      gitGetRemotes,
      gitCleanLocks,
      loadFiles,
      openFile,
      isTextFile,
      setButtonLoading
    });

    // Register WebSocket update callbacks for real-time updates
    registerUpdateCallbacks({
      checkFileUpdates,
      checkGitStatus: checkGitStatusIfEnabled,
      gitStatus,
      loadFiles,
      startPolling: startGitStatusPolling
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

    // Start git status polling (needed even with WebSocket for remote changes)
    startGitStatusPolling();

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

      // Load git status silently
      (async () => {
        try {
          const data = await fetchWithAuth(API_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "git_status" }),
          });

          if (data.success) {
            gitState.files = data.files;
            gitState.isInitialized = data.is_initialized;
            gitState.hasRemote = data.has_remote;
            gitState.ahead = data.ahead || 0;
            gitState.behind = data.behind || 0;

            gitState.totalChanges = [
              ...gitState.files.modified,
              ...gitState.files.added,
              ...gitState.files.deleted,
              ...gitState.files.untracked
            ].length;
            updateGitPanel();
          }
        } catch (error) {
          // Silently fail - git might not be initialized
          console.log("Git status not available:", error.message);
        }
      })()
    ]);

    updateToolbarState();
    updateStatusBar();
    updateSplitViewButtons();

    // Start onboarding if new user
    startOnboarding();
  } catch (error) {
    console.error("Blueprint Studio: Critical initialization error:", error);
    // Even if it fails, try to show the UI
    if (typeof showToast === 'function') {
        showToast("Initialization error. Some features may be limited.", "error");
    }
  } finally {
    // ALWAYS dismiss initial loading screen
    hideGlobalLoading();

    // Initialize blueprintStudio namespace if not already
    window.blueprintStudio = window.blueprintStudio || {};

    // Expose for testing (after all initialization)
    window.blueprintStudio.giteaCreateRepo = giteaCreateRepo;
    window.blueprintStudio.githubCreateRepo = githubCreateRepo;
  }
}

/**
 * Start the onboarding wizard for new users
 * Guides users through setting up Git integration
 */
export async function startOnboarding() {
    if (state.onboardingCompleted) return;

    let shouldOpenSettings = false;

    // Step 1: Welcome & Git Choice
    const choiceResult = await new Promise((resolve) => {
        const modalBody = document.getElementById("modal-body");
        const modalTitle = document.getElementById("modal-title");
        const modal = document.getElementById("modal");
        const modalFooter = document.querySelector(".modal-footer");

        resetModalToDefault();
        modalTitle.textContent = "Welcome to Blueprint Studio! 🚀";
        if (modalFooter) modalFooter.style.display = "none";

        modalBody.innerHTML = `
            <div style="text-align: center;">
                <p style="margin-bottom: 20px;">The modern, Git-powered file editor for Home Assistant.</p>
                <div style="font-weight: 600; margin-bottom: 16px;">Choose your preferred version control system:</div>
                <div class="git-choice-container" style="display: flex; flex-direction: column; gap: 12px;">
                    <button class="btn-secondary onboarding-choice-btn" data-value="github" style="padding: 16px; border: 1px solid var(--border-color); border-radius: 8px; text-align: left; background: var(--bg-secondary); cursor: pointer; transition: background 0.2s; width: 100%; color: inherit;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <svg class="octicon" viewBox="0 0 16 16" width="24" height="24" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02-.08-2.12 0 0 .67-.22 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path></svg>
                            <div>
                                <div style="font-weight: 600;">GitHub</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Connect to GitHub.com</div>
                            </div>
                        </div>
                    </button>
                    <button class="btn-secondary onboarding-choice-btn" data-value="gitea" style="padding: 16px; border: 1px solid var(--border-color); border-radius: 8px; text-align: left; background: var(--bg-secondary); cursor: pointer; transition: background 0.2s; width: 100%; color: inherit;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span class="material-icons" style="font-size: 24px; color: #fa8e14;">emoji_food_beverage</span>
                            <div>
                                <div style="font-weight: 600;">Gitea</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Connect to self-hosted Gitea</div>
                            </div>
                        </div>
                    </button>
                    <button class="btn-secondary onboarding-choice-btn" data-value="none" style="padding: 16px; border: 1px solid var(--border-color); border-radius: 8px; text-align: left; background: var(--bg-secondary); cursor: pointer; transition: background 0.2s; width: 100%; color: inherit;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span class="material-icons" style="font-size: 24px;">block</span>
                            <div>
                                <div style="font-weight: 600;">None</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Skip version control</div>
                            </div>
                        </div>
                    </button>
                </div>
                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 20px;">You can change this later in Settings.</p>
            </div>
        `;

        const buttons = modalBody.querySelectorAll('.onboarding-choice-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.getAttribute('data-value');
                hideModal();
                resolve(val);
            });
        });

        document.getElementById('modal-overlay').classList.add("visible");
    });

    const provider = choiceResult;
    const useGit = provider !== 'none';

    if (useGit) {
        // User chose to enable
        state.gitIntegrationEnabled = (provider === 'github');
        state.giteaIntegrationEnabled = (provider === 'gitea');
        saveSettings();
        applyVersionControlVisibility();

        // Step 3: Initialize Git (if needed)
        if (!gitState.isInitialized) {
          const initResult = await showConfirmDialog({
            title: "Step 1: Track Your Changes",
            message: `
              <div style="text-align: center;">
                <span class="material-icons" style="font-size: 48px; color: var(--accent-color);">source</span>
                <p>First, we need to initialize a Git repository to track your file changes.</p>
                <p style="font-size: 12px; color: var(--text-secondary);">This creates a hidden .git folder in your config directory.</p>
              </div>
            `,
            confirmText: "Initialize Repo",
            cancelText: "Skip"
          });

          if (initResult) {
            const success = await gitInit(true); // Skip prompt
            if (success) {
                gitState.isInitialized = true;
            }
          }
        }

        // Step 4: Git Ignore
        if (gitState.isInitialized) {
            const ignoreResult = await showConfirmDialog({
                title: "Step 2: Ignore Files",
                message: `
                    <div style="text-align: center;">
                        <span class="material-icons" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 10px;">visibility_off</span>
                        <p style="margin-bottom: 10px;">Configure which files to hide from GitHub (like passwords or temp files).</p>
                        <p style="font-size: 12px; color: var(--text-secondary);">We've already configured safe defaults for you.</p>
                    </div>
                `,
                confirmText: "Manage Exclusions",
                cancelText: "Use Defaults"
            });

            if (ignoreResult) {
                await showGitExclusions();
            }
        }

        // Step 5: Connect to Provider (Login)
        let isLoggedIn = false;
        if (provider === 'github') {
            try {
                const creds = await fetchWithAuth(API_BASE, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "git_get_credentials" }),
                });
                isLoggedIn = creds.has_credentials;
            } catch (e) {}

            if (!isLoggedIn) {
                const loginResult = await showConfirmDialog({
                    title: "Step 3: Login to GitHub",
                    message: `
                        <div style="text-align: center;">
                            <span class="material-icons" style="font-size: 48px; color: var(--text-secondary);">login</span>
                            <p>Login to GitHub to sync your configuration to the cloud.</p>
                        </div>
                    `,
                    confirmText: "Login",
                    cancelText: "Skip"
                });

                if (loginResult) {
                    const success = await showGithubDeviceFlowLogin();
                    if (success) isLoggedIn = true;
                }
            }
        } else if (provider === 'gitea') {
            // Gitea login is via settings
            shouldOpenSettings = true;
        }

        // Step 6: Create Repository (if logged in and no remote)
        if (provider === 'github' && isLoggedIn && !gitState.hasRemote) {
            const createResult = await showConfirmDialog({
                title: "Step 4: Create Repository",
                message: `
                    <div style="text-align: center;">
                        <span class="material-icons" style="font-size: 48px; color: var(--accent-color);">add_circle_outline</span>
                        <p>Create a new private repository on GitHub to store your backups.</p>
                    </div>
                `,
                confirmText: "Create Repo",
                cancelText: "Skip"
            });

            if (createResult) {
                await showCreateGithubRepoDialog();
            }
        }
    } else {
        // User chose to disable
        state.gitIntegrationEnabled = false;
        state.giteaIntegrationEnabled = false;
        saveSettings();
        applyVersionControlVisibility();
    }

    // Final Step: Finish
    const finishMessage = useGit
        ? `
        <div style="text-align: center;">
          <p>Explore your files on the left.</p>
          <p>Use the <b>${provider === 'gitea' ? 'Gitea' : 'Git'} Panel</b> to stage, commit, and push changes.</p>
          <br>
          <p style="font-size: 12px;">Need help? Click the <span class="material-icons" style="font-size: 14px; vertical-align: middle;">help_outline</span> icon in the panel.</p>
        </div>
      `
        : `
        <div style="text-align: center;">
          <p>You're good to go! 🚀</p>
          <br>
          <p>Explore your files on the left and start editing.</p>
          <br>
          <p style="font-size: 12px; color: var(--text-secondary);">If you change your mind, you can enable Git integration in <b>Settings</b>.</p>
        </div>
      `;

    await showModal({
      title: "You're All Set! 🎉",
      message: finishMessage,
      confirmText: "Start Editing"
    });

    state.onboardingCompleted = true;
    saveSettings();

    // If they chose to connect Gitea (or GitHub failed login), open the settings modal now
    if (shouldOpenSettings) {
        if (provider === 'gitea') showGiteaSettings();
        else if (provider === 'github') showGitSettings();
    }
  }

// Export init as default
export default init;
