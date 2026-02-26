/**
 * ============================================================================
 * EDITOR MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Handles CodeMirror editor initialization, configuration, editor-specific
 * operations like indentation detection, YAML linting, auto-completion, and
 * editor event handling.
 *
 * EXPORTED FUNCTIONS:
 * - registerEditorCallbacks(cb) - Register dependencies from app.js
 * - createEditor(container) - Create and configure CodeMirror instance
 * - yamlLinter(text) - Lint YAML content and return errors
 * - detectIndentation(content) - Detect file's indentation (spaces/tabs)
 * - handleEditorChange(editor) - Handle editor content changes
 * - selectNextOccurrence() - Multi-cursor: select next occurrence
 *
 * REQUIRED CALLBACKS (from app.js):
 * - saveCurrentFile: Save file when editor changes
 * - openSearchWidget: Open find/replace widget
 * - showCommandPalette: Open command palette
 * - openFile: Open file
 * - closeTab: Close current tab
 * - nextTab: Switch to next tab
 * - previousTab: Switch to previous tab
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new editor mode/language:
 *    - Ensure CodeMirror mode is loaded (add script tag in HTML)
 *    - Detect language in createEditor() based on file extension
 *    - Set mode: editor.setOption("mode", "language")
 *    - Add syntax highlighting CSS if needed
 *
 * 2. Adding editor keybindings:
 *    - Add to extraKeys in createEditor()
 *    - Format: "Cmd-S": (cm) => { action }
 *    - Use platform-aware keys: Cmd (Mac) / Ctrl (Windows/Linux)
 *    - Delegate to callbacks for complex actions
 *
 * 3. Adding linting for other languages:
 *    - Create linter function (similar to yamlLinter)
 *    - Return array of {from, to, message, severity}
 *    - Register in createEditor() lint option
 *    - Show errors in gutter and inline
 *
 * 4. Adding autocompletion:
 *    - Modify hint function in createEditor()
 *    - Return { list: [...completions], from, to }
 *    - Add completion triggers (., -, etc.)
 *    - Support snippet expansion
 *
 * 5. Adding editor themes:
 *    - Load theme CSS file
 *    - Set theme in createEditor(): theme: "theme-name"
 *    - Allow theme switching in settings
 *    - Sync with app theme (dark/light)
 *
 * INTEGRATION POINTS:
 * - state.js: state.editor, editor settings (fontSize, tabSize, etc.)
 * - file-operations.js: YAML validation
 * - ha-autocomplete.js: Home Assistant entity hints
 * - app.js: File operations and tab management
 * - settings.js: Editor configuration persistence
 *
 * EDITOR CONFIGURATION (from state):
 * - fontSize: Editor font size (default: 14px)
 * - tabSize: Tab width in spaces (default: 2)
 * - indentWithTabs: Use tabs vs spaces
 * - wordWrap: Enable line wrapping
 * - showLineNumbers: Show line numbers
 * - showWhitespace: Show whitespace characters
 * - autoSave: Enable auto-save
 * - autoSaveDelay: Auto-save delay in ms
 *
 * CODEMIRROR ADDONS USED:
 * - dialog: Search/replace dialogs
 * - search: Find/replace functionality
 * - searchcursor: Search API
 * - match-highlighter: Highlight matching words
 * - matchbrackets: Bracket matching
 * - closebrackets: Auto-close brackets
 * - comment: Toggle comments
 * - foldcode, foldgutter: Code folding
 * - lint: Inline error checking
 * - hint: Autocompletion
 * - sublime: Sublime Text keybindings
 *
 * ARCHITECTURE NOTES:
 * - CodeMirror loaded globally (not ES6 module)
 * - One editor instance shared across all tabs
 * - Editor content switches when tabs change
 * - Cursor/scroll positions saved per tab
 * - YAML linting happens on change with debounce
 * - Auto-save triggers on change with delay
 *
 * COMMON PATTERNS:
 * - Create editor: const editor = createEditor(container)
 * - Get content: editor.getValue()
 * - Set content: editor.setValue(content)
 * - Get cursor: editor.getCursor()
 * - Set cursor: editor.setCursor(pos)
 * - Change event: editor.on("change", handler)
 * - Run command: editor.execCommand("findNext")
 *
 * INDENTATION DETECTION:
 * - Analyzes first 100 lines
 * - Detects tabs vs spaces
 * - Detects indent size (2, 4, etc.)
 * - Falls back to settings defaults
 * - Updates editor config per file
 *
 * YAML LINTING:
 * - Validates YAML syntax on change
 * - Shows errors in gutter (red icon)
 * - Shows inline error messages
 * - Highlights error lines
 * - Updates in real-time as you type
 *
 * HOME ASSISTANT HINTS:
 * - Autocomplete HA entity IDs
 * - Autocomplete service calls
 * - Context-aware suggestions
 * - Triggered by typing
 *
 * ============================================================================
 */
