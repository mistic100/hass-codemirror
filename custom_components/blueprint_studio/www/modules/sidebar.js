/**
 * ============================================================================
 * SIDEBAR MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Manages sidebar visibility, view switching (files/git/gitea/search/settings),
 * and responsive behavior. Controls the main navigation panel on the left.
 *
 * EXPORTED FUNCTIONS:
 * - showSidebar() - Show sidebar
 * - hideSidebar() - Hide sidebar
 * - toggleSidebar() - Toggle sidebar visibility
 * - switchSidebarView(view) - Switch to specific view
 * - getSidebarView() - Get current active view
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new sidebar view:
 *    - Add view button to HTML sidebar
 *    - Add view content panel
 *    - Add case in switchSidebarView()
 *    - Update getSidebarView() if needed
 *    - Example: AI assistant panel, notifications panel
 *
 * 2. Adding view-specific state:
 *    - Track in state.currentSidebarView
 *    - Persist in settings if needed
 *    - Restore on app load
 *
 * 3. Making sidebar collapsible:
 *    - Already implemented via toggleSidebar()
 *    - Mobile auto-hides on file open
 *    - Desktop persists state
 *
 * INTEGRATION POINTS:
 * - state.js: state.sidebarVisible, state.isMobile
 * - elements: Sidebar DOM elements
 * - event-handlers.js: Keyboard shortcuts
 * - All sidebar views (files, git, search, etc.)
 *
 * VIEWS:
 * - files: File tree view (default)
 * - git: Git integration panel
 * - gitea: Gitea integration panel
 * - search: Global search panel
 * - settings: Settings panel
 * - ai: AI assistant (if enabled)
 *
 * COMMON PATTERNS:
 * - Switch view: switchSidebarView('git')
 * - Toggle: toggleSidebar()
 * - Mobile auto-hide: if (isMobile()) hideSidebar()
 *
 * ============================================================================
 */
import { state, elements } from './state.js';
import { isMobile } from './utils.js';

/**
 * Shows the sidebar
 */
export function showSidebar() {
  state.sidebarVisible = true;
  if (isMobile()) {
    elements.sidebar.classList.add("visible");
    elements.sidebarOverlay.classList.add("visible");
  } else {
    elements.sidebar.classList.remove("hidden");
  }
}

/**
 * Hides the sidebar
 */
export function hideSidebar() {
  state.sidebarVisible = false;
  if (isMobile()) {
    elements.sidebar.classList.remove("visible");
    elements.sidebarOverlay.classList.remove("visible");
  } else {
    elements.sidebar.classList.add("hidden");
  }
}

/**
 * Switches sidebar view (explorer, search, etc.)
 * @param {string} viewName - Name of the view to switch to
 */
export function switchSidebarView(viewName) {
  if (!state.sidebarVisible) {
    showSidebar();
  }

  if (elements.activityExplorer) elements.activityExplorer.classList.toggle("active", viewName === "explorer");
  if (elements.activitySearch) elements.activitySearch.classList.toggle("active", viewName === "search");

  if (elements.viewExplorer) {
    elements.viewExplorer.style.display = viewName === "explorer" ? "flex" : "none";
    elements.viewExplorer.classList.toggle("hidden", viewName !== "explorer");
  }
  if (elements.viewSearch) {
    elements.viewSearch.style.display = viewName === "search" ? "flex" : "none";
    elements.viewSearch.classList.toggle("hidden", viewName !== "search");

    if (viewName === "search" && elements.globalSearchInput) {
      setTimeout(() => elements.globalSearchInput.focus(), 100);
    }
  }
}

/**
 * Toggles sidebar visibility
 */
export function toggleSidebar() {
  if (state.sidebarVisible) {
    hideSidebar();
  } else {
    showSidebar();
  }
}
