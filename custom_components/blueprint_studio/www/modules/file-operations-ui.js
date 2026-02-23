/**
 * ============================================================================
 * FILE OPERATIONS UI MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Handles all dialog prompts for file and folder operations (create, rename,
 * copy, move, delete). Provides consistent input modals and confirmation dialogs
 * for file system operations.
 *
 * EXPORTED FUNCTIONS:
 * - registerFileOperationsUICallbacks(cb) - Register dependencies from app.js
 * - showInputModal(options) - Generic input modal dialog
 * - promptNewFile(initialPath) - Prompt for new file creation
 * - promptNewFolder(initialPath) - Prompt for new folder creation
 * - promptRename(path, isFolder) - Prompt for renaming file/folder
 * - promptCopy(path, isFolder) - Prompt for copying file/folder
 * - promptMove(path, isFolder) - Prompt for moving file/folder
 * - duplicateItem(path, isFolder) - Auto-duplicate with unique name
 * - promptDelete(path, isFolder) - Prompt for deletion confirmation
 *
 * REQUIRED CALLBACKS (from app.js):
 * - resetModalToDefault: Reset modal to default state
 * - showToast: Display notification
 * - showModal: Show basic modal (similar to showInputModal)
 * - showConfirmDialog: Show confirmation dialog
 * - createFile: Create new file
 * - createFolder: Create new folder
 * - renameItem: Rename file/folder
 * - copyItem: Copy file/folder
 * - deleteItem: Delete file/folder
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new file operation prompt:
 *    - Create new exported function (e.g., promptArchive)
 *    - Use showInputModal() for user input
 *    - Validate input
 *    - Call appropriate callback (e.g., callbacks.archiveItem)
 *    - Handle errors with showToast
 *
 * 2. Adding validation to prompts:
 *    - Check result from showInputModal()
 *    - Validate path format, length, special characters
 *    - Check for existing files/folders in state
 *    - Show warning toast if invalid
 *    - Return early if validation fails
 *
 * 3. Adding default values/suggestions:
 *    - Set 'value' option in showInputModal()
 *    - Use state.currentFolderPath for auto-filling paths
 *    - Generate smart defaults (e.g., _copy suffix)
 *
 * 4. Customizing modal appearance:
 *    - Modify showInputModal() options
 *    - Options: title, placeholder, value, hint, confirmText
 *    - Use isDanger: true for destructive actions
 *
 * INTEGRATION POINTS:
 * - state.js: state.currentFolderPath, state.folders, state.files
 * - elements: Modal DOM elements
 * - app.js: Provides all file operation callbacks
 * - file-operations.js: Actual file operations (via callbacks)
 *
 * MODAL OPTIONS:
 * - title: Modal title text
 * - placeholder: Input field placeholder
 * - value: Pre-filled input value
 * - hint: Help text below input
 * - confirmText: Confirm button text (default: "Confirm")
 *
 * ARCHITECTURE NOTES:
 * - This module only shows dialogs - no file operations
 * - Actual operations are in file-operations.js (via callbacks)
 * - All prompts return user input or null if cancelled
 * - Prompts are promise-based for easy async/await usage
 * - Auto-appends .yaml extension if no extension provided
 *
 * COMMON PATTERNS:
 * - const result = await showInputModal({ title, ... });
 * - if (!result) return; // User cancelled
 * - Validate: if (result === basePath || result.endsWith('/')) { showToast(); return; }
 * - Execute: await callbacks.createFile(result);
 * - Auto-fill: value: `${state.currentFolderPath}/`
 *
 * AUTO-NAMING FEATURES:
 * - promptNewFile: Auto-appends .yaml if no extension
 * - promptCopy: Auto-adds _copy suffix before extension
 * - duplicateItem: Auto-finds unique name (_copy, _copy_2, etc.)
 *
 * ============================================================================
 */
import { state, elements } from './state.js';

// Callbacks for cross-module functions
let callbacks = {
  resetModalToDefault: null,
  showToast: null,
  showModal: null,
  showConfirmDialog: null,
  createFile: null,
  createFolder: null,
  renameItem: null,
  copyItem: null,
  deleteItem: null
};

export function registerFileOperationsUICallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Shows a generic input modal and returns the user's input
 * @param {Object} options - Modal configuration
 * @returns {Promise<string|null>} User input or null if cancelled
 */
