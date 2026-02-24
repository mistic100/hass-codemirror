/**
 * ============================================================================
 * SETTINGS UI MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Provides the settings panel UI for configuring all CodeMirror options.
 * Handles UI customization, editor settings, and more.
 *
 * EXPORTED FUNCTIONS:
 * - showSettings() - Open settings panel
 * - hideSettings() - Close settings panel
 * - renderSettingsPanel() - Render all settings sections
 * - updateSettingValue(key, value) - Update individual setting
 *
 * HOW TO ADD FEATURES:
 * 1. Add new setting: Add to state.js, add UI control here, add to settings.js persistence
 * 2. Add setting section: Create new tab/section in renderSettingsPanel()
 * 3. Add validation: Validate in updateSettingValue() before saving
 * 4. Add setting UI control: Checkbox, input, select, color picker, etc.
 *
 * INTEGRATION: settings.js (persistence), state.js (values), ui.js (modals)
 * COMMON PATTERNS: showSettings(), updateSettingValue(key, value)
 *
 * SETTING CATEGORIES:
 * - UI: Theme, font, sidebar, tabs
 * - Editor: Font size, tab size, word wrap, line numbers
 * - Performance: Polling, caching, virtual scroll
 *
 * ============================================================================
 */
import { state, elements } from './state.js';
import { saveSettings } from './settings.js';
import { fetchWithAuth } from './api.js';
import { API_BASE, THEME_PRESETS, ACCENT_COLORS, SYNTAX_THEMES } from './constants.js';
import { showToast, showConfirmDialog } from './ui.js';

// Callbacks for cross-module functions
let callbacks = {
  loadFiles: null,
  applyTheme: null,
  applyCustomSyntaxColors: null,
  applyLayoutSettings: null,
  applyEditorSettings: null,
  renderFileTree: null,
  resetModalToDefault: null,
  hideModal: null
};

export function registerSettingsUICallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Show the application settings modal
 */
