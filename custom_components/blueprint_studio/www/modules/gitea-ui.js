/**
 * ============================================================================
 * GITEA UI MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Handles all UI rendering and user interactions for the Gitea integration
 * panel. Gitea is a lightweight self-hosted Git service. This module provides
 * similar functionality to git-ui.js but for Gitea-specific features.
 *
 * EXPORTED FUNCTIONS:
 * - registerGiteaUICallbacks(cb) - Register dependencies from app.js
 * - updateGiteaPanel() - Refresh the entire Gitea panel UI
 * - renderGiteaFiles(container) - Render Gitea file list with groups
 * - toggleGiteaGroup(groupKey) - Expand/collapse file groups
 * - applyGiteaVisibility() - Show/hide Gitea panel based on settings
 *
 * REQUIRED CALLBACKS (from app.js):
 * - giteaStage: Stage files
 * - giteaUnstage: Unstage files
 * - giteaCommit: Commit with message
 * - showToast: Display notification
 * - showModal: Show input modal
 * - showConfirmDialog: Show confirmation dialog
 * - saveSettings: Save settings to server
 * - setButtonLoading: Set button loading state
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding Gitea-specific features:
 *    - Follow same patterns as git-ui.js
 *    - Add UI controls in updateGiteaPanel()
 *    - Implement operations in gitea-integration.js
 *    - Call via callbacks
 *
 * 2. Adding Gitea actions:
 *    - Add button to Gitea panel
 *    - Create click handler
 *    - Call appropriate callback
 *    - Use setButtonLoading for async operations
 *
 * 3. Customizing Gitea panel:
 *    - Modify updateGiteaPanel() HTML structure
 *    - Add new status displays
 *    - Add action buttons
 *    - Update event listeners
 *
 * INTEGRATION POINTS:
 * - state.js: giteaState (similar to gitState)
 * - gitea-integration.js: Gitea operations (via callbacks)
 * - app.js: Coordination layer
 * - elements: DOM element references
 *
 * STATE MANAGEMENT:
 * - giteaState.collapsedGroups: Set of collapsed group keys
 * - giteaState.selectedFiles: Set of selected file paths
 * - Similar structure to gitState
 *
 * ARCHITECTURE NOTES:
 * - Mirror of git-ui.js but for Gitea
 * - Provides similar git functionality via Gitea
 * - UI-only module, operations in gitea-integration.js
 * - Can coexist with standard git integration
 *
 * COMMON PATTERNS:
 * - Same as git-ui.js
 * - Check if enabled before showing UI
 * - Refresh after operations
 * - Loading states on buttons
 * - Toast notifications
 *
 * ============================================================================
 */
import { state, elements, giteaState } from './state.js';

// Callbacks for cross-module functions
let callbacks = {
  giteaStage: null,
  giteaUnstage: null,
  giteaAbort: null,
  giteaForcePush: null,
  giteaHardReset: null,
  showToast: null,
  isTextFile: null
};

export function registerGiteaUICallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Updates the Gitea panel UI with current status
 * Shows warnings, sync indicators, and file lists
 */
