/**
 * ============================================================================
 * SETTINGS MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Handles loading, saving, and migrating user settings between local storage
 * and server. Manages all application preferences, workspace state, and
 * configuration persistence.
 *
 * EXPORTED FUNCTIONS:
 * - registerSettingsCallbacks(cb) - Register dependencies from app.js
 * - loadSettings() - Load settings from server and local storage
 * - saveSettings() - Save settings to server and local storage
 * - updateShowHiddenButton() - Update show/hide hidden files button state
 *
 * REQUIRED CALLBACKS (from app.js):
 * - applyTheme: Apply theme to UI
 * - applySyntaxColors: Apply syntax colors
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new setting:
 *    - Add to state.js with default value
 *    - Add to loadSettings(): state.newSetting = settings.newSetting || defaultValue
 *    - Add to saveSettings(): newSetting: state.newSetting
 *    - Add UI control in settings-ui.js
 *    - Test migration from old to new versions
 *
 * 2. Migrating settings format:
 *    - Add migration logic in loadSettings()
 *    - Check for old format: if (settings.oldField)
 *    - Convert to new format: state.newField = convertOldToNew(settings.oldField)
 *    - Save migrated settings immediately
 *
 * 3. Adding setting categories:
 *    - Group related settings together in code
 *    - Add comments to separate categories
 *    - Examples: UI, Editor, Performance
 *
 * 4. Adding workspace state:
 *    - Save in saveSettings() if state.rememberWorkspace
 *    - Examples: openTabs, activeTabPath, cursor positions
 *    - Store in _saved prefix: state._savedOpenTabs
 *    - Restore in loadSettings()
 *
 * 5. Adding settings validation:
 *    - Validate in loadSettings() before applying
 *    - Use typeof checks, range checks
 *    - Fall back to defaults if invalid
 *    - Example: parseInt() with || default
 *
 * INTEGRATION POINTS:
 * - state.js: All settings are stored in state object
 * - api.js: fetchWithAuth for server communication
 * - settings-ui.js: Settings UI panel
 * - app.js: Provides callbacks for applying settings
 * - localStorage: Fallback/cache for settings
 *
 * SETTINGS CATEGORIES:
 *
 * 1. UI Customization:
 *    - theme
 *    - fontSize, sidebarWidth
 *    - tabPosition
 *    - showToasts, showHidden, showRecentFiles
 *
 * 2. Editor Settings:
 *    - tabSize, indentWithTabs
 *    - wordWrap, showLineNumbers, showMinimap, showWhitespace
 *    - autoSave, autoSaveDelay
 *
 * 3. File Tree Settings:
 *    - fileTreeCompact, fileTreeShowIcons
 *    - recentFilesLimit
 *
 * 8. Workspace State:
 *    - openTabs: Array of open tab states
 *    - activeTabPath: Currently active tab
 *    - rememberWorkspace: Enable workspace restoration
 *    - favoriteFiles, recentFiles
 *
 * ARCHITECTURE NOTES:
 * - Settings are synced to server (primary storage)
 * - localStorage is used as fallback/cache
 * - Migration happens from localStorage to server on first load
 * - Tab state includes cursor position, scroll position, modified content
 * - Settings save automatically after changes
 * - Debounced saving prevents excessive API calls
 *
 * STORAGE FLOW:
 * 1. Load: Try server → Fall back to localStorage → Use defaults
 * 2. Migrate: If server empty but localStorage has data → Copy to server
 * 3. Save: Write to both server and localStorage
 * 4. Apply: Call callbacks to update UI (theme, colors)
 *
 * COMMON PATTERNS:
 * - Load setting: state.setting = settings.setting || defaultValue
 * - Save setting: settings object includes setting: state.setting
 * - Validate number: parseInt(settings.value) || defaultValue
 * - Validate boolean: settings.value !== false (for default true)
 * - Migrate: if (settings.oldField) { state.newField = convert(settings.oldField) }
 *
 * TAB STATE PRESERVATION:
 * - Saves cursor position per tab
 * - Saves scroll position per tab
 * - Saves modified content (for unsaved changes)
 * - Restores workspace on reload
 * - Controlled by rememberWorkspace setting
 *
 * ============================================================================
 */
import { state, elements } from './state.js';
import { fetchWithAuth } from './api.js';
import { API_BASE } from './constants.js';

// Callbacks for cross-module functions
let callbacks = {
  applyTheme: null,
  applySyntaxColors: null
};

export function registerSettingsCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Loads settings from server and local storage
 * Handles migration from local storage to server
 */
