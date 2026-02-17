/**
 * ============================================================================
 * DOWNLOADS & UPLOADS MODULE
 * ============================================================================
 *
 * PURPOSE: File transfers - download files/folders, upload files via drag-drop
 * or file picker. Handles bulk operations and progress tracking.
 *
 * EXPORTED FUNCTIONS:
 * - downloadFile(path) - Download single file
 * - downloadFolder(path) - Download folder as ZIP
 * - downloadContent(filename, content, isBase64, mimeType) - Download from content
 * - uploadFiles(files, targetPath) - Upload multiple files
 *
 * HOW TO ADD FEATURES:
 * 1. Add progress tracking: Show upload/download progress bars
 * 2. Add resume support: Resume interrupted transfers
 * 3. Add compression options: Choose ZIP compression level
 *
 * INTEGRATION: api.js, file-tree.js, ui.js
 * ============================================================================
 */
import { state, elements } from './state.js';
import { fetchWithAuth } from './api.js';
import { API_BASE } from './constants.js';
import { showToast, showGlobalLoading, hideGlobalLoading, showConfirmDialog } from './ui.js';
import { isTextFile, formatBytes } from './utils.js';

// Callbacks for cross-module functions
let callbacks = {
  showConfirmDialog: null,
  showModal: null,
  loadFiles: null,
  renderFileTree: null,
  checkGitStatusIfEnabled: null,
  toggleSelectionMode: null
};

export function registerDownloadsUploadsCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Downloads the currently active file
 */
export function downloadCurrentFile() {
  if (!state.activeTab) {
    showToast("No file open", "warning");
    return;
  }

  const tab = state.activeTab;
  const filename = tab.path.split("/").pop();
  const content = tab.content;
  const isBinary = tab.isBinary || false;
  const mimeType = tab.mimeType || "application/octet-stream";

  // Debug logging
  console.log("Download debug:", {
    filename,
    isBinary,
    mimeType,
    contentType: typeof content,
    contentLength: content ? content.length : 0,
    contentPreview: content ? content.substring(0, 100) : "empty"
  });

  downloadContent(filename, content, isBinary, mimeType);
}

/**
 * Downloads a file by its path
 * Shows a confirmation dialog for large/binary file types before downloading
 */
export async function downloadFileByPath(path) {
  const filename = path.split("/").pop();
  const ext = filename.split(".").pop().toLowerCase();
  const LARGE_FILE_EXTENSIONS = ["db", "sqlite", "sqlite3", "bak", "tar", "gz", "zip", "tar.gz"];

  // Check if we know the file size from state
  let fileSizeInfo = "";
  const fileInfo = state.files.find(f => f.path === path) ||
    (() => {
      for (const [, dir] of state.loadedDirectories) {
        const f = dir.files?.find(f => f.path === path);
        if (f) return f;
      }
      return null;
    })();

  if (fileInfo && typeof fileInfo.size === "number") {
    fileSizeInfo = ` (${formatBytes(fileInfo.size)})`;
  }

  if (LARGE_FILE_EXTENSIONS.includes(ext)) {
    const confirmed = await showConfirmDialog({
      title: "Download Large File?",
      message: `<b>${filename}</b>${fileSizeInfo} may be a very large file.<br><br>Are you sure you want to download it?`,
      confirmText: "Download",
      cancelText: "Cancel"
    });
    if (!confirmed) return;
  }

  // Perform the actual download
  try {
    showGlobalLoading(`Downloading ${filename}...`);
    const data = await fetchWithAuth(
      `${API_BASE}?action=read_file&path=${encodeURIComponent(path)}&_t=${Date.now()}`
    );
    hideGlobalLoading();

    if (data && data.content !== undefined) {
      const isBinary = data.is_base64 || false;
      const mimeType = data.mime_type || "application/octet-stream";
      downloadContent(filename, data.content, isBinary, mimeType);
    } else {
      showToast(`Failed to download ${filename}`, "error");
    }
  } catch (error) {
    hideGlobalLoading();
    showToast(`Failed to download ${filename}: ${error.message}`, "error");
  }
}

/**
 * Generic download handler
 * Creates a blob and triggers browser download
 */
export function downloadContent(filename, content, is_base64 = false, mimeType = "application/octet-stream") {
  try {
    let blobContent;
    let blobType = mimeType;

    if (is_base64) {
      try {
        const binaryString = atob(content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blobContent = [bytes];
      } catch (e) {
        console.error("Failed to decode base64:", e);
        showToast(`Failed to download ${filename}: Invalid base64 data`, "error");
        return;
      }
    } else {
      blobContent = [content];
      if (!blobType || blobType === "application/octet-stream") {
        blobType = "text/plain;charset=utf-8";
      }
    }

    // Create blob and URL
    const blob = new Blob(blobContent, { type: blobType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Revoke after a longer delay to ensure download starts
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast(`Downloaded ${filename}`, "success");
  } catch (error) {
    console.error("Download failed:", error);
    showToast(`Failed to download ${filename}: ${error.message}`, "error");
  }
}

/**
 * Downloads a folder as a ZIP file
 */
export async function downloadFolder(path) {
  try {
    showGlobalLoading("Preparing download...");

    const data = await fetchWithAuth(
      `${API_BASE}?action=download_folder&path=${encodeURIComponent(path)}`
    );

    hideGlobalLoading();

    if (data.success && data.data) {
      // Decode base64 to binary
      const binaryString = atob(data.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create blob and download
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || `${path.split("/").pop()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Downloaded ${data.filename}`, "success");
    }
  } catch (error) {
    showToast("Failed to download folder: " + error.message, "error");
  }
}

/**
 * Downloads selected items (bulk download)
 * Single file downloads directly, multiple items are zipped
 */
export async function downloadSelectedItems() {
  if (state.selectedItems.size === 0) return;

  const paths = Array.from(state.selectedItems);

  // If only one item is selected, check if it's a file or folder
  if (paths.length === 1) {
    const path = paths[0];
    const isFolder = state.folders.some(f => f.path === path);

    if (!isFolder) {
      // Single file selected - download directly
      await downloadFileByPath(path);
      if (callbacks.toggleSelectionMode) callbacks.toggleSelectionMode(); // Exit selection mode
      return;
    }
    // Single folder selected - will be zipped by the logic below
  }

  try {
    showGlobalLoading("Preparing bulk download...");

    const response = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "download_multi", paths }),
    });

    hideGlobalLoading();

    if (response.success && response.data) {
      downloadContent(response.filename, response.data, true, "application/zip");
      showToast(`Downloaded ${paths.length} items`, "success");

      // Exit selection mode after download
      if (callbacks.toggleSelectionMode) callbacks.toggleSelectionMode();
    }
  } catch (error) {
    hideGlobalLoading();
    showToast("Failed to download items: " + error.message, "error");
  }
}

