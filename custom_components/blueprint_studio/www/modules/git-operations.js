/**
 * ============================================================================
 * GIT OPERATIONS MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Handles all git command operations including init, status, staging, committing,
 * pushing, pulling, branching, and git configuration. This module contains all
 * git business logic and server communication for git operations.
 *
 * EXPORTED FUNCTIONS:
 * Core Operations:
 * - isGitEnabled() - Check if git integration is enabled
 * - checkGitStatusIfEnabled() - Refresh status if git is enabled
 * - gitStatus() - Fetch current git status from server
 * - gitInit() - Initialize new git repository
 * - abortGitOperation() - Abort current git operation (merge/rebase)
 *
 * File Operations:
 * - gitStage(files) - Stage files to git index
 * - gitUnstage(files) - Unstage files from git index
 * - gitReset(files) - Reset files to last commit
 * - gitCommit(commitMessage) - Commit staged changes
 *
 * Remote Operations:
 * - gitPull() - Pull from remote repository
 * - gitPush() - Push to remote repository
 * - gitGetRemotes() - List remote repositories
 * - gitSetCredentials(username, password) - Save git credentials
 *
 * Branch Operations:
 * - repairBranchMismatch() - Fix branch tracking issues
 * - deleteRemoteBranch(branch) - Delete remote branch
 *
 * Advanced Operations:
 * - forcePush() - Force push to remote
 * - hardReset() - Hard reset to remote state
 * - gitCleanLocks() - Remove git lock files
 * - gitRepairIndex() - Repair corrupted git index
 * - handleGitLockAndRetry(files) - Handle lock file and retry staging
 *
 * REQUIRED CALLBACKS (from app.js):
 * - commitStagedFiles: Trigger commit dialog from UI
 * - checkGitStatusIfEnabled: Refresh status after operations
 * - setButtonLoading: Update button loading states
 * - gitStatus: Direct status refresh
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new git command:
 *    - Create new exported async function
 *    - Use fetchWithAuth(API_BASE, { action: "git_command", params })
 *    - Handle success/error responses
 *    - Show toast notifications
 *    - Refresh git status after operation: await callbacks.gitStatus()
 *    - Add to exports and app.js imports
 *
 * 2. Adding error handling for specific git errors:
 *    - Check error.message or data.message for error patterns
 *    - Provide actionable error messages
 *    - Offer "retry" or "fix" buttons with toast actions
 *    - Example: Lock detection, index corruption, merge conflicts
 *
 * 3. Adding a new git action button:
 *    - Add function here for the operation
 *    - Export it
 *    - Import in app.js with Impl suffix
 *    - Create wrapper in app.js
 *    - Call from git-ui.js via callback
 *
 * 4. Adding git lock/index repair:
 *    - Use gitCleanLocks() or gitRepairIndex()
 *    - Automatically detect lock errors in responses
 *    - Offer retry with handleGitLockAndRetry()
 *
 * INTEGRATION POINTS:
 * - state.js: gitState, state.gitIntegrationEnabled
 * - api.js: fetchWithAuth for server communication
 * - ui.js: showToast, showModal, showConfirmDialog
 * - git-ui.js: UI rendering (via callbacks)
 * - app.js: Coordination layer
 *
 * SERVER API ACTIONS:
 * - git_status: Get current git status
 * - git_init: Initialize repository
 * - git_stage: Stage files
 * - git_unstage: Unstage files
 * - git_reset: Reset files
 * - git_commit: Commit changes
 * - git_pull: Pull from remote
 * - git_push: Push to remote
 * - git_clean_locks: Remove lock files
 * - git_repair_index: Repair git index
 * - git_get_remotes: List remotes
 * - git_set_credentials: Save credentials
 * - git_abort: Abort operation
 * - git_delete_remote_branch: Delete remote branch
 * - git_force_push: Force push
 * - git_hard_reset: Hard reset
 *
 * ARCHITECTURE NOTES:
 * - All git operations go through this module
 * - UI rendering is in git-ui.js
 * - This module handles all server communication
 * - Error handling includes lock detection, index corruption, conflicts
 * - Automatic retry logic for transient errors
 * - Credentials are saved securely on server side
 *
 * COMMON PATTERNS:
 * - Check enabled: if (!isGitEnabled()) return;
 * - API call: const data = await fetchWithAuth(API_BASE, { action, params });
 * - Success handling: if (data.success) { showToast(); await callbacks.gitStatus(); }
 * - Error handling: if (errorMsg.includes("lock")) { offerLockCleanup(); }
 * - Loading states: callbacks.setButtonLoading(button, true/false);
 *
 * ERROR HANDLING PATTERNS:
 * - Lock files: Detect "index.lock" → offer clean & retry
 * - Index corruption: Detect "corrupt" → offer repair
 * - Merge conflicts: Detect "CONFLICT" → show conflict resolution
 * - Auth errors: Detect "authentication" → prompt for credentials
 * - Network errors: Detect "fetch" → show retry option
 *
 * ============================================================================
 */
