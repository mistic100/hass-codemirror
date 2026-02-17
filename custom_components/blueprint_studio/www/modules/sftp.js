/**
 * ============================================================================
 * SFTP MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Provides SFTP connection management and remote file browsing/editing.
 * Renders an SFTP panel in the Explorer sidebar BELOW the local file tree.
 * Remote files open in regular CodeMirror tabs with sftp://<connId>/<path>
 * virtual paths. The context menu mirrors the local file tree: New File,
 * New Folder, Rename, Download, Delete.
 *
 * EXPORTED FUNCTIONS:
 * - registerSftpCallbacks(cb)         Register dependencies from app.js
 * - renderSftpPanel()                 Render connections + file tree
 * - connectToServer(connId)           Load remote root directory
 * - navigateSftp(connId, path)        Navigate into a subdirectory
 * - openSftpFile(connId, path)        Fetch content and open in tab
 * - isSftpPath(path)                  Returns true if path starts with sftp://
 * - parseSftpPath(path)               Returns { connId, remotePath }
 * - saveSftpFile(tab, content)        Write content back to remote
 * - showAddConnectionDialog()         Show modal for adding a connection
 * - showEditConnectionDialog(connId)  Show modal for editing a connection
 * - deleteConnection(connId)          Remove a saved connection
 * - initSftpPanelButtons()            Wire static panel header buttons
 * ============================================================================
 */

import { state } from './state.js';
import { getFileIcon, formatBytes } from './utils.js';

// Callbacks registered by app.js
let callbacks = {
  fetchWithAuth: null,
  API_BASE: null,
  showToast: null,
  openTab: null,
  saveSettings: null,
};

export function registerSftpCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

// ─── Visibility ───────────────────────────────────────────────────────────────

/** Show or hide the entire SFTP panel + resize handle based on the integration toggle. */
export function applySftpVisibility() {
  const enabled = state.sftpIntegrationEnabled;
  const panel       = document.getElementById('sftp-panel');
  const resizeHandle = document.getElementById('sftp-resize-handle');
  if (panel) panel.style.display = enabled ? '' : 'none';
  // Only show resize handle when both enabled AND local tree is visible
  if (resizeHandle) resizeHandle.style.display = (enabled && !state.fileTreeCollapsed && !state.sftpPanelCollapsed) ? '' : 'none';
  // If disabling, also clear active session so it doesn't linger
  if (!enabled) {
    state.activeSftp.connectionId = null;
    state.activeSftp.loading = false;
  }
}

// ─── Path Helpers ─────────────────────────────────────────────────────────────

/** True if path is an SFTP virtual path. */
export function isSftpPath(path) {
  return typeof path === 'string' && path.startsWith('sftp://');
}

/**
 * Parse an SFTP virtual path.
 * @param {string} path  e.g. "sftp://my-conn-id/remote/path/file.yaml"
 * @returns {{ connId: string, remotePath: string }}
 */
export function parseSftpPath(path) {
  const withoutScheme = path.slice('sftp://'.length);
  const slashIdx = withoutScheme.indexOf('/');
  if (slashIdx === -1) return { connId: withoutScheme, remotePath: '/' };
  return {
    connId: withoutScheme.slice(0, slashIdx),
    remotePath: withoutScheme.slice(slashIdx),
  };
}

function buildSftpPath(connId, remotePath) {
  return `sftp://${connId}${remotePath}`;
}

function findConnection(connId) {
  return state.sftpConnections.find(c => c.id === connId) || null;
}

function buildAuth(conn) {
  if (conn.authType === 'key') {
    return { type: 'key', private_key: conn.privateKey || '', passphrase: conn.privateKeyPassphrase || '' };
  }
  return { type: 'password', password: conn.password || '' };
}

function _escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function joinRemotePath(dir, name) {
  const base = dir === '/' ? '' : dir.replace(/\/$/, '');
  return base + '/' + name;
}

/** Call an SFTP action on the backend. */
async function callSftpApi(action, conn, extra = {}) {
  const { fetchWithAuth, API_BASE } = callbacks;
  return fetchWithAuth(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      connection: {
        host: conn.host,
        port: conn.port || 22,
        username: conn.username,
        auth: buildAuth(conn),
      },
      ...extra,
    }),
  });
}

// ─── Panel Rendering ──────────────────────────────────────────────────────────