/**
 * Triggers the file upload input click
 */
export function triggerUpload() {
  if (elements.fileUploadInput) {
    elements.fileUploadInput.click();
  }
}

/**
 * Processes file uploads
 * Handles both text and binary files
 */
export async function processUploads(files, targetFolder = null) {
  if (!files || files.length === 0) return;

  const basePath = targetFolder || state.currentFolderPath || "";
  let processedCount = 0;
  let successCount = 0;
  const totalFiles = files.length;

  showGlobalLoading(`Uploading 0 of ${totalFiles} file(s)...`);

  for (const file of files) {
    processedCount++;
    showGlobalLoading(`Uploading ${processedCount} of ${totalFiles} file(s): ${file.name}...`);

    try {
      const isBinaryFile = !isTextFile(file.name);
      let content;
      if (isBinaryFile) {
        content = await readFileAsBase64(file);
      } else {
        content = await readFileAsText(file);
      }

      let filePath = basePath ? `${basePath}/${file.name}` : file.name;

      // Check if file exists
      const existingFile = state.files.find(f => f.path === filePath);
      if (existingFile) {
        if (callbacks.showConfirmDialog) {
          const overwrite = await callbacks.showConfirmDialog({
            title: "File Already Exists",
            message: `File "${file.name}" already exists in ${basePath || "root"}.<br><br>Do you want to overwrite it?`,
            confirmText: "Overwrite",
            cancelText: "Cancel",
            isDanger: true
          });

          if (!overwrite) {
            continue; // Skip this file - don't increment successCount
          }
          await uploadFile(filePath, content, true, isBinaryFile);
          successCount++; // Only increment on successful upload
        }
      } else {
        await uploadFile(filePath, content, false, isBinaryFile);
        successCount++; // Only increment on successful upload
      }
    } catch (error) {
      showGlobalLoading(`Uploading ${processedCount} of ${totalFiles} file(s): ${file.name}...`);
      showToast(`Failed to upload ${file.name}: ${error.message}`, "error");
    }
  }

  hideGlobalLoading();

  if (successCount > 0) {
    showToast(`Successfully uploaded ${successCount} file(s).`, "success");
  } else {
    showToast("No files were uploaded.", "info");
  }
}

/**
 * Handles file input change event
 */
export async function handleFileUpload(event) {
  const files = event.target.files;
  await processUploads(files);
  // Reset input so same file can be uploaded again
  event.target.value = "";
}

/**
 * Reads a file as text
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Reads a file as base64
 */
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove the data URL prefix to get just the base64 data
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a file to the server
 */
export async function uploadFile(path, content, overwrite = false, is_base64 = false) {
  try {
    await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upload_file", path, content, overwrite, is_base64 }),
    });
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Triggers the folder upload input click
 */
export function triggerFolderUpload() {
  if (elements.folderUploadInput) {
    elements.folderUploadInput.click();
  }
}

/**
 * Handles folder upload (ZIP file)
 * Extracts the ZIP to a specified folder
 */
export async function handleFolderUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  if (!file.name.endsWith(".zip")) {
    showToast("Please select a ZIP file", "warning");
    event.target.value = "";
    return;
  }

  const basePath = state.currentFolderPath || "";

  // Prompt for folder name
  const folderName = file.name.replace(".zip", "");
  if (callbacks.showModal) {
    const result = await callbacks.showModal({
      title: "Upload Folder",
      placeholder: "folder_name",
      value: folderName,
      hint: basePath
        ? `ZIP will be extracted to: ${basePath}/<folder_name>`
        : "Enter the folder name to extract ZIP contents to",
    });

    if (!result) {
      event.target.value = "";
      return;
    }

    const targetPath = basePath ? `${basePath}/${result}` : result;

    try {
      showGlobalLoading("Uploading and extracting folder...");

      const zipData = await readFileAsBase64(file);

      const response = await fetchWithAuth(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_folder",
          path: targetPath,
          zip_data: zipData,
        }),
      });

      hideGlobalLoading();

      if (response.success) {
        showToast(`Extracted ${response.files_extracted} files to ${result}`, "success");
        if (callbacks.loadFiles) await callbacks.loadFiles();
        state.expandedFolders.add(targetPath);
        if (callbacks.renderFileTree) callbacks.renderFileTree();

        // Auto-refresh git status after uploading folder
        if (callbacks.checkGitStatusIfEnabled) {
          await callbacks.checkGitStatusIfEnabled();
        }
      }
    } catch (error) {
      hideGlobalLoading();
      showToast("Failed to upload folder: " + error.message, "error");
    }
  }

  event.target.value = "";
}
