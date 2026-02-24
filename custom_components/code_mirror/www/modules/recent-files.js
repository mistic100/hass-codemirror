/**
 * ============================================================================
 * RECENT FILES MODULE
 * ============================================================================
 *
 * PURPOSE: Tracks and displays recently opened files for quick access.
 * Maintains list in order of last opened, persists across sessions.
 *
 * EXPORTED FUNCTIONS:
 * - registerRecentFilesCallbacks(cb) - Register dependencies
 * - renderRecentFilesPanel() - Render recent files in sidebar
 * - addToRecentFiles(path) - Add file to recent list
 *
 * HOW TO ADD FEATURES:
 * 1. Add clear recent: Button to clear all recent files
 * 2. Add pin recent: Pin files to keep at top
 * 3. Add recent limit setting: Configurable max recent files
 *
 * INTEGRATION: settings.js (persistence), sidebar.js, constants.js (limit)
 * ============================================================================
 */
import { state } from './state.js';
import { MAX_RECENT_FILES } from './constants.js';
import { getFileIcon, isMobile } from './utils.js';

// Callbacks for cross-module functions
let callbacks = {
  openFile: null,
  hideSidebar: null,
  showContextMenu: null
};

export function registerRecentFilesCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Render the recent files panel in the sidebar
 */
export function renderRecentFilesPanel() {
  const recentFilesContainer = document.getElementById("recent-files-panel");
  if (!recentFilesContainer) return;

  if (!state.showRecentFiles) {
    recentFilesContainer.style.display = "none";
    return;
  }

  // Filter existing files and apply limit
  const limit = state.recentFilesLimit || MAX_RECENT_FILES;
  const existingRecentFiles = state.recentFiles
    .filter(filePath => state.files.some(f => f.path === filePath))
    .slice(0, limit);

  if (existingRecentFiles.length === 0) {
    recentFilesContainer.style.display = "none";
    return;
  }

  recentFilesContainer.style.display = "block";
  recentFilesContainer.innerHTML = '<div class="recent-files-header">Recent Files</div><div class="recent-files-list" id="recent-files-list"></div>';
  const listContainer = document.getElementById("recent-files-list");

  existingRecentFiles.forEach((filePath) => {
    const fileName = filePath.split("/").pop();
    const item = document.createElement("div");
    item.className = "tree-item recent-item";
    item.style.setProperty("--depth", 0);

    const fileIcon = getFileIcon(filePath);
    const isActive = state.activeTab && state.activeTab.path === filePath;

    item.innerHTML = `
      <div class="tree-chevron hidden"></div>
      <div class="tree-icon ${fileIcon.class}">
        <span class="material-icons">${fileIcon.icon}</span>
      </div>
      <span class="tree-name">${fileName}</span>
    `;

    if (isActive) {
      item.classList.add("active");
    }

    const tab = state.openTabs.find((t) => t.path === filePath);
    if (tab && tab.modified) {
      item.classList.add("modified");
    }

    item.addEventListener("click", (e) => {
      if (callbacks.openFile) callbacks.openFile(filePath);
      if (isMobile() && callbacks.hideSidebar) callbacks.hideSidebar();
    });

    // Context menu
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (callbacks.showContextMenu) {
        callbacks.showContextMenu(e.clientX, e.clientY, { path: filePath, isFolder: false });
      }
    });

    listContainer.appendChild(item);
  });
}
