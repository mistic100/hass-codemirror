/**
 * ============================================================================
 * UTILS MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Collection of utility/helper functions used throughout Blueprint Studio.
 * Provides common operations for file handling, formatting, validation,
 * mobile detection, and other shared functionality.
 *
 * EXPORTED FUNCTIONS:
 * File Utilities:
 * - isTextFile(filename) - Check if file is editable text
 * - getFileIcon(filename) - Get Material icon for file type
 * - formatBytes(bytes) - Format file size human-readable
 * - getFileExtension(filename) - Get file extension
 *
 * Mobile/Responsive:
 * - isMobile() - Check if mobile device
 * - isTouchDevice() - Check if touch-enabled
 *
 * Color Utilities:
 * - lightenColor(color, percent) - Lighten color by percentage
 * - darkenColor(color, percent) - Darken color by percentage
 * - hexToRgb(hex) - Convert hex to RGB
 * - rgbToHex(r, g, b) - Convert RGB to hex
 *
 * String Utilities:
 * - escapeHtml(text) - Escape HTML special characters
 * - truncate(text, length) - Truncate string
 * - slugify(text) - Convert to URL-safe slug
 *
 * Validation:
 * - isValidPath(path) - Validate file path
 * - isValidEmail(email) - Validate email format
 *
 * Other:
 * - debounce(func, wait) - Debounce function calls
 * - copyToClipboard(text) - Copy text to clipboard
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new utility function:
 *    - Create pure function (no side effects)
 *    - Export as named export
 *    - Add JSDoc comment
 *    - Group with similar functions
 *    - Example: export function formatDate(date) { ... }
 *
 * 2. Adding file type detection:
 *    - Add extension to TEXT_FILE_EXTENSIONS in constants.js
 *    - Or add special case in isTextFile()
 *    - Update getFileIcon() if needs custom icon
 *
 * 3. Adding file icons:
 *    - Modify getFileIcon() switch statement
 *    - Use Material Icons names
 *    - Group by file type
 *    - Example: case 'pdf': return 'picture_as_pdf'
 *
 * 4. Adding color utilities:
 *    - Add color manipulation functions
 *    - Work with hex or RGB
 *    - Return in same format as input
 *    - Example: adjustHue(), saturate(), etc.
 *
 * 5. Adding validation functions:
 *    - Create is* or validate* function
 *    - Return boolean
 *    - Use regex or validation library
 *    - Example: isValidUrl(), isValidJson()
 *
 * INTEGRATION POINTS:
 * - file-tree.js: Uses getFileIcon, formatBytes
 * - ui.js: Uses color utilities
 * - All modules: Use various utilities
 * - constants.js: File extension lists
 *
 * FILE TYPE DETECTION:
 * - Checks file extension
 * - Special case for .storage/ files
 * - Extensionless files detected by name
 * - Used to determine editor vs preview
 *
 * FILE ICONS:
 * - Maps extensions to Material Icons
 * - Default icon for unknown types
 * - Consistent visual language
 * - Easy to extend
 *
 * ARCHITECTURE NOTES:
 * - All functions are pure (no side effects)
 * - No state dependencies
 * - Reusable across modules
 * - Easy to test
 * - No DOM manipulation here
 *
 * COMMON PATTERNS:
 * - Check file type: if (isTextFile(path)) { openInEditor() }
 * - Get icon: `<span class="material-icons">${getFileIcon(filename)}</span>`
 * - Format size: `${formatBytes(file.size)}`
 * - Mobile check: if (isMobile()) { showMobileLayout() }
 * - Color manipulation: lightenColor("#3498db", 20)
 * - Escape HTML: element.innerHTML = escapeHtml(userInput)
 *
 * BEST PRACTICES:
 * - Keep functions small and focused
 * - Document parameters and return values
 * - Handle edge cases (null, undefined, empty)
 * - Use consistent naming conventions
 * - Avoid side effects
 *
 * ============================================================================
 */
