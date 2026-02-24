/**
 * ============================================================================
 * GLOBAL SEARCH & REPLACE MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Provides sidebar-based global search and replace functionality across all
 * files in the project. Supports regex, case-sensitive search, and batch
 * replace operations with preview.
 *
 * EXPORTED FUNCTIONS:
 * - registerGlobalSearchCallbacks(cb) - Register dependencies from app.js
 * - initGlobalSearchHandlers() - Initialize global search UI handlers
 * - setupGlobalSearch() - Setup global search sidebar
 * - performGlobalSearch(query, options) - Execute global search
 * - performGlobalReplace(searchQuery, replaceText, options) - Execute replace
 *
 * REQUIRED CALLBACKS (from app.js):
 * - fetchWithAuth: Make authenticated API calls
 * - API_BASE: API base URL constant
 * - openFile: Open file in editor
 * - loadFiles: Reload file list
 * - copyToClipboard: Copy text to clipboard
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding search options:
 *    - Add checkbox/toggle to sidebar HTML (in setupGlobalSearch)
 *    - Read value in performGlobalSearch options
 *    - Pass to API call: { action: "global_search", new_option: value }
 *    - Handle in server-side search logic
 *    - Examples: whole_word, file_type_filter, exclude_folders
 *
 * 2. Adding result grouping:
 *    - Modify setupGlobalSearch() result rendering
 *    - Group results by file, folder, or custom criteria
 *    - Add expand/collapse for groups
 *    - Update result count display
 *
 * 3. Adding replace preview:
 *    - Show preview of changes before applying
 *    - Highlight what will change in each file
 *    - Allow selective replace (checkboxes per file)
 *    - Confirm before executing replace
 *
 * 4. Adding search history:
 *    - Store recent searches in localStorage or state
 *    - Add dropdown to recall previous searches
 *    - Add "Clear History" option
 *
 * 5. Adding file type filters:
 *    - Add file type selector to sidebar
 *    - Filter results by extension
 *    - Or pass filter to API for server-side filtering
 *
 * INTEGRATION POINTS:
 * - elements: Global search sidebar DOM elements
 * - api.js: fetchWithAuth for search/replace operations
 * - state.js: Could store search history
 * - app.js: File opening and management
 * - sidebar.js: Sidebar visibility control
 *
 * SEARCH OPTIONS:
 * - case_sensitive: Match case exactly
 * - use_regex: Use regular expressions
 * - whole_word: Match whole words only (future)
 * - file_types: Filter by file extension (future)
 *
 * ARCHITECTURE NOTES:
 * - Search executes server-side (not client-side)
 * - Results show file path, line number, and context
 * - Click result to open file at that line
 * - Replace operations are batched on server
 * - Results are cached until next search
 * - window.haCodeMirror API for external access
 *
 * COMMON PATTERNS:
 * - Execute search: const results = await performGlobalSearch(query, options)
 * - Results format: [{ path, line, content, matches }]
 * - Open result: await callbacks.openFile(result.path, line)
 * - Replace: await performGlobalReplace(search, replace, options)
 * - Show results: Render in sidebar with file grouping
 *
 * RESULT DISPLAY:
 * - Groups results by file
 * - Shows line numbers and context
 * - Highlights matching text
 * - Click to jump to file/line
 * - Shows total match count
 *
 * REPLACE FUNCTIONALITY:
 * - Replace all occurrences across files
 * - Supports regex capture groups ($1, $2)
 * - Shows confirmation before replacing
 * - Reloads files after replace
 * - Displays success/error messages
 *
 * GLOBAL API:
 * - window.haCodeMirror.performGlobalSearch()
 * - window.haCodeMirror.performGlobalReplace()
 * - Allows external scripts to trigger search
 *
 * ============================================================================
 */
import { state, elements } from './state.js';
import { HA_ENTITIES } from './ha-autocomplete.js';

// Callbacks for cross-module functions
let callbacks = {
  fetchWithAuth: null,
  getApiBase: null,
  showConfirmDialog: null,
  showGlobalLoading: null,
  hideGlobalLoading: null,
  showToast: null,
  loadFiles: null,
  openFile: null,
  copyToClipboard: null
};

export function registerGlobalSearchCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Performs global search across all files
 * @param {string} query - Search query
 * @param {Object} options - Search options (caseSensitive, useRegex, matchWord, include, exclude)
 */