import { state, elements, gitState, giteaState } from './state.js';
import { fetchWithAuth } from './api.js';
import { API_BASE } from './constants.js';
import {
  showToast,
  showGlobalLoading,
  hideGlobalLoading,
  showConfirmDialog,
  showModal
} from './ui.js';

// Callbacks for cross-module functions
let callbacks = {
  updateGitPanel: null,
  loadFiles: null,
  openFile: null,
  giteaStatus: null,
  commitStagedFiles: null,
  checkGitStatusIfEnabled: null,
  setButtonLoading: null,
  gitStatus: null
};

export function registerGitOperationsCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Check if Git integration is enabled
 */
export function isGitEnabled() {
  return localStorage.getItem("gitIntegrationEnabled") !== "false";
}

/**
 * Check git status if enabled (wrapper for both Git and Gitea)
 */
export async function checkGitStatusIfEnabled(shouldFetch = false, silent = false) {
  if (isGitEnabled()) {
    await gitStatus(shouldFetch, silent);
  }
  if (state.giteaIntegrationEnabled) {
    if (callbacks.giteaStatus) await callbacks.giteaStatus(shouldFetch, silent);
  }
}

/**
 * Get git status from server
 */
export async function gitStatus(shouldFetch = false, silent = false) {
  // Double check enabled state (redundant but safe)
  if (!isGitEnabled()) return;

  try {
    if (!silent) {
      // Use pulsing effect instead of spinner
      if (elements.btnGitStatus) elements.btnGitStatus.classList.add("pulsing");
    }

    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "git_status",
        fetch: shouldFetch
      }),
    });

    if (!silent) {
      if (elements.btnGitStatus) elements.btnGitStatus.classList.remove("pulsing");
    }

    if (data.success) {
      // Store previous change list string to check for meaningful changes
      const currentChangesList = JSON.stringify(data.files);
      // Only consider it a new change if the list content is different AND it's not the first load
      const hasMeaningfulChange = state._lastGitChanges && state._lastGitChanges !== currentChangesList;

      state._lastGitChanges = currentChangesList;

      // Update git state
      gitState.isInitialized = data.is_initialized;
      gitState.hasRemote = data.has_remote;
      gitState.currentBranch = data.current_branch || "unknown";
      gitState.localBranches = data.local_branches || [];
      gitState.remoteBranches = data.remote_branches || [];
      gitState.ahead = data.ahead || 0;
      gitState.behind = data.behind || 0;
      gitState.status = data.status || "";

      gitState.files = data.files || {
        modified: [],
        added: [],
        deleted: [],
        untracked: [],
        staged: [],
        unstaged: []
      };

      // Calculate total changes
      gitState.totalChanges = [
        ...gitState.files.modified,
        ...gitState.files.added,
        ...gitState.files.deleted,
        ...gitState.files.untracked
      ].length;

      // Update UI
      if (callbacks.updateGitPanel) callbacks.updateGitPanel();

      // SMART NOTIFICATION:
      // 1. If NOT silent (manual refresh), always show toast
      // 2. If silent (polling), only show toast if the LIST of changes is different (and non-empty)
      if (!silent || (hasMeaningfulChange && gitState.totalChanges > 0)) {
        if (data.has_changes) {
          showToast(`Git: ${gitState.totalChanges} change(s) detected`, "success");
        } else if (!silent) {
          showToast("Working tree clean, no changes", "success");
        }
      }
    }
  } catch (error) {
    if (!silent) {
      if (elements.btnGitStatus) elements.btnGitStatus.classList.remove("pulsing");
      showToast("Git error: " + error.message, "error");
    }
  }
}