export function renderSftpPanel() {
  const listEl   = document.getElementById('sftp-connections-list');
  const breadcrumbEl = document.getElementById('sftp-breadcrumb');
  const treeEl   = document.getElementById('sftp-file-tree');
  const panelBody = document.getElementById('sftp-panel-body');
  const collapseBtn = document.getElementById('btn-sftp-collapse');

  if (!listEl) return;

  // Collapsed state
  const resizeHandle = document.getElementById('sftp-resize-handle');
  if (state.sftpPanelCollapsed) {
    if (panelBody) panelBody.style.display = 'none';
    if (resizeHandle) resizeHandle.style.display = 'none';
    if (collapseBtn) collapseBtn.querySelector('.material-icons').textContent = 'expand_more';
    return;
  }
  if (panelBody) panelBody.style.display = '';
  // When local file tree is collapsed the SFTP panel fills all remaining space
  if (state.fileTreeCollapsed) {
    if (panelBody) { panelBody.style.height = 'auto'; panelBody.style.flex = '1'; }
  } else {
    if (panelBody) { panelBody.style.height = `${state.sftpPanelHeight || 300}px`; panelBody.style.flex = ''; }
  }
  if (resizeHandle && !state.fileTreeCollapsed) resizeHandle.style.display = '';
  if (collapseBtn) collapseBtn.querySelector('.material-icons').textContent = 'expand_less';

  // ── Connections list ──────────────────────────────────────────────────────
  listEl.innerHTML = '';
  if (state.sftpConnections.length === 0) {
    listEl.innerHTML = '<div class="sftp-connection-item" style="color:var(--text-secondary);font-style:italic;cursor:default">No connections. Click + to add one.</div>';
  } else {
    state.sftpConnections.forEach(conn => {
      const isActive = state.activeSftp.connectionId === conn.id;
      const item = document.createElement('div');
      item.className = `sftp-connection-item${isActive ? ' active' : ''}`;
      item.innerHTML = `
        <span class="material-icons" style="font-size:16px;color:var(--accent-color)">dns</span>
        <span class="sftp-conn-label">${_escapeHtml(conn.name)}</span>
        <span style="font-size:11px;color:var(--text-secondary);margin-left:2px">${_escapeHtml(conn.host)}</span>
        <div class="sftp-connection-actions">
          <button class="git-panel-btn sftp-btn-edit" data-id="${conn.id}" title="Edit connection">
            <span class="material-icons" style="font-size:16px">edit</span>
          </button>
          <button class="git-panel-btn sftp-btn-delete" data-id="${conn.id}" title="Remove connection">
            <span class="material-icons" style="font-size:16px">delete_outline</span>
          </button>
        </div>`;

      item.querySelector('.sftp-conn-label').addEventListener('click', () => connectToServer(conn.id));
      item.querySelector('.sftp-btn-edit').addEventListener('click', e => { e.stopPropagation(); showEditConnectionDialog(conn.id); });
      item.querySelector('.sftp-btn-delete').addEventListener('click', e => { e.stopPropagation(); deleteConnection(conn.id); });
      listEl.appendChild(item);
    });
  }

  // ── File tree (only when a connection is active) ──────────────────────────
  const { connectionId, currentPath, folders, files, loading } = state.activeSftp;
  if (!connectionId) {
    if (breadcrumbEl) breadcrumbEl.style.display = 'none';
    if (treeEl) { treeEl.style.display = 'none'; treeEl.innerHTML = ''; }
    return;
  }

  // Breadcrumb
  if (breadcrumbEl) {
    breadcrumbEl.style.display = 'flex';
    _renderBreadcrumb(breadcrumbEl, connectionId, currentPath);
  }

  // Tree
  if (!treeEl) return;
  treeEl.style.display = '';
  if (loading) {
    treeEl.innerHTML = '<div class="tree-item" style="--depth:0;color:var(--text-secondary)"><div class="tree-icon default"><span class="material-icons loading-spinner">sync</span></div><span class="tree-name">Loading...</span></div>';
    return;
  }

  treeEl.innerHTML = '';

  // Right-click on the empty tree area → context menu for current directory
  treeEl.addEventListener('contextmenu', e => {
    if (e.target === treeEl || e.target.closest('.sftp-tree-item') === null) {
      e.preventDefault();
      _showDirContextMenu(e.clientX, e.clientY, connectionId, currentPath);
    }
  });

  // Back row (if not at root)
  if (currentPath && currentPath !== '/') {
    const backItem = document.createElement('div');
    backItem.className = 'tree-item';
    backItem.style.setProperty('--depth', 0);
    backItem.innerHTML = `
      <div class="tree-icon folder"><span class="material-icons">arrow_back</span></div>
      <span class="tree-name">..</span>`;
    backItem.addEventListener('click', () => {
      const parent = currentPath.replace(/\/[^/]+\/?$/, '') || '/';
      navigateSftp(connectionId, parent);
    });
    treeEl.appendChild(backItem);
  }

  folders.forEach(folder => {
    const el = document.createElement('div');
    el.className = 'tree-item';
    el.style.setProperty('--depth', 0);
    el.dataset.path = folder.path;
    el.innerHTML = `
      <div class="tree-icon folder"><span class="material-icons">folder</span></div>
      <span class="tree-name">${_escapeHtml(folder.name)}</span>`;
    el.addEventListener('click', () => navigateSftp(connectionId, folder.path));
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      _showItemContextMenu(e.clientX, e.clientY, connectionId, folder.path, true);
    });
    treeEl.appendChild(el);
  });

  files.forEach(file => {
    const el = document.createElement('div');
    el.className = 'tree-item';
    el.style.setProperty('--depth', 0);
    el.dataset.path = file.path;
    const canOpen = file.is_text !== false;
    if (!canOpen) el.style.opacity = '0.55';
    el.title = canOpen ? '' : 'Binary file – cannot open in editor';
    const fileIcon = getFileIcon(file.name);
    el.innerHTML = `
      <div class="tree-icon ${fileIcon.class}"><span class="material-icons">${fileIcon.icon}</span></div>
      <span class="tree-name">${_escapeHtml(file.name)}</span>
      ${typeof file.size === 'number' ? `<span class="tree-file-size" style="font-size:11px;color:var(--text-muted);margin-left:8px;flex-shrink:0">${formatBytes(file.size, 0)}</span>` : ''}`;
    if (canOpen) {
      el.addEventListener('click', () => openSftpFile(connectionId, file.path));
    }
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      _showItemContextMenu(e.clientX, e.clientY, connectionId, file.path, false);
    });
    treeEl.appendChild(el);
  });

  if (folders.length === 0 && files.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tree-item';
    empty.style.cssText = '--depth:0;color:var(--text-secondary)';
    empty.innerHTML = '<span class="tree-name" style="font-style:italic">(empty directory)</span>';
    treeEl.appendChild(empty);
  }
}

