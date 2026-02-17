/**
 * ============================================================================
 * GITEA INTEGRATION MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Handles Gitea self-hosted Git service operations: repository creation,
 * authentication, push/pull, and Gitea-specific settings.
 *
 * EXPORTED FUNCTIONS:
 * - registerGiteaIntegrationCallbacks(cb) - Register dependencies
 * - giteaCreateRepo(name, isPrivate) - Create Gitea repository
 * - giteaAuth(url, token) - Authenticate with Gitea
 * - showGiteaSettings() - Show Gitea settings dialog
 *
 * HOW TO ADD FEATURES:
 * 1. Add Gitea API calls: Use fetchWithAuth with Gitea API endpoints
 * 2. Add repo operations: Create, delete, fork, star
 * 3. Add organization support: Manage org repos and teams
 * 4. Add webhooks: Configure push/pull webhooks
 *
 * INTEGRATION: gitea-ui.js, api.js, ui.js, similar to GitHub integration
 * COMMON PATTERNS: await giteaCreateRepo(name), giteaAuth(url, token)
 *
 * ============================================================================
 */

import { state, elements, giteaState } from './state.js';
import { fetchWithAuth } from './api.js';
import { API_BASE } from './constants.js';
import { showToast, showGlobalLoading, hideGlobalLoading, resetModalToDefault, showConfirmDialog, showModal } from './ui.js';
import { formatBytes } from './utils.js';
import {
  registerGiteaUICallbacks,
  updateGiteaPanel as updateGiteaPanelImpl,
  renderGiteaFiles as renderGiteaFilesImpl,
  toggleGiteaFileSelection as toggleGiteaFileSelectionImpl,
  stageSelectedGiteaFiles as stageSelectedGiteaFilesImpl,
  stageAllGiteaFiles as stageAllGiteaFilesImpl,
  unstageAllGiteaFiles as unstageAllGiteaFilesImpl
} from './gitea-ui.js';

// ============================================
// Callback Registration
// ============================================

let callbacks = {
  gitStatus: null,
  gitStage: null,
  gitUnstage: null,
  gitGetRemotes: null,
  gitCleanLocks: null,
  loadFiles: null,
  openFile: null,
  isTextFile: null,
  setButtonLoading: null
};

export function registerGiteaIntegrationCallbacks(callbackMap) {
  callbacks = { ...callbacks, ...callbackMap };

  // Register callbacks for gitea-ui.js
  registerGiteaUICallbacks({
    giteaStage,
    giteaUnstage,
    giteaAbort,
    giteaForcePush,
    giteaHardReset,
    showToast,
    isTextFile: callbacks.isTextFile
  });
}

// ============================================
// Gitea Repository Initialization
// ============================================

export async function giteaInit(skipConfirm = false) {
  if (!skipConfirm) {
    const confirmed = await showConfirmDialog({
      title: "Initialize Gitea Repository",
      message: "Are you sure you want to initialize a new Git repository in the config directory?",
      confirmText: "Initialize",
      cancelText: "Cancel"
    });

    if (!confirmed) return false;
  }

  try {
    showToast("Initializing git repository...", "success");
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_init" }),
    });

    if (data.success) {
      showToast("Git repository initialized successfully", "success");
      await fetchWithAuth(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "git_rename_branch", old_name: "master", new_name: "main" }),
      });
      giteaState.isInitialized = true;
      await giteaStatus();
      return true;
    } else {
      showToast("Failed to init: " + (data.message || "Unknown error"), "error");
    }
  } catch (error) {
    showToast("Gitea init failed: " + error.message, "error");
  }
  return false;
}

// ============================================
// Gitea Push Operation
// ============================================