/**
 * Initialize git repository
 */
export async function gitInit(skipConfirm = false) {
  if (!skipConfirm) {
    const confirmed = await showConfirmDialog({
      title: "Initialize Git Repository",
      message: "Are you sure you want to initialize a new Git repository in the config directory?",
      confirmText: "Initialize",
      cancelText: "Cancel"
    });

    if (!confirmed) {
      return false;
    }
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

      // Try to ensure branch is named 'main' (only if 'master' exists)
      try {
        await fetchWithAuth(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "git_rename_branch", old_name: "master", new_name: "main" }),
        });
      } catch (e) {
        // Ignore error - likely means 'master' doesn't exist (already using 'main')
      }

      // Update state
      gitState.isInitialized = true;

      // Refresh status to be sure
      await gitStatus();

      return true;
    } else {
      showToast("Failed to init: " + (data.message || "Unknown error"), "error");
    }
  } catch (error) {
    showToast("Git init failed: " + error.message, "error");
  }
  return false;
}

/**
 * Abort current rebase or merge operation
 */
export async function abortGitOperation() {
  const confirmed = await showConfirmDialog({
    title: "Abort Git Operation",
    message: "This will abort the current rebase or merge process. Your files will return to their state before the sync began. No data will be lost, but you may need to resolve conflicts manually.",
    confirmText: "Abort Sync",
    cancelText: "Cancel"
  });

  if (!confirmed) return;

  try {
    showGlobalLoading("Aborting operation...");
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_abort" }),
    });
    hideGlobalLoading();

    if (data.success) {
      showToast(data.message, "success");
      await gitStatus();
    } else {
      showToast("Failed to abort: " + data.message, "error");
    }
  } catch (e) {
    hideGlobalLoading();
    showToast("Error: " + e.message, "error");
  }
}

/**
 * Force push to remote (dangerous operation)
 */
export async function forcePush() {
  const confirmed = await showConfirmDialog({
    title: "Force Push to GitHub",
    message: "<p style='color: var(--error-color); font-weight: bold;'>⚠️ WARNING: DANGEROUS OPERATION</p><p>This will overwrite the version on GitHub with your local files. Any changes on GitHub that you don't have locally will be PERMANENTLY LOST.</p>",
    confirmText: "I Understand, Force Push",
    cancelText: "Cancel"
  });

  if (!confirmed) return;

  try {
    showGlobalLoading("Force pushing to GitHub...");
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_force_push" }),
    });
    hideGlobalLoading();

    if (data.success) {
      showToast(data.message, "success");
      await gitStatus(true);
    } else {
      showToast("Force push failed: " + data.message, "error");
    }
  } catch (e) {
    hideGlobalLoading();
    showToast("Error: " + e.message, "error");
  }
}

/**
 * Hard reset to remote (dangerous operation)
 */