import { state, elements } from './state.js';
import { validateYaml } from './file-operations.js';
import { homeAssistantHint } from './ha-autocomplete.js';

// CodeMirror is loaded globally via script tags

// Callbacks for cross-module functions
let callbacks = {
  saveCurrentFile: null,
  openSearchWidget: null,
  showCommandPalette: null,
  openFile: null,
  closeTab: null,
  nextTab: null,
  previousTab: null,
  updateToolbarState: null,
  updateStatusBar: null,
  renderTabs: null,
  renderFileTree: null,
  triggerAutoSave: null,
  applyEditorSettings: null,
  applySyntaxColors: null,
  saveSettings: null,
  getWorkspaceSaveTimer: null,
  setWorkspaceSaveTimer: null
};

export function registerEditorCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Creates and initializes the CodeMirror editor
 * @param {HTMLElement} container - Optional container element (defaults to editor container)
 */
export function createEditor(container = null) {
  const targetContainer = container || elements.editorContainer;
  const wrapper = document.createElement("div");
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  wrapper.id = "codemirror-wrapper";
  targetContainer.appendChild(wrapper);

  const cmTheme = state.theme === "dark" ? "material-darker" : "default";

  const editor = CodeMirror(wrapper, {
    value: "",
    mode: null,
    theme: cmTheme,
    lineNumbers: state.showLineNumbers,
    lineWrapping: state.wordWrap,
    matchBrackets: true,
    autoCloseBrackets: true,
    styleActiveLine: true,
    foldGutter: true,
    indentUnit: state.tabSize || 2,
    tabSize: state.tabSize || 2,
    indentWithTabs: state.indentWithTabs || false,
    gutters: state.showLineNumbers ? ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "CodeMirror-lint-markers"] : ["CodeMirror-foldgutter", "CodeMirror-lint-markers"],
    hintOptions: {
      hint: homeAssistantHint,
      completeSingle: false,
      closeOnUnfocus: true,
      alignWithWord: true,
      closeCharacters: /[\s()\[\]{};:>,]/
    },
    extraKeys: {
      "Tab": (cm) => {
        // Use current indentUnit setting
        const spaces = cm.getOption("indentUnit");
        const useTab = cm.getOption("indentWithTabs");

        if (cm.somethingSelected()) {
          cm.indentSelection("add");
        } else {
          const indent = useTab ? "\t" : " ".repeat(spaces);
          cm.replaceSelection(indent);
        }

        return true; // Prevent default Tab behavior
      },
      "Shift-Tab": (cm) => {
        if (cm.somethingSelected()) {
          cm.indentSelection("subtract");
        }
        return true;
      },
      "Ctrl-S": () => {
        if (callbacks.saveCurrentFile) callbacks.saveCurrentFile();
      },
      "Cmd-S": () => {
        if (callbacks.saveCurrentFile) callbacks.saveCurrentFile();
      },
      "Cmd-D": (cm) => selectNextOccurrence(cm),
      "Ctrl-D": (cm) => selectNextOccurrence(cm),
      "Ctrl-F": (cm) => {
        if (callbacks.openSearchWidget) callbacks.openSearchWidget(false);
        // Blur editörü: CodeMirror handler bittikten sonra focus'u geri çekiyor,
        // blur ile bunu engelliyoruz; search.js'deki setTimeout focus'u alıyor.
        cm.getInputField().blur();
      },
      "Cmd-F": (cm) => {
        if (callbacks.openSearchWidget) callbacks.openSearchWidget(false);
        cm.getInputField().blur();
      },
      "Ctrl-H": () => {
        if (callbacks.openSearchWidget) callbacks.openSearchWidget(true);
      },
      "Cmd-Option-F": () => {
        if (callbacks.openSearchWidget) callbacks.openSearchWidget(true);
      },
      "Ctrl-K": () => {
        if (callbacks.showCommandPalette) callbacks.showCommandPalette();
      },
      "Cmd-K": () => {
        if (callbacks.showCommandPalette) callbacks.showCommandPalette();
      },
      "Ctrl-G": () => {
        if (editor) editor.execCommand("jumpToLine");
      },
      "Cmd-G": () => {
        if (editor) editor.execCommand("jumpToLine");
      },
      "Ctrl-/": () => {
        if (editor) editor.execCommand("toggleComment");
      },
      "Cmd-/": () => {
        if (editor) editor.execCommand("toggleComment");
      },
      // Line Operations
      "Alt-Up": (cm) => moveLines(cm, -1),
      "Alt-Down": (cm) => moveLines(cm, 1),
      "Shift-Ctrl-Up": (cm) => moveLines(cm, -1),
      "Shift-Cmd-Up": (cm) => moveLines(cm, -1),
      "Shift-Ctrl-Down": (cm) => moveLines(cm, 1),
      "Shift-Cmd-Down": (cm) => moveLines(cm, 1),
      "Shift-Alt-Up": (cm) => duplicateLines(cm, "up"),
      "Shift-Alt-Down": (cm) => duplicateLines(cm, "down"),
      "Ctrl-Alt-Up": (cm) => duplicateLines(cm, "up"),
      "Cmd-Alt-Up": (cm) => duplicateLines(cm, "up"),
      "Ctrl-Alt-Down": (cm) => duplicateLines(cm, "down"),
      "Cmd-Alt-Down": (cm) => duplicateLines(cm, "down"),

      "Ctrl-Alt-[": (cm) => cm.execCommand("foldAll"),
      "Cmd-Alt-[": (cm) => cm.execCommand("foldAll"),
      "Ctrl-Alt-]": (cm) => cm.execCommand("unfoldAll"),
      "Cmd-Alt-]": (cm) => cm.execCommand("unfoldAll"),

      "Ctrl-Space": (cm) => {
        cm.showHint({ hint: homeAssistantHint });
      },
      "Tab": (cm) => {
        if (cm.somethingSelected()) {
          cm.indentSelection("add");
        } else {
          cm.replaceSelection("  ", "end");
        }
      },
    },
    inputStyle: "contenteditable",
  });

  // Set state references
  state.editor = editor;

  // Apply font settings to the editor
  if (callbacks.applyEditorSettings) {
    callbacks.applyEditorSettings();
  }
  // Apply syntax colors after editor is created
  if (callbacks.applySyntaxColors) {
    callbacks.applySyntaxColors();
  }

  // Aggressive Global Capture Listener for Shortcuts (Move/Duplicate Lines)
  // GLOBAL TAB HANDLER - Bypass CodeMirror's keymap system
  const handleGlobalTab = (e) => {
    // Only handle Tab key
    if (e.key !== "Tab" && e.keyCode !== 9) return;

    // Only handle if editor has focus
    if (!state.editor || !state.editor.hasFocus()) return;

    e.preventDefault();
    e.stopPropagation();

    const spaces = state.editor.getOption("indentUnit");
    const useTab = state.editor.getOption("indentWithTabs");

    if (e.shiftKey) {
      // Shift+Tab = unindent
      if (state.editor.somethingSelected()) {
        state.editor.indentSelection("subtract");
      }
    } else {
      // Tab = indent
      if (state.editor.somethingSelected()) {
        state.editor.indentSelection("add");
      } else {
        const indent = useTab ? "\t" : " ".repeat(spaces);
        state.editor.replaceSelection(indent);
      }
    }
  };

  document.addEventListener("keydown", handleGlobalTab, true); // Use capture phase

  const handleGlobalShortcuts = (e) => {
    if (!state.editor || !state.editor.hasFocus()) return;

    const isUp = e.key === "ArrowUp" || e.keyCode === 38;
    const isDown = e.key === "ArrowDown" || e.keyCode === 40;

    if (!isUp && !isDown) return;

    let handled = false;

    // Move Line: Alt/Option + Arrow
    if (e.altKey && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      moveLines(state.editor, isUp ? -1 : 1);
      handled = true;
    }

    // Duplicate Line: Shift + Alt/Option + Arrow
    else if (e.altKey && e.shiftKey && !e.metaKey && !e.ctrlKey) {
      duplicateLines(state.editor, isUp ? "up" : "down");
      handled = true;
    }

    // Backup: Cmd + Shift + Arrow (Mac override)
    else if (e.metaKey && e.shiftKey) {
      moveLines(state.editor, isUp ? -1 : 1);
      handled = true;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };

  // Remove previous listener if exists
  if (state._globalShortcutHandler) {
    window.removeEventListener("keydown", state._globalShortcutHandler, true);
  }
  state._globalShortcutHandler = handleGlobalShortcuts;
  window.addEventListener("keydown", handleGlobalShortcuts, true);

  // Track changes
  editor.on("change", () => handleEditorChange());

  // Track cursor position
  editor.on("cursorActivity", () => {
    if (callbacks.updateStatusBar) callbacks.updateStatusBar();

    // Debounce saving workspace state (cursor/scroll)
    if (state.rememberWorkspace && callbacks.saveSettings && callbacks.getWorkspaceSaveTimer && callbacks.setWorkspaceSaveTimer) {
      const timer = callbacks.getWorkspaceSaveTimer();
      if (timer) clearTimeout(timer);
      callbacks.setWorkspaceSaveTimer(setTimeout(() => callbacks.saveSettings(), 2000));
    }
  });

  editor.on("scroll", () => {
    if (state.rememberWorkspace && callbacks.saveSettings && callbacks.getWorkspaceSaveTimer && callbacks.setWorkspaceSaveTimer) {
      const timer = callbacks.getWorkspaceSaveTimer();
      if (timer) clearTimeout(timer);
      callbacks.setWorkspaceSaveTimer(setTimeout(() => callbacks.saveSettings(), 2000));
    }
  });

  // Block Scope Highlighting Logic
  let highlightedLines = [];

  const clearBlockHighlight = () => {
    highlightedLines.forEach(lh => {
      editor.removeLineClass(lh, "wrap", "cm-block-highlight-line");
      editor.removeLineClass(lh, "wrap", "cm-block-highlight-start");
      editor.removeLineClass(lh, "wrap", "cm-block-highlight-end");
    });
    highlightedLines = [];
    if (editor) {
      editor.getWrapperElement().style.removeProperty("--block-indent");
    }
  };

  editor.on("mousedown", (cm, e) => {
    // Clear existing on any click
    if (highlightedLines.length > 0) {
      clearBlockHighlight();
    }

    // Only handle left clicks
    if (e.button !== 0) return;

    const pos = cm.coordsChar({left: e.clientX, top: e.clientY});
    if (!pos) return;

    const lineText = cm.getLine(pos.line);

    // Robust detection: Any line that looks like a key definition (e.g. "key:", "- key:", "  key:")
    // We ignore comments
    if (lineText.trim().startsWith("#")) return;

    const isKeyLine = /^\s*(- )?[\w_]+:/.test(lineText);

    if (isKeyLine) {
      const lineNum = pos.line;

      // Calculate base indentation
      const indentMatch = lineText.match(/^\s*/);
      const baseIndent = indentMatch ? indentMatch[0].length : 0;

      const totalLines = cm.lineCount();
      let endLine = lineNum;

      // Find scope
      for (let i = lineNum + 1; i < totalLines; i++) {
        const nextLineText = cm.getLine(i);

        if (nextLineText.trim().length === 0) {
          if (i < totalLines - 1) continue;
          else break;
        }

        const nextIndentMatch = nextLineText.match(/^\s*/);
        const nextIndent = nextIndentMatch ? nextIndentMatch[0].length : 0;

        // Block continues if indentation is deeper or it's a list item at same level
        const isNextListItem = /^\s*- /.test(nextLineText);
        const startIsListItem = /^\s*- /.test(lineText);

        if (nextIndent > baseIndent || (nextIndent === baseIndent && isNextListItem && !startIsListItem)) {
          endLine = i;
        } else {
          break;
        }
      }

      // Apply highlight
      if (endLine >= lineNum) {
        clearBlockHighlight(); // Ensure clear

        // Set indentation variable
        const coords = cm.charCoords({line: lineNum, ch: baseIndent}, "local");
        editor.getWrapperElement().style.setProperty("--block-indent", `${coords.left}px`);

        for (let i = lineNum; i <= endLine; i++) {
          const lineHandle = cm.addLineClass(i, "wrap", "cm-block-highlight-line");
          if (i === lineNum) cm.addLineClass(i, "wrap", "cm-block-highlight-start");
          if (i === endLine) cm.addLineClass(i, "wrap", "cm-block-highlight-end");
          highlightedLines.push(lineHandle);
        }
      }
    }
  });

  // Auto-trigger autocomplete for YAML files
  editor.on("inputRead", (cm, changeObj) => {
    // Only auto-complete in YAML mode
    const mode = cm.getOption("mode");
    if (mode !== "ha-yaml" && mode !== "yaml") return;

    // Don't autocomplete if we're in the middle of completing
    if (cm.state.completionActive) return;

    // Get the character that was just typed
    const text = changeObj.text[0];

    // Auto-trigger on certain characters
    const autoTriggerChars = [':', ' ', '-', '!', '.'];
    const lastChar = text[text.length - 1];

    // Auto-trigger after typing certain characters or when starting a new word
    if (autoTriggerChars.includes(lastChar) ||
        (text.match(/^[a-zA-Z]$/) && changeObj.origin === "+input")) {

      // Small delay to make it feel more natural
      setTimeout(() => {
        if (!cm.state.completionActive) {
          cm.showHint({
            hint: homeAssistantHint,
            completeSingle: false
          });
        }
      }, 100);
    }
  });

  // Initial refresh
  editor.refresh();

  return editor;
}