export function showInputModal({ title, placeholder, value, hint, confirmText }) {
  return new Promise((resolve) => {
      callbacks.resetModalToDefault(); // Ensure DOM structure is correct

      elements.modalTitle.textContent = title;
      if (elements.modalHint) elements.modalHint.textContent = hint || "";

      // Setup Input
      if (elements.modalInput) {
          elements.modalInput.value = value || "";
          elements.modalInput.placeholder = placeholder || "";
          elements.modalInput.style.display = "block";
      }

      // Setup Buttons
      elements.modalConfirm.textContent = confirmText || "Confirm";
      elements.modalConfirm.className = "modal-btn primary";
      elements.modalCancel.textContent = "Cancel";

      // Show Modal
      elements.modalOverlay.classList.add("visible");

      // Focus Input
      setTimeout(() => {
          if (elements.modalInput) {
              elements.modalInput.focus();
              if (elements.modalInput.value) {
                  const len = elements.modalInput.value.length;
                  elements.modalInput.setSelectionRange(len, len);
              }
          }
      }, 100);

      // Handlers
      const cleanup = () => {
          elements.modalOverlay.classList.remove("visible");
          elements.modalConfirm.removeEventListener("click", handleConfirm);
          elements.modalCancel.removeEventListener("click", handleCancel);
          elements.modalClose.removeEventListener("click", handleCancel);
      };

      const handleConfirm = () => {
          const result = elements.modalInput ? elements.modalInput.value : "";
          cleanup();
          resolve(result);
      };

      const handleCancel = () => {
          cleanup();
          resolve(null);
      };

      elements.modalConfirm.addEventListener("click", handleConfirm);
      elements.modalCancel.addEventListener("click", handleCancel);
      elements.modalClose.addEventListener("click", handleCancel);

      // Override the global Enter key behavior for this specific modal instance
      if (elements.modalInput) {
           elements.modalInput.onkeydown = (e) => {
              if (e.key === "Enter") {
                  e.stopPropagation(); // Prevent global handler
                  handleConfirm();
              } else if (e.key === "Escape") {
                  e.stopPropagation();
                  handleCancel();
              }
           };
      }
  });
}

/**
 * Prompts user to create a new file
 * @param {string|null} initialPath - Initial folder path to use
 */
export async function promptNewFile(initialPath = null) {
  // Use provided path or fall back to state
  const basePath = initialPath !== null ? initialPath : (state.currentFolderPath || "");
  const visualPrefix = "/config/";
  // Construct display value: /config/ + relative_path + /
  const defaultValue = basePath ? `${visualPrefix}${basePath}/` : visualPrefix;

  const result = await showInputModal({
    title: "New File",
    placeholder: "filename.yaml",
    value: defaultValue,
    hint: "Enter the full path (e.g., /config/automations/my_light.yaml)",
  });

  if (result) {
    if (result === defaultValue || result.endsWith("/")) {
        callbacks.showToast("Please enter a file name", "warning");
        return;
    }

    let fullPath = result;
    
    // Strip the visual /config/ prefix for the backend
    if (fullPath.startsWith(visualPrefix)) {
      fullPath = fullPath.substring(visualPrefix.length);
    } else if (fullPath.startsWith("/")) {
      // Handle case where user deleted 'config' but kept leading slash
      fullPath = fullPath.substring(1);
    }

    // Auto-append .yaml if no extension is present
    const parts = fullPath.split('/');
    const fileName = parts[parts.length - 1];
    if (fileName && fileName.indexOf('.') === -1) {
      fullPath += ".yaml";
    }

    await callbacks.createFile(fullPath);
  }
}

/**
 * Prompts user to create a new folder
 * @param {string|null} initialPath - Initial folder path to use
 */
export async function promptNewFolder(initialPath = null) {
  // Use provided path or fall back to state
  const basePath = initialPath !== null ? initialPath : (state.currentFolderPath || "");
  const visualPrefix = "/config/";
  const defaultValue = basePath ? `${visualPrefix}${basePath}/` : visualPrefix;

  const result = await showInputModal({
    title: "New Folder",
    placeholder: "folder_name",
    value: defaultValue,
    hint: "Enter the full path (e.g., /config/my_folder)",
  });

  if (result) {
    if (result === defaultValue || result.endsWith("/")) {
        callbacks.showToast("Please enter a folder name", "warning");
        return;
    }
    
    let fullPath = result;
    
    // Strip the visual /config/ prefix for the backend
    if (fullPath.startsWith(visualPrefix)) {
      fullPath = fullPath.substring(visualPrefix.length);
    } else if (fullPath.startsWith("/")) {
      fullPath = fullPath.substring(1);
    }
    
    // Result is the full path since we pre-filled it
    await callbacks.createFolder(fullPath);
  }
}