export async function giteaPush() {
  try {
    if (callbacks.setButtonLoading) {
      callbacks.setButtonLoading(elements.btnGiteaPush, true);
    }
    showToast("Pushing to Gitea...", "info");

    const pushData = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "gitea_push_only" }),
    });

    if (pushData.success) {
      if (callbacks.setButtonLoading) {
        callbacks.setButtonLoading(elements.btnGiteaPush, false);
      }
      showToast(pushData.message || "Successfully pushed to Gitea", "success");
      await giteaStatus();
      return;
    }

    const errorMessage = pushData.message || pushData.error || "Unknown error";

    if (errorMessage.includes("uncommitted changes")) {
      if (callbacks.setButtonLoading) {
        callbacks.setButtonLoading(elements.btnGiteaPush, false);
      }
      const commitMessage = await showModal({
        title: "Commit & Push to Gitea",
        placeholder: "Commit message",
        value: "Update configuration via Blueprint Studio",
        hint: "You have uncommitted changes. Enter a message to commit and push:",
      });

      if (!commitMessage) return;

      if (callbacks.setButtonLoading) {
        callbacks.setButtonLoading(elements.btnGiteaPush, true);
      }
      showToast("Committing and pushing changes...", "info");

      const data = await fetchWithAuth(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "gitea_push",
          commit_message: commitMessage,
        }),
      });

      if (callbacks.setButtonLoading) {
        callbacks.setButtonLoading(elements.btnGiteaPush, false);
      }

      if (data.success) {
        showToast("Successfully pushed to Gitea", "success");
        await giteaStatus();
      } else {
        showToast("Push failed: " + (data.message || data.error), "error");
      }
    } else if (errorMessage.includes("No commits to push")) {
      if (callbacks.setButtonLoading) {
        callbacks.setButtonLoading(elements.btnGiteaPush, false);
      }
      showToast("No commits to push.", "warning");
    } else {
      if (callbacks.setButtonLoading) {
        callbacks.setButtonLoading(elements.btnGiteaPush, false);
      }
      showToast("Push failed: " + errorMessage, "error");
    }
  } catch (error) {
    if (callbacks.setButtonLoading) {
      callbacks.setButtonLoading(elements.btnGiteaPush, false);
    }
    showToast("Gitea push failed: " + error.message, "error");
  }
}

// ============================================
// Gitea Pull Operation
// ============================================

export async function giteaPull() {
  const confirmed = await showConfirmDialog({
    title: "Pull from Gitea",
    message: "Are you sure you want to pull changes from Gitea? This will update your local files.",
    confirmText: "Pull",
    cancelText: "Cancel"
  });

  if (!confirmed) return;

  try {
    if (callbacks.setButtonLoading) {
      callbacks.setButtonLoading(elements.btnGiteaPull, true);
    }
    showToast("Pulling from Gitea...", "success");

    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "gitea_pull" }),
    });

    if (callbacks.setButtonLoading) {
      callbacks.setButtonLoading(elements.btnGiteaPull, false);
    }

    if (data.success) {
      showToast("Successfully pulled from Gitea", "success");
      if (callbacks.loadFiles) await callbacks.loadFiles();
      await giteaStatus();
      if (state.activeTab && callbacks.openFile) {
        await callbacks.openFile(state.activeTab.path, true);
      }
    }
  } catch (error) {
    if (callbacks.setButtonLoading) {
      callbacks.setButtonLoading(elements.btnGiteaPull, false);
    }
    showToast("Gitea pull failed: " + error.message, "error");
  }
}

// ============================================
// Gitea Commit Operation
// ============================================

export async function giteaCommit() {
  const stagedCount = giteaState.files.staged.length;
  if (stagedCount === 0) return;

  let defaultMessage = "Update via Blueprint Studio";
  if (stagedCount === 1) {
    const filename = giteaState.files.staged[0].split("/").pop();
    defaultMessage = `Update ${filename}`;
  } else if (stagedCount > 1) {
    const filename = giteaState.files.staged[0].split("/").pop();
    defaultMessage = `Update ${filename} and ${stagedCount - 1} others`;
  }

  const commitMessage = await showModal({
    title: "Commit Changes (Gitea)",
    placeholder: "Commit message",
    value: defaultMessage,
    hint: `Committing ${stagedCount} staged file(s)`,
  });

  if (!commitMessage) return;

  try {
    showToast("Committing staged changes...", "success");
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_commit", commit_message: commitMessage }),
    });

    if (data.success) {
      showToast("Changes committed successfully", "success");
      await giteaStatus();
    }
  } catch (error) {
    showToast("Commit failed: " + error.message, "error");
  }
}

// ============================================
// Gitea Stage/Unstage Operations
// ============================================

