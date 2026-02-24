/**
 * ============================================================================
 * BREADCRUMB MODULE
 * ============================================================================
 *
 * PURPOSE: Displays breadcrumb path navigation showing current file location.
 * Allows clicking path segments to navigate to folders.
 *
 * EXPORTED FUNCTIONS:
 * - updateBreadcrumb(path) - Update breadcrumb with file path
 *
 * HOW TO ADD FEATURES:
 * 1. Add breadcrumb styles: Modify CSS for different display modes
 * 2. Add breadcrumb actions: Click to copy path, open folder, etc.
 *
 * INTEGRATION: state.js, elements, file-tree.js
 * ============================================================================
 */
import { elements } from './state.js';

/**
 * Updates the breadcrumb navigation with the current file path
 * @param {string} path - File path to display
 */
export function updateBreadcrumb(path) {
  if (!elements.breadcrumb) return;

  elements.breadcrumb.innerHTML = "";

  if (!path) return;

  const parts = path.split("/");
  let currentPath = "";

  parts.forEach((part, index) => {
    if (index > 0) {
      currentPath += "/";
    }
    currentPath += part;

    // Create breadcrumb item
    const item = document.createElement("span");
    item.className = "breadcrumb-item";

    const link = document.createElement("span");
    link.className = "breadcrumb-link";
    link.textContent = part;
    link.title = currentPath;

    // Make all parts except the last one clickable to open folder
    if (index < parts.length - 1) {
      const folderPath = currentPath;
      link.style.cursor = "pointer";
      link.addEventListener("click", () => {
        // Expand folder in tree
        expandFolderInTree(folderPath);
      });
    }

    item.appendChild(link);

    // Add separator except for last item
    if (index < parts.length - 1) {
      const separator = document.createElement("span");
      separator.className = "breadcrumb-separator";
      separator.textContent = "›";
      item.appendChild(separator);
    }

    elements.breadcrumb.appendChild(item);
  });
}

/**
 * Expands a folder in the file tree by triggering a click
 * @param {string} folderPath - Path to the folder to expand
 */
export function expandFolderInTree(folderPath) {
  // This will expand the folder in the file tree
  // The folder is already rendered, we just need to expand it
  const folderElement = document.querySelector(`[data-path="${folderPath}"]`);
  if (folderElement && folderElement.classList.contains("tree-item")) {
    // Trigger click on the folder to expand it
    folderElement.click();
  }
}
