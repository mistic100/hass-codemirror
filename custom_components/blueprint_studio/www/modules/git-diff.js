/**
 * ============================================================================
 * GIT DIFF MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Visualizes git diffs and commit history. Shows file changes, commit details,
 * and allows browsing repository history with syntax-highlighted diffs.
 *
 * EXPORTED FUNCTIONS:
 * - registerGitDiffCallbacks(cb) - Register dependencies
 * - showDiffModal(filePath) - Show diff for file
 * - showGitHistory() - Show commit history
 * - showGitCommitDiff(commitHash) - Show specific commit diff
 *
 * HOW TO ADD FEATURES:
 * 1. Add diff view modes: side-by-side, inline, split
 * 2. Add syntax highlighting: Use highlight.js or Prism
 * 3. Add commit filtering: By author, date, message
 * 4. Add file history: Show changes over time for single file
 *
 * INTEGRATION: git-operations.js, ui.js, api.js
 * COMMON PATTERNS: await showDiffModal(path), showGitHistory()
 *
 * ============================================================================
 */
import { state, elements, gitState } from './state.js';
import { fetchWithAuth } from './api.js';
import { API_BASE } from './constants.js';
import {
  showGlobalLoading,
  hideGlobalLoading,
  showToast,
  showModal,
  resetModalToDefault
} from './ui.js';
import { getEditorMode, ensureDiffLibrariesLoaded } from './utils.js';

// Callbacks for cross-module functions
let callbacks = {
  loadFile: null,
  isGitEnabled: null
};

export function registerGitDiffCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Show diff modal for a file
 * Compares HEAD version with current version
 */
export async function showDiffModal(path) {
  try {
    await ensureDiffLibrariesLoaded();
    showGlobalLoading(`Calculating diff for ${path}...`);

    // 1. Get HEAD content (Old)
    const headData = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_show", path: path }),
    });

    let oldContent = "";
    if (headData.success) {
      oldContent = headData.content;
    }

    // 2. Get Current Content (New)
    let newContent = "";
    const tab = state.openTabs.find(t => t.path === path);
    if (tab) {
      newContent = tab.content;
    } else if (callbacks.loadFile) {
      const diskData = await callbacks.loadFile(path);
      newContent = diskData.content;
    }

    hideGlobalLoading();

    // 3. Setup Modal
    const modalOverlay = document.getElementById("modal-overlay");
    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");
    const modalFooter = document.querySelector(".modal-footer");

    resetModalToDefault();
    modal.style.maxWidth = "95vw";
    modal.style.width = "95vw";
    modal.style.height = "85vh";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";

    modalTitle.textContent = `Diff: ${path}`;
    modalFooter.style.display = "none";

    // Use flex column for body to let MergeView fill it
    modalBody.innerHTML = `<div id="diff-view" style="height: 100%; width: 100%;"></div>`;
    modalBody.style.padding = "0";
    modalBody.style.flex = "1";
    modalBody.style.display = "flex";
    modalBody.style.flexDirection = "column";
    modalBody.style.overflow = "hidden"; // Let CodeMirror handle scroll

    modalOverlay.classList.add("visible");

    // 4. Initialize CodeMirror Merge View
    const target = document.getElementById("diff-view");
    const mode = getEditorMode(path);

    // Old on Left (origLeft), New on Right (value/main)
    const mergeView = CodeMirror.MergeView(target, {
      value: newContent,
      origLeft: oldContent,
      lineNumbers: true,
      mode: mode,
      theme: state.theme === "light" ? "default" : "material-darker",
      highlightDifferences: true,
      connect: "align",
      collapseIdentical: false,
      readOnly: true,
      revertButtons: false
    });

    // Cleanup handler
    const closeHandler = () => {
      modalOverlay.classList.remove("visible");
      modalOverlay.removeEventListener("click", overlayClickHandler);
      // Clean up modal styles
      resetModalToDefault();
      modal.style.width = "";
      modal.style.height = "";
      modal.style.display = "";
      modal.style.flexDirection = "";
      modalBody.style.padding = "";
      modalBody.style.flex = "";
      modalBody.style.display = "";
      modalBody.style.overflow = "";
    };

    const overlayClickHandler = (e) => {
      if (e.target === modalOverlay) closeHandler();
    };
    modalOverlay.addEventListener("click", overlayClickHandler);
    document.getElementById("modal-close").onclick = closeHandler;

  } catch (error) {
    hideGlobalLoading();
    showToast("Diff failed: " + error.message, "error");
  }
}

/**
 * Show git commit history
 */
