/**
 * ============================================================================
 * COMMAND PALETTE MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Provides a quick-access command palette (Cmd+Shift+P / Ctrl+Shift+P) for
 * discovering and executing editor commands. Features fuzzy search and
 * keyboard navigation.
 *
 * EXPORTED FUNCTIONS:
 * - registerCommandPaletteCallbacks(cb) - Register dependencies from app.js
 * - showCommandPalette() - Open command palette
 * - hideCommandPalette() - Close command palette
 *
 * REQUIRED CALLBACKS (from app.js):
 * File Operations:
 * - saveFile: Save current file
 * - saveAllFiles: Save all open files
 * - closeTab: Close current tab
 * - closeAllTabs: Close all tabs
 * - downloadFile: Download file
 * - promptNewFile: Create new file
 * - promptNewFolder: Create new folder
 *
 * Editor Operations:
 * - formatCode: Format current file
 * - selectNextOccurrence: Multi-cursor next occurrence
 *
 * View Operations:
 * - toggleSidebar: Toggle sidebar visibility
 *
 * Search Operations:
 * - openSearchWidget: Open find/replace
 * - performGlobalSearch: Open global search
 *
 * Git Operations:
 * - gitCommit: Commit changes
 * - gitPush: Push to remote
 * - gitPull: Pull from remote
 *
 * Other:
 * - restartHomeAssistant: Restart HA server
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new command:
 *    - Add to COMMANDS array in showCommandPalette()
 *    - Format: { label: "Command Name", action: async () => { ... } }
 *    - Use Material Icons for icon: { icon: "save" }
 *    - Group similar commands together
 *    - Call appropriate callback in action function
 *
 * 2. Adding keyboard shortcuts to commands:
 *    - Add shortcut property: { label: "...", shortcut: "Cmd+S", action: ... }
 *    - Shortcut is display-only (actual handling in event-handlers.js)
 *    - Use platform-specific naming (Cmd/Ctrl)
 *
 * 3. Adding command categories:
 *    - Group commands with separator comments
 *    - Or add category property and filter UI
 *    - Examples: File, Edit, View, Git, Search
 *
 * 4. Improving fuzzy search:
 *    - Modify fuzzyMatch() function
 *    - Add scoring/ranking for better matches
 *    - Support abbreviations (e.g., "gp" → "Git Push")
 *
 * 5. Adding recent commands:
 *    - Track command usage in state
 *    - Show recent commands at top
 *    - Add "Clear Recent" command
 *
 * INTEGRATION POINTS:
 * - elements: elements.commandPalette, elements.commandPaletteInput
 * - event-handlers.js: Keyboard shortcut to open (Cmd+Shift+P)
 * - app.js: Provides all command action callbacks
 * - state.js: Could store recent commands
 *
 * COMMAND STRUCTURE:
 * {
 *   label: "Command Name",      // Display text
 *   icon: "material_icon",       // Material icon name
 *   shortcut: "Cmd+S",           // Optional keyboard shortcut (display only)
 *   action: async () => {}       // Function to execute
 * }
 *
 * ARCHITECTURE NOTES:
 * - Commands are defined in showCommandPalette() function
 * - Fuzzy search filters commands as user types
 * - Keyboard navigation: Arrow keys, Enter to execute
 * - Commands execute and palette auto-closes
 * - All actions delegate to callbacks (no direct operations)
 *
 * COMMON PATTERNS:
 * - Add command: { label: "My Command", icon: "icon", action: async () => await callbacks.myAction() }
 * - Conditional command: if (state.activeTab) { show command }
 * - Close after action: All actions automatically close palette
 * - Error handling: Wrap action in try/catch if needed
 *
 * FUZZY SEARCH:
 * - Case-insensitive matching
 * - Matches anywhere in command label
 * - Highlights matching characters
 * - Updates results as user types
 *
 * KEYBOARD NAVIGATION:
 * - Up/Down arrows: Navigate commands
 * - Enter: Execute selected command
 * - Escape: Close palette
 * - Tab: Cycle through commands
 *
 * ============================================================================
 */
import { state, elements } from './state.js';

