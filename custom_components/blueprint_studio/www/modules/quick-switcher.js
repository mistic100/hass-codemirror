/**
 * ============================================================================
 * QUICK SWITCHER MODULE
 * ============================================================================
 *
 * PURPOSE: Fast file navigation with fuzzy search (Cmd+P / Ctrl+P).
 * Quickly jump to any file by typing part of its name.
 *
 * EXPORTED FUNCTIONS:
 * - showQuickSwitcher() - Open quick switcher
 * - hideQuickSwitcher() - Close quick switcher
 * - registerQuickSwitcherCallback(cb) - Register file open callback
 *
 * HOW TO ADD FEATURES:
 * 1. Add fuzzy matching: Improve search algorithm for better results
 * 2. Add recent files priority: Show recently used files first
 * 3. Add file previews: Show file content preview on hover
 *
 * INTEGRATION: state.js, event-handlers.js (Cmd+P), file-tree.js
 * ============================================================================
 */
import { state, elements } from './state.js';
import { getFileIcon } from './utils.js';

// Callback for opening files (registered from app.js)
let openFileCallback = null;

export function registerQuickSwitcherCallbacks(callbacks) {
  openFileCallback = callbacks.openFile;
}

/**
 * Shows the quick switcher overlay
 */
export function showQuickSwitcher() {
  if (!elements.quickSwitcherOverlay) return;
  elements.quickSwitcherOverlay.classList.add("visible");
  elements.quickSwitcherInput.value = "";
  elements.quickSwitcherInput.focus();
  updateQuickSwitcherResults("");
}

/**
 * Hides the quick switcher overlay
 */
export function hideQuickSwitcher() {
  if (!elements.quickSwitcherOverlay) return;
  elements.quickSwitcherOverlay.classList.remove("visible");
}

/**
 * Updates quick switcher results based on query
 * @param {string} query - Search query
 */
export function updateQuickSwitcherResults(query) {
  if (!elements.quickSwitcherResults) return;

  query = query.toLowerCase();
  let matches = [];

  // Filter files
  if (!query) {
    // Show recent files if no query
    matches = state.recentFiles.map(path => {
      return state.files.find(f => f.path === path);
    }).filter(f => f); // Filter out nulls

    // Fill up with other files up to limit
    if (matches.length < 20) {
      const others = state.files.filter(f => !state.recentFiles.includes(f.path));
      matches = matches.concat(others.slice(0, 20 - matches.length));
    }
  } else {
    // Simple fuzzy: check if name includes query
    matches = state.files.filter(f => f.name.toLowerCase().includes(query));

    // Also search paths if few matches
    if (matches.length < 10) {
      const pathMatches = state.files.filter(f =>
        !matches.includes(f) && f.path.toLowerCase().includes(query)
      );
      matches = matches.concat(pathMatches);
    }
  }

  // Limit results
  matches = matches.slice(0, 50);
  state.quickSwitcherSelectedIndex = 0;

  let html = "";
  matches.forEach((file, index) => {
    const fileIcon = getFileIcon(file.path);
    const isSelected = index === 0 ? "selected" : "";

    html += `
      <div class="quick-switcher-item ${isSelected}" data-index="${index}" data-path="${file.path}">
        <span class="material-icons ${fileIcon.class}">${fileIcon.icon}</span>
        <span class="quick-switcher-name">${file.name}</span>
        <span class="quick-switcher-path">${file.path}</span>
      </div>
    `;
  });

  if (matches.length === 0) {
    html = `<div style="padding: 16px; text-align: center; color: var(--text-secondary);">No files found</div>`;
  }

  elements.quickSwitcherResults.innerHTML = html;
}

/**
 * Initialize quick switcher event handlers
 * Should be called once during app initialization
 */
export function initQuickSwitcherEvents() {
  // Input handler
  if (elements.quickSwitcherInput) {
    elements.quickSwitcherInput.addEventListener("input", (e) => {
      updateQuickSwitcherResults(e.target.value);
    });

    // Keyboard navigation
    elements.quickSwitcherInput.addEventListener("keydown", (e) => {
      const items = elements.quickSwitcherResults.querySelectorAll(".quick-switcher-item");
      if (items.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[state.quickSwitcherSelectedIndex].classList.remove("selected");
        state.quickSwitcherSelectedIndex = (state.quickSwitcherSelectedIndex + 1) % items.length;
        items[state.quickSwitcherSelectedIndex].classList.add("selected");
        items[state.quickSwitcherSelectedIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[state.quickSwitcherSelectedIndex].classList.remove("selected");
        state.quickSwitcherSelectedIndex = (state.quickSwitcherSelectedIndex - 1 + items.length) % items.length;
        items[state.quickSwitcherSelectedIndex].classList.add("selected");
        items[state.quickSwitcherSelectedIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        const path = items[state.quickSwitcherSelectedIndex].dataset.path;
        if (openFileCallback) {
          openFileCallback(path);
        }
        hideQuickSwitcher();
      }
    });
  }

  // Overlay click to close
  if (elements.quickSwitcherOverlay) {
    elements.quickSwitcherOverlay.addEventListener("click", (e) => {
      if (e.target === elements.quickSwitcherOverlay) {
        hideQuickSwitcher();
      }
    });
  }

  // Click on result to open
  if (elements.quickSwitcherResults) {
    elements.quickSwitcherResults.addEventListener("click", (e) => {
      const item = e.target.closest(".quick-switcher-item");
      if (item && openFileCallback) {
        openFileCallback(item.dataset.path);
        hideQuickSwitcher();
      }
    });
  }
}