export async function showGitHistory() {
  if (!callbacks.isGitEnabled || !callbacks.isGitEnabled()) {
    showToast("Git integration is not enabled", "error");
    return;
  }

  if (!gitState.isInitialized) {
    showToast("Git integration is not initialized", "error");
    return;
  }

  try {
    showGlobalLoading("Fetching history...");
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_log", count: 30 }),
    });
    hideGlobalLoading();

    if (data.success) {
      if (data.commits.length === 0) {
        showToast("No commits found in this repository", "success");
        return;
      }

      const commitListHtml = data.commits.map(commit => {
        const date = new Date(commit.timestamp * 1000).toLocaleString();
        return `
          <div class="git-history-item" data-hash="${commit.hash}" style="padding: 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.15s;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 600; color: var(--accent-color); font-family: monospace;">${commit.hash.substring(0, 7)}</span>
              <span style="font-size: 11px; color: var(--text-muted);">${date}</span>
            </div>
            <div style="font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">${commit.message}</div>
            <div style="font-size: 12px; color: var(--text-secondary); opacity: 0.8;">by ${commit.author}</div>
          </div>
        `;
      }).join("");

      // Show commit history modal
      const historyPromise = showModal({
        title: "Commit History",
        message: `
          <div style="max-height: 60vh; overflow-y: auto; margin: -16px; background: var(--bg-primary);">
            ${commitListHtml}
          </div>
        `,
        confirmText: "Close",
        onConfirm: () => {}
      });

      // Make modal wider (responsive for mobile)
      const modal = document.getElementById("modal");
      if (modal) {
        modal.style.maxWidth = "min(900px, 95vw)";
        modal.style.width = "min(900px, 95vw)";
      }

      // Add click listeners to history items
      setTimeout(() => {
        const items = document.querySelectorAll(".git-history-item");
        items.forEach(item => {
          item.addEventListener("click", () => {
            const hash = item.getAttribute("data-hash");
            const commit = data.commits.find(c => c.hash === hash);
            showGitCommitDiff(commit);
          });
          item.addEventListener("mouseenter", () => item.style.background = "var(--bg-tertiary)");
          item.addEventListener("mouseleave", () => item.style.background = "transparent");
        });
      }, 100);

    } else {
      showToast("Failed to fetch history: " + data.message, "error");
    }
  } catch (e) {
    hideGlobalLoading();
    showToast("Error fetching history: " + e.message, "error");
  }
}

/**
 * Show diff for a specific commit
 */
export async function showGitCommitDiff(commit) {
  try {
    showGlobalLoading(`Loading diff for ${commit.hash.substring(0, 7)}...`);
    const data = await fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "git_diff_commit", hash: commit.hash }),
    });
    hideGlobalLoading();

    if (data.success) {
      // We'll reuse the modal but with a large diff view
      const date = new Date(commit.timestamp * 1000).toLocaleString();

      // Format diff with some basic coloring
      const lines = data.diff.split("\n");
      const coloredDiff = lines.map(line => {
        let color = "inherit";
        if (line.startsWith("+") && !line.startsWith("+++")) color = "var(--success-color)";
        else if (line.startsWith("-") && !line.startsWith("---")) color = "var(--error-color)";
        else if (line.startsWith("@@")) color = "var(--accent-color)";

        return `<div style="color: ${color}; white-space: pre-wrap; font-family: monospace; font-size: 12px; line-height: 1.4;">${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
      }).join("");

      // Show commit diff modal
      const diffPromise = showModal({
        title: `Commit: ${commit.hash.substring(0, 7)}`,
        message: `
          <div style="display: flex; flex-direction: column; height: 70vh;">
            <div style="padding-bottom: 12px; border-bottom: 1px solid var(--border-color); margin-bottom: 12px;">
              <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">${commit.message}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">
                <strong>Author:</strong> ${commit.author} | <strong>Date:</strong> ${date}
              </div>
            </div>
            <div style="flex: 1; overflow: auto; background: var(--bg-primary); padding: 12px; border-radius: 4px; border: 1px solid var(--border-color);">
              ${coloredDiff || '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No changes to display in this commit</div>'}
            </div>
          </div>
        `,
        confirmText: "Back to History"
      });

      // Make modal wider (responsive for mobile)
      const modal = document.getElementById("modal");
      if (modal) {
        modal.style.maxWidth = "min(900px, 95vw)";
        modal.style.width = "min(900px, 95vw)";
      }

      // Wait for user to close the modal
      const result = await diffPromise;

      // Only navigate back to history if user clicked "Back to History" button
      // (not if they clicked Cancel/Close which returns null)
      if (result !== null) {
        await showGitHistory();
      }

    } else {
      showToast("Failed to fetch diff: " + data.message, "error");
    }
  } catch (e) {
    hideGlobalLoading();
    showToast("Error fetching diff: " + e.message, "error");
  }
}
