# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.2] - 2026-02-20

### ✨ Feature & Fix Update

#### 🆕 New Features
*   **Collapse All Folders**: Added a "Collapse All" button (`unfold_less` icon) to the toolbar. Clears all expanded folder states and re-renders the file tree for a clean view.
*   **One Tab Mode**: Added an optional mode to keep only the last opened file active.
    *   Automatically saves and closes the previous tab when opening a new one.
    *   Toggle via the new toolbar button (`tab` icon) or **Settings → Editor → Behavior**.
    *   State is persisted across sessions.
*   **Toolbar Enhancements**: "Show Hidden Files" and "Select Files" buttons have been moved from the sidebar header to the main toolbar for better accessibility.
*   **Scrollbar Visibility**: Significantly increased the visibility of scrollbars in modals, shortcuts, and settings by darkening the default thumb color.
*   **CSV Support**: Added full support for creating, editing, and viewing `.csv` files with syntax highlighting and spreadsheet-inspired icons.

#### 🌍 Internationalisation
*   **Global Language Support**: Added translation files for 31 new languages, including Chinese (Simplified), Spanish, Hindi, Arabic, French, Portuguese, Russian, German, Japanese, and many European languages.

#### 🐛 Bug Fixes
*   **Favorites Panel**: Fixed an issue where the Favorites panel header was destroyed during rendering.
*   **Folder Pinning**: Validates both files and folders now, preventing favorited folders from disappearing from the list.

#### 🧹 UI Cleanup
*   **Explorer Header**: Removed the redundant "EXPLORER" sidebar header to maximize vertical space.
*   **Accent Color**: Removed the redundant dropdown selector in Appearance settings, keeping the cleaner color circle buttons.

## [2.2.1] - 2026-02-20

### ✨ Editor & UI Enhancement Suite

#### 🆕 New Features
*   **Collapsible File Tree**: A traditional tree view for navigating files with single-click expand/collapse. Can be toggled via Settings → File Tree. When active, breadcrumbs and back buttons are automatically hidden for a cleaner workspace.
*   **Improved Search (Ctrl+F)**: The cursor now correctly jumps to the search bar when opening search in the code editor. Three new search filters have been added:
    *   **Match Case (Aa)**: Case-sensitive lookups
    *   **Whole Word (ab|)**: Excludes partial matches
    *   **Regex (.*)**: Full regular expression support with real-time syntax validation
*   **Syntax Themes**: Five predefined themes available: Dracula, Nord, Monokai, Solarized, and One Dark.
*   **New UI Preset**: Midnight Blue added to appearance settings.
*   **New Font Options**: Additional font choices available in editor settings.

#### ⚡ Improvements
*   **Large File Protection**: A confirmation dialog is now shown before downloading potentially large files (.db, .sqlite, .zip) to prevent accidental transfers.

---
A big thank you to @cataseven for putting together this extensive UI enhancement PR — 13 files changed, all manually tested. The effort and attention to detail are greatly appreciated!

## [2.2.0] - 2026-02-12

### ✨ New Features

#### 📁 Folder Navigation (File Explorer Redesign)
*   **Browse-Style Navigation**: Completely redesigned file explorer from a tree expansion model to folder navigation (like Windows Explorer or mobile file browsers):
    *   **Double-Click to Enter**: Double-click any folder to navigate into it - shows only that folder's contents
    *   **Back Button**: Navigate up one level with the back button (disabled at root)
    *   **Breadcrumb Trail**: Full path shown as clickable breadcrumbs - jump to any level instantly
    *   **Flat View**: Clean, simple list of folders and files without nested indentation
    *   **No Chevrons**: Removed expand/collapse arrows - navigation is by entering folders, not expanding them
    *   **Removed Expand All Button**: No longer needed with folder navigation model
*   **Lazy Loading**: Directory contents loaded on-demand as you navigate - faster initial load, no massive tree rendering
*   **Performance**: Only loads the current folder - instant navigation, less memory usage
*   **Mobile-Friendly**: Large touch targets, familiar mobile UX, no tiny chevron icons

#### 🔍 Enhanced File Tree Search
*   **Recursive Search**: File search now finds files across ALL folders, not just the current folder:
    *   **Filename Search** (default): Searches all filenames recursively across the entire filesystem
    *   **Content Search** (toggle): Searches file contents across all files
    *   **Flat Results**: Matching files displayed as a flat list regardless of which folder they're in - click any result to open
    *   **Auto-Recursive**: Both search modes use backend API to search all files, not just visible ones