export async function performGlobalSearch(query, options = {}) {
  if (!query || query.length < 2) return;

  if (elements.globalSearchLoading) elements.globalSearchLoading.style.display = "block";
  if (elements.globalSearchResults) elements.globalSearchResults.innerHTML = "";

  try {
      const API_BASE = callbacks.getApiBase ? callbacks.getApiBase() : "";
      const data = await callbacks.fetchWithAuth(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              action: "global_search",
              query: query,
              case_sensitive: options.caseSensitive || false,
              use_regex: options.useRegex || false,
              match_word: options.matchWord || false,
              include: options.include || "",
              exclude: options.exclude || ""
          }),
      });

      if (elements.globalSearchLoading) elements.globalSearchLoading.style.display = "none";

      const entityMatches = HA_ENTITIES.filter(e =>
          e.entity_id.toLowerCase().includes(query.toLowerCase()) ||
          (e.friendly_name && e.friendly_name.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 50);

      if (Array.isArray(data)) {
           state._lastGlobalSearchResults = data;
           renderGlobalSearchResults(data, entityMatches);
      } else {
           state._lastGlobalSearchResults = [];
           renderGlobalSearchResults([], entityMatches);
      }

  } catch (e) {
      if (elements.globalSearchLoading) elements.globalSearchLoading.style.display = "none";
      console.error("Search failed", e);
      if (elements.globalSearchResults) {
          elements.globalSearchResults.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--error-color);">Search failed: ${e.message}</div>`;
      }
  }
}

/**
 * Performs global replace across all files
 */
export async function performGlobalReplace() {
  const query = elements.globalSearchInput.value;
  const replacement = elements.globalReplaceInput.value;
  const results = state._lastGlobalSearchResults || [];

  if (!query || results.length === 0) return;

  // Group results by file for the message
  const grouped = {};
  results.forEach(res => {
      if (!grouped[res.path]) grouped[res.path] = 0;
      grouped[res.path]++;
  });
  const fileCount = Object.keys(grouped).length;

  const confirmed = await callbacks.showConfirmDialog({
      title: "Global Replace",
      message: `Replace all occurrences of <b>"${escapeHtml(query)}"</b> with <b>"${escapeHtml(replacement)}"</b>?<br><br>This will affect <b>${results.length} occurrences</b> across <b>${fileCount} files</b>.`,
      confirmText: "Replace All",
      cancelText: "Cancel",
      isDanger: true
  });

  if (!confirmed) return;

  try {
      callbacks.showGlobalLoading(`Replacing in ${fileCount} files...`);

      const API_BASE = callbacks.getApiBase ? callbacks.getApiBase() : "";
      const response = await callbacks.fetchWithAuth(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              action: "global_replace",
              query: query,
              replacement: replacement,
              case_sensitive: elements.btnMatchCase?.classList.contains("active"),
              use_regex: elements.btnUseRegex?.classList.contains("active"),
              match_word: elements.btnMatchWord?.classList.contains("active"),
              include: elements.globalSearchInclude.value,
              exclude: elements.globalSearchExclude.value
          }),
      });

      callbacks.hideGlobalLoading();

      if (response.success) {
          callbacks.showToast(`Successfully replaced in ${response.files_updated} files`, "success");
          // Refresh files and search
          await callbacks.loadFiles(true);
          performGlobalSearch(query, {
              caseSensitive: elements.btnMatchCase?.classList.contains("active"),
              useRegex: elements.btnUseRegex?.classList.contains("active"),
              matchWord: elements.btnMatchWord?.classList.contains("active"),
              include: elements.globalSearchInclude.value,
              exclude: elements.globalSearchExclude.value
          });
      } else {
          callbacks.showToast("Replace failed: " + response.message, "error");
      }
  } catch (e) {
      callbacks.hideGlobalLoading();
      callbacks.showToast("Error during replace: " + e.message, "error");
  }
}

/**
 * Renders global search results in the sidebar
 * @param {Array} results - Search results from server
 * @param {Array} entityResults - Matching Home Assistant entities
 */