export async function giteaStage(files) {
  // Reuse gitStage but refresh gitea status
  if (callbacks.gitStage) {
    await callbacks.gitStage(files);
  }
  await giteaStatus();
}

export async function giteaUnstage(files) {
  if (callbacks.gitUnstage) {
    await callbacks.gitUnstage(files);
  }
  await giteaStatus();
}

// ============================================
// Gitea File Selection
// ============================================

export function toggleGiteaFileSelection(file) {
  return toggleGiteaFileSelectionImpl(file);
}

export async function stageSelectedGiteaFiles() {
  return await stageSelectedGiteaFilesImpl();
}

export async function stageAllGiteaFiles() {
  return await stageAllGiteaFilesImpl();
}

export async function unstageAllGiteaFiles() {
  return await unstageAllGiteaFilesImpl();
}

// ============================================
// Gitea Abort Operation
// ============================================

export async function giteaAbort() {
  const confirmed = await showConfirmDialog({
    title: "Abort Gitea Sync?",
    message: "This will cancel the current Gitea operation and reset your sync state. Any merge conflicts will be discarded.",
    confirmText: "Abort Sync",
    cancelText: "Cancel",
    isDanger: true
  });

  if (confirmed) {
    try {
      showGlobalLoading("Aborting...");
      const data = await fetchWithAuth(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "git_abort" }),
      });
      hideGlobalLoading();
      if (data.success) {
        showToast("Sync operation aborted", "success");
        await giteaStatus();
      }
    } catch (error) {
      hideGlobalLoading();
      showToast("Abort failed: " + error.message, "error");
    }
  }
}

// ============================================
// Gitea Force Push Operation
// ============================================

export async function giteaForcePush() {
  const confirmed = await showConfirmDialog({
    title: "Force Push to Gitea?",
    message: "This will OVERWRITE the version on Gitea with your local version. Use with caution!",
    confirmText: "Force Push",
    cancelText: "Cancel",
    isDanger: true
  });

  if (confirmed) {
    try {
      showGlobalLoading("Force Pushing...");
      const data = await fetchWithAuth(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "git_force_push", remote: "gitea" }),
      });
      hideGlobalLoading();
      if (data.success) {
        showToast("Force pushed to Gitea successfully", "success");
        await giteaStatus();
      }
    } catch (error) {
      hideGlobalLoading();
      showToast("Force push failed: " + error.message, "error");
    }
  }
}

// ============================================
// Gitea Hard Reset Operation
// ============================================

export async function giteaHardReset() {
  const confirmed = await showConfirmDialog({
    title: "Hard Reset from Gitea?",
    message: "This will PERMANENTLY DELETE your local changes and match the Gitea version exactly.",
    confirmText: "Hard Reset",
    cancelText: "Cancel",
    isDanger: true
  });

  if (confirmed) {
    try {
      showGlobalLoading("Hard Resetting...");
      const data = await fetchWithAuth(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "git_hard_reset", remote: "gitea", branch: giteaState.currentBranch }),
      });
      hideGlobalLoading();
      if (data.success) {
        showToast("Reset to Gitea version successfully", "success");
        if (callbacks.loadFiles) await callbacks.loadFiles();
        await giteaStatus();
      }
    } catch (error) {
      hideGlobalLoading();
      showToast("Hard reset failed: " + error.message, "error");
    }
  }
}

// ============================================
// Gitea Settings Modal
// ============================================