export async function hardReset() {
  const confirmed = await showConfirmDialog({
    title: "Hard Reset to GitHub",
    message: "<p style='color: var(--error-color); font-weight: bold;'>⚠️ WARNING: DANGEROUS OPERATION</p><p>This will delete your local commits and changes to make your files exactly match GitHub. Your local work will be PERMANENTLY LOST.</p>",
    confirmText: "I Understand, Reset My Files",
    cancelText: "Cancel"
  });

  if (!confirmed) return;

  try {
    showGlobalLoading("Resetting local files to match GitHub...");
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_hard_reset", branch: gitState.currentBranch }),
    });
    hideGlobalLoading();

    if (data.success) {
      showToast(data.message, "success");
      if (callbacks.loadFiles) await callbacks.loadFiles(); // Refresh file tree
      await gitStatus(true);
    } else {
      showToast("Reset failed: " + data.message, "error");
    }
  } catch (e) {
    hideGlobalLoading();
    showToast("Error: " + e.message, "error");
  }
}

/**
 * Delete a remote branch on GitHub
 */
export async function deleteRemoteBranch(branchName) {
  const confirmed = await showConfirmDialog({
    title: "Delete GitHub Branch",
    message: `<p>Are you sure you want to delete the branch <b>${branchName}</b> from GitHub?</p><p>This cannot be undone.</p>`,
    confirmText: "Delete Branch",
    cancelText: "Cancel"
  });

  if (!confirmed) return;

  try {
    showGlobalLoading(`Deleting branch ${branchName}...`);
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_delete_remote_branch", branch: branchName }),
    });
    hideGlobalLoading();

    if (data.success) {
      showToast(data.message, "success");
      await gitStatus(true);
    }
  } catch (e) {
    hideGlobalLoading();
    let errorMsg = e.message || "Unknown error";

    if (errorMsg.includes("refusing to delete the current branch")) {
      const autoFix = await showConfirmDialog({
        title: "Switch Default Branch?",
        message: `
          <p>GitHub won't let us delete <b>${branchName}</b> because it is currently the <b>Default Branch</b>.</p>
          <br>
          <p>Would you like Blueprint Studio to automatically make <b>main</b> the default branch and then delete <b>${branchName}</b> for you?</p>
        `,
        confirmText: "Yes, Fix Automatically",
        cancelText: "No, I'll do it manually"
      });

      if (autoFix) {
        try {
          showGlobalLoading("Setting 'main' as default branch...");
          const patchData = await fetchWithAuth(API_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "github_set_default_branch", branch: "main" }),
          });

          if (patchData.success) {
            showGlobalLoading(`Deleting branch ${branchName}...`);
            const deleteData = await fetchWithAuth(API_BASE, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "git_delete_remote_branch", branch: branchName }),
            });

            hideGlobalLoading();
            if (deleteData.success) {
              showToast(`Success! 'main' is now default and '${branchName}' was deleted.`, "success");
              await gitStatus(true);
            } else {
              showToast("Branch was set as default, but deletion failed: " + deleteData.message, "error");
            }
          }
        } catch (patchErr) {
          hideGlobalLoading();
          showToast("Auto-fix failed: " + patchErr.message, "error");
        }
      }
    } else {
      showToast("Delete failed: " + errorMsg, "error");
    }
  }
}

/**
 * Get list of git remotes
 */
export async function gitGetRemotes() {
  try {
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_get_remotes" }),
    });

    if (data.success) {
      return data.remotes || {};
    }
  } catch (error) {
    console.error("Failed to get remotes:", error);
    return {};
  }
}

/**
 * Set git credentials (username and token)
 */
export async function gitSetCredentials(username, token, rememberMe = true) {
  try {
    showToast("Configuring git credentials...", "success");
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_set_credentials", username, token, remember_me: rememberMe }),
    });

    if (data.success) {
      showToast("Git credentials configured successfully", "success");
      return true;
    }
  } catch (error) {
    showToast("Failed to set credentials: " + error.message, "error");
    return false;
  }
}

/**
 * Stage files for commit
 * @param {Array} files - Array of file paths to stage
 */
