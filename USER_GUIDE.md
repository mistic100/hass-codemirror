# 📘 Blueprint Studio - The Complete User Guide

Welcome to the definitive manual for **Blueprint Studio**. This guide goes beyond the basics to help you leverage every feature of this professional Home Assistant file editor.

---

## 📚 Table of Contents

1.  [Getting Started](#1-getting-started)
    *   [Installation (HACS & Manual)](#installation)
    *   [First Run & Onboarding](#first-run--onboarding)
2.  [Interface Tour](#2-interface-tour)
3.  [File Management Masterclass](#3-file-management-masterclass)
    *   [Smart Creation & Extensions](#smart-file-creation)
    *   [Bulk Operations](#bulk-operations)
    *   [Protected System Files](#protected-system-files)
4.  [Power Editing Features](#4-power-editing-features)
    *   [Multi-Cursor Editing](#multi-cursor-editing)
    *   [Advanced Search & Replace](#advanced-search--replace)
    *   [Block Scope & Navigation](#block-scope--navigation)
    *   [Jinja & YAML Intelligence](#jinja--yaml-intelligence)
5.  [Git Integration - Full Guide](#5-git-integration---full-guide)
    *   [Authentication (OAuth vs Token)](#authentication)
    *   [The Staging Lifecycle](#the-staging-workflow)
    *   [Visual Diff Viewer](#visual-diff-viewer)
    *   [Resolving Sync Issues](#resolving-sync-issues)
6.  [AI Studio Copilot](#6-ai-studio-copilot)
    *   [Providers & Privacy](#providers--privacy)
    *   [Generating Scenes & Scripts](#generating-scenes--scripts)
7.  [Keyboard Shortcuts Cheat Sheet](#7-keyboard-shortcuts-cheat-sheet)
8.  [Troubleshooting & FAQ](#8-troubleshooting--faq)

---

## 1. Getting Started

### Installation

#### Option A: HACS (Recommended)
The easiest way to install and stay updated.
1.  Open **HACS** > **Integrations**.
2.  Menu (`...`) > **Custom repositories**.
3.  URL: `https://github.com/soulripper13/blueprint-studio`, Category: **Integration**.
4.  Search for "Blueprint Studio" and click **Download**.
5.  **Restart Home Assistant** (Settings > System > Restart).
6.  Navigate to **Settings** > **Devices & Services** > **Add Integration** > **Blueprint Studio**.

#### Option B: Manual Installation
For users without HACS.
1.  Download the `latest release.zip` from the [GitHub Releases](https://github.com/soulripper13/blueprint-studio/releases) page.
2.  Unzip the file. You will see a `blueprint_studio` folder.
3.  Use your current file editor (Samba/SSH) to move the `blueprint_studio` folder into your Home Assistant's `/config/custom_components/` directory.
4.  Restart Home Assistant.
5.  Add the integration via the Settings page as described above.

### First Run & Onboarding
When you first open Blueprint Studio, you will see the **Onboarding Wizard**. This guide helps you:
1.  **Initialize:** Verifies read/write access to your configuration.
2.  **Git Setup (Optional):** Asks if you want to set up GitHub synchronization immediately.
3.  **Theme Selection:** Lets you pick your initial look (Dark/Light).

---

## 2. Interface Tour

The interface mimics modern IDEs like VS Code to make you feel at home.

### 🌳 The Sidebar (File Explorer)
*   **Header Buttons:**
    *   **New File/Folder:** Quick creation buttons.
    *   **Collapse All:** Instantly closes all open folders to declutter your view.
    *   **Refresh:** Reloads the file list from disk.
    *   **Show Hidden:** Toggles visibility of dotfiles (e.g., `.gitignore`, `.storage`).
*   **Resizable:** Drag the right edge of the sidebar to widen it for long filenames.
*   **Icons:**
    *   🟡 **Yellow YAML:** Configuration files.
    *   🐍 **Blue/Green:** Python scripts.
    *   📄 **White:** Text/Logs.
*   **Status Indicators:**
    *   **M (Orange):** Modified file (unsaved or Git changed).
    *   **U (Green):** Untracked file (new to Git).
*   **Filtering:** Use the "Search files..." box to filter the tree instantly by name. Toggle the "Content" icon to search *inside* files instead.

### 🛠️ The Toolbar
*   **Validation Checkmark:** Runs a full YAML syntax check on the current file. Red errors will appear in the editor if invalid.
*   **Restart Button:** A quick way to restart the Home Assistant Core process. **Tip:** Use this after editing `configuration.yaml` to apply your changes.
*   **Git Branch Icon:** Shows your current active Git branch (usually `main` or `master`).

### 📝 The Editor
*   **Tabs:** You can drag and drop tabs to reorder them. The active tab has a blue underline.
*   **Gutter:** Contains line numbers and "fold" arrows to collapse code blocks.
*   **Minimap:** (Optional in Settings) A zoomed-out overview of your code on the right side.

---

## 3. File Management Masterclass

### Smart File Creation
When you create a new file (Right-click > New File), Blueprint Studio helps you:
*   **Auto-Extension:** If you type `my_automation` and hit Enter, it automatically creates `my_automation.yaml`.
*   **Full Paths:** You can type `automations/living_room/lights.yaml` to create the folder structure and file in one go.

### Bulk Operations
Need to delete 10 log files or download a specific set of scripts?
1.  Click the **Checkboxes Icon** (top of sidebar) to enter **Selection Mode**.
2.  Checkboxes appear next to every file and folder.
3.  Select multiple items.
4.  A **Bulk Action Bar** appears at the bottom of the sidebar:
    *   **Download:** Zips selected items.
    *   **Delete:** Batch deletion (requires confirmation).
    *   **Stage:** (If Git enabled) Batch stage selected files.

### Favorites & Pinning
*   **Pinning:** Hover over any file and click the **Push Pin** icon.
*   **Behavior:** Pinned files stay at the very top of the sidebar, even if you close the folder they are in.
*   **Hiding:** The Favorites panel automatically hides itself if you have no pinned files.

### Protected System Files
To prevent breaking your installation, Blueprint Studio hides/protects:
*   `.storage/` (Hidden) - Contains internal registries.
*   `home-assistant_v2.db` (Hidden) - The main database.
*   `__pycache__` (Hidden) - Python compiled files.
*   You **cannot delete** `configuration.yaml` or `secrets.yaml` (but you can edit them).

---

## 4. Power Editing Features

### Multi-Cursor Editing
Edit multiple lines simultaneously—a massive time saver for YAML lists.
*   **Add Cursor:** Hold `Alt` (Windows) or `Option` (Mac) and click multiple places.
*   **Select Next Match:** Highlight a word (e.g., `entity_id`) and press `Ctrl+D` (Cmd+D). It selects the next occurrence. Press again for the next. Now typing replaces ALL of them at once.

### Advanced Search & Replace
Press `Ctrl+F` (Find) or `Ctrl+H` (Replace).
*   **Regex:** Click the `.*` icon to enable Regular Expressions.
*   **Case Sensitive:** Click `Aa` to match exact casing.
*   **Entity Explorer:** In Global Search (`Ctrl+Shift+F`), click the "Entities" toggle to search your *running* HA entity registry, not just files. Click an entity to copy its ID.

### Block Scope & Navigation
*   **Scope Lines:** Click on a keyword like `trigger:` or `action:`. A distinct vertical line will appear on the left, tracing exactly where that block starts and ends.
*   **Folding:** Click the arrows in the gutter to collapse large blocks you aren't working on.

### Jinja & YAML Intelligence
*   **Jinja Highlighting:** In `.jinja` files, logic tags `{% ... %}` are colored differently (Orange) than output tags `{{ ... }}` (Yellow) for clarity.
*   **Bracket Matching:** Placing your cursor next to a `{` or `(` highlights its closing partner.

---

## 5. Git Integration - Full Guide

### Authentication
*   **OAuth Device Flow (Easiest):** Generates a code (`ABCD-1234`). You visit `github.com/login/device`, enter it, and you're done. Tokens auto-renew.
*   **Personal Access Token (Advanced):** If you prefer manual control, generate a "Classic" token with `repo` scope on GitHub and paste it in.

### The Staging Workflow
Git in Blueprint Studio follows standard Git practices:
1.  **Working Directory:** You edit files. They appear as "Unstaged Changes".
2.  **Stage:** Click the `+` on specific files to move them to "Staged Changes". This lets you group related edits (e.g., "Only commit the lighting changes, not the sensor changes yet").
3.  **Commit:** Writes the staged changes to your local history.
4.  **Push:** Uploads local commits to GitHub.

### Visual Diff Viewer
**Never commit blind.**
1.  In the Git Panel, hover over a modified file.
2.  Click the **Difference Icon** (looks like a document with a `+/-`).
3.  A modal opens showing your current file on the right and the original version on the left.
    *   **Green:** Added lines.
    *   **Red:** Deleted lines.

### Managing Large Changes
If you have many changed files, the Git Panel organizes them:
*   **Grouping:** Files are grouped by status (Staged, Modified, Untracked).
*   **Collapse:** Click the header of any group to collapse it and save space.
*   **Stage All:** Use the "Stage All" button in the panel footer to stage everything at once.

### Resolving Sync Issues
If your push fails because "Remote contains work you do not have" (Diverged History):
1.  Open **Git Settings** > **Advanced**.
2.  **Pull (Rebase):** Tries to download remote changes and replay yours on top.
3.  **Force Push:** (Dangerous) Overwrites GitHub with your local version.
4.  **Hard Reset:** (Dangerous) Destroys local changes and matches GitHub exactly.

---

## 6. AI Studio Copilot

### Providers & Privacy
*   **Local Logic (Default):** Runs entirely on your machine. Parses specific phrases like "Turn on light at 5pm" using regex logic. Zero data leaves your server.
*   **Gemini/OpenAI:** Sends prompts to cloud APIs. Required for complex requests ("Write a script that flashes lights if the garage opens").

### Generating Scenes & Scripts
The AI is tuned for Home Assistant structure.
*   **Prompt:** "Create a 'Movie Night' scene for the living room."
*   **Result:** Generates valid YAML with dimmed lights, warm colors, and media player states, using your *actual* entity IDs (e.g., `light.living_room_main`).

---

## 7. Keyboard Shortcuts Cheat Sheet

| Action | Windows / Linux | Mac |
| :--- | :--- | :--- |
| **Command Palette** | `Ctrl + K` | `Cmd + K` |
| **Quick File Switcher** | `Ctrl + E` | `Cmd + E` |
| **Global Search** | `Ctrl + Shift + F` | `Cmd + Shift + F` |
| **Save File** | `Ctrl + S` | `Cmd + S` |
| **Multi-Select Word** | `Ctrl + D` | `Cmd + D` |
| **Toggle Comment** | `Ctrl + /` | `Cmd + /` |
| **Go to Line** | `Ctrl + G` | `Cmd + G` |
| **Find** | `Ctrl + F` | `Cmd + F` |
| **Replace** | `Ctrl + H` | `Cmd + Option + F` |
| **Insert UUID** | `Ctrl + Shift + U` | `Cmd + Shift + U` |
| **Close Tab** | `Alt + W` | `Option + W` |
| **Next Tab** | `Ctrl + Shift + ]` | `Cmd + Shift + ]` |

---

## 8. Troubleshooting & FAQ

**Q: I clicked "Check Now" on GitHub login and it failed?**
**A:** We fixed this in v2.0.3! The button now coordinates with background polling. If it still fails, just wait 10 seconds for the auto-poll to pick it up.

**Q: Why can't I see my `.gitignore` file?**
**A:** Enable "Show Hidden Files" in the Settings menu (Gear icon).

**Q: Git Push says "Uncommitted changes"?**
**A:** You can now push *just* your committed changes even if you have other modified files (Fixed in v2.0.2). However, standard "Push" usually tries to push everything. Use the specific **Push Only** action if you want to leave dirty files behind.

**Q: The editor feels slow?**
**A:** If you have massive log files (`home-assistant.log` > 10MB), avoid opening them in the editor. Download them instead.

**Q: How do I reset Blueprint Studio settings?**
**A:** Clear your browser's "Local Storage" for the Home Assistant page, or reinstall the integration.