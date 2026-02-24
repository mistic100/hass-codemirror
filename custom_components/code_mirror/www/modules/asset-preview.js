/**
 * ============================================================================
 * ASSET PREVIEW MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Handles preview rendering for non-code files including images, videos,
 * and markdown files. Provides specialized viewers for each file type with
 * appropriate controls and navigation.
 *
 * EXPORTED FUNCTIONS:
 * - registerAssetPreviewCallbacks(cb) - Register dependencies from app.js
 * - renderAssetPreview(tab) - Render preview for binary assets
 * - toggleMarkdownPreview() - Toggle markdown preview mode
 *
 * REQUIRED CALLBACKS (from app.js):
 * - openFile: Open a file
 * - closeTab: Close a tab
 * - downloadContent: Download file content
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new file type preview:
 *    - Add detection in renderAssetPreview() (check tab.isXXX or file extension)
 *    - Create new renderXXXPreview(tab, filename) function
 *    - Build HTML for the preview with toolbar and viewer
 *    - Add event listeners for controls
 *    - Follow existing patterns (image/video)
 *
 * 2. Adding image navigation controls:
 *    - Already implemented: previous/next buttons
 *    - Modify renderImagePreview() to add new controls
 *    - Filter files in same directory by extension
 *    - Use callbacks.openFile() to switch images
 *
 * 4. Enhancing markdown rendering:
 *    - Modify renderMarkdown() function
 *    - Add new regex patterns for syntax
 *    - Examples: tables, task lists, strikethrough, emojis
 *    - Or replace with full markdown library (marked.js, etc.)
 *
 * 5. Adding syntax highlighting to code blocks:
 *    - In renderMarkdown(), detect language in code blocks
 *    - Apply syntax highlighting library (Prism, highlight.js)
 *    - Add CSS classes for highlighting
 *
 * INTEGRATION POINTS:
 * - state.js: state.activeTab, state.editor, state.files
 * - elements: elements.assetPreview, elements.btnMarkdownPreview
 * - app.js: File opening and tab management
 * - tabs.js: Tab switching (markdown preview resets on tab switch)
 *
 * SUPPORTED FILE TYPES:
 * - Images: PNG, JPG, JPEG, GIF, BMP, WEBP, SVG, ICO
 * - Videos: MP4, WEBM, MOV, AVI, MKV, FLV, WMV, M4V
 * - Markdown: .md files (custom renderer)
 *
 * ARCHITECTURE NOTES:
 * - Uses elements.assetPreview panel for all previews
 * - Binary content is base64 encoded from server
 * - Markdown renderer is lightweight regex-based (no dependencies)
 * - Image navigation finds files in same directory
 * - All previews include download functionality
 *
 * COMMON PATTERNS:
 * - Set base64 data URL: `data:${tab.mimeType};base64,${tab.content}`
 * - Build toolbar HTML with controls
 * - Add event listeners with getElementById()
 * - Download: callbacks.downloadContent(filename, content, isBase64, mimeType)
 * - Navigation: Find neighbors, add prev/next buttons
 *
 * MARKDOWN PREVIEW:
 * - Toggles between editor and preview mode
 * - Uses same assetPreview panel as other types
 * - Renders markdown to HTML on-the-fly
 * - Button in toolbar toggles active state
 * - Preview updates from current editor content
 *
 * MARKDOWN SYNTAX SUPPORTED:
 * - Headers: # ## ###
 * - Bold: **text**
 * - Italic: *text*
 * - Code: `inline` and ```blocks```
 * - Links: [text](url)
 * - Lists: * or 1.
 * - Blockquotes: > text
 * - Horizontal rules: ---
 * - Auto paragraph wrapping
 *
 * ============================================================================
 */
import { state, elements } from './state.js';

// Callbacks for cross-module functions
let callbacks = {
  openFile: null,
  closeTab: null,
  downloadContent: null
};

export function registerAssetPreviewCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Renders preview for binary assets (images, videos)
 * @param {Object} tab - The tab object containing file data
 * @param {HTMLElement} container - The preview container element (optional, defaults to elements.assetPreview)
 */
