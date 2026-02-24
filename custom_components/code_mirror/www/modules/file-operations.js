/**
 * ============================================================================
 * FILE OPERATIONS MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Handles all file system operations including creating, deleting, copying,
 * renaming, and validating files and folders. This module contains the actual
 * file operation logic (not UI - see file-operations-ui.js for dialogs).
 *
 * EXPORTED FUNCTIONS:
 * Core Operations:
 * - registerFileOperationsCallbacks(cb) - Register dependencies
 * - createFile(path, content) - Create new file
 * - createFolder(path) - Create new folder
 * - deleteItem(path) - Delete file or folder
 * - renameItem(oldPath, newPath) - Rename/move file or folder
 * - copyItem(sourcePath, destPath) - Copy file or folder
 *
 * Validation:
 * - validateYaml(yamlText) - Validate YAML syntax
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new file operation:
 *    - Create exported async function
 *    - Use fetchWithAuth() to call server API
 *    - Pass action: "operation_name" + parameters
 *    - Handle success/error responses
 *    - Show toast notification
 *    - Refresh file list: await callbacks.loadFiles()
 *
 * 2. Adding file validation:
 *    - Create validate* function
 *    - Parse content (YAML, JSON, etc.)
 *    - Return errors array or null
 *    - Use in editor linting
 *    - Example: validateJson(), validateXml()
 *
 * 3. Adding bulk operations:
 *    - Accept array of paths
 *    - Loop and call individual operations
 *    - Or create single API call for batch
 *    - Show progress indicator
 *    - Handle partial failures
 *
 * 4. Adding file templates:
 *    - Create template content strings
 *    - Pass as content to createFile()
 *    - Add template selector UI
 *    - Examples: automation template, script template
 *
 * INTEGRATION POINTS:
 * - file-operations-ui.js: UI dialogs (prompts user, then calls these functions)
 * - file-tree.js: Updates after operations
 * - api.js: Server communication
 * - app.js: Coordination layer
 *
 * SERVER API ACTIONS:
 * - create_file: Create new file
 * - create_folder: Create new folder
 * - delete_file: Delete file/folder
 * - rename_file: Rename/move file/folder
 * - copy_file: Copy file/folder
 *
 * ARCHITECTURE NOTES:
 * - This module does actual operations (file-operations-ui.js shows dialogs)
 * - All operations are async (server-side execution)
 * - Operations auto-refresh file list
 * - Error handling with toast notifications
 * - Validation happens client-side for performance
 *
 * COMMON PATTERNS:
 * - Create: await createFile(path, content); await callbacks.loadFiles()
 * - Delete: await deleteItem(path); await callbacks.loadFiles()
 * - Validate: const errors = validateYaml(content); if (errors) { show errors }
 * - Error handling: try { await operation() } catch (e) { showToast(error) }
 *
 * YAML VALIDATION:
 * - Uses js-yaml library
 * - Returns array of error objects
 * - Shows line numbers
 * - Integrates with editor linting
 *
 * FILE OPERATION FLOW:
 * 1. User triggers from UI (file-operations-ui.js shows dialog)
 * 2. Dialog calls function here with parameters
 * 3. Function calls server API via fetchWithAuth()
 * 4. Server performs operation
 * 5. Success: Refresh file list + show toast
 * 6. Error: Show error toast
 *
 * ============================================================================
 */
import { state, elements } from './state.js';
import { fetchWithAuth } from './api.js';
import { API_BASE } from './constants.js';
import { showToast } from './ui.js';
import { loadScript } from './utils.js';

// Callbacks for cross-module functions
let callbacks = {
  loadFiles: null,
  openFile: null,
  closeTab: null,
  renderFileTree: null,
  renderTabs: null,
  updateToolbarState: null
};

export function registerFileOperationsCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Create a new file
 */
export async function createFile(path, content = "", is_base64 = false) {
  try {
    await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_file", path, content, is_base64 }),
    });
    showToast(`Created ${path.split("/").pop()}`, "success");
    if (callbacks.loadFiles) await callbacks.loadFiles();
    if (callbacks.openFile) callbacks.openFile(path);

    return true;
  } catch (error) {
    showToast("Failed to create file: " + error.message, "error");
    return false;
  }
}

