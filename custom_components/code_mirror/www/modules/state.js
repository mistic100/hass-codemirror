/**
 * ============================================================================
 * STATE MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Central state management for CodeMirror. This module exports reactive
 * state objects that hold ALL application data including files, tabs, settings,
 * and UI state. This is the single source of truth for the app.
 *
 * EXPORTED OBJECTS:
 * - state: Main application state
 * - elements: DOM element references
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new state property:
 *    - Add to appropriate state object (state)
 *    - Set sensible default value
 *    - Document in STATE PROPERTIES section below
 *    - Add to settings.js if it should persist
 *    - Update UI when state changes
 *
 * 2. Adding a new DOM element reference:
 *    - Add to elements object
 *    - Use document.getElementById() or querySelector()
 *    - Initialize in initialization.js
 *    - Access via elements.elementName in other modules
 *
 * 4. Making state reactive:
 *    - Consider using Proxy for reactivity
 *    - Or implement getter/setter pattern
 *    - Trigger UI updates on changes
 *    - Example: use observers or event emitters
 *
 * 5. Adding computed properties:
 *    - Create getter function
 *    - Derive from existing state
 *    - Example: get activeFileName() { return state.activeTab?.name }
 *
 * INTEGRATION POINTS:
 * - ALL modules import and use state
 * - settings.js: Persists state to storage
 * - initialization.js: Initializes elements
 * - Every module reads/writes state
 *
 * STATE PROPERTIES:
 *
 * FILE SYSTEM:
 * - files: Array of file objects
 * - folders: Array of folder objects
 * - allItems: Combined files + folders
 * - fileTree: Nested tree structure
 * - expandedFolders: Set of expanded folder paths
 * - currentFolderPath: Currently selected folder
 *
 * TABS & EDITOR:
 * - openTabs: Array of open tab objects
 * - activeTab: Currently active tab object
 * - editor: CodeMirror instance
 * - _savedOpenTabs: Persisted tab state
 * - _savedActiveTabPath: Persisted active tab
 *
 * SEARCH:
 * - searchQuery: File tree search query
 * - contentSearchEnabled: Whether content search is active
 * - contentSearchResults: Set of matching file paths
 *
 * UI STATE:
 * - isMobile: Whether on mobile device
 * - sidebarVisible: Sidebar visibility
 * - theme: Current theme ("dark" or "light")
 * - showHidden: Show hidden files
 * - showRecentFiles: Show recent files panel
 *
 * FAVORITES & RECENT:
 * - favoriteFiles: Array of favorited file paths
 * - recentFiles: Array of recently opened files
 * - recentFilesLimit: Max recent files to keep
 *
 * EDITOR SETTINGS:
 * - fontSize: Editor font size
 * - tabSize: Tab width in spaces
 * - indentWithTabs: Use tabs vs spaces
 * - wordWrap: Line wrapping
 * - showLineNumbers: Show line numbers
 * - showWhitespace: Show whitespace
 * - autoSave: Auto-save enabled
 * - autoSaveDelay: Auto-save delay (ms)
 *
 * UI CUSTOMIZATION:
 * - theme: Theme name
 * - sidebarWidth: Sidebar width (px)
 * - fileTreeCompact: Compact file tree
 * - fileTreeShowIcons: Show file icons
 * - showToasts: Show toast notifications
 *
 * OTHER:
 * - rememberWorkspace: Remember open tabs
 *
 * ELEMENTS (elements object):
 * All DOM element references cached for performance
 * - Buttons, panels, inputs, containers, etc.
 * - Initialize in initialization.js
 * - Access in all modules
 *
 * ARCHITECTURE NOTES:
 * - State is mutable (not immutable like Redux)
 * - Direct property assignment: state.property = value
 * - No automatic reactivity - must manually trigger UI updates
 * - State persisted via settings.js
 * - Elements cached for performance (no repeated querySelector)
 *
 * COMMON PATTERNS:
 * - Read state: const files = state.files
 * - Update state: state.files = newFiles; renderFileTree()
 * - Access element: elements.fileTree.innerHTML = ...
 * - Check mobile: if (state.isMobile) { ... }
 * - Tab operations: state.openTabs.push(tab); state.activeTab = tab
 *
 * BEST PRACTICES:
 * - Always update UI after changing state
 * - Don't store computed values - compute on demand
 * - Use Set for collections needing fast lookup
 * - Cache elements in elements object, not local variables
 * - Document new state properties in settings.js if persistent
 *
 * ============================================================================
 */
import { MOBILE_BREAKPOINT } from './constants.js';

export const state = {
  files: [],
  folders: [],
  allItems: [],
  fileTree: {},
  openTabs: [],
  activeTab: null,
  expandedFolders: new Set(),
  favoriteFiles: [],
  recentFiles: [],
  searchQuery: "",
  contentSearchEnabled: false,
  contentSearchResults: null,
  isMobile: window.innerWidth <= MOBILE_BREAKPOINT,
  sidebarVisible: window.innerWidth > MOBILE_BREAKPOINT,
  theme: "dark",
  showHidden: false,
  showRecentFiles: true,
  contextMenuTarget: null,
  tabContextMenuTarget: null,
  currentFolderPath: "",
  loadedDirectories: new Map(), // Cache: path -> {folders: [], files: []}
  loadingDirectories: new Set(), // Track which directories are currently loading
  editor: null,
  selectionMode: false,
  selectedItems: new Set(),

  fontSize: 14,
  tabSize: 2,
  indentWithTabs: false,
  sidebarWidth: 320,
  wordWrap: true,
  showLineNumbers: true,
  showWhitespace: false,
  autoSave: false,
  autoSaveDelay: 1000,
  fileTreeCompact: false,
  fileTreeShowIcons: true,
  recentFilesLimit: 10,
  rememberWorkspace: true,
  showToasts: true,
  // Internal tracking
  _wsUpdateTimer: null,
  _savedOpenTabs: null,
  _savedActiveTabPath: null,
  // Quick switcher
  quickSwitcherSelectedIndex: 0,
  // Search overlay
  searchOverlay: null,
  activeMatchMark: null,
  searchCaseSensitive: false, // Editor search: match case (exact match)
  searchWholeWord: false,     // Editor search: match whole word
  searchUseRegex: false,      // Editor search: use regular expression
  syntaxTheme: 'dracula',     // Pre-defined syntax highlighting theme
};

export const elements = {};
