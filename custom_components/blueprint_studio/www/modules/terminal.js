/**
 * ============================================================================ 
 * TERMINAL MODULE
 * ============================================================================ 
 *
 * PURPOSE:
 * Provides an embedded terminal emulator using xterm.js.
 * Connects to a PTY session via WebSocket for full interactive shell access.
 *
 * FEATURES:
 * - VS Code-like bottom panel
 * - xterm.js integration (Stateful PTY)
 * - WebSocket streaming
 * - Auto-fit on resize
 * - Theme synchronization
 *
 * ============================================================================ 
 */

import { state, elements } from './state.js';
import { loadScript } from './utils.js';
import { API_BASE } from './constants.js';
import { showToast, showModal, showConfirmDialog } from './ui.js';
import { saveSettings } from './settings.js';

let term = null;
let fitAddon = null;
let terminalContainer = null;
let socket = null;
let isTerminalInTab = false;
let tabBtn = null;
let closeBtn = null;
let sshSelect = null;

// Callbacks
let callbacks = {
    openTerminalTab: null,
    closeTerminalTab: null,
    toggleSplitView: null,
    showSshManager: null,
    getAuthToken: null
};

export function registerTerminalCallbacks(cb) {
    callbacks = { ...callbacks, ...cb };
}

// Initialize Terminal
export async function initTerminal() {
    if (term) return;

    // Load xterm.js css
    if (!document.getElementById('xterm-css')) {
        const link = document.createElement('link');
        link.id = 'xterm-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css';
        document.head.appendChild(link);
    }

    try {
        await loadScript('https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js');
        await loadScript('https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js');

        // Wait a bit and verify Terminal class is available (with retry)
        let retries = 0;
        while (retries < 10) {
            if (typeof Terminal !== 'undefined' && typeof FitAddon !== 'undefined') {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }

        if (typeof Terminal === 'undefined') {
            throw new Error('Terminal class not available after script load. Please check your internet connection or try clearing your browser cache.');
        }
        if (typeof FitAddon === 'undefined') {
            throw new Error('FitAddon class not available after script load. Please check your internet connection or try clearing your browser cache.');
        }
    } catch (e) {
        console.error("Failed to load xterm.js", e);
        showToast(`Failed to load terminal libraries: ${e.message}`, "error");
        return;
    }

    // Create container
    terminalContainer = document.createElement('div');
    terminalContainer.id = 'terminal-panel';
    terminalContainer.className = 'terminal-panel';
    terminalContainer.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 300px;
        background: var(--bg-primary);
        border-top: 1px solid var(--border-color);
        z-index: 999;
        display: ${state.terminalVisible ? 'flex' : 'none'};
        flex-direction: column;
        box-shadow: 0 -4px 12px rgba(0,0,0,0.2);
    `;

    // Resize Handle
    const resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = `
        height: 4px;
        cursor: row-resize;
        background: transparent;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 10;
    `;
    resizeHandle.addEventListener('mousedown', initDrag);
    terminalContainer.appendChild(resizeHandle);

    function initDrag(e) {
        e.preventDefault();
        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);
        document.body.style.cursor = 'row-resize';
        terminalContainer.style.transition = 'none'; // Disable transition during drag
    }

    function doDrag(e) {
        const newHeight = window.innerHeight - e.clientY;
        if (newHeight > 100 && newHeight < window.innerHeight - 50) {
            terminalContainer.style.height = newHeight + 'px';
            if (fitAddon) fitAddon.fit();
            if (socket && socket.readyState === WebSocket.OPEN) sendResize();
        }
    }

    function stopDrag() {
        window.removeEventListener('mousemove', doDrag);
        window.removeEventListener('mouseup', stopDrag);
        document.body.style.cursor = '';
        if (fitAddon) {
            fitAddon.fit();
            sendResize();
        }
    }

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 12px;
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border-color);
        height: 32px;
    `;
    
    const title = document.createElement('span');
    title.innerHTML = '<span class="material-icons" style="font-size:14px; vertical-align:text-bottom; margin-right:6px">terminal</span>Terminal';
    title.style.fontSize = '12px';
    title.style.fontWeight = '500';
    title.style.flex = '1';
    
    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '4px';

    tabBtn = document.createElement('button');
    tabBtn.innerHTML = '<span class="material-icons">open_in_new</span>';
    tabBtn.title = "Move to Editor Tab";
    tabBtn.className = 'icon-btn';
    tabBtn.style.cssText = 'background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:2px;';
    tabBtn.onclick = () => {
        if (callbacks.openTerminalTab) callbacks.openTerminalTab();
    };

    closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<span class="material-icons">close</span>';
    closeBtn.title = "Close Panel";
    closeBtn.className = 'icon-btn';
    closeBtn.style.cssText = 'background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:2px;';
    closeBtn.onclick = () => toggleTerminal();

    actionsDiv.appendChild(tabBtn);
    actionsDiv.appendChild(closeBtn);

    header.appendChild(title);

    // SSH Dropdown
    const sshDiv = document.createElement('div');
    sshDiv.style.marginRight = '8px';
    
    sshSelect = document.createElement('select');
    sshSelect.className = 'ssh-select';
    sshSelect.style.cssText = `
        background: var(--input-bg);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 2px 4px;
        font-size: 11px;
        height: 24px;
        max-width: 150px;
        outline: none;
    `;
    
    sshSelect.onchange = () => {
        const val = sshSelect.value;
        if (!val) return;
        
        if (val === 'manage') {
            showSshManager();
            sshSelect.value = "";
            return;
        }
        
        try {
            const host = JSON.parse(val);
            const cmd = `ssh ${host.username}@${host.host}${host.port ? ` -p ${host.port}` : ''}`;
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(cmd + '\r');
                term.focus();
            } else {
                showToast("Terminal not connected", "error");
            }
        } catch(e) { console.error(e); }
        sshSelect.value = "";
    };
    
    sshDiv.appendChild(sshSelect);
    updateSshDropdown(); // Initial population

    header.appendChild(sshDiv);
    header.appendChild(actionsDiv);
    terminalContainer.appendChild(header);

    // Terminal Div
    const termDiv = document.createElement('div');
    termDiv.id = 'xterm-container';
    termDiv.style.cssText = 'flex: 1; padding: 4px; overflow: hidden; background: var(--bg-primary);';
    terminalContainer.appendChild(termDiv);

    document.body.appendChild(terminalContainer);

    // Get theme colors
    const style = getComputedStyle(document.documentElement);
    const bg = style.getPropertyValue('--bg-primary').trim() || '#1e1e1e';
    const fg = style.getPropertyValue('--text-primary').trim() || '#d4d4d4';
    const cursor = style.getPropertyValue('--accent-color').trim() || '#ffffff';

    // Init xterm
    // @ts-ignore
    term = new Terminal({
        cursorBlink: true,
        fontFamily: "'Fira Code', monospace",
        fontSize: 14,
        theme: {
            background: bg,
            foreground: fg,
            cursor: cursor,
            selectionBackground: style.getPropertyValue('--accent-color-transparent')?.trim() || 'rgba(255, 255, 255, 0.3)'
        },
        convertEol: true, // Treat \n as new line
    });

    // @ts-ignore
    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(termDiv);
    
    // Connect WebSocket
    await connectSocket();

    // Handle Input
    term.onData(data => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(data);
        }
    });

    // Intercept Ctrl+L to prevent browser address bar focus
    term.attachCustomKeyEventHandler((e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'l' && e.type === 'keydown') {
            e.preventDefault();
            term.clear(); // Local clear
            return false;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k' && e.type === 'keydown') {
            e.preventDefault();
            term.clear(); // Local clear
            return false;
        }
        return true;
    });

    // Handle Resize
    window.addEventListener('resize', () => {
        if ((state.terminalVisible || isTerminalInTab) && fitAddon) {
            fitAddon.fit();
            sendResize();
        }
    });
    
    // Initial resize
    setTimeout(() => {
        if (fitAddon) {
            fitAddon.fit();
            sendResize();
        }
    }, 100);
}