export function renderAssetPreview(tab, container = null) {
  const previewContainer = container || elements.assetPreview;
  if (!previewContainer) return;

  // Temporarily swap elements.assetPreview to use the provided container
  const originalPreview = elements.assetPreview;
  elements.assetPreview = previewContainer;

  const filename = tab.path.split("/").pop();

  if (tab.isImage) {
    renderImagePreview(tab, filename);
  } else if (tab.isVideo) {
    renderVideoPreview(tab, filename);
  }

  // Restore original elements.assetPreview
  elements.assetPreview = originalPreview;
}

/**
 * Renders image preview with navigation
 */
function renderImagePreview(tab, filename) {
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg", ".ico"];
  let imageFiles = [];

  const currentDir = tab.path.substring(0, tab.path.lastIndexOf("/"));
  imageFiles = state.files
    .filter(f => {
      const fDir = f.path.substring(0, f.path.lastIndexOf("/"));
      const ext = "." + f.name.split(".").pop().toLowerCase();
      return fDir === currentDir && imageExtensions.includes(ext);
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));

  const currentIndex = imageFiles.findIndex(f => f.path === tab.path);
  const prevImage = currentIndex > 0 ? imageFiles[currentIndex - 1] : null;
  const nextImage = currentIndex < imageFiles.length - 1 ? imageFiles[currentIndex + 1] : null;

  elements.assetPreview.style.padding = "0";
  const dataUrl = `data:${tab.mimeType};base64,${tab.content}`;

  elements.assetPreview.innerHTML = `
    <div class="image-viewer-container" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg-tertiary);">
      <div class="image-viewer-toolbar" style="padding: 8px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--borderColor); display: flex; justify-content: space-between; align-items: center; height: 48px; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="material-icons" style="color: var(--accent-color);">image</span>
          <span style="font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;">${filename}</span>
          <span style="color: var(--text-secondary); font-size: 12px; margin-left: 8px;">${tab.mimeType}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <button id="img-prev" class="toolbar-btn" title="Previous Image" ${!prevImage ? 'disabled style="opacity: 0.5; cursor: default;"' : ''}>
              <span class="material-icons">chevron_left</span>
            </button>
            <span style="font-size: 13px; color: var(--text-secondary); min-width: 60px; text-align: center;">${currentIndex + 1} / ${imageFiles.length}</span>
            <button id="img-next" class="toolbar-btn" title="Next Image" ${!nextImage ? 'disabled style="opacity: 0.5; cursor: default;"' : ''}>
              <span class="material-icons">chevron_right</span>
            </button>
          </div>
          <div style="width: 1px; height: 24px; background: var(--borderColor);"></div>
          <button id="img-download" class="toolbar-btn" title="Download Image">
            <span class="material-icons">download</span>
          </button>
        </div>
      </div>
      <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; overflow: auto; padding: 20px; background: var(--bg-primary);">
        <div style="position: relative; max-width: 100%; max-height: 100%;">
          <img src="${dataUrl}" alt="${filename}" style="max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.3); background-image: linear-gradient(45deg, var(--bg-secondary) 25%, transparent 25%), linear-gradient(-45deg, var(--bg-secondary) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--bg-secondary) 75%), linear-gradient(-45deg, transparent 75%, var(--bg-secondary) 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px;">
        </div>
      </div>
    </div>
  `;

  if (prevImage) {
    document.getElementById("img-prev").addEventListener("click", () => {
      // Close current tab and open previous image (reuses tab slot)
      const currentTab = state.activeTab;
      if (callbacks.closeTab) callbacks.closeTab(currentTab);
      if (callbacks.openFile) callbacks.openFile(prevImage.path);
    });
  }

  if (nextImage) {
    document.getElementById("img-next").addEventListener("click", () => {
      // Close current tab and open next image (reuses tab slot)
      const currentTab = state.activeTab;
      if (callbacks.closeTab) callbacks.closeTab(currentTab);
      if (callbacks.openFile) callbacks.openFile(nextImage.path);
    });
  }

  document.getElementById("img-download").addEventListener("click", () => {
    // Use downloadContent to download from tab content instead of server
    if (callbacks.downloadContent) {
      callbacks.downloadContent(filename, tab.content, true, tab.mimeType);
    }
  });

  // Keyboard navigation
  const handleKeyNav = (e) => {
    if (!document.body.contains(elements.assetPreview)) {
      document.removeEventListener("keydown", handleKeyNav);
      return;
    }
    if (e.key === "ArrowLeft" && prevImage) {
      const currentTab = state.activeTab;
      if (callbacks.closeTab) callbacks.closeTab(currentTab);
      if (callbacks.openFile) callbacks.openFile(prevImage.path);
    }
    if (e.key === "ArrowRight" && nextImage) {
      const currentTab = state.activeTab;
      if (callbacks.closeTab) callbacks.closeTab(currentTab);
      if (callbacks.openFile) callbacks.openFile(nextImage.path);
    }
  };
  // Remove any existing listener to prevent duplicates
  document.addEventListener("keydown", handleKeyNav, { once: true });
}

