/**
 * ============================================================================
 * SEARCH MODULE (In-Editor Find/Replace)
 * ============================================================================
 *
 * PURPOSE:
 * Handles in-editor find and replace functionality within a single file.
 * Provides search highlighting, match navigation, and replacement operations.
 * Note: This is different from global-search.js which searches across all files.
 *
 * EXPORTED FUNCTIONS:
 * - updateSearchHighlights(query, options) - Update search highlights
 * - updateMatchStatus(currentMatch, totalMatches) - Update match counter
 * - openSearchWidget() - Open find/replace widget
 * - closeSearchWidget() - Close find/replace widget
 * - doFind(query, options) - Find text in editor
 * - doReplace(find, replace, options) - Replace current match
 * - doReplaceAll(find, replace, options) - Replace all matches
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding search options:
 *    - Add checkbox to search widget
 *    - Pass option to doFind()
 *    - Update CodeMirror search config
 *    - Examples: whole word, regex, case sensitive
 *
 * 2. Adding search history:
 *    - Track recent searches in state
 *    - Add dropdown to recall previous
 *    - Persist in settings
 *
 * 3. Adding match highlighting styles:
 *    - Modify updateSearchHighlights()
 *    - Add CSS classes for different match types
 *    - Examples: current match, other matches
 *
 * INTEGRATION POINTS:
 * - editor.js: CodeMirror instance (state.editor)
 * - event-handlers.js: Cmd/Ctrl+F shortcut
 * - ui.js: Widget styling
 * - Note: Separate from global-search.js (multi-file search)
 *
 * SEARCH OPTIONS:
 * - caseSensitive: Match case exactly
 * - wholeWord: Match whole words only
 * - useRegex: Use regular expressions
 *
 * COMMON PATTERNS:
 * - Open search: openSearchWidget(); doFind(query)
 * - Navigate: Find Next/Previous (CodeMirror handles)
 * - Replace: doReplace(find, replace)
 * - Replace all: doReplaceAll(find, replace)
 *
 * ============================================================================
 */
import { state, elements } from './state.js';
import { showToast } from './ui.js';

/**
 * Updates search highlights overlay in the editor
 * @param {string} query - Search query
 */
export function updateSearchHighlights(query) {
  if (!state.editor) return;

  // Remove existing overlay if any
  if (state.searchOverlay) {
    state.editor.removeOverlay(state.searchOverlay);
    state.searchOverlay = null;
  }

  if (!query) return;

  // Create a new overlay for all matches
  state.searchOverlay = {
    token: function(stream) {
      if (stream.match(query, true, true)) {
        return "search-match";
      }
      while (stream.next() != null && !stream.match(query, false, true)) {}
      return null;
    }
  };

  state.editor.addOverlay(state.searchOverlay);
}

/**
 * Updates match count and highlights current match
 * @param {string} query - Search query
 */
export function updateMatchStatus(query) {
  if (!state.editor || !query) {
    if (elements.searchCount) elements.searchCount.textContent = "";
    if (state.activeMatchMark) {
      state.activeMatchMark.clear();
      state.activeMatchMark = null;
    }
    return;
  }

  const cursor = state.editor.getSearchCursor(query, null, { caseFold: true });
  let count = 0;
  let currentIdx = -1;

  const selFrom = state.editor.getCursor("from");
  const selTo = state.editor.getCursor("to");

  // Clear previous active mark
  if (state.activeMatchMark) {
    state.activeMatchMark.clear();
    state.activeMatchMark = null;
  }

  while (cursor.findNext()) {
    count++;
    // Check if this match is the selected one
    if (cursor.from().line === selFrom.line && cursor.from().ch === selFrom.ch &&
        cursor.to().line === selTo.line && cursor.to().ch === selTo.ch) {
      currentIdx = count;

      // Highlight this specific match as active
      state.activeMatchMark = state.editor.markText(
        cursor.from(),
        cursor.to(),
        { className: "cm-search-active" }
      );
    }
  }

  if (elements.searchCount) {
    if (count > 0) {
      if (currentIdx > 0) {
        elements.searchCount.textContent = `${currentIdx} of ${count}`;
      } else {
        elements.searchCount.textContent = `${count} found`;
      }
    } else {
      elements.searchCount.textContent = "No results";
    }
  }
}