async function connectSocket() {
    if (socket) {
        // Remove listeners to prevent retry loop
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.onopen = null;
        socket.close();
    }

    const token = callbacks.getAuthToken ? await callbacks.getAuthToken() : null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${API_BASE}?action=terminal_ws&token=${token || ''}`;

    socket = new WebSocket(wsUrl);
    // Use binary type for efficient transfer if backend sends bytes
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
        term.write('\x1b[1;32mConnected to Terminal.\x1b[0m\r\n');
        if (fitAddon) {
            fitAddon.fit();
            sendResize();
        }
    };

    socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
            term.write(event.data);
        } else {
            // ArrayBuffer
            const text = new TextDecoder().decode(event.data);
            term.write(text);
        }
    };

    socket.onclose = () => {
        term.write('\r\n\x1b[1;31mConnection closed. Reconnecting in 3s...\x1b[0m\r\n');
        setTimeout(connectSocket, 3000);
    };

    socket.onerror = (error) => {
        console.error('Terminal WebSocket error:', error);
    };
}

function sendResize() {
    if (socket && socket.readyState === WebSocket.OPEN && term) {
        const dims = { cols: term.cols, rows: term.rows };
        socket.send(JSON.stringify({ type: 'resize', ...dims }));
    }
}

export function getTerminalContainer() {
    return terminalContainer;
}

export function fitTerminal() {
    if (fitAddon) {
        fitAddon.fit();
        sendResize();
    }
    if (term) term.focus();
}

export function setTerminalMode(mode) {
    if (!terminalContainer) return;
    
    isTerminalInTab = (mode === 'tab');
    
    if (mode === 'tab') {
        // Reset fixed positioning for docking into tab
        terminalContainer.style.position = 'absolute';
        terminalContainer.style.top = '0';
        terminalContainer.style.left = '0';
        terminalContainer.style.right = '0';
        terminalContainer.style.bottom = '0';
        terminalContainer.style.height = '100%';
        terminalContainer.style.width = '100%';
        terminalContainer.style.zIndex = '1';
        terminalContainer.style.borderTop = 'none';
        terminalContainer.style.boxShadow = 'none';
        terminalContainer.style.display = 'flex';
        
        // Show header in tab mode (for Move to Panel button)
        if (terminalContainer.firstChild) terminalContainer.firstChild.style.display = 'flex';

        // Update buttons for Tab Mode
        if (tabBtn) {
            tabBtn.innerHTML = '<span class="material-icons">vertical_align_bottom</span>';
            tabBtn.title = "Move to Bottom Panel";
            tabBtn.onclick = () => {
                if (callbacks.closeTerminalTab) callbacks.closeTerminalTab();
            };
        }
        if (closeBtn) closeBtn.style.display = 'none';

    } else {
        // Restore fixed bottom panel
        terminalContainer.style.position = 'fixed';
        terminalContainer.style.top = 'auto';
        terminalContainer.style.bottom = '0';
        terminalContainer.style.left = '0';
        terminalContainer.style.right = '0';
        terminalContainer.style.height = '300px';
        terminalContainer.style.width = 'auto';
        terminalContainer.style.zIndex = '999';
        terminalContainer.style.borderTop = '1px solid var(--border-color)';
        terminalContainer.style.boxShadow = '0 -4px 12px rgba(0,0,0,0.2)';
        // Show header
        if (terminalContainer.firstChild) terminalContainer.firstChild.style.display = 'flex';
        
        // Update buttons for Panel Mode
        if (tabBtn) {
            tabBtn.innerHTML = '<span class="material-icons">open_in_new</span>';
            tabBtn.title = "Move to Editor Tab";
            tabBtn.onclick = () => {
                if (callbacks.openTerminalTab) callbacks.openTerminalTab();
            };
        }
        if (closeBtn) closeBtn.style.display = '';

        // Re-append to body if it was detached (nested in another element)
        if (terminalContainer.parentNode !== document.body) {
            document.body.appendChild(terminalContainer);
        }
    }
    setTimeout(fitTerminal, 50);
}

export async function toggleTerminal(forceState = null) {
    if (!term) await initTerminal();
    
    if (forceState !== null) {
        state.terminalVisible = forceState;
    } else {
        state.terminalVisible = !state.terminalVisible;
    }

    terminalContainer.style.display = state.terminalVisible ? 'flex' : 'none';
    
    if (state.terminalVisible) {
        if (fitAddon) {
            setTimeout(() => {
                fitAddon.fit();
                term.focus();
                sendResize();
            }, 50);
        }
    }
    saveSettings();
}

// Deprecated: Legacy runCommand for stateless compatibility (not used in WS mode)
// If needed, we can send text to WS.
export async function runCommand(cmd, skipConfirm = false) {
    if (!term) await initTerminal();
    if (!state.terminalVisible) await toggleTerminal(true);
    
    // In WS mode, we just type it? Or send it?
    // We can simulate input
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(cmd + '\r');
    }
}

export function updateTerminalTheme() {
    if (!term) return;
    const style = getComputedStyle(document.documentElement);
    term.options.theme = {
        background: style.getPropertyValue('--bg-primary').trim(),
        foreground: style.getPropertyValue('--text-primary').trim(),
        cursor: style.getPropertyValue('--accent-color').trim(),
        selectionBackground: style.getPropertyValue('--accent-color-transparent')?.trim()
    };
    if (terminalContainer) {
        terminalContainer.style.background = style.getPropertyValue('--bg-primary').trim();
        const termDiv = document.getElementById('xterm-container');
        if (termDiv) termDiv.style.background = style.getPropertyValue('--bg-primary').trim();
    }
}

export function updateSshDropdown() {
    if (!sshSelect) return;
    sshSelect.innerHTML = "";
    
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.text = "SSH Connect...";
    sshSelect.appendChild(defaultOption);
    
    if (state.sshHosts && state.sshHosts.length > 0) {
        state.sshHosts.forEach(host => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify(host);
            opt.text = host.name || `${host.username}@${host.host}`;
            sshSelect.appendChild(opt);
        });
    }
    
    const manageOption = document.createElement('option');
    manageOption.value = "manage";
    manageOption.text = "Manage Hosts...";
    sshSelect.appendChild(manageOption);
}

async function showSshManager() {
    const hosts = state.sshHosts || [];
    
    let listHtml = '<div style="max-height: 300px; overflow-y: auto; margin-bottom: 16px; border: 1px solid var(--border-color); border-radius: 4px;">';
    
    if (hosts.length === 0) {
        listHtml += '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No SSH hosts saved.</div>';
    } else {
        hosts.forEach((host, index) => {
            listHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border-color);">
                <div>
                    <div style="font-weight: 500;">${host.name || host.host}</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">${host.username}@${host.host}:${host.port || 22}</div>
                </div>
                <button class="icon-btn delete-ssh-btn" data-index="${index}" style="color: var(--error-color); cursor: pointer; padding: 4px;">
                    <span class="material-icons" style="font-size: 18px;">delete</span>
                </button>
            </div>`;
        });
    }
    listHtml += '</div><button id="btn-add-ssh-host" class="btn-primary" style="width: 100%; padding: 8px; border-radius: 4px; cursor: pointer;">Add New Host</button>';

    const handler = async (e) => {
        if (e.target.closest('#btn-add-ssh-host')) {
            // Close list, open add
            // We use hideModal() from ui.js indirectly by clicking the close button or simulating cancel
            // Since we can't call hideModal() because we are awaiting showModal(), we rely on triggering the resolve.
            // We can assume modal elements are global.
            const closeBtn = document.getElementById('modal-close');
            if (closeBtn) closeBtn.click();
            
            setTimeout(async () => {
                await addSshHost();
                showSshManager();
            }, 300);
        }
        
        const delBtn = e.target.closest('.delete-ssh-btn');
        if (delBtn) {
            const index = parseInt(delBtn.dataset.index);
            const closeBtn = document.getElementById('modal-close');
            if (closeBtn) closeBtn.click();
            
            setTimeout(async () => {
                if (await showConfirmDialog({ title: "Delete Host", message: "Are you sure you want to remove this host?", isDanger: true })) {
                    state.sshHosts.splice(index, 1);
                    saveSettings();
                    updateSshDropdown();
                }
                showSshManager();
            }, 300);
        }
    };
    
    document.addEventListener('click', handler);
    
    await showModal({
        title: "SSH Hosts",
        message: listHtml,
        confirmText: "Close",
        cancelText: ""
    });
    
    document.removeEventListener('click', handler);
}