/**
 * Renders video preview with controls
 */
function renderVideoPreview(tab, filename) {
  elements.assetPreview.style.padding = "0";
  const dataUrl = `data:${tab.mimeType};base64,${tab.content}`;

  elements.assetPreview.innerHTML = `
    <div class="video-viewer-container" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg-tertiary);">
      <div class="video-viewer-toolbar" style="padding: 8px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--borderColor); display: flex; justify-content: space-between; align-items: center; height: 48px; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="material-icons" style="color: var(--accent-color);">movie</span>
          <span style="font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px;">${filename}</span>
          <span style="color: var(--text-secondary); font-size: 12px; margin-left: 8px;">${tab.mimeType}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <button id="video-download" class="toolbar-btn" title="Download Video">
            <span class="material-icons">download</span>
          </button>
        </div>
      </div>
      <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--bg-primary);">
        <video
          controls
          preload="metadata"
          style="max-width: 100%; max-height: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.3); background: #000;">
          <source src="${dataUrl}" type="${tab.mimeType}">
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  `;

  document.getElementById("video-download").addEventListener("click", () => {
    if (callbacks.downloadContent) {
      callbacks.downloadContent(filename, tab.content, true, tab.mimeType);
    }
  });
}

/**
 * Renders markdown text to HTML using marked.js (GitHub Flavored Markdown)
 * @param {string} text - Markdown text to render
 * @returns {string} HTML string
 */
function renderMarkdown(text) {
  if (!text) return "";

  // Check if marked.js is loaded
  if (typeof marked === 'undefined') {
    console.error('marked.js is not loaded');
    return '<p>Error: Markdown library not loaded</p>';
  }

  try {
    // Configure marked for GitHub Flavored Markdown
    marked.setOptions({
      gfm: true,              // GitHub Flavored Markdown
      breaks: true,           // GFM line breaks
      headerIds: true,        // Add IDs to headers
      mangle: false,          // Don't mangle email addresses
      sanitize: false,        // Don't sanitize HTML (we trust the content)
      smartLists: true,       // Use smarter list behavior
      smartypants: false,     // Don't use smart typography
      xhtml: false            // Don't use XHTML tags
    });

    // Render markdown to HTML
    const html = marked.parse(text);

    return html;
  } catch (error) {
    console.error('Markdown rendering error:', error);
    return `<pre>${text}</pre>`;
  }
}

/**
 * Toggles markdown preview mode for .md files
 */
export function toggleMarkdownPreview() {
  if (!state.activeTab || !state.activeTab.path.endsWith(".md")) return;

  const isPreview = elements.btnMarkdownPreview.classList.toggle("active");

  if (isPreview) {
    // Show Preview
    if (state.editor) {
      state.editor.getWrapperElement().style.display = "none";
    }
    if (elements.assetPreview) {
      elements.assetPreview.classList.add("visible");
      const content = state.editor ? state.editor.getValue() : state.activeTab.content;
      elements.assetPreview.innerHTML = `<div class="markdown-body">${renderMarkdown(content)}</div>`;
    }
  } else {
    // Show Editor
    if (elements.assetPreview) {
      elements.assetPreview.classList.remove("visible");
      elements.assetPreview.innerHTML = "";
    }
    if (state.editor) {
      state.editor.getWrapperElement().style.display = "block";
      state.editor.refresh();
      state.editor.focus();
    }
  }
}