export function updateGiteaPanel() {
  const panel = document.getElementById("gitea-panel");
  if (!panel) return;

  if (!state.giteaIntegrationEnabled) {
    panel.classList.remove("visible");
    panel.style.display = "none";
    return;
  }

  const container = document.getElementById("gitea-files-container");
  const badge = document.getElementById("gitea-changes-count");
  const commitBtn = document.getElementById("btn-gitea-commit-staged");
  const actions = panel.querySelector(".git-panel-actions");

  if (!container || !badge || !commitBtn || !actions) return;

  if (badge) badge.textContent = giteaState.totalChanges;

  // Sync indicators
  const oldIndicators = actions.querySelectorAll(".git-sync-indicator");
  oldIndicators.forEach(i => i.remove());

  if (giteaState.isInitialized && giteaState.hasRemote) {
    if (giteaState.ahead > 0) {
      const pushBtn = document.createElement("button");
      pushBtn.className = "git-panel-btn git-sync-indicator";
      pushBtn.id = "btn-gitea-push-sync";
      pushBtn.title = `${giteaState.ahead} commits to push`;
      pushBtn.innerHTML = `
        <span class="material-icons" style="font-size: 18px; color: var(--success-color);">arrow_upward</span>
        <span style="font-size: 10px; margin-left: -2px; font-weight: bold; color: var(--success-color);">${giteaState.ahead}</span>
      `;
      actions.insertBefore(pushBtn, actions.firstChild);
    }
    if (giteaState.behind > 0) {
      const pullBtn = document.createElement("button");
      pullBtn.className = "git-panel-btn git-sync-indicator";
      pullBtn.id = "btn-gitea-pull-sync";
      pullBtn.title = `${giteaState.behind} commits to pull`;
      pullBtn.innerHTML = `
        <span class="material-icons" style="font-size: 18px; color: var(--warning-color);">arrow_downward</span>
        <span style="font-size: 10px; margin-left: -2px; font-weight: bold; color: var(--warning-color);">${giteaState.behind}</span>
      `;
      actions.insertBefore(pullBtn, actions.firstChild);
    }
  }

  // Stuck Operation Detection
  let stuckWarningHtml = "";
  if (giteaState.status && (
    giteaState.status.toLowerCase().includes("rebasing") ||
    giteaState.status.toLowerCase().includes("merging") ||
    giteaState.status.toLowerCase().includes("unmerged") ||
    giteaState.status.toLowerCase().includes("conflict")
  )) {
    stuckWarningHtml = `
      <div style="margin: 8px; padding: 12px; background: rgba(244, 67, 54, 0.1); border: 1px solid var(--error-color); border-radius: 6px; font-size: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--error-color); font-weight: 600;">
          <span class="material-icons" style="font-size: 18px;">error_outline</span>
          <span>Gitea Sync Blocked</span>
        </div>
        <p style="margin-bottom: 10px; color: var(--text-secondary);">A previous Gitea operation failed or is in progress. You must resolve or abort it.</p>
        <button id="btn-gitea-abort" style="width: 100%; padding: 6px; background: var(--error-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
          Abort & Reset Gitea Sync
        </button>
      </div>
    `;
  }

  // Diverged Sync Detection
  let divergedWarningHtml = "";
  if (giteaState.ahead > 0 && giteaState.behind > 0) {
    divergedWarningHtml = `
      <div style="margin: 8px; padding: 12px; background: rgba(156, 39, 176, 0.1); border: 1px solid #9c27b0; border-radius: 6px; font-size: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #9c27b0; font-weight: 600;">
          <span class="material-icons" style="font-size: 18px;">sync_problem</span>
          <span>Gitea Sync Conflict</span>
        </div>
        <p style="margin-bottom: 10px; color: var(--text-secondary);">Your local and Gitea versions have diverged.</p>
        <div style="display: flex; gap: 8px;">
          <button id="btn-gitea-force-push" style="flex: 1; padding: 6px; background: #9c27b0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">
            Force Push
          </button>
          <button id="btn-gitea-hard-reset" style="flex: 1; padding: 6px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 11px;">
            Hard Reset
          </button>
        </div>
      </div>
    `;
  }

  // Toggle visibility state based on content availability logic same as git
  if (giteaState.totalChanges > 0 || giteaState.ahead > 0 || giteaState.behind > 0 || !giteaState.isInitialized || !giteaState.hasRemote || stuckWarningHtml || divergedWarningHtml) {
    panel.classList.add("visible");
    panel.style.display = "flex";
  } else {
    panel.classList.add("visible");
    panel.style.display = "flex";
  }

  // Apply saved collapse state
  if (state.giteaPanelCollapsed) {
    panel.classList.add("collapsed");
    const icon = elements.btnGiteaCollapse?.querySelector(".material-icons");
    if (icon) {
      icon.textContent = "expand_more";
      elements.btnGiteaCollapse.title = "Expand Gitea Panel";
    }
  } else {
    panel.classList.remove("collapsed");
    const icon = elements.btnGiteaCollapse?.querySelector(".material-icons");
    if (icon) {
      icon.textContent = "expand_less";
      elements.btnGiteaCollapse.title = "Collapse Gitea Panel";
    }
  }

  if (!giteaState.isInitialized) {
    container.innerHTML = `
      <div class="git-empty-state">
        <span class="material-icons" style="font-size: 48px; opacity: 0.5; margin-bottom: 10px; color: #fa8e14;">source</span>
        <p style="margin: 0 0 10px 0; font-weight: 500;">Gitea Not Initialized</p>
        <button class="btn-primary" id="btn-gitea-init-panel" style="padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; background: #fa8e14; color: white;">
          <span class="material-icons" style="font-size: 18px;">play_circle</span> Initialize Repo
        </button>
      </div>
    `;
    if (commitBtn) commitBtn.disabled = true;
    return;
  }

  if (!giteaState.hasRemote) {
    if (giteaState.totalChanges === 0) {
      container.innerHTML = `
        <div class="git-empty-state">
          <span class="material-icons" style="font-size: 48px; opacity: 0.5; margin-bottom: 10px; color: #fa8e14;">link_off</span>
          <p style="margin: 0 0 10px 0; font-weight: 500;">No Gitea Remote</p>
          <button class="btn-primary" id="btn-gitea-connect-panel" style="padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; background: #fa8e14; color: white;">
            <span class="material-icons">link</span> Connect to Gitea
          </button>
        </div>
      `;
      if (commitBtn) commitBtn.disabled = true;
      return;
    }
  }

  if (giteaState.totalChanges > 0 || stuckWarningHtml || divergedWarningHtml) {
    container.innerHTML = stuckWarningHtml + divergedWarningHtml;
    if (giteaState.totalChanges > 0) {
      renderGiteaFiles(container);
    }

    // Add event listeners for warning buttons
    const btnAbort = document.getElementById("btn-gitea-abort");
    if (btnAbort && callbacks.giteaAbort) {
      btnAbort.addEventListener("click", callbacks.giteaAbort);
    }

    const btnForcePush = document.getElementById("btn-gitea-force-push");
    if (btnForcePush && callbacks.giteaForcePush) {
      btnForcePush.addEventListener("click", callbacks.giteaForcePush);
    }

    const btnHardReset = document.getElementById("btn-gitea-hard-reset");
    if (btnHardReset && callbacks.giteaHardReset) {
      btnHardReset.addEventListener("click", callbacks.giteaHardReset);
    }
  } else {
    container.innerHTML = `
      <div class="git-empty-state">
        <span class="material-icons" style="color: #fa8e14; font-size: 48px; opacity: 0.5;">check_circle</span>
        <p>No changes detected</p>
        <div class="git-empty-state-actions" style="display: flex; gap: 8px; margin-top: 12px; justify-content: center;">
          <button class="btn-secondary" id="btn-gitea-pull-empty-state" style="padding: 6px 12px; font-size: 12px; background: transparent; border: 1px solid var(--border-color);">
            <span class="material-icons" style="font-size: 16px;">cloud_download</span> Pull
          </button>
          <button class="btn-secondary" id="btn-gitea-refresh-empty-state" style="padding: 6px 12px; font-size: 12px; background: transparent; border: 1px solid var(--border-color);">
            <span class="material-icons" style="font-size: 16px;">refresh</span> Refresh
          </button>
        </div>
      </div>
    `;
  }

  if (commitBtn) commitBtn.disabled = giteaState.files.staged.length === 0;
}