#### 🌐 SFTP Integration
*   **Remote File Access**: Connect to HAOS host or any SSH/SFTP server to edit files outside `/config`:
    *   **Dual Authentication**: Password and SSH key (RSA, Ed25519, ECDSA, DSS) support with optional passphrase
    *   **Named Connections**: Save multiple SFTP profiles (e.g., "HAOS Host", "NAS", "Remote Server")
    *   **Host Access**: Browse and edit `/addons`, `/ssl`, and any path on the HAOS host filesystem
    *   **Browse & Navigate**: Directory tree with breadcrumb navigation, back button, and folder drill-down
    *   **Full File I/O**: Open, edit, save, create, delete, and rename remote files
    *   **Virtual Paths**: Remote files open in regular tabs with `sftp://` prefix for seamless integration
    *   **Connection Test**: "Test & Save" validates connectivity before saving credentials
    *   **Context Menus**: Right-click files/folders for Rename and Delete operations
    *   **Sidebar Panel**: Dedicated SFTP section in Explorer below git panels
    *   **Session Persistence**: Connections saved in HA settings with secure credential storage
*   **Security Features**:
    *   Auto-accepts host keys on first connect (logs warning about AutoAddPolicy)
    *   Credentials stored in HA settings store (same security level as git tokens/AI keys)
    *   No credentials logged
    *   Text file filtering (binary files shown but disabled)
*   **Use Cases**: Access HAOS add-on configs, edit system files, manage backups, sync configurations

*   **Performance Control Panel**: New "Advanced" tab in Settings with fine-grained performance controls:
    *   **Polling Interval**: Adjustable git status polling (10-60 seconds) - default reduced from 5s to 10s for 50% fewer network requests
    *   **Remote Fetch Interval**: Configurable remote fetch timing (15-300 seconds) - default 30s
    *   **File Cache Size**: Adjustable in-memory file cache (5-20 files)
    *   **Virtual Scrolling**: Toggle for large file trees
*   **Real-time Sliders**: All performance settings update live with visual feedback
*   **Smart Defaults**: Balanced configuration optimized for most Home Assistant installations

#### 🔍 Global Search & Replace
*   **Project-Wide Search**: New sidebar-based global search across all files:
    *   **Keyboard Shortcut**: `Cmd/Ctrl + Shift + F` to open search sidebar
    *   **Search Options**: Case-sensitive matching, whole word matching, and regular expression support
    *   **File Filtering**: Include/exclude file patterns (e.g., `*.yaml`, `!secrets.yaml`)
    *   **Smart Results**: Results grouped by file with collapsible sections
    *   **Context Preview**: Shows line numbers and code context for each match
    *   **Quick Navigation**: Click any result to jump directly to that line in the file
    *   **Match Highlighting**: Temporarily highlights matched line when opening file
*   **Global Replace**: Batch replace across multiple files with safety features:
    *   **Preview**: See affected files and match counts before replacing
    *   **Confirmation Dialog**: Shows total occurrences and file count before proceeding
    *   **Regex Support**: Use regex capture groups ($1, $2) in replacements
    *   **Auto-Refresh**: Results update automatically after replace
*   **Home Assistant Integration**: Built-in entity search in results:
    *   Search matches Home Assistant entity IDs and friendly names
    *   Click to copy entity ID to clipboard
    *   Displays alongside file search results
*   **Visual Features**:
    *   Match count badges on each file
    *   Collapsible file groups with toggle arrows
    *   Loading spinner during search
    *   Empty state guidance

#### ✏️ Tab Size (Indentation) Control
*   **Customizable Indentation**: New tab size setting in Editor configuration:
    *   **Size Options**: Choose between 2, 4, or 8 spaces per indentation level
    *   **Indent With Tabs**: Toggle to use hard tabs instead of spaces
    *   **Smart Auto-Detection**: Automatically detects indentation from existing file content
    *   **User Preference Fallback**: Uses your configured tab size for new/empty files when auto-detection isn't possible
    *   **Live Updates**: Changes apply immediately to both editors (primary and secondary panes)
*   **Intelligent Behavior**: Balances smart auto-detection with user control - respects file conventions while maintaining your preferences
*   **Quick Status Bar Picker**: Click "Spaces: X" in status bar to instantly change tab size without opening Settings
    *   Visual dropdown menu with 2, 4, 8 space options
    *   Toggle "Indent with Tabs" on/off
    *   Checkmarks show current selection
    *   Changes apply immediately and save automatically
*   **Settings Location**: Editor → Tab Size & Indentation

#### 📱 Split View (Experimental) 🧪
*   **VS Code-Style Split Editor**: Edit multiple files side-by-side in a dual-pane layout:
    *   **Vertical Split**: Side-by-side layout for comparing and editing files simultaneously
    *   **Independent Editors**: Full CodeMirror features in both panes (syntax highlighting, search, replace, folding)
    *   **Pane Badges**: Each tab shows its pane location (L/R) for clear visual identification
    *   **Drag-and-Drop**: Move tabs between panes by dragging or via context menu
    *   **Smart Auto-Balance**: Automatically distribute tabs when moving to prevent empty panes
    *   **Same File Support**: Open the same file in both panes for comparing different sections
    *   **Resizable Panes**: Drag resize handle to adjust pane sizes (20-80% range)
    *   **Workspace Persistence**: Split view state, pane sizes, and tab distribution saved across sessions