/**
 * Prompts user to rename a file or folder
 * @param {string} path - Current path
 * @param {boolean} isFolder - Whether it's a folder
 */
export async function promptRename(path, isFolder) {
  const currentName = path.split("/").pop();
  const parentPath = path.split("/").slice(0, -1).join("/");

  const result = await callbacks.showModal({
    title: isFolder ? "Rename Folder" : "Rename File",
    placeholder: "New name",
    value: currentName,
    hint: "Enter the new name",
  });

  if (result && result !== currentName) {
    const newPath = parentPath ? `${parentPath}/${result}` : result;
    await callbacks.renameItem(path, newPath);
  }
}

/**
 * Prompts user to copy a file or folder
 * @param {string} path - Current path
 * @param {boolean} isFolder - Whether it's a folder
 */
export async function promptCopy(path, isFolder) {
  const currentName = path.split("/").pop();
  const parentPath = path.split("/").slice(0, -1).join("/");

  let defaultName = `${currentName}_copy`;

  // If it's a file with an extension, insert _copy before the extension
  if (!isFolder && currentName.includes(".")) {
      const parts = currentName.split(".");
      const ext = parts.pop();
      const name = parts.join(".");
      if (name) { // Ensure it's not just ".gitignore" (empty name)
          defaultName = `${name}_copy.${ext}`;
      }
  }

  const result = await callbacks.showModal({
    title: isFolder ? "Copy Folder" : "Copy File",
    placeholder: "New name",
    value: defaultName,
    hint: "Enter the name for the copy",
  });

  if (result) {
    const newPath = parentPath ? `${parentPath}/${result}` : result;
    await callbacks.copyItem(path, newPath);
  }
}

/**
 * Prompts user to move a file or folder
 * @param {string} path - Current path
 * @param {boolean} isFolder - Whether it's a folder
 */
export async function promptMove(path, isFolder) {
  const currentName = path.split("/").pop();
  const currentFullPath = path;

  const result = await callbacks.showModal({
    title: isFolder ? "Move Folder" : "Move File",
    placeholder: "New path",
    value: currentFullPath,
    hint: "Enter the new full path (e.g., config/folder/file.yaml)",
  });

  if (result && result !== currentFullPath) {
    await callbacks.renameItem(path, result);
  }
}

/**
 * Duplicates a file or folder with an auto-generated name
 * @param {string} path - Current path
 * @param {boolean} isFolder - Whether it's a folder
 */
export async function duplicateItem(path, isFolder) {
  const currentName = path.split("/").pop();
  const parentPath = path.split("/").slice(0, -1).join("/");

  let newName = "";
  let counter = 1;
  let baseName = currentName;
  let ext = "";

  if (!isFolder && currentName.includes(".")) {
      const parts = currentName.split(".");
      ext = "." + parts.pop();
      baseName = parts.join(".");
  }

  // Find a unique name
  while (true) {
      const suffix = counter === 1 ? "_copy" : `_copy_${counter}`;
      newName = `${baseName}${suffix}${ext}`;
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;

      const exists = isFolder
          ? state.folders.some(f => f.path === newPath)
          : state.files.some(f => f.path === newPath);

      if (!exists) break;
      counter++;
      if (counter > 100) {
          callbacks.showToast("Could not generate a unique name", "error");
          return;
      }
  }

  const newPath = parentPath ? `${parentPath}/${newName}` : newName;
  await callbacks.copyItem(path, newPath);
}

/**
 * Prompts user to confirm deletion of a file or folder
 * @param {string} path - Path to delete
 * @param {boolean} isFolder - Whether it's a folder
 */
export async function promptDelete(path, isFolder) {
  const name = path.split("/").pop();
  const result = await callbacks.showConfirmDialog({
    title: isFolder ? "Delete Folder?" : "Delete File?",
    message: `Are you sure you want to delete <b>${name}</b>?${isFolder ? "<br><br>This will permanently delete the folder and all its contents." : ""}`,
    confirmText: "Delete",
    cancelText: "Cancel",
    isDanger: true,
  });

  if (result) {
    await callbacks.deleteItem(path);
  }
}