export async function loadSettings() {
  try {
    // 1. Fetch from server
    let settings = {};
    try {
      settings = await fetchWithAuth(`${API_BASE}?action=get_settings`);
    } catch (e) {
      // Failed to fetch settings from server, using local fallback
    }

    // 4. Apply to State
    state.theme = settings.theme || "dark";
    state.showHidden = settings.showHidden || false;
    state.sshHosts = settings.sshHosts || [];
    state.showRecentFiles = settings.showRecentFiles !== false;
    state.favoriteFiles = settings.favoriteFiles || [];
    state.recentFiles = settings.recentFiles || [];
    state.syntaxTheme = settings.syntaxTheme || 'dracula';

    // New UI customization settings
    state.fontSize = parseInt(settings.fontSize) || 14;
    state.tabSize = parseInt(settings.tabSize) || 2;
    state.indentWithTabs = settings.indentWithTabs || false;
    state.sidebarWidth = parseInt(settings.sidebarWidth) || 320;
    state.tabPosition = settings.tabPosition || "top";
    state.wordWrap = settings.wordWrap !== false; // default true
    state.showLineNumbers = settings.showLineNumbers !== false; // default true
    state.showMinimap = settings.showMinimap || false;
    state.showWhitespace = settings.showWhitespace || false;
    state.autoSave = settings.autoSave || false;
    state.autoSaveDelay = parseInt(settings.autoSaveDelay) || 1000;
    state.fileTreeCompact = settings.fileTreeCompact || false;
    state.fileTreeShowIcons = settings.fileTreeShowIcons !== false; // default true
    state.recentFilesLimit = parseInt(settings.recentFilesLimit) || 10;
    state.showToasts = settings.showToasts !== false; // default true

    // Experimental features
    state.enableSplitView = settings.enableSplitView || false; // default false (experimental)

    state.rememberWorkspace = settings.rememberWorkspace !== false; // default true

    // Split view settings
    if (settings.splitView) {
      state.splitView.enabled = settings.splitView.enabled || false;
      state.splitView.orientation = settings.splitView.orientation || 'vertical';
      state.splitView.primaryPaneSize = settings.splitView.primaryPaneSize || 50;
      state.splitView.primaryTabs = settings.splitView.primaryTabs || [];
      state.splitView.secondaryTabs = settings.splitView.secondaryTabs || [];
      state._savedPrimaryActiveTabPath = settings.splitView.primaryActiveTabPath;
      state._savedSecondaryActiveTabPath = settings.splitView.secondaryActiveTabPath;
    }

    state._savedOpenTabs = settings.openTabs || [];
    state._savedActiveTabPath = settings.activeTabPath || null;

    if (callbacks.applyTheme) callbacks.applyTheme();
    if (callbacks.applySyntaxColors) callbacks.applySyntaxColors();

  } catch (e) {
    // Could not load settings
  }
}

/**
 * Saves settings to server and local storage
 * Includes workspace state (open tabs, cursor positions)
 */
export async function saveSettings() {
  try {
    // Update current active tab's cursor/scroll before saving
    if (state.activeTab && state.editor) {
      state.activeTab.cursor = state.editor.getCursor();
      state.activeTab.scroll = state.editor.getScrollInfo();
    }

    // Save open tabs state
    let openTabsState = [];
    let activeTabPath = null;

    if (state.rememberWorkspace) {
      openTabsState = state.openTabs.map(tab => {
        // If this is the active tab, it already has the latest cursor/scroll from above.
        // Other tabs have their cursor/scroll preserved from when they were last active.
        const tabState = {
          path: tab.path,
          modified: tab.modified,
          cursor: tab.cursor,
          scroll: tab.scroll
        };

        // Save modified content so it can be restored
        if (tab.modified && tab.content) {
          tabState.content = tab.content;
          tabState.originalContent = tab.originalContent;
        }

        return tabState;
      });
      activeTabPath = state.activeTab ? state.activeTab.path : null;
    }

    const settings = {
      theme: state.theme,
      showHidden: state.showHidden,
      sshHosts: state.sshHosts,
      showRecentFiles: state.showRecentFiles,
      favoriteFiles: state.favoriteFiles,
      recentFiles: state.recentFiles,
      syntaxTheme: state.syntaxTheme,
      openTabs: openTabsState,
      activeTabPath: activeTabPath,
      // New UI customization settings
      fontSize: state.fontSize,
      tabSize: state.tabSize,
      indentWithTabs: state.indentWithTabs,
      sidebarWidth: state.sidebarWidth,
      tabPosition: state.tabPosition,
      wordWrap: state.wordWrap,
      showLineNumbers: state.showLineNumbers,
      showMinimap: state.showMinimap,
      showWhitespace: state.showWhitespace,
      autoSave: state.autoSave,
      autoSaveDelay: state.autoSaveDelay,
      fileTreeCompact: state.fileTreeCompact,
      fileTreeShowIcons: state.fileTreeShowIcons,
      recentFilesLimit: state.recentFilesLimit,
      enableSplitView: state.enableSplitView, // Experimental feature
      rememberWorkspace: state.rememberWorkspace,
      // Split view settings
      splitView: state.splitView ? {
        enabled: state.splitView.enabled,
        orientation: state.splitView.orientation,
        primaryPaneSize: state.splitView.primaryPaneSize,
        primaryTabs: state.splitView.primaryTabs || [],
        secondaryTabs: state.splitView.secondaryTabs || [],
        primaryActiveTabPath: state.splitView.primaryActiveTab?.path || null,
        secondaryActiveTabPath: state.splitView.secondaryActiveTab?.path || null,
      } : null
    };

    // Save to server
    const savePromise = fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_settings", settings: settings }),
    }).catch(e => console.error("Failed to save settings to server:", e));

    return savePromise;
  } catch (e) {
    // Could not save settings
    return Promise.resolve();
  }
}

/**
 * Updates the show/hide hidden files button state
 */
export function updateShowHiddenButton() {
  if (elements.btnShowHidden) {
    const icon = elements.btnShowHidden.querySelector('.material-icons');
    if (state.showHidden) {
      icon.textContent = 'visibility';
      elements.btnShowHidden.title = 'Hide hidden folders';
      elements.btnShowHidden.classList.add('active');
    } else {
      icon.textContent = 'visibility_off';
      elements.btnShowHidden.title = 'Show hidden folders';
      elements.btnShowHidden.classList.remove('active');
    }
  }
}