/**
 * Create a new folder
 */
export async function createFolder(path) {
  try {
    await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_folder", path }),
    });
    showToast(`Created folder ${path.split("/").pop()}`, "success");
    if (callbacks.loadFiles) await callbacks.loadFiles();
    state.expandedFolders.add(path);
    if (callbacks.renderFileTree) callbacks.renderFileTree();

    return true;
  } catch (error) {
    showToast("Failed to create folder: " + error.message, "error");
    return false;
  }
}

/**
 * Delete a file or folder
 */
export async function deleteItem(path) {
  try {
    await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", path }),
    });
    showToast(`Deleted ${path.split("/").pop()}`, "success");

    // Close tab if open
    const tab = state.openTabs.find(t => t.path === path);
    if (tab && callbacks.closeTab) {
      callbacks.closeTab(tab, true);
    }

    if (callbacks.loadFiles) await callbacks.loadFiles();

    return true;
  } catch (error) {
    showToast("Failed to delete: " + error.message, "error");
    return false;
  }
}

/**
 * Copy a file or folder
 */
export async function copyItem(source, destination) {
  try {
    await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "copy", source, destination }),
    });
    showToast(`Copied to ${destination.split("/").pop()}`, "success");
    if (callbacks.loadFiles) await callbacks.loadFiles();

    return true;
  } catch (error) {
    showToast("Failed to copy: " + error.message, "error");
    return false;
  }
}

/**
 * Rename a file or folder
 */
export async function renameItem(source, destination) {
  try {
    await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", source, destination }),
    });
    showToast(`Renamed to ${destination.split("/").pop()}`, "success");

    // Update tab path if open
    const tab = state.openTabs.find(t => t.path === source);
    if (tab) {
      tab.path = destination;
      if (callbacks.renderTabs) callbacks.renderTabs();
    }

    if (callbacks.loadFiles) await callbacks.loadFiles();

    return true;
  } catch (error) {
    showToast("Failed to rename: " + error.message, "error");
    return false;
  }
}

/**
 * Pre-process YAML to fix common indentation issues
 * Helps avoid syntax errors when formatting
 */
function fixYamlIndentation(content) {
  const lines = content.split('\n');
  const fixed = [];
  let currentIndent = 0;
  let inListContext = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      fixed.push(line);
      continue;
    }

    // Detect list items
    if (trimmed.startsWith('- ')) {
      // Get the indentation of previous list item (if any)
      if (inListContext && i > 0) {
        // Find the last list item to match its indentation
        for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j];
          const prevTrimmed = prevLine.trim();
          if (prevTrimmed.startsWith('- ')) {
            const prevIndent = prevLine.match(/^(\s*)/)[1].length;
            const content = trimmed.substring(2); // Remove '- '
            fixed.push(' '.repeat(prevIndent) + '- ' + content);
            inListContext = true;
            break;
          }
          // If we hit a non-list line, use current indentation
          if (prevTrimmed && !prevTrimmed.startsWith('- ')) {
            fixed.push(line);
            inListContext = true;
            break;
          }
        }
      } else {
        // First list item - keep as is
        fixed.push(line);
        inListContext = true;
      }
    } else if (trimmed.includes(':') && !trimmed.startsWith('- ')) {
      // Key-value pair - reset list context
      inListContext = false;
      fixed.push(line);
    } else {
      // Other content
      fixed.push(line);
    }
  }

  return fixed.join('\n');
}

/**
 * Format code using Prettier
 */