/**
 * YAML linter function
 */
export function yamlLinter(content, updateLinting) {
  validateYaml(content).then((result) => {
    const annotations = [];
    if (!result.valid && result.error) {
      const match = result.error.match(/line (\d+)/);
      if (match) {
        const line = parseInt(match[1]) - 1;
        annotations.push({
          from: CodeMirror.Pos(line, 0),
          to: CodeMirror.Pos(line, 100),
          message: result.error,
          severity: "error",
        });
      }
    }
    updateLinting(annotations);
  });
}

/**
 * Detects indentation style and size from content
 */
export function detectIndentation(content) {
  if (!content) {
    return { tabs: state.indentWithTabs, size: state.tabSize };
  }

  const lines = content.split("\n").slice(0, 100); // Check first 100 lines
  let tabs = 0;
  let spaces = 0;
  const spaceCounts = {};

  lines.forEach(line => {
    const indentMatch = line.match(/^(\s+)/);
    if (indentMatch) {
      const indent = indentMatch[1];
      if (indent.includes("\t")) {
        tabs++;
      } else {
        // Ignore lines that are just whitespace
        if (indent.length === line.length) return;

        spaces++;
        const count = indent.length;
        if (count > 0) {
          spaceCounts[count] = (spaceCounts[count] || 0) + 1;
        }
      }
    }
  });

  if (tabs > spaces) {
    return { tabs: true, size: 4 }; // Default tab size 4
  }

  // Find most common indentation jump
  let bestSize = state.tabSize || 2;  // Default to user preference, not hardcoded 2
  let maxFreq = 0;
  for (const [size, freq] of Object.entries(spaceCounts)) {
    if (freq > maxFreq) {
      maxFreq = freq;
      bestSize = parseInt(size);
    }
  }

  // Home Assistant standard is 2, so if it's 0 or weird, default to user preference
  return { tabs: false, size: bestSize || state.tabSize };
}