*   **Experimental Feature Toggle**: Enable/disable split view from Settings → Advanced → Experimental Features
*   **Asset Preview Support**: Image, PDF, and markdown previews work in both panes
*   **Keyboard Shortcuts**:
    *   `Cmd/Ctrl + \` - Toggle split view on/off
    *   `Cmd/Ctrl + 1` - Focus primary pane (left)
    *   `Cmd/Ctrl + 2` - Focus secondary pane (right)
*   **Smart Button Management**: Split view buttons only appear when feature is enabled and 2+ tabs are open

#### 🧠 AI Architecture Overhaul
*   **Unified AI System**: Complete restructuring of AI integration with three distinct modes:
    *   **Rule-based**: Built-in pattern matching for automation generation (no API required)
    *   **Local AI**: Self-hosted LLM support via Ollama, LM Studio, or custom endpoints
    *   **Cloud AI**: Gemini, OpenAI, and Claude with persistent API keys per provider
*   **Persistent API Keys**: API keys now saved separately for each cloud provider - switch between Gemini, OpenAI, and Claude without re-entering credentials
*   **Smart Migration**: Automatic migration from old AI structure to new architecture
*   **Provider Isolation**: Each AI provider maintains independent configuration and state

### ⚡ Performance Improvements

#### 🚀 Parallel Initialization
*   **Concurrent Loading**: Multiple initialization tasks now run in parallel using Promise.all():
    *   Version fetch, WebSocket initialization, entity loading, and file listing run simultaneously
    *   ~30-40% faster initial load time
*   **Optimized Startup**: Reduced sequential bottlenecks during application bootstrap
*   **Smarter Polling**: Git status and tab restoration now execute concurrently

#### 📊 Reduced Server Load
*   **50% Fewer Requests**: Default polling interval increased from 5s to 10s
*   **Configurable Intervals**: Users can tune polling frequency for their environment
*   **Smart Fetch Timing**: Remote repository checks happen every 3rd poll (30s) by default
*   **Resource-Aware**: All settings persist across sessions

### 🏗️ Architecture & Code Quality

#### 📦 Modular Refactoring 
*   **84% Size Reduction**: app.js reduced from 12,461 lines to 2,032 lines
*   **46 Focused Modules**: Extracted functionality into maintainable, single-responsibility modules:
    *   `settings.js` (316 lines) - Settings management
    *   `settings-ui.js` (1,484 lines) - Settings modal UI
    *   `polling.js` (111 lines) - Optimized polling system
    *   `initialization.js` (671 lines) - Parallel initialization
    *   `split-view.js` (450+ lines) - Split view functionality
    *   `tabs.js` - Dual-pane tab rendering
    *   Plus 30 other specialized modules
*   **Callback Pattern**: Consistent cross-module communication preventing circular dependencies
*   **Better Testability**: Each module independently testable

#### 🔧 Settings System Enhancement
*   **Server-Side Sync**: Settings now stored on server with local fallback
*   **Automatic Migration**: Seamless transition from localStorage to server storage
*   **Type Safety**: Integer parsing for numeric settings preventing edge cases
*   **Performance Settings**: New category for polling, caching, and rendering options
*   **Settings UI Reorganization**: Complete 5-tab restructure for better user experience (General, Appearance, Editor, Integrations, Advanced)
*   **New Workspace Controls**: Added Remember Workspace and Show Hidden Files toggles

### 🛡️ Fixes & Stability
*   **Critical: File Size Protection**: Added 500MB hard limit to prevent out-of-memory crashes when opening large files
    *   Applies to ALL file types (text, binary, images, databases, etc.)
    *   Prevents server crashes when clicking on large database files like `home-assistant_v2.db`
    *   Shows user-friendly error message instead of attempting to load oversized files
    *   Configurable via `MAX_FILE_SIZE` constant (default: 500MB)
    *   Enhanced 2MB warning for text files using centralized `TEXT_FILE_WARNING_SIZE` constant
    *   8-second error toast with clear size limits and reasoning
*   **File Cache Corruption Fix (DEFINITIVE SOLUTION)**: Comprehensive 4-layer protection against HTTP 500 backend crashes:
    *   **🔒 LAYER 0 - Thread Safety (DEFINITIVE FIX)**: Added `threading.Lock` to prevent concurrent access corruption
        *   Root cause identified: Multiple concurrent requests via `async_add_executor_job` caused race conditions in Python 3.13
        *   All cache operations (read, write, clear) now protected by mutex lock
        *   Prevents cache from becoming `None` during concurrent access
        *   API methods (`git_pull`, `git_init`, `git_hard_reset`) now use thread-safe `clear_cache()` instead of direct `_file_cache = {}` assignment
        *   **This is the DEFINITIVE FIX** - eliminates the root cause rather than just handling symptoms
    *   **Layer 1 - Ultra-Defensive Initialization**: Detects and auto-recovers from cache becoming `None` due to race conditions or Python 3.13 GC issues
    *   **Layer 2 - os.walk() Validation**: Handles corrupted filesystem walker results (when `dirs` or `files` unexpectedly become `None`)
    *   **Layer 3 - Global Exception Handling**: Catches all filesystem errors (permissions, I/O errors, corruption) and returns cached/empty data instead of crashing
    *   **Production-Grade Diagnostics**: Detailed error logging showing exact failure type and location for troubleshooting
    *   **Graceful Degradation**: System continues operating with stale cache or empty results rather than requiring HA restart
    *   **Root Cause Analysis**: Fixed "argument of type 'NoneType' is not iterable" and "'NoneType' object does not support item assignment" errors identified from production logs
    *   **Python 3.13 Compatibility**: Addresses stricter event loop and GC behavior in Home Assistant Core 2026.2 (Python 3.13)
    *   **Impact**: Backend never crashes from file cache corruption - thread-safe operations prevent race conditions, automatic recovery handles edge cases
*   **Cache State Validation**: Implemented automatic cache reinitialization when corruption is detected, with logging to track occurrences
*   **Settings Persistence**: All new performance settings properly saved and loaded
*   **Migration Safety**: Automatic backup and restoration of AI settings during structure change
*   **Type Coercion**: Fixed parseInt issues for numeric settings preventing NaN errors
*   **Font Family Loading**: Added Google Fonts CDN import to ensure all editor font options (Fira Code, JetBrains Mono, Source Code Pro, Roboto Mono, Ubuntu Mono) are available on all systems without requiring manual font installation

### 🎨 UI/UX Improvements
*   **Settings Menu Reorganization**: Complete restructure of settings for better usability and logical grouping:
    *   **New Tab Structure**: "Features" renamed to "Integrations" for clarity
    *   **General Tab**: Now focused on workspace behavior (Remember Workspace, Recent Files, Show Hidden, UI Feedback)
    *   **Appearance Tab**: Streamlined to focus on visual customization (Theme, File Tree) - removed clutter
    *   **Editor Tab**: Added Syntax Highlighting section (moved from Appearance) for better organization
    *   **Integrations Tab**: Dedicated tab for external services (Version Control + AI Copilot) - all Git settings moved here
    *   **Advanced Tab**: Now includes Experimental Features and Danger Zone (moved from Features)
    *   **New Settings**: Added Remember Workspace toggle and Show Hidden Files toggle to General
    *   **Logical Grouping**: Each tab has a clear, focused purpose - easier to find settings
    *   **Same Visual Style**: Maintained consistent design language throughout
*   **Advanced Settings Tab**: Clean, organized interface for power users
*   **Range Sliders**: Visual feedback with real-time value updates
*   **Toast Notifications**: Immediate feedback for all settings changes
*   **Help Text**: Descriptive tooltips explaining each performance setting
*   **Welcome Screen Fix**: Now properly displays on startup when no tabs are open, and after closing all tabs

### 🔄 Migration Notes
*   **Automatic**: All migrations happen transparently on first load of v2.2.0
*   **AI Settings**: Old `aiProvider` automatically migrated to new `aiType` + `cloudProvider` structure
*   **API Keys**: Preserved and properly assigned to respective providers
*   **Performance**: New settings applied with safe defaults
*   **Zero Downtime**: No user action required



---

## [2.1.5] - 2026-02-09

### 🛡️ Fixes
*   **Home Assistant Compatibility**: Resolved `ImportError` for `StaticPathConfig` on Home Assistant versions older than 2024.7 (e.g., 2024.4.1).
*   **Dynamic Resource Registration**: Implemented a robust fallback system that detects and uses the appropriate static path registration method (`async_register_static_paths` or `register_static_path`) at runtime.
*   **Version Shim**: Added a `StaticPathConfig` compatibility shim to ensure stable performance across Home Assistant versions 2024.1 through 2026+.
*   **Asset Preview**: Removed the 2MB size restriction/warning for images and PDFs, allowing them to open instantly as binary assets.


## [2.1.4] - 2026-02-08

### ✨ New Features
*   **Smart Duplicate**: Added "Duplicate" action to file explorer context menu.
*   **Tab Management**: Added context menu for tabs with "Close Others" and "Close Saved".
*   **Folding Shortcuts**: Added `Ctrl+Alt+[` and `Ctrl+Alt+]` to Fold/Unfold All.
*   **VS Code-like Status Bar**: Real-time Ln/Col tracking, indentation info, and file encoding display.

### 🛡️ Fixes
*   **Large File Safety**: Added protection against opening files larger than 2MB to prevent browser crashes.

## [2.1.3] - 2026-02-06

### ✨ AI Models Update
*   **AI Model Refresh**: Updated Copilot to support latest 2026 models: **Gemini 3 Pro/Flash**, **GPT-5**, **GPT-5.2**, and more.

## [2.1.2] - 2026-02-06

### ✨ New Features
*   **Image Navigation**: Added Previous/Next buttons and keyboard shortcuts (Arrow Keys) to browse all images in a folder without closing the viewer.
*   **Integrated PDF Viewer**: View PDF files directly within the integration using a new high-performance PDF.js rendering engine.
*   **Markdown Preview**: Added a live preview toggle for `.md` files, rendering them as styled HTML.
*   **Bulk Operations**: Added support for multi-selecting files to **Delete**, **Download (as ZIP)**, and **Move** them in batches. Also supports **Batch Upload** via multi-select dialog or drag-and-drop.
*   **Quick Delete**: Streamlined the deletion process by replacing the filename typing requirement with a standard confirmation dialog.

### ⚡ Improvements
*   **Secure Binary Serving**: Added a dedicated `serve_file` API endpoint for efficient and secure binary file transfers.
*   **Auth Reliability**: Improved token handling for direct file downloads to prevent authentication timeouts.

### 🐛 Bug Fixes
*   **Git Notification Spam**: Eliminated repetitive "changes detected" toast notifications during background polling.
*   **Thread Safety**: Fixed `hass.async_create_task` being called from non-thread-safe contexts in `websocket.py`.
*   **Blocking I/O**: Moved synchronous file reads in `api.py` to executor jobs to prevent event loop blocking.
*   **Lifecycle Management**: Implemented proper background task cleanup during integration unloading.

## [2.1.1] - 2026-02-05

### ✨ New Features
*   **Context Menu Creation**: You can now **right-click** any folder or file in the explorer to quickly add a **New File** or **New Folder** in that directory.
*   **Productivity Shortcuts**: Added VS Code-style line operations:
    *   `Alt + Up/Down`: Move selected lines up/down.
    *   `Shift + Alt + Up/Down`: Duplicate selected lines.
    *   Includes Mac support using `Option` and `Cmd + Shift + Up/Down` overrides.
*   **Nested Folder Creation**: Create deep directory structures instantly (e.g., `folder/sub/deep`) without creating each level manually.
*   **Context Menu Actions**: Added **New File** and **New Folder** options to the file explorer right-click menu.
*   **Smart Path Pre-filling**: "New File/Folder" dialogs now pre-fill with the currently selected folder path, allowing for quick modifications.

## [2.1.0] - 2026-02-05

### ✨ New Features
*   **WebSocket Engine**: Real-time reactive updates for files and Git status. Blueprint Studio now pushes updates from the server, eliminating aggressive HTTP polling and drastically reducing network/CPU overhead.
*   **Instant Explorer (Backend Caching)**: Implemented server-side file tree caching. The file explorer now loads and filters instantly even in massive configurations, with intelligent cache invalidation and a manual "Hard Refresh" option.
*   **Modular Architecture**: Transitioned the massive monolithic JavaScript core into a modern ES Module system for better maintainability and performance.
*   **Gitea Integration**: Added full support for self-hosted Gitea instances with a dedicated workflow and dual-remote support.
*   **Real-time External Sync**: Automatically detects and reloads files modified outside of the editor while preserving cursor position.
*   **Claude AI Support**: Full integration for Anthropic Claude 4.5 suite (Sonnet, Haiku, and Opus).
*   **Help & Support Hub**: A professional, centralized modal for shortcuts, bug reports, and feature requests.
*   **One-Click Socials**: Star the repo and follow the author directly from the Support modal.
*   **1ocal Hosting**: Material Icons and fonts are now hosted locally, enabling true offline support and faster loading.
*   **Configurable Notifications**: Added a toggle to enable or disable toast notifications.
*   **Resource-Smart Polling**: Background checks now pause when the browser tab is not focused.

### 🐛 Bug Fixes
*   **Command Palette Restoration**: Fixed scope and shortcut issues ensuring palette works reliably across the entire UI.
*   **Setup Timeout Fix**: Resolved an issue where background tasks could block Home Assistant bootstrap.
*   **UI Ghosting**: Optimized loading sequence to prevent visual flickering.

### 🎨 Visual Refinements
*   **Editor Gutter Contrast**: Enhanced visual separation between the gutter and code area.
*   **Toast Repositioning**: Moved notifications to the bottom right to avoid obstructing the view.

## [2.0.6] - 2026-02-05

### 🐛 Bug Fixes
*   Folders in custom_components couldn't be deleted.

## [2.0.5] - 2026-02-02

### ✨ New Features
*   **Persistent Workspace**: The editor now remembers your exact workspace layout across restarts, including the specific order of your open tabs, which tab was actively being edited, and the exact cursor/scroll positions for every file. This can be toggled in **Settings > General**.

### 🐛 Bug Fixes
*   **Keyboard Shortcuts**: Removed the `?` global shortcut for the help overlay, as it was interfering with typing question marks in some contexts.

## [2.0.4] - 2026-02-01

### 🐛 Bug Fixes
*   **Multi-Cursor Selection**: Fixed a bug where **Cmd+D** (select next occurrence) failed to work when text was selected from right to left (backward selection).
*   **Git Panel Persistence**: The Git changes panel now remembers its collapsed/expanded state across restarts and page reloads.
*   **Git Panel Collapse**: Fixed an issue where clicking the collapse button would hide the entire Git changes panel, preventing users from re-expanding it. The panel now correctly collapses to show only its header, with a toggleable icon.

## [2.0.3] - 2026-01-31

### ✨ Improvements
*   **Robust OAuth Polling**: Re-engineered the GitHub Device Flow authentication to dynamically adjust polling speed in response to server rate limits ("slow_down" signals), preventing API timeouts and ensuring a reliable login experience.
*   **Smart "Check Now"**: The manual auth check button now coordinates with the background polling loop to prevent race conditions and accidental rate limiting.
*   **Multi-Cursor Editing**: Added **Ctrl+D** (Cmd+D) support to select the next occurrence of the current selection, enabling simultaneous editing of multiple lines for faster refactoring.

## [2.0.2] - 2026-01-31

### ✨ Improvements
*   **Refined Block Indicator**: The vertical indentation guide has been significantly improved. It is now **thinner (1px)** and matches your editor's line number color for a subtle, professional look. Additionally, the line now starts **below the block header**, ensuring it doesn't overlap with the first character or dash.
*   **Modal Keyboard Shortcuts**: Added support for **Enter** to confirm and **Escape** to cancel in all standard input modals for a smoother, keyboard-driven experience.
*   **Smart File Extensions**: New files created without an extension are now automatically saved as `.yaml` files, streamlining the creation of Home Assistant configuration files.

### 🐛 Bug Fixes
*   **Selective Commits**: Resolved a critical issue where unselected files were being included in commits. The "Commit" action now strictly respects your staged files.
*   **Push Behavior**: "Push" continues to function as a convenient "Commit All & Push" for quick syncing, while "Push Only" is now more flexible, allowing you to push existing commits even with a dirty working directory.
*   **Favorites Alignment**: Fixed visual misalignment of labels in the Favorites panel and ensured the empty state is correctly hidden.
*   **Compact Tree Indentation**: Corrected CSS priority issue that caused nested folders to lose their indentation hierarchy when using Compact Mode.

## [2.0.1] - 2026-01-31

### ✨ New Features
*   **Block Scope Highlighting**: Added a visual vertical line indicator that appears when clicking on Home Assistant keywords (e.g., `automation:`, `trigger:`, `action:`) to clearly show the boundaries of code blocks.


### 🐛 Bug Fixes
*   **Intelligent Scope Detection**: Enhanced the block detection logic to correctly handle complex YAML list structures and shared indentation levels common in `automations.yaml`.
*   **Toolbar Save Button**: Fixed a critical issue where the Save button in the toolbar was unresponsive when auto-save was disabled due to an event parameter conflict.
*   **Code Folding Restoration**: Fixed a regression where configuration blocks could no longer be collapsed in YAML files.

## [2.0.0] - 2026-01-30

### ✨ New Features

#### 🧠 AI Studio Copilot
Bring AI intelligence directly into your Home Assistant workflow with flexible provider support and a powerful local logic engine.
*   **Dual-Mode Intelligence**:
    *   **Cloud Mode**: Native integration for **Gemini** (defaulting to `gemini-2.0-flash-exp`) and **OpenAI** GPT models. System prompts strictly enforce 2024+ Home Assistant best practices (e.g., plural `triggers:`, mandatory `id:` fields, `metadata: {}` blocks).
    *   **Local Logic Engine**: A robust, privacy-first fallback that parses natural language locally to generate valid YAML without any external API calls.
*   **Context-Aware Analysis**: The AI reads your currently active file to provide suggestions that match your specific configuration structure.
*   **Smart Trigger Detection**: Local parser automatically extracts complex triggers from natural language:
    *   **Time**: Handles AM/PM, "at 5pm", and multiple time slots.
    *   **State**: Detects motion, door/window events, and generic on/off changes.
    *   **Numeric**: Parses "above 25 degrees", "humidity under 50%", etc.
*   **Real-time Structural Analysis**: The "Fix my error" feature uses a custom YAML loader to report exact line numbers for:
    *   Legacy syntax (`service:` vs `action:`, `platform:` triggers).
    *   Singular keys (`trigger:` vs `triggers:`).
    *   Malformed entity IDs and missing automation IDs.

#### 🎭 Intelligent Scene & Script Generation
*   **7 Smart Scene Presets**:
    *   **Morning**: 100% brightness, 4000K (Cool White), `mdi:weather-sunny`.
    *   **Evening**: 40% brightness, 2700K (Warm White), `mdi:weather-night`.
    *   **Movie**: 10% brightness, Deep Blue RGB, `mdi:movie`.
    *   **Reading**: 80% brightness, 4000K, `mdi:book-open`.
    *   **Romantic**: 20% brightness, Soft Pink/Red, `mdi:heart`.
    *   **Party**: 100% brightness, Vibrant Magenta, `mdi:party-popper`.
    *   **Relax**: 50% brightness, 2700K, `mdi:sofa`.
*   **Multi-Step Script Logic**: Automatically detects sequences ("then", "after", "wait") to generate `sequence:` blocks with precise `delay:` actions (hours/minutes/seconds).
*   **Parallel Execution Detection**: Phrases like "turn on all lights" trigger parallel execution mode for optimized performance.
*   **Advanced Domain Support**:
    *   **100+ Synonyms**: Maps terms like "chandelier" -> `light`, "roomba" -> `vacuum`, "deadbolt" -> `lock`.
    *   **Area Awareness**: Entity scoring algorithm boosts matches found in the mentioned room (e.g., "kitchen lights" prioritizes `light.kitchen_main`).

#### 📝 Jinja Template Support
*   **Advanced Editor**: Full syntax highlighting for `.jinja`, `.jinja2`, and `.j2` files.
*   **Distinct Syntax Coloring**: Brackets (`{{`, `{%`), keywords (`if`, `for`), variables, and operators are now colored distinctly from the surrounding YAML or text.
*   **Intelligent Validation**: dedicated validator checks for:
    *   Missing quotes in `states()` (e.g., `states(sensor.temp)` -> `states('sensor.temp')`).
    *   Wrong bracket usage (`{{{` -> `{{`).
    *   Missing filter pipes.
*   **Smart Suggestions**: Context-aware autocomplete for loops (`{% for %}`), time functions (`now()`), and state attributes.

#### 🎨 Professional UI Customization
*   **6 Theme Presets**: Dark (VS Code style), Light, High Contrast, Solarized (Dark/Light), Ocean, and Dracula.
*   **Custom Accent Colors**: 8 vibrant options (Blue, Purple, Pink, Cyan, etc.) with automatic hover color generation.
*   **Editor Personalization**: Adjustable font size (10-24px), 7 programming font families (Fira Code, JetBrains Mono, etc.), word wrap toggle, and whitespace visibility.
*   **File Tree Customization**: Compact mode for dense listings and toggleable file type icons.

#### 💾 Advanced File Management
*   **Configurable Auto-Save**: Automatically save files after typing stops (500ms - 5000ms delay).
*   **Smart Settings Interface**: New tabbed modal for General, Appearance, Editor, and Feature settings.
*   **Recent Files Limit**: Configurable history depth (5-30 files).
*   **Entity Explorer Mode**: New "Search Entities" toggle in Global Search (`Ctrl+Shift+F`) to browse the Home Assistant entity registry, view states, and one-click copy IDs into your configuration.
*   **UUID Generator**: Insert random UUIDs instantly with `Ctrl+Shift+U` or via the Command Palette.
*   **Filter by Content**: New toggle in the File Explorer sidebar allows filtering the file tree by content (e.g., entity IDs) instead of just filenames.
*   **Full Theme Selector**: The bottom toolbar theme menu now includes all presets (High Contrast, Solarized, Ocean, Dracula) for quick switching.
*   **Custom Editor Colors**: Added ability to customize font colors for **Line Numbers** and **Fold Arrows** (collapsible indicators) in the editor.

### 🚀 Improvements
*   **Editor UX**: Fold icons are now 40% larger and scale proportionally with your chosen font size for better visibility and easier clicking.
*   **Theme Synchronization**: The bottom toolbar theme selector is now fully synchronized with the main Settings presets, including correct icons and labels for all specific theme modes.
*   **Slider Visibility**: Improved the visual contrast of settings sliders by updating track colors to ensure they are visible across all light and dark themes.
*   **Global Search Performance**: Engineered a faster search engine that automatically excludes binary files (`.db`, `.sqlite`, `.zip`) and all hidden folders (starting with `.`), including `.storage` and `.git`.
*   **Dynamic CSS Architecture**: All themes and accent colors applied via CSS variables for instant preview without reloading.
*   **Robust Backend API**: New `check_yaml` and `check_jinja` endpoints provide instant feedback to the frontend.
*   **Self-Healing Git**: Sync recovery tools and automated branch mismatch migration.
*   **Entity Scoring Algorithm**: improved fuzzy matching logic considers friendly names, entity IDs, and area context for more accurate device selection.

### 🐛 Bug Fixes
*   **Robust Auto-Save**: Hardened the auto-save feature with background timer cleanup and execution guards to ensure it strictly respects the toggle state and prevents accidental saves after being disabled.
*   **Real-time Color Updates**: Fixed an issue where changing custom line number or fold gutter colors required a page refresh to apply.
*   **Double Save**: Resolved a conflict between editor and global keyboard shortcuts that caused files to be saved twice (and two toast notifications) when pressing Ctrl+S.
*   **Git Toggle Robustness**: Ensured the Git Changes panel and all associated toolbar buttons are completely hidden when the GitHub integration is toggled off.
*   **Drag-and-Drop Reliability**: Fixed an issue where moving files via drag-and-drop triggered duplicate API calls due to event bubbling, resulting in "Invalid path or exists" error toasts despite successful moves.
*   **Zero External Dependencies**: Local mode now strictly keeps configuration 100% private.
*   **Recent Files Logic**: Fixed limit enforcement and persistent storage issues.
*   **Toast Layering**: Corrected an issue where toast notifications were hidden behind modals by moving them to the highest visual layer (z-index).
*   **Editor Font Stability**: Corrected font loading race conditions on editor initialization.
*   **YAML Analysis**: Fixed line/column reporting for complex nested structures.

## [1.5.0] - 2026-01-25

### ✨ New Features
*   **Command Palette**: Access all Blueprint Studio features instantly with `Ctrl+K`.
*   **Commit History**: New panel to browse recent commits with color-coded diffs.
*   **YAML Snippets**: Intelligent templates for common Home Assistant patterns (`snip:`).
*   **Advanced Global Search**: Support for Regular Expressions and Case Sensitivity.

## [1.4.0] - 2026-01-25

### ✨ New Features
*   **Smart Entity Autocomplete**: Intelligent suggestions for Home Assistant entities with icons.
*   **Global Search**: Cross-file text search with context and filtering.

## [1.2.0] - 2026-01-18

### 🌟 Added - GitHub Integration & Advanced Features
*   **GitHub Integration**: Full push/pull/commit/stage workflow with OAuth.
*   **Pin Favorites**: Quick access to frequently used files in the sidebar.
*   **Smart .gitignore**: Automatically excludes large models and lock files.

## [1.0.0] - 2024-12-05

### Added
- Initial release with VS Code-like interface and multi-tab editing.
- Syntax highlighting and real-time YAML validation.

---

## Version History
- **2.2.2** - Feature & Fix Update (31 Languages)
- **2.2.1** - Editor & UI Enhancement Suite
- **2.2.0** - Performance, Architecture & SFTP Integration Update
- **2.1.5** - Compatibility & Reliability Update
- **2.1.4** - Quality of Life Update
- **2.1.3** - AI Models Update
- **2.1.2** - Visuals & Efficiency Update
- **2.1.1** - Professional File Management and Productivity Boost 
- **2.1.0** - The Performance & Architecture Update
- **2.0.5** - Allow Deletion of Folders and Files In custom_components Folder
- **2.0.5** - Persistant Workspace and Keyboard Shortcut Conflict Fix
- **2.0.4** - Git Panel Bug Fix
- **2.0.3** - Robust GitHub Authentication
- **2.0.2** - Git & UI Improvements
- **2.0.1** - Bug Fixes & Stability
- **2.0.0** - AI Copilot, Intelligent Scenes, Advanced Scripts & UI Customization
- **1.5.0** - Command Palette, Commit History & Regex Search
- **1.4.0** - Smart Autocomplete, Global Search & Bug Fixes
- **1.2.0** - GitHub Integration, Pin Favorites & Auto-Refresh
- **1.0.0** - First stable release

[Unreleased]: https://github.com/soulripper13/blueprint-studio/compare/v2.2.2...HEAD
[2.2.2]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.2.2
[2.2.1]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.2.1
[2.2.0]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.2.0
[2.1.5]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.1.5
[2.1.4]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.1.4
[2.1.3]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.1.3
[2.1.2]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.1.2
[2.1.1]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.1.1
[2.1.0]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.1.0
[2.0.6]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.0.6
[2.0.5]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.0.5
[2.0.4]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.0.4
[2.0.3]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.0.3
[2.0.2]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.0.2
[2.0.1]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.0.1
[2.0.0]: https://github.com/soulripper13/blueprint-studio/releases/tag/v2.0.0
[1.5.0]: https://github.com/soulripper13/blueprint-studio/releases/tag/v1.5.0
[1.4.0]: https://github.com/soulripper13/blueprint-studio/releases/tag/v1.4.0
[1.2.0]: https://github.com/soulripper13/blueprint-studio/releases/tag/v1.2.0
[1.0.0]: https://github.com/soulripper13/blueprint-studio/releases/tag/v1.0.0