/**
 * Renders Gitea files in the panel
 * Groups files by status: staged, modified, added, deleted, untracked
 */
export function renderGiteaFiles(container) {
  const groups = [
    { key: "staged", title: "Staged Changes", files: giteaState.files.staged, icon: "inventory_2", color: "success" },
    { key: "modified", title: "Modified", files: giteaState.files.modified.filter(f => !giteaState.files.staged.includes(f)), icon: "edit", color: "modified" },
    { key: "added", title: "Added", files: giteaState.files.added.filter(f => !giteaState.files.staged.includes(f)), icon: "add_circle", color: "added" },
    { key: "deleted", title: "Deleted", files: giteaState.files.deleted.filter(f => !giteaState.files.staged.includes(f)), icon: "delete", color: "deleted" },
    { key: "untracked", title: "Untracked", files: giteaState.files.untracked, icon: "help_outline", color: "untracked" }
  ];

  let html = "";

  for (const group of groups) {
    if (group.files.length === 0) continue;

    const isCollapsed = giteaState.collapsedGroups.has(group.key);
    const collapsedClass = isCollapsed ? ' collapsed' : '';

    html += `
      <div class="git-file-group${collapsedClass}" data-group="${group.key}">
        <div class="git-file-group-header">
          <span class="git-file-group-icon material-icons ${group.color}" style="font-size: 18px;">${group.icon}</span>
          <span>${group.title}</span>
          <span class="git-file-group-count">(${group.files.length})</span>
          <span class="material-icons git-file-group-chevron">chevron_right</span>
        </div>
        <div class="git-file-list">
    `;

    for (const file of group.files) {
      const isStaged = giteaState.files.staged.includes(file);
      const checked = giteaState.selectedFiles.has(file) ? 'checked' : '';

      let diffButton = "";
      if ((group.key === "modified" || group.key === "staged") && callbacks.isTextFile && callbacks.isTextFile(file)) {
        diffButton = `
          <button class="btn-icon-only btn-git-diff" data-path="${file}" title="View Diff" style="background: transparent; border: none; cursor: pointer; color: var(--text-secondary); margin-left: auto; padding: 4px;">
            <span class="material-icons" style="font-size: 16px;">difference</span>
          </button>
        `;
      }

      html += `
        <div class="git-file-item" data-file="${file}">
          <input type="checkbox" class="gitea-file-checkbox" ${checked} data-file-path="${file}" />
          <span class="git-file-name" title="${file}" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${file}</span>
          ${diffButton}
          ${isStaged ? '<span class="git-file-status staged" style="margin-left: 4px; background: var(--success-color); color: var(--bg-primary);">Staged</span>' : ''}
        </div>
      `;
    }
    html += `</div></div>`;
  }
  container.insertAdjacentHTML('beforeend', html);
}