function _renderBreadcrumb(el, connId, remotePath) {
  const conn = findConnection(connId);
  const connName = conn ? conn.name : connId;
  const parts = remotePath.split('/').filter(Boolean);
  let html = `<span class="sftp-crumb" data-path="/" style="cursor:pointer">${_escapeHtml(connName)}</span>`;
  let built = '';
  parts.forEach(part => {
    built += '/' + part;
    const p = built;
    html += `<span class="material-icons" style="font-size:12px">chevron_right</span>
             <span class="sftp-crumb" data-path="${_escapeHtml(p)}" style="cursor:pointer">${_escapeHtml(part)}</span>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.sftp-crumb').forEach(crumb => {
    crumb.addEventListener('click', () => navigateSftp(connId, crumb.dataset.path));
  });
}

// ─── Connection Actions ───────────────────────────────────────────────────────

export async function connectToServer(connId) {
  const conn = findConnection(connId);
  if (!conn) return;

  if (!sessionStorage.getItem('sftpWarningShown')) {
    callbacks.showToast('ℹ️ SFTP: Host keys are auto-accepted on first connect. Use trusted networks only.', 'info');
    sessionStorage.setItem('sftpWarningShown', '1');
  }

  state.activeSftp.connectionId = connId;
  state.activeSftp.currentPath = '/';
  state.activeSftp.navigationHistory = [];
  state.activeSftp.folders = [];
  state.activeSftp.files = [];
  state.activeSftp.loading = true;
  renderSftpPanel();

  try {
    const result = await callSftpApi('sftp_list', conn, { path: '/' });
    if (result.success) {
      state.activeSftp.folders = result.folders || [];
      state.activeSftp.files   = result.files   || [];
    } else {
      callbacks.showToast(`SFTP: ${result.message}`, 'error');
      state.activeSftp.connectionId = null;
    }
  } catch (err) {
    callbacks.showToast(`SFTP: ${err.message}`, 'error');
    state.activeSftp.connectionId = null;
  } finally {
    state.activeSftp.loading = false;
    renderSftpPanel();
  }
}

export async function navigateSftp(connId, path) {
  const conn = findConnection(connId);
  if (!conn) return;

  state.activeSftp.navigationHistory.push(state.activeSftp.currentPath);
  state.activeSftp.currentPath = path;
  state.activeSftp.loading = true;
  renderSftpPanel();

  try {
    const result = await callSftpApi('sftp_list', conn, { path });
    if (result.success) {
      state.activeSftp.folders = result.folders || [];
      state.activeSftp.files   = result.files   || [];
    } else {
      callbacks.showToast(`SFTP: ${result.message}`, 'error');
      state.activeSftp.currentPath = state.activeSftp.navigationHistory.pop() || '/';
    }
  } catch (err) {
    callbacks.showToast(`SFTP: ${err.message}`, 'error');
    state.activeSftp.currentPath = state.activeSftp.navigationHistory.pop() || '/';
  } finally {
    state.activeSftp.loading = false;
    renderSftpPanel();
  }
}

export async function openSftpFile(connId, remotePath) {
  const conn = findConnection(connId);
  if (!conn) return;

  const virtualPath = buildSftpPath(connId, remotePath);
  const fileName = remotePath.split('/').pop();

  const existingTab = state.openTabs.find(t => t.path === virtualPath);
  if (existingTab) {
    if (callbacks.openTab) callbacks.openTab(existingTab);
    return;
  }

  callbacks.showToast(`Opening ${fileName}…`, 'info');
  try {
    const result = await callSftpApi('sftp_read', conn, { path: remotePath });
    if (!result.success) {
      callbacks.showToast(`SFTP read failed: ${result.message}`, 'error');
      return;
    }
    const content = result.content || '';
    const tab = {
      path: virtualPath,
      name: fileName,
      content,
      originalContent: content,
      modified: false,
      cursor: null,
      scroll: null,
    };
    if (callbacks.openTab) callbacks.openTab(tab);
  } catch (err) {
    callbacks.showToast(`SFTP: ${err.message}`, 'error');
  }
}

export async function saveSftpFile(tab, content) {
  const { connId, remotePath } = parseSftpPath(tab.path);
  const conn = findConnection(connId);
  if (!conn) {
    callbacks.showToast('SFTP: Connection not found', 'error');
    return false;
  }
  try {
    const result = await callSftpApi('sftp_write', conn, { path: remotePath, content });
    if (result.success) {
      callbacks.showToast(`Saved ${tab.name} (remote)`, 'success');
      tab.modified = false;
      tab.originalContent = content;
      return true;
    } else {
      callbacks.showToast(`SFTP save failed: ${result.message}`, 'error');
      return false;
    }
  } catch (err) {
    callbacks.showToast(`SFTP: ${err.message}`, 'error');
    return false;
  }
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

let _ctxMenu = null;

function _dismissCtxMenu() {
  if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
  document.removeEventListener('click', _dismissCtxMenu, true);
  document.removeEventListener('contextmenu', _dismissCtxMenu, true);
}

function _positionMenu(menu, x, y) {
  document.body.appendChild(menu);
  const rect  = menu.getBoundingClientRect();
  const winW  = window.innerWidth;
  const winH  = window.innerHeight;
  menu.style.left = `${Math.min(x, winW - rect.width  - 8)}px`;
  menu.style.top  = `${Math.min(y, winH - rect.height - 8)}px`;
  // Dismiss on next click anywhere
  setTimeout(() => {
    document.addEventListener('click',       _dismissCtxMenu, true);
    document.addEventListener('contextmenu', _dismissCtxMenu, true);
  }, 50);
}

function _makeMenu(items) {
  _dismissCtxMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu visible';
  menu.id = 'sftp-ctx-menu';
  menu.style.cssText = 'position:fixed;z-index:9999;';
  items.forEach(item => {
    if (item === 'divider') {
      const d = document.createElement('div');
      d.className = 'context-menu-divider';
      menu.appendChild(d);
      return;
    }
    const el = document.createElement('div');
    el.className = `context-menu-item${item.danger ? ' danger' : ''}`;
    el.innerHTML = `<span class="material-icons">${item.icon}</span>${_escapeHtml(item.label)}`;
    el.addEventListener('click', () => { _dismissCtxMenu(); item.action(); });
    menu.appendChild(el);
  });
  _ctxMenu = menu;
  return menu;
}

/** Context menu when right-clicking a file or folder. */
function _showItemContextMenu(x, y, connId, remotePath, isFolder) {
  const name = remotePath.split('/').pop();
  const items = [];

  if (isFolder) {
    items.push({ icon: 'note_add',           label: 'New File',   action: () => _promptNewFile(connId, remotePath) });
    items.push({ icon: 'create_new_folder',  label: 'New Folder', action: () => _promptNewFolder(connId, remotePath) });
    items.push('divider');
  } else {
    items.push({ icon: 'download', label: 'Download', action: () => _downloadFile(connId, remotePath) });
    items.push('divider');
  }

  items.push({ icon: 'drive_file_rename_outline', label: 'Rename', action: () => _promptRename(connId, remotePath, name) });
  items.push('divider');
  items.push({ icon: 'delete',  label: 'Delete', danger: true, action: () => _promptDelete(connId, remotePath, isFolder) });

  _positionMenu(_makeMenu(items), x, y);
}

/** Context menu when right-clicking empty space in the current directory. */
function _showDirContextMenu(x, y, connId, dirPath) {
  const items = [
    { icon: 'note_add',          label: 'New File',   action: () => _promptNewFile(connId, dirPath) },
    { icon: 'create_new_folder', label: 'New Folder', action: () => _promptNewFolder(connId, dirPath) },
  ];
  _positionMenu(_makeMenu(items), x, y);
}

// ─── File Operations ──────────────────────────────────────────────────────────

async function _promptNewFile(connId, dirPath) {
  const conn = findConnection(connId);
  if (!conn) return;

  const name = window.prompt('New file name:', 'new_file.yaml');
  if (!name || !name.trim()) return;
  const remotePath = joinRemotePath(dirPath, name.trim());

  const result = await callSftpApi('sftp_create', conn, { path: remotePath, content: '' });
  if (result.success) {
    callbacks.showToast(`Created ${name}`, 'success');
    await _refreshCurrentDir(connId);
    // Open the new file in the editor
    await openSftpFile(connId, remotePath);
  } else {
    callbacks.showToast(`Create failed: ${result.message}`, 'error');
  }
}

async function _promptNewFolder(connId, dirPath) {
  const conn = findConnection(connId);
  if (!conn) return;

  const name = window.prompt('New folder name:');
  if (!name || !name.trim()) return;
  const remotePath = joinRemotePath(dirPath, name.trim());

  const result = await callSftpApi('sftp_mkdir', conn, { path: remotePath });
  if (result.success) {
    callbacks.showToast(`Created folder ${name}`, 'success');
    await _refreshCurrentDir(connId);
  } else {
    callbacks.showToast(`Mkdir failed: ${result.message}`, 'error');
  }
}

async function _promptRename(connId, remotePath, oldName) {
  const conn = findConnection(connId);
  if (!conn) return;

  const newName = window.prompt('Rename to:', oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;

  const dir  = remotePath.replace(/\/[^/]+$/, '') || '/';
  const dest = joinRemotePath(dir, newName.trim());

  const result = await callSftpApi('sftp_rename', conn, { source: remotePath, destination: dest });
  if (result.success) {
    callbacks.showToast(`Renamed to ${newName}`, 'success');
    // If open in editor, close old tab (path changed) — user can reopen
    const virtualOld = buildSftpPath(connId, remotePath);
    const oldTab = state.openTabs.find(t => t.path === virtualOld);
    if (oldTab) {
      // Update the tab's path and name in-place
      oldTab.path = buildSftpPath(connId, dest);
      oldTab.name = newName.trim();
    }
    await _refreshCurrentDir(connId);
  } else {
    callbacks.showToast(`Rename failed: ${result.message}`, 'error');
  }
}

async function _promptDelete(connId, remotePath, isFolder) {
  const name = remotePath.split('/').pop();
  if (!confirm(`Delete "${name}"?${isFolder ? '\n\nFolder must be empty.' : ''}`)) return;

  const conn = findConnection(connId);
  if (!conn) return;

  const result = await callSftpApi('sftp_delete', conn, { path: remotePath });
  if (result.success) {
    callbacks.showToast(`Deleted ${name}`, 'success');
    // Close any open tab for this file
    const virtualPath = buildSftpPath(connId, remotePath);
    const idx = state.openTabs.findIndex(t => t.path === virtualPath);
    if (idx >= 0) state.openTabs.splice(idx, 1);
    await _refreshCurrentDir(connId);
  } else {
    callbacks.showToast(`Delete failed: ${result.message}`, 'error');
  }
}

async function _downloadFile(connId, remotePath) {
  const conn = findConnection(connId);
  if (!conn) return;
  const fileName = remotePath.split('/').pop();
  callbacks.showToast(`Downloading ${fileName}…`, 'info');
  try {
    const result = await callSftpApi('sftp_read', conn, { path: remotePath });
    if (!result.success) {
      callbacks.showToast(`Download failed: ${result.message}`, 'error');
      return;
    }
    const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    callbacks.showToast(`Downloaded ${fileName}`, 'success');
  } catch (err) {
    callbacks.showToast(`Download failed: ${err.message}`, 'error');
  }
}

async function _refreshCurrentDir(connId) {
  const conn = findConnection(connId);
  if (!conn || state.activeSftp.connectionId !== connId) return;
  const path = state.activeSftp.currentPath;
  state.activeSftp.loading = true;
  renderSftpPanel();
  try {
    const result = await callSftpApi('sftp_list', conn, { path });
    if (result.success) {
      state.activeSftp.folders = result.folders || [];
      state.activeSftp.files   = result.files   || [];
    }
  } catch (_) { /* ignore */ }
  state.activeSftp.loading = false;
  renderSftpPanel();
}

// ─── Connection Management (Add / Edit / Delete) ──────────────────────────────

export async function deleteConnection(connId) {
  if (!confirm('Remove this SFTP connection?')) return;
  state.sftpConnections = state.sftpConnections.filter(c => c.id !== connId);
  if (state.activeSftp.connectionId === connId) {
    state.activeSftp.connectionId    = null;
    state.activeSftp.folders         = [];
    state.activeSftp.files           = [];
    state.activeSftp.currentPath     = '/';
    state.activeSftp.navigationHistory = [];
  }
  callbacks.saveSettings();
  renderSftpPanel();
}

// ─── Connection Dialog ────────────────────────────────────────────────────────

function _generateId() {
  return 'sftp-' + Math.random().toString(36).slice(2, 10);
}

function _buildDialogHtml(conn = {}) {
  const isEdit   = !!conn.id;
  const authType = conn.authType || 'password';
  return `
    <div class="modal-overlay visible" id="sftp-dialog-overlay">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <span class="modal-title">${isEdit ? 'Edit' : 'Add'} SFTP Connection</span>
          <button class="modal-close" id="sftp-dialog-close">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="modal-body">
          <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Name</label>
          <input type="text" class="modal-input" id="sftp-input-name" placeholder="My HAOS Host" value="${_escapeHtml(conn.name || '')}" style="margin-bottom:12px;" />

          <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Host</label>
          <input type="text" class="modal-input" id="sftp-input-host" placeholder="192.168.1.100" value="${_escapeHtml(conn.host || '')}" style="margin-bottom:12px;" />

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div>
              <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Port</label>
              <input type="number" class="modal-input" id="sftp-input-port" value="${conn.port || 22}" />
            </div>
            <div>
              <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Username</label>
              <input type="text" class="modal-input" id="sftp-input-username" placeholder="root" value="${_escapeHtml(conn.username || '')}" />
            </div>
          </div>

          <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Authentication</label>
          <select class="modal-input" id="sftp-input-auth-type" style="margin-bottom:12px;">
            <option value="password" ${authType === 'password' ? 'selected' : ''}>Password</option>
            <option value="key"      ${authType === 'key'      ? 'selected' : ''}>SSH Key (PEM)</option>
          </select>

          <div id="sftp-password-section" style="${authType === 'password' ? '' : 'display:none'}">
            <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Password</label>
            <input type="password" class="modal-input" id="sftp-input-password" placeholder="••••••••" value="${_escapeHtml(conn.password || '')}" />
          </div>

          <div id="sftp-key-section" style="${authType === 'key' ? '' : 'display:none'}">
            <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Private Key (PEM)</label>
            <textarea class="modal-input" id="sftp-input-private-key" rows="6" placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..." style="margin-bottom:12px;font-family:monospace;font-size:12px;">${_escapeHtml(conn.privateKey || '')}</textarea>
            <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Key Passphrase (optional)</label>
            <input type="password" class="modal-input" id="sftp-input-key-passphrase" value="${_escapeHtml(conn.privateKeyPassphrase || '')}" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn secondary" id="sftp-dialog-cancel">Cancel</button>
          <button class="modal-btn primary" id="sftp-dialog-save">
            ${isEdit ? 'Save' : 'Test & Save'}
          </button>
        </div>
      </div>
    </div>`;
}

function _attachDialogEvents(editingConn = null) {
  const overlay         = document.getElementById('sftp-dialog-overlay');
  const authTypeSelect  = document.getElementById('sftp-input-auth-type');
  const passwordSection = document.getElementById('sftp-password-section');
  const keySection      = document.getElementById('sftp-key-section');

  authTypeSelect.addEventListener('change', () => {
    const v = authTypeSelect.value;
    passwordSection.style.display = v === 'password' ? '' : 'none';
    keySection.style.display      = v === 'key'      ? '' : 'none';
  });

  document.getElementById('sftp-dialog-close').addEventListener('click', () => overlay.remove());
  document.getElementById('sftp-dialog-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('sftp-dialog-save').addEventListener('click', async () => {
    const name               = document.getElementById('sftp-input-name').value.trim();
    const host               = document.getElementById('sftp-input-host').value.trim();
    const port               = parseInt(document.getElementById('sftp-input-port').value) || 22;
    const username           = document.getElementById('sftp-input-username').value.trim();
    const authType           = authTypeSelect.value;
    const password           = document.getElementById('sftp-input-password').value;
    const privateKey         = document.getElementById('sftp-input-private-key').value.trim();
    const privateKeyPassphrase = document.getElementById('sftp-input-key-passphrase').value;

    if (!name || !host || !username) {
      callbacks.showToast('Please fill in Name, Host and Username', 'error');
      return;
    }

    const conn = { id: editingConn ? editingConn.id : _generateId(), name, host, port, username, authType, password, privateKey, privateKeyPassphrase };

    const saveBtn = document.getElementById('sftp-dialog-save');
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Testing…';

    const result = await callSftpApi('sftp_test', conn);
    saveBtn.disabled    = false;
    saveBtn.textContent = editingConn ? 'Save' : 'Test & Save';

    if (!result.success) {
      callbacks.showToast(`Connection failed: ${result.message}`, 'error');
      return;
    }
    callbacks.showToast(`Connected: ${result.message}`, 'success');

    if (editingConn) {
      const idx = state.sftpConnections.findIndex(c => c.id === conn.id);
      if (idx >= 0) state.sftpConnections[idx] = conn;
    } else {
      state.sftpConnections.push(conn);
    }

    callbacks.saveSettings();
    overlay.remove();
    renderSftpPanel();
  });
}

export function showAddConnectionDialog() {
  const existing = document.getElementById('sftp-dialog-overlay');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', _buildDialogHtml());
  _attachDialogEvents(null);
}

export function showEditConnectionDialog(connId) {
  const conn = findConnection(connId);
  if (!conn) return;
  const existing = document.getElementById('sftp-dialog-overlay');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', _buildDialogHtml(conn));
  _attachDialogEvents(conn);
}

// ─── Panel Button Wiring ──────────────────────────────────────────────────────

export function initSftpPanelButtons() {
  const addBtn      = document.getElementById('btn-sftp-add');
  const collapseBtn = document.getElementById('btn-sftp-collapse');
  const resizeHandle = document.getElementById('sftp-resize-handle');
  const panelBody   = document.getElementById('sftp-panel-body');

  if (addBtn)     addBtn.addEventListener('click',     () => showAddConnectionDialog());
  if (collapseBtn) collapseBtn.addEventListener('click', () => {
    state.sftpPanelCollapsed = !state.sftpPanelCollapsed;
    callbacks.saveSettings();
    renderSftpPanel();
  });

  // Vertical resize
  if (resizeHandle && panelBody) {
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    resizeHandle.addEventListener('mousedown', e => {
      isResizing = true;
      startY = e.clientY;
      startHeight = panelBody.offsetHeight;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!isResizing) return;
      // Handle is above the panel: drag up → panel grows, drag down → panel shrinks
      const newHeight = Math.max(80, Math.min(window.innerHeight * 0.7, startHeight - (e.clientY - startY)));
      panelBody.style.height = `${newHeight}px`;
      state.sftpPanelHeight = newHeight;
    });

    document.addEventListener('mouseup', () => {
      if (!isResizing) return;
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      callbacks.saveSettings();
    });
  }
}