// Callbacks for cross-module functions
let callbacks = {
  saveFile: null,
  saveAllFiles: null,
  showQuickSwitcher: null,
  promptNewFile: null,
  promptNewFolder: null,
  insertUUID: null,
  gitStatus: null,
  gitPush: null,
  gitPull: null,
  showGitHistory: null,
  validateYaml: null,
  restartHomeAssistant: null,
  toggleSidebar: null,
  showShortcuts: null,
  showAppSettings: null,
  reportIssue: null,
  requestFeature: null,
  fetchWithAuth: null,
  getApiBase: null,
  showToast: null,
  copyToClipboard: null,
  downloadFileByPath: null,
  saveSettings: null,
  setTheme: null,
  closeTab: null
};

export function registerCommandPaletteCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Shows the command palette overlay with fuzzy search
 */
export function showCommandPalette() {
  if (!elements.commandPaletteOverlay) elements.commandPaletteOverlay = document.getElementById("command-palette-overlay");
  if (!elements.commandPaletteInput) elements.commandPaletteInput = document.getElementById("command-palette-input");
  if (!elements.commandPaletteResults) elements.commandPaletteResults = document.getElementById("command-palette-results");

  if (elements.commandPaletteOverlay.classList.contains("visible")) return;

  const commands = [
      { id: "save", label: "Save Current File", icon: "save", shortcut: "Ctrl+S", action: () => { if (state.activeTab && callbacks.saveFile) callbacks.saveFile(state.activeTab.path, state.activeTab.content); } },
      { id: "save_all", label: "Save All Files", icon: "save_alt", shortcut: "Ctrl+Shift+S", action: callbacks.saveAllFiles },
      { id: "quick_switcher", label: "Go to File...", icon: "find_in_page", shortcut: "Ctrl+E", action: callbacks.showQuickSwitcher },
      { id: "new_file", label: "New File", icon: "note_add", action: callbacks.promptNewFile },
      { id: "new_folder", label: "New Folder", icon: "create_new_folder", action: callbacks.promptNewFolder },
      { id: "generate_uuid", label: "Generate UUID", icon: "fingerprint", shortcut: "Ctrl+Shift+U", action: callbacks.insertUUID },
      { id: "git_status", label: "Git Status", icon: "sync", action: () => callbacks.gitStatus && callbacks.gitStatus(true) },
      { id: "git_push", label: "Git Push", icon: "cloud_upload", action: callbacks.gitPush },
      { id: "git_pull", label: "Git Pull", icon: "cloud_download", action: callbacks.gitPull },
      { id: "git_history", label: "Git History", icon: "history", action: callbacks.showGitHistory },
      { id: "validate_yaml", label: "Validate YAML", icon: "check_circle", action: () => { if (state.activeTab && callbacks.validateYaml) callbacks.validateYaml(state.activeTab.content); } },
      { id: "restart_ha", label: "Restart Home Assistant", icon: "restart_alt", action: callbacks.restartHomeAssistant },
      { id: "toggle_sidebar", label: "Toggle Sidebar", icon: "menu", shortcut: "Ctrl+B", action: callbacks.toggleSidebar },
      { id: "shortcuts", label: "Show Keyboard Shortcuts", icon: "keyboard", action: callbacks.showShortcuts },
      { id: "settings", label: "Settings", icon: "settings", action: callbacks.showAppSettings },
      { id: "report_issue", label: "Report Issue", icon: "bug_report", action: callbacks.reportIssue },
      { id: "request_feature", label: "Request Feature", icon: "lightbulb", action: callbacks.requestFeature },
      { id: "clean_git_locks", label: "Clean Git Lock Files", icon: "delete_sweep", action: async () => {
          if (!confirm("Are you sure you want to clean Git lock files? This can fix stuck operations.")) return;
          try {
              const API_BASE = callbacks.getApiBase ? callbacks.getApiBase() : "";
              const res = await callbacks.fetchWithAuth(API_BASE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "git_clean_locks" }) });
              if (res.success) callbacks.showToast(res.message, "success"); else callbacks.showToast("Failed to clean locks: " + res.message, "error");
          } catch (e) { callbacks.showToast("Error: " + e.message, "error"); }
      }},
      { id: "copy_path", label: "Copy Current File Path", icon: "content_copy", action: () => {
          if (state.activeTab && callbacks.copyToClipboard && callbacks.showToast) {
              callbacks.copyToClipboard(state.activeTab.path);
              callbacks.showToast("Path copied to clipboard", "success");
          }
      }},
      { id: "download_file", label: "Download Current File", icon: "download", action: () => {
          if (state.activeTab && callbacks.downloadFileByPath) callbacks.downloadFileByPath(state.activeTab.path);
      }},
      { id: "toggle_word_wrap", label: "Toggle Word Wrap", icon: "wrap_text", action: () => {
          state.wordWrap = !state.wordWrap;
          if (state.editor) state.editor.setOption('lineWrapping', state.wordWrap);
          if (callbacks.saveSettings) callbacks.saveSettings();
          if (callbacks.showToast) callbacks.showToast(`Word wrap ${state.wordWrap ? "enabled" : "disabled"}`, "info");
      }},
      { id: "fold_all", label: "Fold All", icon: "unfold_less", action: () => { if (state.editor) state.editor.execCommand("foldAll"); } },
      { id: "unfold_all", label: "Unfold All", icon: "unfold_more", action: () => { if (state.editor) state.editor.execCommand("unfoldAll"); } },
      { id: "close_others", label: "Close Other Tabs", icon: "close_fullscreen", action: () => { if (state.activeTab && callbacks.closeTab) { const tabs = state.openTabs.filter(t => t !== state.activeTab); tabs.forEach(t => callbacks.closeTab(t)); } } },
      { id: "close_saved", label: "Close Saved Tabs", icon: "save", action: () => { if (state.activeTab && callbacks.closeTab) { const tabs = state.openTabs.filter(t => !t.modified && t !== state.activeTab); tabs.forEach(t => callbacks.closeTab(t)); } } },
      { id: "theme_light", label: "Switch to Light Theme", icon: "light_mode", action: () => callbacks.setTheme && callbacks.setTheme("light") },
      { id: "theme_dark", label: "Switch to Dark Theme", icon: "dark_mode", action: () => callbacks.setTheme && callbacks.setTheme("dark") },
      { id: "theme_auto", label: "Switch to Auto Theme", icon: "brightness_auto", action: () => callbacks.setTheme && callbacks.setTheme("auto") },
  ];

  let selectedIndex = 0;
  let filteredCommands = [...commands];

  const overlay = elements.commandPaletteOverlay;
  const input = elements.commandPaletteInput;
  const results = elements.commandPaletteResults;

  const renderResults = () => {
      results.innerHTML = filteredCommands.map((cmd, index) => `
          <div class="command-item ${index === selectedIndex ? 'selected' : ''}" data-index="${index}">
              <div class="command-item-label">
                  <span class="material-icons command-item-icon">${cmd.icon}</span>
                  <span>${cmd.label}</span>
              </div>
              ${cmd.shortcut ? `<span class="command-item-shortcut">${cmd.shortcut}</span>` : ''}
          </div>
      `).join("");

      const selectedItem = results.querySelector(".command-item.selected");
      if (selectedItem) selectedItem.scrollIntoView({ block: "nearest" });
  };

  const cleanup = () => {
      overlay.classList.remove("visible");
      window.removeEventListener("keydown", handleKeyDown, true);
      overlay.onclick = null;
      input.oninput = null;
      results.onclick = null;
  };

  const handleKeyDown = (e) => {
      if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cleanup();
      } else if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          if (filteredCommands.length > 0) {
              selectedIndex = (selectedIndex + 1) % filteredCommands.length;
              renderResults();
          }
      } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          if (filteredCommands.length > 0) {
              selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
              renderResults();
          }
      } else if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          const cmd = filteredCommands[selectedIndex];
          if (cmd) {
              cleanup();
              setTimeout(() => cmd.action(), 50);
          }
      }
  };

  input.value = "";
  filteredCommands = [...commands];
  selectedIndex = 0;
  renderResults();

  overlay.classList.add("visible");
  setTimeout(() => input.focus(), 10);

  input.oninput = () => {
      const query = input.value.toLowerCase().trim();
      filteredCommands = commands.filter(cmd =>
          cmd.label.toLowerCase().includes(query)
      );
      selectedIndex = 0;
      renderResults();
  };

  overlay.onclick = (e) => {
      if (e.target === overlay) cleanup();
  };

  results.onclick = (e) => {
      const item = e.target.closest(".command-item");
      if (item) {
          const index = parseInt(item.getAttribute("data-index"));
          const cmd = filteredCommands[index];
          if (cmd) {
              cleanup();
              setTimeout(() => cmd.action(), 50);
          }
      }
  };

  window.addEventListener("keydown", handleKeyDown, true);
}