export async function showGiteaSettings() {
  // Get current remotes
  const remotes = callbacks.gitGetRemotes ? await callbacks.gitGetRemotes() : {};
  const giteaRemote = remotes["gitea"] || "";

  // Get saved credentials
  const credentialsData = await fetchWithAuth(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "gitea_get_credentials" }),
  });

  const savedUsername = credentialsData.has_credentials ? credentialsData.username : "";
  const hasCredentials = credentialsData.has_credentials;

  // Get saved Gitea server URL from localStorage
  const savedGiteaUrl = localStorage.getItem("giteaServerUrl") || "";

  const modalOverlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalFooter = document.querySelector(".modal-footer");

  modalTitle.textContent = "Gitea Settings";

  let remotesHtml = "";
  if (Object.keys(remotes).length > 0) {
    remotesHtml = '<div class="git-settings-section"><div class="git-settings-label">Current Remotes</div>';
    for (const [name, url] of Object.entries(remotes)) {
      remotesHtml += `
        <div class="git-remote-item">
          <div style="flex: 1; min-width: 0;">
              <span class="git-remote-name">${name}</span>
              <span class="git-remote-url">${url}</span>
          </div>
          <button class="btn-icon-only remove-remote-btn" data-remote-name="${name}" title="Remove Remote" style="background: transparent; border: none; cursor: pointer; color: var(--text-secondary); padding: 4px;">
              <span class="material-icons" style="font-size: 18px;">delete</span>
          </button>
        </div>
      `;
    }
    remotesHtml += '</div>';
  }

  let credentialsStatusHtml = "";
  if (hasCredentials) {
    credentialsStatusHtml = `
      <div class="git-settings-info" style="color: #4caf50; margin-bottom: 12px;">
        <span class="material-icons">check_circle</span>
        <span>You are logged in as <strong>${savedUsername}</strong></span>
      </div>
      <button id="btn-gitea-signout" style="width: 100%; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; background: #f44336; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; transition: background 0.15s;">
        <span class="material-icons">logout</span>
        <span>Sign Out</span>
      </button>
    `;
  }

  modalBody.innerHTML = `
    <div class="git-settings-content">
      ${remotesHtml}

      <div class="git-settings-section">
        <div class="git-settings-label">Gitea Repository URL</div>
        <input type="text" class="git-settings-input" id="gitea-repo-url"
               placeholder="https://gitea.example.com/user/repo.git"
               value="${giteaRemote}"
               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
        <div class="git-settings-buttons">
          <button class="btn-primary" id="btn-save-gitea-remote" style="width: 100%;">Save Remote</button>
        </div>
      </div>

      <div class="git-settings-section">
        <div class="git-settings-label">
          <span class="material-icons" style="vertical-align: middle; margin-right: 8px; color: #fa8e14;">emoji_food_beverage</span>
          Gitea Authentication
        </div>

        ${credentialsStatusHtml}

        <input type="text" class="git-settings-input" id="gitea-username"
               placeholder="Gitea username"
               value="${savedUsername}"
               autocomplete="username" autocorrect="off" autocapitalize="off" spellcheck="false"
               style="margin-bottom: 8px;" />
        <input type="password" class="git-settings-input" id="gitea-token"
               placeholder="${hasCredentials ? 'Enter new token to update (leave blank to keep current)' : 'Personal Access Token'}"
               autocomplete="off"
               style="margin-bottom: 12px;" />

        <div class="git-settings-buttons">
          <button class="btn-secondary" id="btn-test-gitea-connection">Test Connection</button>
          <button class="btn-primary" id="btn-save-gitea-credentials">${hasCredentials ? 'Update' : 'Save'} Credentials</button>
        </div>
      </div>

      <div class="git-settings-section">
        <div class="git-settings-label">
          <span class="material-icons" style="vertical-align: middle; margin-right: 8px; color: #fa8e14;">add_box</span>
          Create New Repository
        </div>
        <input type="text" class="git-settings-input" id="gitea-new-repo-name"
               placeholder="Repository name (e.g., my-config)"
               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
               style="margin-bottom: 8px;" />
        <input type="text" class="git-settings-input" id="gitea-new-repo-description"
               placeholder="Description (optional)"
               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
               style="margin-bottom: 8px;" />
        <input type="text" class="git-settings-input" id="gitea-server-url"
               placeholder="Gitea server URL (e.g., https://gitea.example.com)"
               value="${savedGiteaUrl}"
               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
               style="margin-bottom: 8px;" />
        <div class="git-settings-checkbox" style="margin-bottom: 12px;">
          <input type="checkbox" id="gitea-repo-private" checked>
          <label for="gitea-repo-private">Private repository</label>
        </div>
        <button class="btn-primary" id="btn-create-gitea-repo" style="width: 100%;">
          <span class="material-icons" style="vertical-align: middle; margin-right: 8px;">add</span>
          Create Repository on Gitea
        </button>
      </div>

      <div class="git-settings-section">
        <div class="git-settings-label">Troubleshooting</div>
        <button class="btn-secondary" id="btn-clean-git-locks" style="width: 100%;">
          <span class="material-icons" style="vertical-align: middle; margin-right: 8px;">delete_sweep</span>
          Clean Git Lock Files
        </button>
      </div>
    </div>
  `;

  modalOverlay.classList.add("visible");

  // Set wider modal for Gitea Settings (responsive on mobile via CSS)
  modal.style.maxWidth = "650px";

  // Hide default modal buttons
  if (modalFooter) {
    modalFooter.style.display = "none";
  }

  // Function to clean up and close the Gitea Settings modal
  const closeGiteaSettings = () => {
    modalOverlay.classList.remove("visible");
    resetModalToDefault();
    modalOverlay.removeEventListener("click", overlayClickHandler);
  };

  // Overlay click handler (defined separately so we can remove it)
  const overlayClickHandler = (e) => {
    if (e.target === modalOverlay) {
      closeGiteaSettings();
    }
  };
  modalOverlay.addEventListener("click", overlayClickHandler);
  document.getElementById("modal-close").onclick = closeGiteaSettings;

  // Add event listeners for delete remote buttons
  const removeRemoteBtns = modalBody.querySelectorAll('.remove-remote-btn');
  removeRemoteBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const remoteName = e.currentTarget.dataset.remoteName;
      const confirmed = await showConfirmDialog({
        title: "Remove Remote",
        message: `Are you sure you want to remove the remote '${remoteName}'?`,
        confirmText: "Remove",
        cancelText: "Cancel",
        isDanger: true
      });

      if (confirmed) {
        try {
          const data = await fetchWithAuth(API_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "gitea_remove_remote", name: remoteName }),
          });

          if (data.success) {
            showToast(data.message, "success");
            // Refresh settings modal
            setTimeout(() => showGiteaSettings(), 300);
          } else {
            showToast("Failed to remove remote: " + data.message, "error");
          }
        } catch (error) {
          showToast("Error removing remote: " + error.message, "error");
        }
      }
    });
  });

  document.getElementById("btn-save-gitea-remote")?.addEventListener("click", async () => {
    const url = document.getElementById("gitea-repo-url").value;
    if (!url) return showToast("URL required", "error");

    const result = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "gitea_add_remote", url: url }),
    });
    if (result.success) {
      showToast("Gitea remote saved", "success");

      // Extract and save the base server URL from the repo URL
      try {
        const urlObj = new URL(url);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        localStorage.setItem("giteaServerUrl", baseUrl);
      } catch (e) {
        // If URL parsing fails, ignore it
      }
    }
    else showToast("Failed: " + result.error, "error");
  });

  document.getElementById("btn-save-gitea-credentials")?.addEventListener("click", async () => {
    const username = document.getElementById("gitea-username").value;
    const token = document.getElementById("gitea-token").value;
    if (!username) return showToast("Username required", "error");
    if (!token && !hasCredentials) return showToast("Token required", "error");

    const result = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "gitea_set_credentials", username, token }),
    });
    if (result.success) {
      showToast("Credentials saved", "success");
      closeGiteaSettings();
    } else {
      showToast("Failed: " + result.message, "error");
    }
  });

  document.getElementById("btn-gitea-signout")?.addEventListener("click", async () => {
    await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "gitea_clear_credentials" }),
    });
    showToast("Signed out", "success");
    closeGiteaSettings();
  });

  document.getElementById("btn-test-gitea-connection")?.addEventListener("click", async () => {
    const result = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "gitea_test_connection" }),
    });
    if (result.success) showToast("Connection Successful", "success");
    else showToast("Connection Failed: " + result.error, "error");
  });

  document.getElementById("btn-create-gitea-repo")?.addEventListener("click", async () => {
    const repoName = document.getElementById("gitea-new-repo-name")?.value.trim();
    const description = document.getElementById("gitea-new-repo-description")?.value.trim();
    const giteaUrl = document.getElementById("gitea-server-url")?.value.trim();
    const isPrivate = document.getElementById("gitea-repo-private")?.checked;

    if (!repoName) {
      showToast("Repository name is required", "error");
      return;
    }

    if (!giteaUrl) {
      showToast("Gitea server URL is required", "error");
      return;
    }

    const result = await giteaCreateRepo(repoName, description, isPrivate, giteaUrl);

    if (result && result.success) {
      // Save the Gitea server URL for future use
      localStorage.setItem("giteaServerUrl", giteaUrl);

      // Clear the form
      document.getElementById("gitea-new-repo-name").value = "";
      document.getElementById("gitea-new-repo-description").value = "";

      // Refresh the modal to show the new remote
      setTimeout(() => {
        closeGiteaSettings();
        showGiteaSettings();
      }, 2000);
    }
  });

  document.getElementById("btn-clean-git-locks")?.addEventListener("click", async () => {
    if (callbacks.gitCleanLocks) {
      await callbacks.gitCleanLocks();
    }
  });
}