export async function gitStage(files) {
  if (!files || files.length === 0) return;

  try {
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_stage", files }),
    });

    if (data.success) {
      showToast(data.message, "success");
      if (callbacks.gitStatus) await callbacks.gitStatus(); // Refresh status
    } else {
      // Error returned from backend
      const errorMsg = data.message || "";
      if (errorMsg.includes("index.lock") || errorMsg.includes("File exists")) {
        showToast("Git lock detected. Staging failed.", "error", 0, {
          text: "Clean & Retry",
          callback: async () => {
            await handleGitLockAndRetry(files);
          }
        });
      } else {
        showToast("Failed to stage files: " + errorMsg, "error");
      }
    }
  } catch (error) {
    // Exception thrown (500 error, network error, etc.)
    const errorMsg = error.message || "";
    if (errorMsg.includes("index.lock") || errorMsg.includes("File exists")) {
      showToast("Git lock detected. Staging failed.", "error", 0, {
        text: "Clean & Retry",
        callback: async () => {
          await handleGitLockAndRetry(files);
        }
      });
    } else {
      showToast("Failed to stage files: " + errorMsg, "error");
    }
  }
}

/**
 * Handle Git lock file cleanup and retry staging
 * @param {Array} files - Array of file paths to stage
 */
export async function handleGitLockAndRetry(files) {
  const cleaned = await gitCleanLocks();

  if (cleaned) {
    // Wait a moment for filesystem
    await new Promise(resolve => setTimeout(resolve, 500));

    // Retry the stage operation
    try {
      const retryData = await fetchWithAuth(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "git_stage", files }),
      });

      if (retryData.success) {
        showToast(retryData.message, "success");
        if (callbacks.gitStatus) await callbacks.gitStatus();
      } else {
        showToast("Failed to stage after cleaning locks. Try again or restart Home Assistant.", "error");
      }
    } catch (retryError) {
      showToast("Failed to stage after cleaning locks. Try again or restart Home Assistant.", "error");
    }
  } else {
    showToast("Could not clean lock files. Please restart Home Assistant.", "error");
  }
}

/**
 * Clean Git lock files
 * @returns {Promise<boolean>} True if successful
 */
export async function gitCleanLocks() {
  try {
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_clean_locks" }),
    });

    if (data.success) {
      showToast(data.message, "success");
      return true;
    } else {
      showToast("Failed to clean Git locks", "error");
      return false;
    }
  } catch (error) {
    showToast("Failed to clean Git locks: " + error.message, "error");
    return false;
  }
}

/**
 * Repair Git Index
 * @returns {Promise<boolean>} True if successful
 */
export async function gitRepairIndex() {
  try {
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_repair_index" }),
    });

    if (data.success) {
      showToast(data.message, "success");
      return true;
    } else {
      showToast("Failed to repair Git index", "error");
      return false;
    }
  } catch (error) {
    showToast("Failed to repair Git index: " + error.message, "error");
    return false;
  }
}

/**
 * Unstage files
 * @param {Array} files - Array of file paths to unstage
 */
export async function gitUnstage(files) {
  if (!files || files.length === 0) return;

  try {
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_unstage", files }),
    });

    if (data.success) {
      showToast(data.message, "success");
      if (callbacks.gitStatus) await callbacks.gitStatus(); // Refresh status
    }
  } catch (error) {
    showToast("Failed to unstage files: " + error.message, "error");
  }
}

/**
 * Reset/discard changes to files
 * @param {Array} files - Array of file paths to reset
 */
export async function gitReset(files) {
  if (!files || files.length === 0) return;

  const confirmed = await showConfirmDialog({
    title: "Discard Changes",
    message: `Are you sure you want to discard changes to ${files.length} file(s)?<br><br>This action cannot be undone.`,
    confirmText: "Discard",
    cancelText: "Cancel",
    isDanger: true
  });

  if (!confirmed) {
    return;
  }

  try {
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_reset", files }),
    });

    if (data.success) {
      showToast(data.message, "success");
      if (callbacks.gitStatus) await callbacks.gitStatus(); // Refresh status
    }
  } catch (error) {
    showToast("Failed to reset files: " + error.message, "error");
  }
}