/**
 * Toggle Gitea file selection
 */
export function toggleGiteaFileSelection(file) {
  if (giteaState.selectedFiles.has(file)) {
    giteaState.selectedFiles.delete(file);
  } else {
    giteaState.selectedFiles.add(file);
  }
}

/**
 * Stage selected Gitea files
 */
export async function stageSelectedGiteaFiles() {
  // Robust fallback: if Set is empty, check DOM for checked checkboxes
  if (giteaState.selectedFiles.size === 0) {
    const container = document.getElementById("gitea-files-container");
    if (container) {
      const checked = container.querySelectorAll(".gitea-file-checkbox:checked");
      checked.forEach(cb => {
        const path = cb.getAttribute("data-file-path");
        if (path) giteaState.selectedFiles.add(path);
      });
    }
  }

  const selectedFiles = Array.from(giteaState.selectedFiles);
  if (selectedFiles.length === 0) {
    if (callbacks.showToast) {
      callbacks.showToast("No files selected.", "warning");
    }
    return;
  }

  if (callbacks.giteaStage) {
    await callbacks.giteaStage(selectedFiles);
  }
  giteaState.selectedFiles.clear();
}

/**
 * Stage all unstaged Gitea files
 */
export async function stageAllGiteaFiles() {
  const unstagedFiles = [
    ...giteaState.files.modified.filter(f => !giteaState.files.staged.includes(f)),
    ...giteaState.files.added.filter(f => !giteaState.files.staged.includes(f)),
    ...giteaState.files.deleted.filter(f => !giteaState.files.staged.includes(f)),
    ...giteaState.files.untracked
  ];

  if (unstagedFiles.length > 0 && callbacks.giteaStage) {
    await callbacks.giteaStage(unstagedFiles);
  }
}

/**
 * Unstage all staged Gitea files
 */
export async function unstageAllGiteaFiles() {
  if (giteaState.files.staged.length > 0 && callbacks.giteaUnstage) {
    await callbacks.giteaUnstage(giteaState.files.staged);
  }
}