function renderGlobalSearchResults(results, entityResults = []) {
  if (!elements.globalSearchResults) return;

  // Prevent stale results if input was cleared while searching
  if (elements.globalSearchInput && elements.globalSearchInput.value.length < 2) {
      // Ensure empty state is shown (triggerGlobalSearch should have done this, but we enforce it here)
      elements.globalSearchResults.innerHTML = `
          <div class="search-empty-state" style="padding: 40px 20px; text-align: center; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center;">
              <span class="material-icons" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px;">search</span>
              <p style="margin: 0; font-size: 14px;">Type to search across all files</p>
          </div>`;
      return;
  }

  if ((!results || results.length === 0) && (!entityResults || entityResults.length === 0)) {
      elements.globalSearchResults.innerHTML = `
          <div class="search-empty-state" style="padding: 40px 20px; text-align: center; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center;">
              <span class="material-icons" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px;">search_off</span>
              <p style="margin: 0; font-size: 14px;">No results found</p>
          </div>`;
      return;
  }

  let html = "";

  // 1. Entities Section
  if (entityResults && entityResults.length > 0) {
      html += `
          <div class="search-result-group">
              <div class="search-result-file-header" onclick="document.getElementById('results-entities').classList.toggle('hidden'); this.querySelector('.arrow').classList.toggle('rotated');" style="padding: 8px 12px; background: var(--bg-tertiary); cursor: pointer; display: flex; align-items: center; border-bottom: 1px solid var(--border-color);">
                  <span class="material-icons arrow rotated" style="font-size: 16px; margin-right: 6px; transition: transform 0.2s;">chevron_right</span>
                  <span style="font-weight: 600; font-size: 13px;">Entities</span>
                  <span class="badge" style="margin-left: auto; background: var(--success-color); color: white; border-radius: 10px; padding: 0 6px; font-size: 10px;">${entityResults.length}</span>
              </div>
              <div class="search-result-list" id="results-entities" style="display: block;">
                  ${entityResults.map(e => `
                      <div class="search-result-match" onclick="window.haCodeMirror.copyEntityId('${e.entity_id}')" style="padding: 6px 12px 6px 34px; cursor: pointer; font-size: 12px; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column;">
                          <div style="font-weight: 600; color: var(--text-primary);">${e.friendly_name || e.entity_id}</div>
                          <div style="font-family: monospace; color: var(--text-secondary); font-size: 11px;">${e.entity_id}</div>
                      </div>
                  `).join('')}
              </div>
          </div>
      `;
  }

  // 2. Files Section (Group by file)
  const grouped = {};
  results.forEach(res => {
      if (!grouped[res.path]) grouped[res.path] = [];
      grouped[res.path].push(res);
  });

  for (const [path, matches] of Object.entries(grouped)) {
      const filename = path.split("/").pop();
      const folder = path.split("/").slice(0, -1).join("/");
      const safeId = path.replace(/[^a-zA-Z0-9]/g, '-');

      html += `
          <div class="search-result-file">
              <div class="search-result-file-header" onclick="document.getElementById('results-${safeId}').classList.toggle('hidden'); this.querySelector('.arrow').classList.toggle('rotated');" style="padding: 8px 12px; background: var(--bg-tertiary); cursor: pointer; display: flex; align-items: center; border-bottom: 1px solid var(--border-color);">
                  <span class="material-icons arrow rotated" style="font-size: 16px; margin-right: 6px; transition: transform 0.2s;">chevron_right</span>
                  <span style="font-weight: 600; font-size: 13px;">${filename}</span>
                  <span style="font-size: 11px; color: var(--text-secondary); margin-left: 8px; opacity: 0.7;">${folder}</span>
                  <span class="badge" style="margin-left: auto; background: var(--accent-color); color: white; border-radius: 10px; padding: 0 6px; font-size: 10px;">${matches.length}</span>
              </div>
              <div class="search-result-list" id="results-${safeId}" style="display: block;">
                  ${matches.map(m => `
                      <div class="search-result-match" onclick="window.haCodeMirror.openFileAndScroll('${m.path.replace(/'/g, "\\'")}', ${m.line})" style="padding: 6px 12px 6px 34px; cursor: pointer; font-family: monospace; font-size: 12px; border-bottom: 1px solid var(--border-color); display: flex;">
                          <span style="color: var(--text-secondary); margin-right: 8px; min-width: 20px;">${m.line}:</span>
                          <span style="white-space: pre; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(m.content.trim())}</span>
                      </div>
                  `).join('')}
              </div>
          </div>
      `;
  }

  elements.globalSearchResults.innerHTML = html;

  // Reset collapse/expand button to "Collapse All" state after new results render
  const btnCollapse = document.getElementById('btn-collapse-search');
  if (btnCollapse) {
      const icon = btnCollapse.querySelector('.material-icons');
      if (icon) icon.textContent = 'unfold_less';
      btnCollapse.title = 'Collapse All';
  }
}

/**
 * Escapes HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Initializes global handlers for onclick events in search results
 * These need to be on window object because they're called from HTML onclick attributes
 */
export function initGlobalSearchHandlers() {
  window.haCodeMirror = window.haCodeMirror || {};

  window.haCodeMirror.openFileAndScroll = async (path, line) => {
      await callbacks.openFile(path);
      if (state.editor) {
          const lineIdx = line - 1;
          state.editor.setCursor({line: lineIdx, ch: 0});
          state.editor.scrollIntoView({line: lineIdx, ch: 0}, 200);
          state.editor.focus();
          const marker = state.editor.markText(
              {line: lineIdx, ch: 0},
              {line: lineIdx + 1, ch: 0},
              {className: "cm-search-active", clearOnEnter: true}
          );
          setTimeout(() => marker.clear(), 2000);
      }
  };

  window.haCodeMirror.copyEntityId = (entityId) => {
      callbacks.copyToClipboard(entityId);
      callbacks.showToast(`Copied: ${entityId}`, "success");
  };
}