// ============================================
// Gitea Repository Creation
// ============================================

export async function giteaCreateRepo(repoName, description, isPrivate, giteaUrl) {
  try {
    if (!giteaUrl) {
      showToast("Gitea server URL is required", "error");
      return null;
    }

    showToast("Creating Gitea repository...", "info");
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "gitea_create_repo",
        repo_name: repoName,
        description: description,
        is_private: isPrivate,
        gitea_url: giteaUrl
      }),
    });

    if (data.success) {
      showToast(data.message, "success");

      // Show link to new repo
      if (data.html_url) {
        setTimeout(() => {
          showToast(
            `View your repo: ${data.html_url}`,
            "success",
            10000  // Show for 10 seconds
          );
        }, 2000);
      }

      return data;
    } else {
      showToast("Failed to create repo: " + (data.message || "Unknown error"), "error");
      return null;
    }
  } catch (error) {
    showToast("Failed to create repo: " + error.message, "error");
    return null;
  }
}

// ============================================
// Gitea Status Check
// ============================================

export async function giteaStatus(shouldFetch = false, silent = false) {
  if (!state.giteaIntegrationEnabled) return;

  try {
    if (!silent) {
      if (elements.btnGiteaStatus) elements.btnGiteaStatus.classList.add("pulsing");
    }

    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "gitea_status",
        fetch: shouldFetch
      }),
    });

    if (!silent) {
      if (elements.btnGiteaStatus) elements.btnGiteaStatus.classList.remove("pulsing");
    }

    if (data.success) {
      // Store previous change list string to check for meaningful changes
      const currentChangesList = JSON.stringify(data.files);
      const hasMeaningfulChange = state._lastGiteaChanges && state._lastGiteaChanges !== currentChangesList;
      state._lastGiteaChanges = currentChangesList;

      giteaState.isInitialized = data.is_initialized;
      giteaState.hasRemote = data.has_remote;
      giteaState.currentBranch = data.current_branch || "unknown";
      giteaState.localBranches = data.local_branches || [];
      giteaState.remoteBranches = data.remote_branches || [];
      giteaState.ahead = data.ahead || 0;
      giteaState.behind = data.behind || 0;
      giteaState.status = data.status || "";

      giteaState.files = data.files || {
        modified: [],
        added: [],
        deleted: [],
        untracked: [],
        staged: [],
        unstaged: []
      };

      giteaState.totalChanges = [
        ...giteaState.files.modified,
        ...giteaState.files.added,
        ...giteaState.files.deleted,
        ...giteaState.files.untracked
      ].length;

      updateGiteaPanel();

      // SMART NOTIFICATION for Gitea
      if (!silent || (hasMeaningfulChange && giteaState.totalChanges > 0)) {
        if (data.has_changes) {
          showToast(`Gitea: ${giteaState.totalChanges} change(s) detected`, "success");
        } else if (!silent) {
          showToast("Gitea tree clean, no changes", "success");
        }
      }
    }
  } catch (error) {
    if (!silent) {
      if (elements.btnGiteaStatus) elements.btnGiteaStatus.classList.remove("pulsing");
      showToast("Gitea error: " + error.message, "error");
    }
  }
}

// ============================================
// Gitea Panel UI Update
// ============================================

export function updateGiteaPanel() {
  return updateGiteaPanelImpl();
}

// ============================================
// Gitea Files Rendering
// ============================================

export function renderGiteaFiles(container) {
  return renderGiteaFilesImpl(container);
}