/**
 * Handles editor content changes
 */
export function handleEditorChange(editor = null) {
  if (!state.editor) return;

  // Determine which tab to update based on which editor changed
  let targetTab = state.activeTab;

  if (!targetTab) return;

  const currentContent = state.editor.getValue();
  targetTab.content = currentContent;
  targetTab.modified = currentContent !== targetTab.originalContent;

  if (callbacks.updateToolbarState) callbacks.updateToolbarState();
  if (callbacks.renderTabs) callbacks.renderTabs();
  if (callbacks.renderFileTree) callbacks.renderFileTree();

  // Handle auto-save
  if (callbacks.triggerAutoSave) callbacks.triggerAutoSave();
}

/**
 * Selects next occurrence of current selection (multi-cursor)
 */
export function selectNextOccurrence(cm) {
  const selections = cm.listSelections();
  if (selections.length === 0) return;

  // Use the last selection (the most recently added one) as the reference
  const lastSelection = selections[selections.length - 1];

  // If text is not selected, select the word under cursor
  if (lastSelection.empty()) {
    const word = cm.findWordAt(lastSelection.head);
    // Replace the last empty cursor with the word selection
    const newSelections = selections.slice(0, -1);
    newSelections.push({ anchor: word.anchor, head: word.head });
    cm.setSelections(newSelections);
    return;
  }

  // Get the selection range ordered (important for getRange)
  const anchor = lastSelection.anchor;
  const head = lastSelection.head;
  const isHeadAfterAnchor = (head.line > anchor.line || (head.line === anchor.line && head.ch > anchor.ch));
  const from = isHeadAfterAnchor ? anchor : head;
  const to = isHeadAfterAnchor ? head : anchor;

  // Get the text to match
  const query = cm.getRange(from, to);
  if (!query) return;

  // Check if searchcursor addon is loaded
  if (!cm.getSearchCursor) {
    console.warn("CodeMirror searchcursor addon not loaded");
    return;
  }

  // Find next occurrence starting from the end of the last selection
  const cursor = cm.getSearchCursor(query, to, { caseFold: false });

  if (cursor.findNext()) {
    cm.addSelection(cursor.from(), cursor.to());
    cm.scrollIntoView(cursor.to(), 20);
  }
}