export async function formatCode() {
  if (!state.editor) return;

  const activeTab = state.activeTab;
  if (!activeTab) return;

  const content = state.editor.getValue();
  const filePath = activeTab.path;
  const fileName = filePath.split('/').pop();

  // Determine file type
  let parser = null;
  if (fileName.match(/\.ya?ml$/i)) {
    parser = 'yaml';
  } else if (fileName.match(/\.json$/i)) {
    parser = 'json';
  } else if (fileName.match(/\.jsx?$/i)) {
    parser = 'babel';
  } else if (fileName.match(/\.tsx?$/i)) {
    parser = 'typescript';
  } else if (fileName.match(/\.css$/i)) {
    parser = 'css';
  } else if (fileName.match(/\.s[ca]ss$/i)) {
    parser = 'scss';
  } else if (fileName.match(/\.html?$/i)) {
    parser = 'html';
  } else if (fileName.match(/\.md$/i)) {
    parser = 'markdown';
  } else {
    showToast("Formatting not supported for this file type", "warning");
    return;
  }

  try {
    // Load Prettier if not already loaded
    if (!window.prettier) {
      showToast("Loading formatter...", "info");
      await loadPrettier();
    }

    // Pre-process YAML to fix common indentation issues
    let contentToFormat = content;
    if (parser === 'yaml') {
      contentToFormat = fixYamlIndentation(content);
    }

    // Format the code
    const formatted = await window.prettier.format(contentToFormat, {
      parser: parser,
      plugins: window.prettierPlugins,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: false,
      trailingComma: 'none',
      bracketSpacing: true,
      arrowParens: 'avoid',
      printWidth: 80,
      endOfLine: 'lf'
    });

    // Only update if content changed
    if (formatted !== content) {
      const cursor = state.editor.getCursor();
      const scroll = state.editor.getScrollInfo();

      state.editor.setValue(formatted);

      // Restore cursor position (approximate)
      state.editor.setCursor(cursor);
      state.editor.scrollTo(scroll.left, scroll.top);

      // Mark as modified
      activeTab.modified = true;
      activeTab.content = formatted;

      if (callbacks.renderTabs) callbacks.renderTabs();
      if (callbacks.updateToolbarState) callbacks.updateToolbarState();

      showToast("Code formatted successfully", "success");
    } else {
      showToast("Code is already formatted", "info");
    }
  } catch (error) {
    console.error("Formatting error:", error);

    // Check if it's a syntax error
    if (error.message && (error.message.includes('SyntaxError') || error.message.includes('YAMLSyntaxError'))) {
      showToast("Cannot format: File has syntax errors. Fix syntax errors first.", "error");

      // Extract line number if available
      const lineMatch = error.message.match(/\((\d+):/);
      if (lineMatch && state.editor) {
        const lineNum = parseInt(lineMatch[1]) - 1;
        state.editor.setCursor(lineNum, 0);
        state.editor.focus();
        showToast(`Syntax error at line ${lineNum + 1}. Check indentation.`, "warning");
      }
    } else {
      showToast(`Formatting failed: ${error.message}`, "error");
    }
  }
}

/**
 * Load Prettier library and plugins
 */
async function loadPrettier() {
  if (window.prettier) return; // Already loaded

  try {
    // Load Prettier standalone
    await loadScript("https://unpkg.com/prettier@3.2.5/standalone.js");

    // Load plugins
    await loadScript("https://unpkg.com/prettier@3.2.5/plugins/babel.js");
    await loadScript("https://unpkg.com/prettier@3.2.5/plugins/estree.js");
    await loadScript("https://unpkg.com/prettier@3.2.5/plugins/yaml.js");
    await loadScript("https://unpkg.com/prettier@3.2.5/plugins/html.js");
    await loadScript("https://unpkg.com/prettier@3.2.5/plugins/markdown.js");
    await loadScript("https://unpkg.com/prettier@3.2.5/plugins/postcss.js");
    await loadScript("https://unpkg.com/prettier@3.2.5/plugins/typescript.js");

    // Store plugins for Prettier to use
    window.prettierPlugins = {
      babel: window.prettierPlugins.babel,
      estree: window.prettierPlugins.estree,
      yaml: window.prettierPlugins.yaml,
      html: window.prettierPlugins.html,
      markdown: window.prettierPlugins.markdown,
      postcss: window.prettierPlugins.postcss,
      typescript: window.prettierPlugins.typescript
    };

    console.log("✅ Prettier loaded successfully");
  } catch (error) {
    console.error("Failed to load Prettier:", error);
    throw new Error("Failed to load formatting library");
  }
}

/**
 * Validate YAML syntax
 */
export async function validateYaml(content) {
  try {
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check_yaml", content }),
    });
    return data;
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