/**
 * Opens the search widget
 * @param {boolean} replaceMode - Whether to open in replace mode
 */
export function openSearchWidget(replaceMode = false) {
  if (!elements.searchWidget) return;
  elements.searchWidget.classList.add("visible");

  if (replaceMode) {
    elements.searchWidget.classList.add("replace-mode");
    elements.searchReplaceRow.style.display = "flex";
  } else {
    elements.searchWidget.classList.remove("replace-mode");
    elements.searchReplaceRow.style.display = "none";
  }

  if (state.editor) {
    const selection = state.editor.getSelection();
    if (selection) {
      elements.searchFindInput.value = selection;
      updateSearchHighlights(selection);
      updateMatchStatus(selection);
    } else if (elements.searchFindInput.value) {
      updateSearchHighlights(elements.searchFindInput.value);
      updateMatchStatus(elements.searchFindInput.value);
    }
  }

  elements.searchFindInput.focus();
  elements.searchFindInput.select();
}

/**
 * Closes the search widget and clears highlights
 */
export function closeSearchWidget() {
  if (!elements.searchWidget) return;
  elements.searchWidget.classList.remove("visible");

  // Clear highlights
  if (state.editor && state.searchOverlay) {
    state.editor.removeOverlay(state.searchOverlay);
    state.searchOverlay = null;
  }
  // Clear active mark
  if (state.activeMatchMark) {
    state.activeMatchMark.clear();
    state.activeMatchMark = null;
  }

  if (elements.searchCount) elements.searchCount.textContent = "";

  if (state.editor) state.editor.focus();
}

/**
 * Finds next/previous occurrence of search query
 * @param {boolean} reverse - Whether to search backwards
 */
export function doFind(reverse = false) {
  if (!state.editor) return;
  const query = elements.searchFindInput.value;

  // Update highlights
  updateSearchHighlights(query);

  if (!query) {
    updateMatchStatus(""); // Clear status
    return;
  }

  // Determine start position based on direction and current selection
  const startPos = state.editor.getCursor(reverse ? "from" : "to");

  let cursor = state.editor.getSearchCursor(query, startPos, { caseFold: true });

  let found = false;

  if (reverse) {
    found = cursor.findPrevious();
  } else {
    found = cursor.findNext();
  }

  // Handle wrapping if not found
  if (!found) {
    const wrapStart = reverse
      ? { line: state.editor.lineCount(), ch: 0 }
      : { line: 0, ch: 0 };

    cursor = state.editor.getSearchCursor(query, wrapStart, { caseFold: true });

    if (reverse) {
      found = cursor.findPrevious();
    } else {
      found = cursor.findNext();
    }

    if (found) {
      showToast("Search wrapped", "info", 1000);
    }
  }

  if (found) {
    state.editor.setSelection(cursor.from(), cursor.to());
    state.editor.scrollIntoView({from: cursor.from(), to: cursor.to()}, 20);
  } else {
    showToast("No match found", "info", 1500);
  }

  // Update status/count AFTER selection is set
  updateMatchStatus(query);
}

/**
 * Replaces current match and finds next
 */
export function doReplace() {
  if (!state.editor) return;
  const query = elements.searchFindInput.value;
  const replacement = elements.searchReplaceInput.value;
  if (!query) return;

  // Check if current selection matches query
  const selection = state.editor.getSelection();
  if (selection && selection.toLowerCase() === query.toLowerCase()) {
    state.editor.replaceSelection(replacement);
    doFind(); // Find next
  } else {
    doFind(); // Find first
  }
  // Update count after replace
  updateMatchStatus(query);
}

/**
 * Replaces all occurrences of search query
 */
export function doReplaceAll() {
  if (!state.editor) return;
  const query = elements.searchFindInput.value;
  const replacement = elements.searchReplaceInput.value;
  if (!query) return;

  const cursor = state.editor.getSearchCursor(query, null, { caseFold: true });
  state.editor.operation(() => {
    let count = 0;
    while (cursor.findNext()) {
      cursor.replace(replacement);
      count++;
    }
    showToast(`Replaced ${count} occurrences`, "success");
    // Clear highlights/count since they are gone/changed
    updateSearchHighlights(query);
    updateMatchStatus(query);
  });
}