/**
 * Moves selected lines up or down
 * @param {CodeMirror} cm - CodeMirror instance
 * @param {number} direction - -1 for up, 1 for down
 */
function moveLines(cm, direction) {
  cm.operation(() => {
    const range = cm.listSelections()[0];
    const startLine = Math.min(range.head.line, range.anchor.line);
    const endLine = Math.max(range.head.line, range.anchor.line);

    if (direction === -1) { // Up
      if (startLine === 0) return;
      const textToMove = cm.getRange({line: startLine, ch: 0}, {line: endLine, ch: cm.getLine(endLine).length});
      const textAbove = cm.getLine(startLine - 1);

      cm.replaceRange(textToMove + "\n" + textAbove,
        {line: startLine - 1, ch: 0},
        {line: endLine, ch: cm.getLine(endLine).length}
      );

      cm.setSelection(
        {line: range.anchor.line - 1, ch: range.anchor.ch},
        {line: range.head.line - 1, ch: range.head.ch}
      );
    } else { // Down
      if (endLine === cm.lastLine()) return;
      const textToMove = cm.getRange({line: startLine, ch: 0}, {line: endLine, ch: cm.getLine(endLine).length});
      const textBelow = cm.getLine(endLine + 1);

      cm.replaceRange(textBelow + "\n" + textToMove,
        {line: startLine, ch: 0},
        {line: endLine + 1, ch: cm.getLine(endLine + 1).length}
      );

      cm.setSelection(
        {line: range.anchor.line + 1, ch: range.anchor.ch},
        {line: range.head.line + 1, ch: range.head.ch}
      );
    }
  });
}