/**
 * Commit staged changes
 * @param {string} commitMessage - Commit message
 * @returns {Promise<boolean>} True if successful
 */
export async function gitCommit(commitMessage) {
  try {
    showToast("Committing staged changes...", "success");
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_commit", commit_message: commitMessage }),
    });

    if (data.success) {
      showToast("Changes committed successfully", "success");
      if (callbacks.gitStatus) await callbacks.gitStatus(); // Refresh status
      return true;
    }
  } catch (error) {
    const errorMsg = error.message || "";
    if (errorMsg.includes("index.lock") || errorMsg.includes("File exists")) {
      showToast("Git lock detected. Commit failed.", "error", 0, {
        text: "Clean & Retry",
        callback: async () => {
          const cleaned = await gitCleanLocks();
          if (cleaned) {
              // We can't easily retry the commit because we lost the message context
              // But cleaning allows them to try again immediately
              showToast("Locks cleaned. Please try committing again.", "success");
          }
        }
      });
    } else if (errorMsg.includes("index file smaller than expected") || errorMsg.includes("bad index file")) {
      showToast("Git repository corrupted. Repair needed.", "error", 0, {
        text: "Repair Repo",
        callback: async () => {
          const repaired = await gitRepairIndex();
          if (repaired) {
              showToast("Repository repaired. Please try again.", "success");
              if (callbacks.gitStatus) await callbacks.gitStatus();
          }
        }
      });
    } else {
      showToast("Git commit failed: " + error.message, "error");
    }
    return false;
  }
}

/**
 * Pull changes from remote repository
 */
export async function gitPull() {
  const confirmed = await showConfirmDialog({
    title: "Pull from Remote",
    message: "Are you sure you want to pull changes from the remote repository? This will update your local files.",
    confirmText: "Pull",
    cancelText: "Cancel"
  });

  if (!confirmed) {
    return;
  }

  try {
    if (callbacks.setButtonLoading) callbacks.setButtonLoading(elements.btnGitPull, true);
    showToast("Pulling from remote...", "success");

    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_pull" }),
    });

    if (callbacks.setButtonLoading) callbacks.setButtonLoading(elements.btnGitPull, false);

    if (data.success) {
      showToast("Successfully pulled from remote", "success");

      // Wait a moment for file system to settle after git pull
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reload files to show changes (with retry on failure)
      try {
        if (callbacks.loadFiles) await callbacks.loadFiles();
      } catch (err) {
        // Retry after another delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          if (callbacks.loadFiles) await callbacks.loadFiles();
        } catch (retryErr) {
          showToast("Files updated but display refresh failed. Try refreshing manually.", "warning");
        }
      }

      if (callbacks.checkGitStatusIfEnabled) await callbacks.checkGitStatusIfEnabled();

      // Reload active tab content to reflect changes
      if (state.activeTab && callbacks.openFile) {
          await callbacks.openFile(state.activeTab.path, true);
      }
    }
  } catch (error) {
    if (callbacks.setButtonLoading) callbacks.setButtonLoading(elements.btnGitPull, false);
    const errorMsg = error.message || "";
    
    if (errorMsg.includes("rebase-merge") || errorMsg.includes("rebase-apply")) {
        showToast("Stale rebase detected. Would you like to abort it?", "error", 0, {
            text: "Abort & Retry",
            callback: async () => {
                showGlobalLoading("Aborting rebase...");
                try {
                    await fetchWithAuth(API_BASE, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "git_abort" }),
                    });
                    // Also clean locks just in case
                    await gitCleanLocks();
                    hideGlobalLoading();
                    // Retry the pull
                    await gitPull();
                } catch (e) {
                    hideGlobalLoading();
                    showToast("Failed to abort rebase: " + e.message, "error");
                }
            }
        });
    } else {
        showToast("Git pull failed: " + errorMsg, "error");
    }
  }
}