export async function showAppSettings() {
    const modalOverlay = document.getElementById("modal-overlay");
    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");
    const modalFooter = document.querySelector(".modal-footer");

    // Get current setting from localStorage
    const showRecentFiles = state.showRecentFiles;
    const customColors = state.customColors || {};

    modalTitle.textContent = "CodeMirror Settings";

    const renderColorInput = (label, key) => {
        const hasValue = customColors.hasOwnProperty(key);
        const colorValue = hasValue ? customColors[key] : '#000000';
        const disabled = !hasValue;

        return `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center;">
                <input type="checkbox" class="syntax-color-toggle" data-key="${key}" ${hasValue ? 'checked' : ''} style="margin-right: 8px;">
                <span style="font-size: 12px; opacity: ${disabled ? '0.5' : '1'}; transition: opacity 0.2s;">${label}</span>
            </div>
            <input type="color" class="syntax-color-input" data-key="${key}" value="${colorValue}" ${disabled ? 'disabled' : ''} style="cursor: ${disabled ? 'default' : 'pointer'}; height: 24px; width: 40px; border: none; padding: 0; background: transparent; opacity: ${disabled ? '0.2' : '1'}; transition: opacity 0.2s;">
        </div>
    `;
    };

    // Generate theme preset options
    const themePresetOptions = Object.entries(THEME_PRESETS).map(([key, preset]) =>
      `<option value="${key}" ${state.themePreset === key ? 'selected' : ''}>${preset.name}</option>`
    ).join('');

    modalBody.innerHTML = `
      <div class="settings-tabs" style="display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 16px;">
        <button class="settings-tab active" data-tab="general" style="padding: 10px 16px; background: transparent; border: none; color: var(--text-primary); cursor: pointer; border-bottom: 2px solid var(--accent-color); font-size: 13px;">General</button>
        <button class="settings-tab" data-tab="appearance" style="padding: 10px 16px; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; font-size: 13px;">Appearance</button>
        <button class="settings-tab" data-tab="editor" style="padding: 10px 16px; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; font-size: 13px;">Editor</button>
        <button class="settings-tab" data-tab="advanced" style="padding: 10px 16px; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; font-size: 13px;">Advanced</button>
      </div>

      <div class="settings-content">
        <!-- General Tab -->
        <div id="settings-tab-general" class="settings-panel active">
          <div class="git-settings-section">
            <div class="git-settings-label">Workspace Settings</div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Remember Workspace</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Restore open tabs and editor state on reload</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="remember-workspace-toggle" ${state.rememberWorkspace !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Show Recent Files</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Display recently opened files at the top of the file tree</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="recent-files-toggle" ${showRecentFiles ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Recent Files Limit</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Maximum number of recent files to display</div>
              </div>
              <input type="number" id="recent-files-limit" value="${state.recentFilesLimit}" min="5" max="30" style="width: 60px; padding: 6px; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); text-align: center;">
            </div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Show Hidden Files</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Display hidden files and folders in the file tree</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="show-hidden-toggle" ${state.showHidden ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="git-settings-label" style="margin-top: 20px;">UI Feedback</div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Toast Notifications</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Show popup notifications for actions (saves, errors, etc.)</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="show-toasts-toggle" ${state.showToasts ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Appearance Tab -->
        <div id="settings-tab-appearance" class="settings-panel" style="display: none;">
          <div class="git-settings-section">
            <div class="git-settings-label">Theme</div>

            <div style="padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="font-weight: 500; margin-bottom: 8px;">Theme Preset</div>
              <select id="theme-preset-select" class="git-settings-input" style="width: 100%;">
                ${themePresetOptions}
              </select>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Choose from pre-defined color schemes</div>
            </div>

            <div style="padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="font-weight: 500; margin-bottom: 8px;">Accent Color</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${ACCENT_COLORS.map(color => `
                  <button class="accent-color-btn" data-color="${color.value}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid ${state.accentColor === color.value ? 'var(--text-primary)' : 'transparent'}; background: ${color.value}; cursor: pointer;" title="${color.name}"></button>
                `).join('')}
                <button class="accent-color-btn" data-color="" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid ${!state.accentColor ? 'var(--text-primary)' : 'transparent'}; background: var(--bg-tertiary); cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);" title="Use Theme Default">✕</button>
              </div>
            </div>

            <div class="git-settings-label" style="margin-top: 20px;">File Tree</div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Compact Mode</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Reduce padding in the file tree for a more compact view</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="file-tree-compact-toggle" ${state.fileTreeCompact ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Show File Icons</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Display file type icons in the file tree</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="file-tree-icons-toggle" ${state.fileTreeShowIcons ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Collapsable Tree Mode</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Show folders as a collapsable tree (single click to expand/collapse) instead of the default folder navigation mode (double click to enter)</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="tree-collapsable-mode-toggle" ${state.treeCollapsableMode ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Editor Tab -->
        <div id="settings-tab-editor" class="settings-panel" style="display: none;">
          <div class="git-settings-section">
            <div class="git-settings-label">Font</div>

            <div style="padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="font-weight: 500; margin-bottom: 8px;">Font Size</div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <input type="range" id="font-size-slider" min="10" max="24" value="${state.fontSize}" style="flex: 1;">
                <span id="font-size-value" style="min-width: 40px; text-align: center; font-family: monospace;">${state.fontSize}px</span>
              </div>
            </div>

            <div style="padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="font-weight: 500; margin-bottom: 8px;">Font Family</div>
              <select id="font-family-select" class="git-settings-input" style="width: 100%; margin-bottom: 8px;">
                  <option value="'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace" ${state.fontFamily === "'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace" ? 'selected' : ''}>SF Mono (Default)</option>
                  <option value="'Fira Code', monospace" ${state.fontFamily === "'Fira Code', monospace" ? 'selected' : ''}>Fira Code</option>
                  <option value="'JetBrains Mono', monospace" ${state.fontFamily === "'JetBrains Mono', monospace" ? 'selected' : ''}>JetBrains Mono</option>
                  <option value="'Source Code Pro', monospace" ${state.fontFamily === "'Source Code Pro', monospace" ? 'selected' : ''}>Source Code Pro</option>
                  <option value="'Roboto Mono', monospace" ${state.fontFamily === "'Roboto Mono', monospace" ? 'selected' : ''}>Roboto Mono</option>
                  <option value="'Ubuntu Mono', monospace" ${state.fontFamily === "'Ubuntu Mono', monospace" ? 'selected' : ''}>Ubuntu Mono</option>
                  <option value="'Monaco', 'Courier New', monospace" ${state.fontFamily === "'Monaco', 'Courier New', monospace" ? 'selected' : ''}>Monaco</option>
                  <option value="'Consolas', monospace" ${state.fontFamily === "'Consolas', monospace" ? 'selected' : ''}>Consolas</option>
                  <option value="'DM Mono', monospace" ${state.fontFamily === "'DM Mono', monospace" ? 'selected' : ''}>DM Mono</option>
                  <option value="'Reddit Mono', monospace" ${state.fontFamily === "'Reddit Mono', monospace" ? 'selected' : ''}>Reddit Mono</option>
                  <option value="'Libertinus Mono', monospace" ${state.fontFamily === "'Libertinus Mono', monospace" ? 'selected' : ''}>Libertinus Mono</option>
                  <option value="'Azeret Mono', monospace" ${state.fontFamily === "'Azeret Mono', monospace" ? 'selected' : ''}>Azeret Mono</option>
                  <option value="monospace" ${state.fontFamily === "monospace" ? 'selected' : ''}>System Monospace</option>
                </select>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Choose a monospace font for the code editor</div>
            </div>

            <div style="padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="font-weight: 500; margin-bottom: 8px;">Tab Size (Indentation)</div>
              <select id="tab-size-select" class="git-settings-input" style="width: 100%; margin-bottom: 8px;">
                <option value="2" ${state.tabSize === 2 ? 'selected' : ''}>2 spaces (Home Assistant Standard)</option>
                <option value="4" ${state.tabSize === 4 ? 'selected' : ''}>4 spaces</option>
                <option value="8" ${state.tabSize === 8 ? 'selected' : ''}>8 spaces</option>
              </select>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Number of spaces for each indentation level (Home Assistant standard is 2)</div>
            </div>

            <div class="git-settings-label" style="margin-top: 20px;">Behavior</div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Word Wrap</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Wrap long lines to fit the editor width</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="word-wrap-toggle" ${state.wordWrap ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Show Line Numbers</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Display line numbers in the editor gutter</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="line-numbers-toggle" ${state.showLineNumbers ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Show Whitespace</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Display spaces and tabs as visible characters</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="whitespace-toggle" ${state.showWhitespace ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="git-settings-label" style="margin-top: 20px;">Auto-Save</div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Enable Auto-Save</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Automatically save files after a delay</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="auto-save-toggle" ${state.autoSave ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div id="auto-save-delay-container" style="display: ${state.autoSave ? 'flex' : 'none'}; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Auto-Save Delay</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Delay in milliseconds before auto-saving</div>
              </div>
              <input type="number" id="auto-save-delay-input" value="${state.autoSaveDelay}" min="500" max="10000" step="100" style="width: 80px; padding: 6px; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); text-align: center;">
            </div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">One Tab Mode</div>
                <div style="font-size: 12px; color: var(--text-secondary);">When opening a file, auto-save and close all other tabs. Only the last opened file stays open.</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="one-tab-mode-toggle" ${state.onTabMode ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="git-settings-label" style="margin-top: 20px;">Syntax Highlighting</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">Customize the font colors for the code editor</div>

            <!-- Pre-defined Syntax Themes -->
            <div style="margin-bottom: 16px;">
              <div style="font-weight: 500; margin-bottom: 10px; font-size: 13px;">Pre-defined Themes</div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;" id="syntax-theme-grid">
                ${Object.entries(SYNTAX_THEMES).map(([key, theme]) => {
                  const isActive = (state.syntaxTheme || 'custom') === key;
                  const swatches = theme.colors ? Object.values(theme.colors).slice(0, 5).map(c =>
                    `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};margin-right:2px;"></span>`
                  ).join('') : '<span style="opacity:0.5;font-size:10px;">custom</span>';
                  return `
                    <button class="syntax-theme-btn ${isActive ? 'active' : ''}" data-theme="${key}"
                      style="padding:8px 6px;border-radius:6px;border:2px solid ${isActive ? 'var(--accent-color)' : 'var(--border-color)'};
                      background:${isActive ? 'var(--bg-hover)' : 'var(--bg-primary)'};cursor:pointer;text-align:left;
                      transition:border-color 0.15s,background 0.15s;">
                      <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">${theme.name}</div>
                      <div style="margin-bottom:4px;">${swatches}</div>
                      <div style="font-size:10px;color:var(--text-secondary);">${theme.description}</div>
                    </button>`;
                }).join('')}
              </div>
            </div>

            <!-- Custom Colors (shown only when Custom theme selected) -->
            <div id="custom-colors-section" style="display:${(state.syntaxTheme || 'custom') === 'custom' ? 'block' : 'none'};">
              <div style="font-weight: 500; margin-bottom: 8px; font-size: 13px;">Custom Colors</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                ${renderColorInput("Comment", "comment")}
                ${renderColorInput("Keyword", "keyword")}
                ${renderColorInput("String", "string")}
                ${renderColorInput("Number", "number")}
                ${renderColorInput("Boolean", "boolean")}
                ${renderColorInput("Key / Property", "key")}
                ${renderColorInput("Tag", "tag")}
                ${renderColorInput("Line Numbers", "lineNumberColor")}
                ${renderColorInput("Fold Arrows", "foldColor")}
              </div>
              <button class="btn-secondary" id="btn-reset-colors" style="margin-top: 12px; width: 100%; font-size: 12px;">
                Reset to Default Colors
              </button>
            </div>
          </div>
        </div>

        <!-- Advanced Tab -->
        <div id="settings-tab-advanced" class="settings-panel" style="display: none;">
          <div class="git-settings-section">
            <div class="git-settings-label">Performance Settings</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">
              Fine-tune polling intervals and caching for optimal performance
            </div>

            <div style="padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-weight: 500;">File Cache Size</div>
                <span id="file-cache-size-value" style="font-family: monospace; color: var(--text-secondary);">${state.fileCacheSize} files</span>
              </div>
              <input type="range" id="file-cache-size-slider" min="5" max="20" step="1" value="${state.fileCacheSize}" style="width: 100%;">
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                Number of files to cache in memory for faster access (5-20 files).
              </div>
            </div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">Enable Virtual Scrolling</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Improve performance with large file trees by rendering only visible items</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="virtual-scroll-toggle" ${state.enableVirtualScroll ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
              <span class="material-icons" style="font-size: 16px; vertical-align: middle; color: var(--info-color);">info</span>
              <span style="margin-left: 8px;">These settings help optimize CodeMirror for your specific environment. Changes take effect immediately.</span>
            </div>

            <div class="git-settings-label" style="margin-top: 20px;">Experimental Features</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
              These features are in beta and may have limitations. Enable at your own discretion.
            </div>

            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color);">
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">
                  Split View <span style="font-size: 11px; padding: 2px 6px; background: var(--warning-color); color: #000; border-radius: 3px; margin-left: 6px;">BETA</span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">Enable VS Code-style split view to edit multiple files side-by-side</div>
              </div>
              <label class="toggle-switch" style="margin-left: 16px;">
                <input type="checkbox" id="split-view-toggle" ${state.enableSplitView ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="git-settings-label" style="margin-top: 20px; color: var(--error-color);">Danger Zone</div>

            <!-- Reset Application -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0;">
                <div style="font-size: 12px; color: var(--text-secondary); max-width: 70%;">
                    Reset all application settings, theme preferences, and onboarding status. This does not delete your files.
                </div>
                <button class="btn-secondary" id="btn-reset-app" style="padding: 6px 12px; font-size: 12px; color: var(--error-color); border-color: var(--error-color);">
                    Reset Application
                </button>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; font-size: 13px;">
        <span class="material-icons" style="font-size: 16px; vertical-align: middle; color: var(--info-color, #2196f3);">info</span>
        <span style="margin-left: 8px;">Changes will take effect immediately</span>
      </div>
    `;

    modalOverlay.classList.add("visible");
    modal.style.maxWidth = "600px";
    modal.style.maxHeight = "85vh";

    // Hide default modal buttons
    if (modalFooter) {
      modalFooter.style.display = "none";
    }

    // Function to clean up and close the Settings modal
    const closeSettings = () => {
      modalOverlay.classList.remove("visible");

      // Reset modal to default state
      if (callbacks.resetModalToDefault) {
        callbacks.resetModalToDefault();
      }

      // Remove overlay click handler
      modalOverlay.removeEventListener("click", overlayClickHandler);
    };

    // Overlay click handler
    const overlayClickHandler = (e) => {
      if (e.target === modalOverlay) {
        closeSettings();
      }
    };

    modalOverlay.addEventListener("click", overlayClickHandler);

    // Handle Settings Tabs
    const tabButtons = modalBody.querySelectorAll('.settings-tab');
    const tabPanels = modalBody.querySelectorAll('.settings-panel');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;

        // Update tab buttons
        tabButtons.forEach(btn => {
          if (btn.dataset.tab === targetTab) {
            btn.classList.add('active');
            btn.style.color = 'var(--text-primary)';
            btn.style.borderBottomColor = 'var(--accent-color)';
          } else {
            btn.classList.remove('active');
            btn.style.color = 'var(--text-secondary)';
            btn.style.borderBottomColor = 'transparent';
          }
        });

        // Update tab panels
        tabPanels.forEach(panel => {
          if (panel.id === `settings-tab-${targetTab}`) {
            panel.style.display = 'block';
          } else {
            panel.style.display = 'none';
          }
        });
      });
    });

    // Internal helper function for saving settings
    const saveSettingsImpl = async () => {
      await saveSettings();
    };

    // Handle Recent Files toggle
    const recentFilesToggle = document.getElementById("recent-files-toggle");
    if (recentFilesToggle) {
      recentFilesToggle.addEventListener("change", async (e) => {
        state.showRecentFiles = e.target.checked;
        await saveSettingsImpl();
        if (callbacks.renderFileTree) {
          callbacks.renderFileTree();
        }
        showToast(state.showRecentFiles ? "Recent files shown" : "Recent files hidden", "success");
      });
    }

    // Handle Recent Files Limit
    const recentFilesLimitInput = document.getElementById("recent-files-limit");
    if (recentFilesLimitInput) {
      recentFilesLimitInput.addEventListener("change", async (e) => {
        state.recentFilesLimit = parseInt(e.target.value);
        await saveSettingsImpl();
        if (callbacks.renderFileTree) {
          callbacks.renderFileTree();
        }
        showToast(`Recent files limit set to ${state.recentFilesLimit}`, "success");
      });
    }

    // Handle Remember Workspace toggle
    const rememberWorkspaceToggle = document.getElementById("remember-workspace-toggle");
    if (rememberWorkspaceToggle) {
      rememberWorkspaceToggle.addEventListener("change", async (e) => {
        state.rememberWorkspace = e.target.checked;
        await saveSettingsImpl();
        showToast(state.rememberWorkspace ? "Workspace will be remembered" : "Workspace will not be remembered", "success");
      });
    }

    // Handle Show Hidden toggle
    const showHiddenToggle = document.getElementById("show-hidden-toggle");
    if (showHiddenToggle) {
      showHiddenToggle.addEventListener("change", async (e) => {
        state.showHidden = e.target.checked;
        await saveSettingsImpl();
        if (callbacks.updateShowHiddenButton) {
          callbacks.updateShowHiddenButton();
        }
        if (callbacks.loadFiles) {
          await callbacks.loadFiles();
        }
        showToast(state.showHidden ? "Hidden files shown" : "Hidden files hidden", "success");
      });
    }

    // Handle Theme Preset selection
    const themePresetSelect = document.getElementById("theme-preset-select");
    if (themePresetSelect) {
      themePresetSelect.addEventListener("change", async (e) => {
        state.themePreset = e.target.value;
        await saveSettingsImpl();
        if (callbacks.applyTheme) {
          callbacks.applyTheme();
        }
        showToast(`Theme changed to ${THEME_PRESETS[state.themePreset].name}`, "success");
      });
    }

    // Handle Accent Color buttons
    const accentColorButtons = modalBody.querySelectorAll('.accent-color-btn');
    accentColorButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const color = btn.dataset.color || null;
        state.accentColor = color;

        // Update button borders
        accentColorButtons.forEach(b => {
          const isActive = (b.dataset.color || null) === color;
          b.style.borderColor = isActive ? 'var(--text-primary)' : 'transparent';
        });

        await saveSettingsImpl();
        if (callbacks.applyTheme) {
          callbacks.applyTheme();
        }
        showToast(color ? "Accent color updated" : "Accent color reset to theme default", "success");
      });
    });

    // Handle Font Size
    const fontSizeSlider = document.getElementById("font-size-slider");
    const fontSizeValue = document.getElementById("font-size-value");
    if (fontSizeSlider && fontSizeValue) {
      fontSizeSlider.addEventListener("input", (e) => {
        fontSizeValue.textContent = `${e.target.value}px`;
      });

      fontSizeSlider.addEventListener("change", async (e) => {
        state.fontSize = parseInt(e.target.value);

        // Apply to all editors immediately
        if (callbacks.applyEditorSettings) {
          callbacks.applyEditorSettings();
        }

        // Refresh all editors
        if (state.primaryEditor) state.primaryEditor.refresh();
        if (state.secondaryEditor) state.secondaryEditor.refresh();

        await saveSettingsImpl();
        showToast(`Font size set to ${state.fontSize}px`, "success");
      });
    }

    // Handle Font Family
    const fontFamilySelect = document.getElementById("font-family-select");
    if (fontFamilySelect) {
      fontFamilySelect.addEventListener("change", async (e) => {
        state.fontFamily = e.target.value;

        // Apply to all editors immediately
        if (callbacks.applyEditorSettings) {
          callbacks.applyEditorSettings();
        }

        // Refresh all editors
        if (state.primaryEditor) state.primaryEditor.refresh();
        if (state.secondaryEditor) state.secondaryEditor.refresh();

        await saveSettingsImpl();
        showToast("Font family updated", "success");
      });
    }

    // Handle Tab Size
    const tabSizeSelect = document.getElementById("tab-size-select");
    if (tabSizeSelect) {
      tabSizeSelect.addEventListener("change", async (e) => {
        state.tabSize = parseInt(e.target.value);

        // Apply to all editors immediately
        if (state.primaryEditor) {
          state.primaryEditor.setOption("indentUnit", state.tabSize);
          state.primaryEditor.setOption("tabSize", state.tabSize);
        }
        if (state.secondaryEditor) {
          state.secondaryEditor.setOption("indentUnit", state.tabSize);
          state.secondaryEditor.setOption("tabSize", state.tabSize);
        }

        await saveSettingsImpl();
        showToast(`Tab size set to ${state.tabSize} spaces`, "success");
      });
    }

    // Handle Word Wrap
    const wordWrapToggle = document.getElementById("word-wrap-toggle");
    if (wordWrapToggle) {
      wordWrapToggle.addEventListener("change", async (e) => {
        state.wordWrap = e.target.checked;

        // Apply to all editors immediately
        if (callbacks.applyEditorSettings) {
          callbacks.applyEditorSettings();
        }

        await saveSettingsImpl();
        showToast(state.wordWrap ? "Word wrap enabled" : "Word wrap disabled", "success");
      });
    }

    // Handle Line Numbers
    const lineNumbersToggle = document.getElementById("line-numbers-toggle");
    if (lineNumbersToggle) {
      lineNumbersToggle.addEventListener("change", async (e) => {
        state.showLineNumbers = e.target.checked;

        // Apply to all editors immediately
        if (callbacks.applyEditorSettings) {
          callbacks.applyEditorSettings();
        }

        await saveSettingsImpl();
        showToast(state.showLineNumbers ? "Line numbers shown" : "Line numbers hidden", "success");
      });
    }

    // Handle Whitespace
    const whitespaceToggle = document.getElementById("whitespace-toggle");
    if (whitespaceToggle) {
      whitespaceToggle.addEventListener("change", async (e) => {
        state.showWhitespace = e.target.checked;
        await saveSettingsImpl();

        // Apply editor settings immediately (toggles whitespace overlay)
        if (callbacks.applyEditorSettings) {
          callbacks.applyEditorSettings();
        }

        showToast(state.showWhitespace ? "Whitespace shown" : "Whitespace hidden", "success");
      });
    }

    // Handle Auto-Save
    const autoSaveToggle = document.getElementById("auto-save-toggle");
    const autoSaveDelayContainer = document.getElementById("auto-save-delay-container");
    if (autoSaveToggle) {
      autoSaveToggle.addEventListener("change", async (e) => {
        state.autoSave = e.target.checked;
        if (autoSaveDelayContainer) {
          autoSaveDelayContainer.style.display = state.autoSave ? 'flex' : 'none';
        }
        await saveSettingsImpl();
        showToast(state.autoSave ? "Auto-save enabled" : "Auto-save disabled", "success");
      });
    }

    const autoSaveDelayInput = document.getElementById("auto-save-delay-input");
    if (autoSaveDelayInput) {
      autoSaveDelayInput.addEventListener("change", async (e) => {
        state.autoSaveDelay = parseInt(e.target.value);
        await saveSettingsImpl();
        showToast(`Auto-save delay set to ${state.autoSaveDelay}ms`, "success");
      });
    }

    const oneTabModeToggle = document.getElementById("one-tab-mode-toggle");
    if (oneTabModeToggle) {
      oneTabModeToggle.addEventListener("change", async (e) => {
        state.onTabMode = e.target.checked;
        // Sync toolbar button if present
        const btnOneTabMode = document.getElementById("btn-one-tab-mode");
        if (btnOneTabMode) {
          btnOneTabMode.classList.toggle("active", state.onTabMode);
        }
        await saveSettingsImpl();
        showToast(state.onTabMode ? "One Tab Mode enabled" : "One Tab Mode disabled", "success");
      });
    }

    // Handle File Tree Compact
    const fileTreeCompactToggle = document.getElementById("file-tree-compact-toggle");
    if (fileTreeCompactToggle) {
      fileTreeCompactToggle.addEventListener("change", async (e) => {
        state.fileTreeCompact = e.target.checked;
        await saveSettingsImpl();

        // Apply layout changes immediately
        if (callbacks.applyLayoutSettings) {
          callbacks.applyLayoutSettings();
        }

        if (callbacks.renderFileTree) {
          callbacks.renderFileTree();
        }
        showToast(state.fileTreeCompact ? "Compact mode enabled" : "Compact mode disabled", "success");
      });
    }

    // Handle File Tree Icons
    const fileTreeIconsToggle = document.getElementById("file-tree-icons-toggle");
    if (fileTreeIconsToggle) {
      fileTreeIconsToggle.addEventListener("change", async (e) => {
        state.fileTreeShowIcons = e.target.checked;
        await saveSettingsImpl();

        // Apply layout changes immediately
        if (callbacks.applyLayoutSettings) {
          callbacks.applyLayoutSettings();
        }

        if (callbacks.renderFileTree) {
          callbacks.renderFileTree();
        }
        showToast(state.fileTreeShowIcons ? "File icons shown" : "File icons hidden", "success");
      });
    }

    // Handle Collapsable Tree Mode
    const treeCollapsableModeToggle = document.getElementById("tree-collapsable-mode-toggle");
    if (treeCollapsableModeToggle) {
      treeCollapsableModeToggle.addEventListener("change", async (e) => {
        state.treeCollapsableMode = e.target.checked;
        state.lazyLoadingEnabled = !state.treeCollapsableMode;
        await saveSettingsImpl();

        // Reset navigation state when switching modes
        if (!state.treeCollapsableMode) {
          // Switching back to folder navigation: reset to root
          state.currentNavigationPath = "";
          state.navigationHistory = [];
        } else {
          // Switching to collapsable tree: clear expanded folders
          state.expandedFolders.clear();
        }

        // Reload file tree with new mode
        if (callbacks.loadFiles) {
          await callbacks.loadFiles(true);
        } else if (callbacks.renderFileTree) {
          callbacks.renderFileTree();
        }

        // Show/hide nav elements based on mode
        const breadcrumb = document.getElementById("breadcrumb");
        const backBtn = document.getElementById("btn-nav-back");
        if (breadcrumb) breadcrumb.style.display = state.treeCollapsableMode ? "none" : "";
        if (backBtn) backBtn.style.display = state.treeCollapsableMode ? "none" : "";

        showToast(state.treeCollapsableMode ? "Collapsable tree mode enabled" : "Folder navigation mode enabled", "success");
      });
    }
    const showToastsToggle = document.getElementById("show-toasts-toggle");
    if (showToastsToggle) {
      showToastsToggle.addEventListener("change", async (e) => {
        state.showToasts = e.target.checked;
        await saveSettingsImpl();
        showToast(state.showToasts ? "Toast notifications enabled" : "Toast notifications disabled", "success");
      });
    }

    // Handle Syntax Color Toggles (Checkbox)
    const colorToggles = modalBody.querySelectorAll(".syntax-color-toggle");
    colorToggles.forEach(toggle => {
        toggle.addEventListener("change", async (e) => {
            const key = e.target.dataset.key;
            const checked = e.target.checked;
            const input = modalBody.querySelector(`.syntax-color-input[data-key="${key}"]`);
            const labelSpan = e.target.nextElementSibling;

            if (checked) {
                // Enable: add to customColors with current color value
                state.customColors[key] = input.value;
                input.disabled = false;
                input.style.opacity = "1";
                input.style.cursor = "pointer";
                if (labelSpan) labelSpan.style.opacity = "1";
            } else {
                // Disable: remove from customColors
                delete state.customColors[key];
                input.disabled = true;
                input.style.opacity = "0.2";
                input.style.cursor = "default";
                if (labelSpan) labelSpan.style.opacity = "0.5";
            }

            await saveSettingsImpl();
            if (callbacks.applyCustomSyntaxColors) {
              callbacks.applyCustomSyntaxColors();
            }
        });
    });

    // Handle Syntax Color Inputs (Color Picker)
    const colorInputs = modalBody.querySelectorAll(".syntax-color-input");
    colorInputs.forEach(input => {
        input.addEventListener("change", async (e) => {
            const key = e.target.dataset.key;
            const value = e.target.value;

            // Only update if checkbox is enabled
            const toggle = modalBody.querySelector(`.syntax-color-toggle[data-key="${key}"]`);
            if (toggle && toggle.checked) {
                state.customColors[key] = value;
                await saveSettingsImpl();
                if (callbacks.applyCustomSyntaxColors) {
                  callbacks.applyCustomSyntaxColors();
                }
            }
        });
    });

    // Handle Reset Colors button
    // Handle Syntax Theme selection
    const syntaxThemeBtns = modalBody.querySelectorAll(".syntax-theme-btn");
    syntaxThemeBtns.forEach(btn => {
      btn.addEventListener("click", async () => {
        const themeKey = btn.dataset.theme;
        state.syntaxTheme = themeKey;
        await saveSettingsImpl();

        // Apply immediately
        if (callbacks.applyCustomSyntaxColors) {
          callbacks.applyCustomSyntaxColors();
        }

        // Update button styles
        syntaxThemeBtns.forEach(b => {
          const isActive = b.dataset.theme === themeKey;
          b.classList.toggle("active", isActive);
          b.style.borderColor = isActive ? "var(--accent-color)" : "var(--border-color)";
          b.style.background = isActive ? "var(--bg-hover)" : "var(--bg-primary)";
        });

        // Show/hide custom colors section
        const customSection = document.getElementById("custom-colors-section");
        if (customSection) {
          customSection.style.display = themeKey === "custom" ? "block" : "none";
        }

        showToast(`Syntax theme: ${SYNTAX_THEMES[themeKey].name}`, "success");
      });
    });

    const btnResetColors = document.getElementById("btn-reset-colors");
    if (btnResetColors) {
        btnResetColors.addEventListener("click", async () => {
            state.customColors = {};
            await saveSettingsImpl();
            if (callbacks.applyCustomSyntaxColors) {
              callbacks.applyCustomSyntaxColors();
            }
            showToast("Colors reset to defaults", "success");

            // Re-render settings to update UI
            setTimeout(() => {
                closeSettings();
                showAppSettings();
            }, 300);
        });
    }

    // Handle Reset Application button
    const btnResetApp = document.getElementById("btn-reset-app");
    if (btnResetApp) {
      btnResetApp.addEventListener("click", async () => {
        // Close settings modal first
        closeSettings();

        // Show confirmation dialog
        const confirmed = await showConfirmDialogWithItems(
            "Reset Application",
            "Are you sure you want to reset the application? This will:",
            [
                "Clear all settings and preferences",
                "Reset theme to default",
                "Clear recent files and favorites"
            ],
            "This action cannot be undone, but your files will remain safe.",
            true
        );

        if (!confirmed) return;

        // Show advanced options
        const advancedModal = document.getElementById("modal");
        const advancedModalBody = document.getElementById("modal-body");
        const advancedModalTitle = document.getElementById("modal-title");

        advancedModalTitle.textContent = "Reset Options";
        advancedModalBody.innerHTML = `
          <div style="padding: 16px 0;">
            <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 6px; font-size: 12px; color: var(--text-secondary);">
              <strong>Note:</strong> Your configuration files will not be deleted. Only application settings will be reset.
            </div>
          </div>
        `;

        const handleConfirm = async () => {
            // Reset server-side settings
            try {
                await fetchWithAuth(API_BASE, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "save_settings",
                        settings: {}
                    }),
                });
            } catch (e) {
                console.error("Failed to reset server settings:", e);
            }

            localStorage.clear();
            window.location.reload();
        };

        // One-time listener for this specific modal instance
        const cleanup = () => {
            elements.modalConfirm.removeEventListener("click", handleConfirm);
            if (callbacks.hideModal) {
              elements.modalCancel.removeEventListener("click", callbacks.hideModal);
            }
        };

        elements.modalConfirm.addEventListener("click", handleConfirm, { once: true });
      });
    }

    // Handle File Cache Size slider
    const fileCacheSizeSlider = document.getElementById("file-cache-size-slider");
    const fileCacheSizeValue = document.getElementById("file-cache-size-value");
    if (fileCacheSizeSlider && fileCacheSizeValue) {
      fileCacheSizeSlider.addEventListener("input", (e) => {
        fileCacheSizeValue.textContent = `${e.target.value} files`;
      });

      fileCacheSizeSlider.addEventListener("change", async (e) => {
        state.fileCacheSize = parseInt(e.target.value);
        await saveSettingsImpl();
        showToast(`File cache size set to ${state.fileCacheSize} files`, "success");
      });
    }

    // Handle Virtual Scrolling toggle
    const virtualScrollToggle = document.getElementById("virtual-scroll-toggle");
    if (virtualScrollToggle) {
      virtualScrollToggle.addEventListener("change", async (e) => {
        state.enableVirtualScroll = e.target.checked;
        await saveSettingsImpl();
        showToast(state.enableVirtualScroll ? "Virtual scrolling enabled" : "Virtual scrolling disabled", "success");
      });
    }

    // Handle Split View toggle (Experimental)
    const splitViewToggle = document.getElementById("split-view-toggle");
    if (splitViewToggle) {
      splitViewToggle.addEventListener("change", async (e) => {
        state.enableSplitView = e.target.checked;
        await saveSettingsImpl();
        showToast(state.enableSplitView ? "Split View enabled (Beta)" : "Split View disabled", "success");

        // Update split view buttons visibility
        // This will be handled by the updateSplitViewButtons function in split-view.js
        const event = new CustomEvent('splitViewSettingChanged', {
          detail: { enabled: state.enableSplitView }
        });
        window.dispatchEvent(event);
      });
    }
  }

// Helper function for confirmation dialogs with list items (local variant)
async function showConfirmDialogWithItems(title, message, items, note, showCancel = true) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal");
    const modalOverlay = document.getElementById("modal-overlay");
    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");

    modalTitle.textContent = title;
    modalBody.innerHTML = `
      <div style="padding: 16px 0;">
        <p style="margin-bottom: 12px; font-size: 14px;">${message}</p>
        ${items ? `
          <ul style="margin: 12px 0; padding-left: 20px;">
            ${items.map(item => `<li style="margin: 6px 0; font-size: 13px;">${item}</li>`).join('')}
          </ul>
        ` : ''}
        ${note ? `
          <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 6px; font-size: 12px; color: var(--text-secondary); margin-top: 12px;">
            ${note}
          </div>
        ` : ''}
      </div>
    `;

    modalOverlay.classList.add("visible");

    const handleConfirm = () => {
      modalOverlay.classList.remove("visible");
      elements.modalConfirm.removeEventListener("click", handleConfirm);
      if (showCancel) {
        elements.modalCancel.removeEventListener("click", handleCancel);
      }
      resolve(true);
    };

    const handleCancel = () => {
      modalOverlay.classList.remove("visible");
      elements.modalConfirm.removeEventListener("click", handleConfirm);
      if (showCancel) {
        elements.modalCancel.removeEventListener("click", handleCancel);
      }
      resolve(false);
    };

    elements.modalConfirm.addEventListener("click", handleConfirm);
    if (showCancel) {
      elements.modalCancel.addEventListener("click", handleCancel);
    }
  });
}