/**
 * Duplicates selected lines up or down
 * @param {CodeMirror} cm - CodeMirror instance
 * @param {string} direction - "up" or "down"
 */
function duplicateLines(cm, direction) {
  cm.operation(() => {
    const range = cm.listSelections()[0];
    const startLine = Math.min(range.head.line, range.anchor.line);
    const endLine = Math.max(range.head.line, range.anchor.line);
    const text = cm.getRange({line: startLine, ch: 0}, {line: endLine, ch: cm.getLine(endLine).length});

    if (direction === "up") {
      cm.replaceRange(text + "\n", {line: startLine, ch: 0});
      const lineCount = endLine - startLine + 1;
      cm.setSelection(
        {line: range.anchor.line + lineCount, ch: range.anchor.ch},
        {line: range.head.line + lineCount, ch: range.head.ch}
      );
    } else { // Down
      cm.replaceRange("\n" + text, {line: endLine, ch: cm.getLine(endLine).length});
    }
  });
}

/**
 * Copies text to clipboard with fallback for older browsers
 * @param {string} text - Text to copy
 */
export function copyToClipboard(text) {
  if (!navigator.clipboard) {
      // Fallback for non-secure contexts or browsers without clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
          document.execCommand('copy');
          if (callbacks.showToast) callbacks.showToast("Code copied to clipboard", "success");
      } catch (err) {
          console.error("Fallback copy failed:", err);
          if (callbacks.showToast) callbacks.showToast("Failed to copy code", "error");
      }
      document.body.removeChild(textArea);
      return;
  }

  navigator.clipboard.writeText(text).then(() => {
      if (callbacks.showToast) callbacks.showToast("Code copied to clipboard", "success");
  }).catch(err => {
      console.error("Async copy failed:", err);
      if (callbacks.showToast) callbacks.showToast("Failed to copy code", "error");
  });
}