import { MOBILE_BREAKPOINT, TEXT_FILE_EXTENSIONS } from './constants.js';

/**
 * ============================================================================
 * PERFORMANCE UTILITIES
 * ============================================================================
 */

/**
 * Debounce function - delays execution until after wait time has elapsed since last call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - ensures function is called at most once per wait period
 * @param {Function} func - Function to throttle
 * @param {number} wait - Milliseconds to wait between calls
 * @returns {Function} Throttled function
 */
export function throttle(func, wait) {
  let timeout;
  let previous = 0;

  return function executedFunction(...args) {
    const now = Date.now();
    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func(...args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func(...args);
      }, remaining);
    }
  };
}

/**
 * Request Animation Frame throttle - calls function on next animation frame
 * @param {Function} func - Function to throttle
 * @returns {Function} RAF-throttled function
 */
export function rafThrottle(func) {
  let rafId = null;

  return function executedFunction(...args) {
    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      func(...args);
      rafId = null;
    });
  };
}

/**
 * Memoize function results - caches return values based on arguments
 * @param {Function} func - Function to memoize
 * @returns {Function} Memoized function
 */
export function memoize(func) {
  const cache = new Map();

  return function memoized(...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = func(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Cached regex compilation - prevents recompiling same patterns
 * @param {string} pattern - Regex pattern
 * @param {string} flags - Regex flags (g, i, m, etc.)
 * @returns {RegExp} Compiled and cached regex
 */
export function getCachedRegex(pattern, flags = '') {
  const key = `${pattern}:::${flags}`;

  if (!window._regexCache) {
    window._regexCache = new Map();
  }

  if (!window._regexCache.has(key)) {
    try {
      window._regexCache.set(key, new RegExp(pattern, flags));
    } catch (e) {
      console.error('Invalid regex pattern:', pattern, e);
      return null;
    }
  }

  return window._regexCache.get(key);
}

/**
 * Clear regex cache (useful for memory management)
 */
export function clearRegexCache() {
  if (window._regexCache) {
    window._regexCache.clear();
  }
}

/**
 * ============================================================================
 * FILE UTILITIES
 * ============================================================================
 */

export function isTextFile(filename) {
  if (!filename) return false;
  if (filename.includes(".storage/") || filename.startsWith(".storage/")) return true;
  const ext = filename.split(".").pop().toLowerCase();
  // Using a local copy of extensions for now or passing it
  const extensions = new Set([
    "yaml", "yml", "json", "py", "js", "css", "html", "txt",
    "md", "conf", "cfg", "ini", "sh", "log", "svg", "jinja", "jinja2", "j2",
    "pem", "crt", "key", "cpp", "h", "gitignore", "lock"
  ]);
  return extensions.has(ext);
}

export function isMobile() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function lightenColor(hex, percent) {
  if (!hex) return hex;
  const num = parseInt(hex.replace("#", ""), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = (num >> 8 & 0x00FF) + amt,
    B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

export async function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Lazy-load Diff/Merge libraries
export async function ensureDiffLibrariesLoaded(showGlobalLoading, hideGlobalLoading) {
  if (window.diff_match_patch && CodeMirror.MergeView) return;
  
  if (showGlobalLoading) showGlobalLoading("Initializing Diff viewer...");
  try {
      if (!window.diff_match_patch) {
          await loadScript("https://cdnjs.cloudflare.com/ajax/libs/diff_match_patch/20121119/diff_match_patch.js");
      }
      if (!CodeMirror.MergeView) {
          await loadScript("https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/merge/merge.min.js");
      }
  } catch (e) {
      console.error("Failed to load Diff libraries", e);
      throw new Error("Could not load Diff components. Please check your internet connection.");
  } finally {
      if (hideGlobalLoading) hideGlobalLoading();
  }
}

// Memoized file icon lookup (theme support reverted)
function _getFileIcon(filename) {
  // Home Assistant .storage entries are JSON
  if (filename && (filename.includes(".storage/") || filename.startsWith(".storage/"))) {
    return { icon: "data_object", class: "json" };
  }

  const ext = filename ? filename.split(".").pop().toLowerCase() : "";

  switch (ext) {
    case "yaml":
    case "yml":
      return { icon: "description", class: "yaml" };
    case "json":
      return { icon: "data_object", class: "json" };
    case "py":
      return { icon: "code", class: "python" };
    case "js":
      return { icon: "javascript", class: "js" };
    case "css":
      return { icon: "style", class: "default" };
    case "html":
      return { icon: "html", class: "default" };
    case "md":
      return { icon: "article", class: "default" };
    case "txt":
      return { icon: "text_snippet", class: "default" };
    case "log":
      return { icon: "receipt_long", class: "default" };
    case "sh":
      return { icon: "terminal", class: "default" };
    case "conf":
    case "cfg":
    case "ini":
      return { icon: "settings", class: "default" };
    case "jinja":
    case "jinja2":
    case "j2":
      return { icon: "integration_instructions", class: "default" };
    case "db":
    case "sqlite":
      return { icon: "storage", class: "default" };
    case "pem":
    case "crt":
    case "der":
      return { icon: "verified_user", class: "default" };
    case "key":
      return { icon: "vpn_key", class: "default" };
    case "bin":
      return { icon: "memory", class: "default" };
    case "zip":
    case "tar":
    case "gz":
      return { icon: "archive", class: "default" };
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "svg":
    case "webp":
      return { icon: "image", class: "default" };
    case "pdf":
      return { icon: "picture_as_pdf", class: "default" };
    default:
      return { icon: "insert_drive_file", class: "default" };
  }
}

export const getFileIcon = memoize(_getFileIcon);

export function getEditorMode(filename) {
    if (!filename) return null;
    if (filename.includes(".storage/") || filename.startsWith(".storage/")) {
        return { name: "javascript", json: true };
    }
    const ext = filename.split(".").pop().toLowerCase();

    // Toggle for custom HA YAML mode
    const yamlMode = "ha-yaml";

    const modeMap = {
      yaml: yamlMode,
      yml: yamlMode,
      json: { name: "javascript", json: true },
      py: "python",
      js: "javascript",
      css: "css",
      html: "htmlmixed",
      md: "markdown",
      sh: "shell",
      txt: null,
      log: null,
      conf: yamlMode,
      cfg: yamlMode,
      ini: "yaml",
      jinja: yamlMode,
      jinja2: yamlMode,
      j2: yamlMode,
      db: null,
      sqlite: null,
      pem: null,
      crt: null,
      key: null,
      der: null,
      bin: null,
      ota: null,
      cpp: "text/x-c++src",
      h: "text/x-c++src",
      tar: null,
      gz: null,
      gitignore: yamlMode,
      lock: null,
    };
    return modeMap[ext] || null;
}

export function getLanguageName(filename) {
    if (!filename) return "Plain Text";
    const ext = filename.split(".").pop().toLowerCase();
    const nameMap = {
      yaml: "YAML",
      yml: "YAML",
      json: "JSON",
      py: "Python",
      js: "JavaScript",
      css: "CSS",
      html: "HTML",
      md: "Markdown",
      sh: "Shell",
      txt: "Plain Text",
      log: "Log",
      conf: "Config",
      cfg: "Config",
      ini: "INI",
      jinja: "Jinja",
      jinja2: "Jinja2",
      j2: "Jinja",
      db: "Database",
      sqlite: "Database",
      pem: "Certificate",
      crt: "Certificate",
      key: "Key",
      der: "Binary Certificate",
      bin: "Binary",
      ota: "OTA Firmware",
      cpp: "C++",
      h: "C/C++ Header",
      tar: "Tar Archive",
      gz: "Gzip Archive",
      gitignore: "Git Ignore",
      lock: "Lock File",
    };
    return nameMap[ext] || "Plain Text";
}



