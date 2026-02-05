/**
 * Editor management module for Blueprint Studio
 */
import { state, elements } from './state.js';
import { THEME_PRESETS, HA_SCHEMA } from './constants.js';
import { getEffectiveTheme } from './ui.js';

// Callbacks registered from main.js
let callbacks = {
    saveCurrentFile: null,
    showCommandPalette: null,
    openSearchWidget: null,
    validateYaml: null,
    saveSettings: null,
    updateStatusBar: null
};

export function registerEditorCallbacks(cb) {
    callbacks = { ...callbacks, ...cb };
}

export function getEditorMode(path) {
    if (!path) return null;
    const ext = path.split(".").pop().toLowerCase();
    if (ext === "yaml" || ext === "yml") return "ha-yaml";
    if (ext === "py") return "python";
    if (ext === "js") return "javascript";
    if (ext === "json") return "javascript"; // JSON uses JS mode in CodeMirror
    if (ext === "css") return "css";
    if (ext === "html") return "htmlmixed";
    if (ext === "md") return "markdown";
    if (ext === "sh") return "shell";
    if (ext === "jinja" || ext === "jinja2" || ext === "j2") return "jinja2";
    return null;
}

export function createEditor() {
    const wrapper = document.createElement("div");
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";
    wrapper.id = "codemirror-wrapper";
    elements.editorContainer.appendChild(wrapper);

    const preset = THEME_PRESETS[state.themePreset] || THEME_PRESETS.dark;
    const cmTheme = preset.colors.cmTheme;

    state.editor = CodeMirror(wrapper, {
      value: "",
      mode: null,
      theme: cmTheme,
      lineNumbers: state.showLineNumbers,
      lineWrapping: state.wordWrap,
      matchBrackets: true,
      autoCloseBrackets: true,
      styleActiveLine: true,
      foldGutter: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      gutters: state.showLineNumbers ? ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "CodeMirror-lint-markers"] : ["CodeMirror-foldgutter", "CodeMirror-lint-markers"],
      extraKeys: {
        "Ctrl-S": () => callbacks.saveCurrentFile(),
        "Cmd-S": () => callbacks.saveCurrentFile(),
        "Ctrl-K": () => callbacks.showCommandPalette(),
        "Cmd-K": () => callbacks.showCommandPalette(),
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
        "Ctrl-F": "findPersistent",
        "Cmd-F": "findPersistent",
        "Ctrl-H": "replace",
        "Cmd-H": "replace",
        "Ctrl-G": "jumpToLine",
        "Cmd-G": "jumpToLine",
        "Ctrl-/": "toggleComment",
        "Cmd-/": "toggleComment",
      }
    });

    state.editor.on("change", handleEditorChange);
    state.editor.on("cursorActivity", () => {
        if (callbacks.updateStatusBar) callbacks.updateStatusBar();
    });

    // Aggressive Global Capture Listener for Shortcuts
    // We attach to window with capture: true to intercept before browser defaults
    const handleGlobalShortcuts = (e) => {
        console.log("[Debug] Global Keydown:", e.key, e.keyCode, "Meta:", e.metaKey, "Alt:", e.altKey, "Shift:", e.shiftKey, "Focus:", state.editor ? state.editor.hasFocus() : false);
        
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

        // Backup: Cmd + Shift + Arrow (Mac specific override)
        else if (e.metaKey && e.shiftKey) {
             moveLines(state.editor, isUp ? -1 : 1);
             handled = true;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // The nuclear option
        }
    };

    // Remove previous listener if exists (to avoid duplicates on HMR/reload logic if any)
    if (state._globalShortcutHandler) {
        window.removeEventListener("keydown", state._globalShortcutHandler, true);
    }
    state._globalShortcutHandler = handleGlobalShortcuts;
    window.addEventListener("keydown", handleGlobalShortcuts, true);
}

function handleEditorChange() {
    if (!state.activeTab || !state.editor) return;
    const currentContent = state.editor.getValue();
    if (state.activeTab.content !== currentContent) {
      state.activeTab.content = currentContent;
      state.activeTab.modified = true;
      // renderTabs(); // We'll need to call this
    }
}

export function applyEditorSettings() {
    if (!state.editor) return;
    const editorEl = document.querySelector('.CodeMirror');
    if (editorEl) {
      editorEl.style.fontSize = state.fontSize + 'px';
      editorEl.style.fontFamily = state.fontFamily;
    }
    state.editor.setOption('lineNumbers', state.showLineNumbers);
    state.editor.setOption('lineWrapping', state.wordWrap);
}

function moveLines(cm, direction) {
    cm.operation(() => {
        const range = cm.listSelections()[0]; // Handle primary selection
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

function duplicateLines(cm, direction) {
    cm.operation(() => {
        const range = cm.listSelections()[0];
        const startLine = Math.min(range.head.line, range.anchor.line);
        const endLine = Math.max(range.head.line, range.anchor.line);
        const text = cm.getRange({line: startLine, ch: 0}, {line: endLine, ch: cm.getLine(endLine).length});
        
        if (direction === "up") {
            // Insert copy above
            cm.replaceRange(text + "\n", {line: startLine, ch: 0});
            // Fix selection to stay on original (which moved down)
            const lineCount = endLine - startLine + 1;
            cm.setSelection(
                {line: range.anchor.line + lineCount, ch: range.anchor.ch},
                {line: range.head.line + lineCount, ch: range.head.ch}
            );
        } else { // Down
            // Insert copy below
            cm.replaceRange("\n" + text, {line: endLine, ch: cm.getLine(endLine).length});
            // Selection stays on original (top) - no action needed
        }
    });
}