/**
 * Push changes to remote repository
 */
export async function gitPush() {
  try {
    // Proactive safety check: If there are staged changes, ask to commit them first
    if (gitState.files.staged.length > 0) {
      const shouldCommit = await showConfirmDialog({
        title: "Staged Changes Detected",
        message: `You have ${gitState.files.staged.length} prepared changes that haven't been saved (committed).<br><br>Would you like to commit and push these changes now?`,
        confirmText: "Commit & Push",
        cancelText: "Push Existing Only"
      });

      if (shouldCommit) {
        // Trigger the commit flow
        if (callbacks.commitStagedFiles) await callbacks.commitStagedFiles();
        // After commit (or if cancelled inside commit), the status will refresh.
        // If they successfully committed, gitStatus polling or the refresh will update staged count.
        // We should re-check or just continue to the push logic which will check for HEAD.
      }
    }

    if (callbacks.setButtonLoading) callbacks.setButtonLoading(elements.btnGitPush, true);
    showToast("Pushing to remote...", "info");

    // First try to push existing commits without committing
    const pushData = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "git_push_only"
      }),
    });

    if (pushData.success) {
      if (callbacks.setButtonLoading) callbacks.setButtonLoading(elements.btnGitPush, false);
      showToast(pushData.message || "Successfully pushed to remote", "success");
      if (callbacks.gitStatus) await callbacks.gitStatus();
      return;
    }

    // If push_only failed, show the error
    const errorMessage = pushData.message || pushData.error || "Unknown error";

    // If push_only failed, check if it's because of uncommitted changes
    if (errorMessage.includes("uncommitted changes")) {
      if (callbacks.setButtonLoading) callbacks.setButtonLoading(elements.btnGitPush, false);

      // Ask for commit message and use git_push (commit + push)
      const commitMessage = await showModal({
        title: "Commit & Push Changes",
        placeholder: "Commit message",
        value: "Update configuration via Blueprint Studio",
        hint: "You have uncommitted changes. Enter a message to commit and push:",
      });

      if (!commitMessage) {
        return;
      }

      if (callbacks.setButtonLoading) callbacks.setButtonLoading(elements.btnGitPush, true);
      showToast("Committing and pushing changes...", "info");

      const data = await fetchWithAuth(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "git_push",
          commit_message: commitMessage,
        }),
      });

      if (callbacks.setButtonLoading) callbacks.setButtonLoading(elements.btnGitPush, false);

      if (data.success) {
        showToast("Successfully pushed to remote", "success");
        if (callbacks.gitStatus) await callbacks.gitStatus();
      } else {
        const errMsg = data.message || data.error || "Unknown error";
        showToast("Push failed: " + errMsg, "error");
      }
    } else if (errorMessage.includes("No commits to push")) {
      if (callbacks.setButtonLoading) callbacks.setButtonLoading(elements.btnGitPush, false);
      showToast("No commits to push. Please stage and commit files first.", "warning", 0, {
        text: "Open Git Panel",
        callback: () => {
          const gitPanel = document.getElementById("git-panel");
          if (gitPanel) {
            gitPanel.classList.add("visible");
            const gitPanelHeader = gitPanel.querySelector(".git-panel-header"); // Assuming a header or first element to scroll to
            if (gitPanelHeader) {
              gitPanelHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }
      });
    } else {
      if (callbacks.setButtonLoading) callbacks.setButtonLoading(elements.btnGitPush, false);
      // Show the actual error message
      showToast("Push failed: " + errorMessage, "error");
    }
  } catch (error) {
    if (callbacks.setButtonLoading) callbacks.setButtonLoading(elements.btnGitPush, false);
    showToast("Git push failed: " + error.message, "error");
  }
}
