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
import { fetchWithAuth, serveFileUrl, urlWithToken } from './api.js';
import { API_BASE } from './constants.js';
import { showToast, showGlobalLoading, hideGlobalLoading } from './ui.js';

// Callbacks for cross-module functions
let callbacks = {
  showConfirmDialog: null,
  showModal: null,
  loadFiles: null,
};

export function registerDownloadsUploadsCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Downloads the currently active file
 */
export async function downloadCurrentFile() {
  if (!state.activeTab) {
    showToast("No file open", "warning");
    return;
  }

  const tab = state.activeTab;
  const filename = tab.path.split("/").pop();
  const url = await serveFileUrl(tab.path);

  downloadFile(url, filename);
}

/**
 * Downloads a file by its path
 * Shows a confirmation dialog for large/binary file types before downloading
 */
export async function downloadFileByPath(path) {
  const filename = path.split("/").pop();

  // Perform the actual download
  try {
    const url = await serveFileUrl(path);

    downloadFile(url, filename);
  } catch (error) {
    hideGlobalLoading();
    showToast(`Failed to download ${filename}: ${error.message}`, "error");
  }
}

export function downloadFile(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Downloads a folder as a ZIP file
 */
export async function downloadFolder(path) {
  try {
    const url = await urlWithToken(
      `${API_BASE}?action=download_folder&path=${encodeURIComponent(path)}`
    );

    const a = document.createElement("a");
    a.href = url;
    a.download = `${path.split("/").pop()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (error) {
    showToast("Failed to download folder: " + error.message, "error");
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
          await uploadFile(filePath, file, true);
          successCount++; // Only increment on successful upload
        }
      } else {
        await uploadFile(filePath, file, false);
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

    if (callbacks.loadFiles) await callbacks.loadFiles();
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
 * Uploads a file to the server
 */
export async function uploadFile(path, file, overwrite = false) {
  try {
    const data = new FormData();
    data.append("action", "upload_file");
    data.append("path", path);
    data.append("overwrite", overwrite);
    data.append("file", file);
    await fetchWithAuth(API_BASE, {
      method: "POST",
      body: data,
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

      const data = new FormData();
      data.append("action", "upload_folder");
      data.append("path", targetPath);
      data.append("file", file);
      const response = await fetchWithAuth(API_BASE, {
        method: "POST",
        body: data,
      });

      hideGlobalLoading();

      if (response.success) {
        showToast(`Extracted ${response.files_extracted} files to ${result}`, "success");
        state.expandedFolders.add(targetPath);
        if (callbacks.loadFiles) await callbacks.loadFiles();
      }
    } catch (error) {
      hideGlobalLoading();
      showToast("Failed to upload folder: " + error.message, "error");
    }
  }

  event.target.value = "";
}