async function addSshHost() {
    const formHtml = `
        <div style="display: flex; flex-direction: column; gap: 12px; padding: 4px;">
            <div>
                <label style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px; display: block;">Friendly Name</label>
                <input type="text" id="ssh-name" class="modal-input" style="display:block;" placeholder="e.g. Home Server">
            </div>
            <div style="display: flex; gap: 12px;">
                <div style="flex: 2;">
                    <label style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px; display: block;">Host Address</label>
                    <input type="text" id="ssh-host" class="modal-input" style="display:block;" placeholder="192.168.1.5">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px; display: block;">Port</label>
                    <input type="number" id="ssh-port" class="modal-input" style="display:block;" placeholder="22" value="22">
                </div>
            </div>
            <div>
                <label style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px; display: block;">Username</label>
                <input type="text" id="ssh-user" class="modal-input" style="display:block;" placeholder="root" value="root">
            </div>
        </div>
    `;

    const result = await showModal({
        title: "Add SSH Host",
        message: formHtml,
        confirmText: "Save",
        cancelText: "Cancel"
    });

    // If confirmed (result is not null)
    if (result !== null) {
        const name = document.getElementById('ssh-name')?.value.trim();
        const host = document.getElementById('ssh-host')?.value.trim();
        const user = document.getElementById('ssh-user')?.value.trim() || 'root';
        const port = document.getElementById('ssh-port')?.value.trim() || '22';

        if (name && host) {
            state.sshHosts = state.sshHosts || [];
            state.sshHosts.push({
                name: name,
                username: user,
                host: host,
                port: port
            });
            saveSettings();
            updateSshDropdown();
            showToast("SSH Host Saved", "success");
        } else {
            if (!host) showToast("Host address is required", "warning");
            if (!name) showToast("Name is required", "warning");
        }
    }
}