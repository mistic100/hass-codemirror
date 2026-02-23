"""Terminal Manager for Blueprint Studio."""
from __future__ import annotations

import logging
import subprocess
import shlex
import os
import shutil
import select
import sys

# PTY support (Linux only)
try:
    import pty
    import fcntl
    import termios
    import struct
    HAS_PTY = True
except ImportError:
    HAS_PTY = False

_LOGGER = logging.getLogger(__name__)

# Strict allow-list of commands (Legacy stateless mode)
ALLOWED_COMMANDS = {
    "ha": "Home Assistant CLI",
    "hass": "Home Assistant Core",
    "python3": "Python 3 Interpreter",
    "pip": "Python Package Installer",
    "ls": "List directory",
    "cat": "Read file",
    "cd": "Change directory",
    "pwd": "Print working directory",
    "echo": "Echo text",
    "whoami": "Current user",
    "id": "User identity",
    "ssh": "Secure Shell (Non-interactive)",
    "git": "Git Version Control",
    "grep": "Search text",
    "find": "Search files",
    "du": "Disk usage",
    "df": "Disk free",
    "free": "Memory usage",
    "top": "Process monitor (batch mode)",
    "ps": "Process status",
    "date": "System date",
    "uptime": "System uptime",
    "ping": "Network check",
    "curl": "Network request",
    "wget": "Network download",
    "head": "Read first lines",
    "tail": "Read last lines",
}

# Blocked arguments for safety (Legacy stateless mode)
BLOCKED_ARGS = [
    ">", ">>", "|", "&", ";", "$", "`",  # Shell operators
    "/dev", "/sys", "/proc",             # System paths
    "rm", "mv", "dd", "mkfs", "fdisk",   # Destructive commands
    "reboot", "shutdown", "poweroff",    # System power
]

class TerminalManager:
    """Manages secure terminal command execution."""

    def __init__(self, hass):
        """Initialize the terminal manager."""
        self.hass = hass

    def spawn(self, rows=24, cols=80):
        """Spawn a PTY session. Returns (master_fd, pid)."""
        if not HAS_PTY:
            raise RuntimeError("PTY is not supported on this platform (Linux required).")

        # Determine shell
        shell = shutil.which("bash") or shutil.which("sh") or "/bin/sh"

        # Determine Env
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["HOME"] = self.hass.config.config_dir

        # Set locale variables to prevent SSH issues with some servers
        env["LANG"] = env.get("LANG", "C.UTF-8")
        env["LC_ALL"] = env.get("LC_ALL", "C.UTF-8")

        # Ensure PATH includes common binary locations for SSH and other tools
        path_additions = ["/usr/bin", "/usr/local/bin", "/bin", "/usr/sbin", "/sbin"]
        current_path = env.get("PATH", "")
        for path_dir in path_additions:
            if path_dir not in current_path:
                current_path = f"{path_dir}:{current_path}" if current_path else path_dir
        env["PATH"] = current_path

        # Setup SSH directory and configuration
        ssh_dir = os.path.join(self.hass.config.config_dir, ".ssh")
        if not os.path.exists(ssh_dir):
            try:
                os.makedirs(ssh_dir, mode=0o700)
                _LOGGER.info("Created SSH directory: %s", ssh_dir)
            except Exception as e:
                _LOGGER.warning("Failed to create SSH directory: %s", e)

        # Create SSH config for better remote server compatibility
        ssh_config_path = os.path.join(ssh_dir, "config")
        if not os.path.exists(ssh_config_path):
            try:
                ssh_config_content = """# Auto-generated SSH config for Blueprint Studio Terminal
# Place your SSH private keys in ~/.ssh/ (id_rsa, id_ed25519, etc.)
# For passwordless access, copy your public key to remote: ssh-copy-id user@host

Host *
    # Automatically accept new host keys (but reject changed keys for security)
    StrictHostKeyChecking accept-new

    # Force TTY allocation for proper interactive sessions
    RequestTTY yes

    # Keep connections alive to prevent timeouts
    ServerAliveInterval 60
    ServerAliveCountMax 3
    TCPKeepAlive yes

    # Connection timeouts
    ConnectTimeout 30

    # Try common key types
    IdentityFile ~/.ssh/id_rsa
    IdentityFile ~/.ssh/id_ed25519
    IdentityFile ~/.ssh/id_ecdsa

    # Disable problematic options that may not work in containers
    AddKeysToAgent no

    # Enable compression for slow connections
    Compression yes

    # Ensure proper session handling
    SessionType default

# Example host-specific configuration:
# Host myserver
#     HostName 192.168.1.100
#     User myusername
#     Port 22
#     IdentityFile ~/.ssh/myserver_key
"""
                with open(ssh_config_path, 'w') as f:
                    f.write(ssh_config_content)
                os.chmod(ssh_config_path, 0o600)
                _LOGGER.info("Created SSH config: %s", ssh_config_path)
            except Exception as e:
                _LOGGER.warning("Failed to create SSH config: %s", e)

        # Ensure known_hosts file exists
        known_hosts_path = os.path.join(ssh_dir, "known_hosts")
        if not os.path.exists(known_hosts_path):
            try:
                open(known_hosts_path, 'a').close()
                os.chmod(known_hosts_path, 0o600)
                _LOGGER.info("Created known_hosts file: %s", known_hosts_path)
            except Exception as e:
                _LOGGER.warning("Failed to create known_hosts: %s", e)

        # Create helpful README for SSH setup
        readme_path = os.path.join(ssh_dir, "README.txt")
        if not os.path.exists(readme_path):
            try:
                readme_content = """Blueprint Studio Terminal - SSH Setup Guide
==========================================

This directory stores SSH configuration and keys for secure remote access.

PASSWORDLESS SSH ACCESS:
1. Generate a key pair (if you don't have one):
   ssh-keygen -t ed25519 -C "homeassistant@blueprintstudio"

2. Copy your public key to the remote server:
   ssh-copy-id user@remote-server

3. Your private key will be automatically used from this directory

SSH KEY FILES:
- id_rsa / id_rsa.pub (RSA keys - older, still supported)
- id_ed25519 / id_ed25519.pub (Ed25519 keys - recommended, more secure)
- id_ecdsa / id_ecdsa.pub (ECDSA keys)
- config (SSH client configuration)
- known_hosts (Fingerprints of servers you've connected to)

SECURITY NOTES:
- Never share your private keys (files without .pub extension)
- Private keys should have 600 permissions (read/write for owner only)
- Public keys (.pub files) can be safely shared
- Host key verification protects against man-in-the-middle attacks

TROUBLESHOOTING:
- If connection is slow, check ServerAliveInterval in config
- If key is rejected, ensure proper permissions: chmod 600 ~/.ssh/id_*
- For debugging, use: ssh -v user@host (verbose mode)
- Check logs in Home Assistant for connection errors

For more help: https://github.com/soulripper13/blueprint-studio
"""
                with open(readme_path, 'w') as f:
                    f.write(readme_content)
                _LOGGER.debug("Created SSH README: %s", readme_path)
            except Exception as e:
                _LOGGER.warning("Failed to create SSH README: %s", e)

        # Verify SSH client availability
        ssh_client = shutil.which("ssh")
        if ssh_client:
            _LOGGER.info("Blueprint Studio Terminal: SSH client found at %s", ssh_client)
        else:
            _LOGGER.warning(
                "Blueprint Studio Terminal: SSH client not found in PATH. "
                "SSH connections will not work. Please install openssh-client in your Home Assistant environment."
            )

        # Create PTY pair
        master_fd, slave_fd = pty.openpty()
        
        try:
            p = subprocess.Popen(
                [shell],
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=self.hass.config.config_dir,
                env=env,
                start_new_session=True,
                close_fds=True
            )
        except Exception:
            os.close(slave_fd)
            os.close(master_fd)
            raise

        # Close slave_fd in parent process
        os.close(slave_fd)
        
        self.resize(master_fd, rows, cols)
        return master_fd, p.pid

    def resize(self, fd, rows, cols):
        """Resize the PTY window."""
        if not HAS_PTY:
            return
        try:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
        except OSError:
            pass

    async def execute_command(self, command_str: str, user: str = "Unknown", cwd: str = None) -> dict:
        """Execute a command safely (Legacy Stateless Mode)."""
        if not command_str or not command_str.strip():
            return {"output": "", "retval": 0}

        # Log command for audit
        _LOGGER.info("Terminal command by %s: %s (cwd: %s)", user, command_str, cwd)

        # Determine effective CWD
        base_dir = self.hass.config.config_dir
        if cwd:
            # Ensure cwd is valid and absolute (or relative to config)
            if not os.path.isdir(cwd):
                return {"output": f"Error: Working directory '{cwd}' does not exist.", "retval": 1}
            effective_cwd = cwd
        else:
            effective_cwd = base_dir

        try:
            # 1. Basic safety checks
            for blocked in BLOCKED_ARGS:
                if blocked in command_str:
                    return {
                        "output": f"Error: Command contains blocked character/path: '{blocked}'",
                        "retval": 1
                    }

            # 2. Parse arguments
            args = shlex.split(command_str)
            if not args:
                return {"output": "", "retval": 0}

            cmd = args[0]

            # 3. Check allow-list
            if cmd not in ALLOWED_COMMANDS:
                return {
                    "output": f"Error: Command '{cmd}' is not in the allow-list.\nAllowed: {', '.join(sorted(ALLOWED_COMMANDS.keys()))}",
                    "retval": 127
                }

            # Handle SSH - require PTY terminal
            if cmd == "ssh":
                return {
                    "output": "⚠️  SSH requires an interactive terminal.\n\nPlease use the PTY Terminal (WebSocket mode) for SSH connections.\nSSH needs interactive password prompts and host key verification.\n\nTip: If you need passwordless SSH, add your private key to ~/.ssh/ directory.",
                    "retval": 1
                }

            # Handle 'cd' internally
            if cmd == "cd":
                target = args[1] if len(args) > 1 else base_dir
                # Resolve path
                new_path = os.path.abspath(os.path.join(effective_cwd, target))
                if os.path.isdir(new_path):
                    return {"output": "", "retval": 0, "new_cwd": new_path}
                else:
                    return {"output": f"cd: {target}: No such file or directory", "retval": 1}

            # 4. Special handling for specific commands
            if cmd == "top":
                # Force batch mode for top to avoid hanging
                if "-b" not in args:
                    args.append("-b")
                if "-n" not in args:
                    args.extend(["-n", "1"])

            if cmd == "ping":
                # Limit ping count
                if "-c" not in args:
                    args.extend(["-c", "3"])

            # 5. Resolve executable
            executable = shutil.which(cmd)
            if not executable:
                if cmd == "ha":
                    return {
                        "output": "Error: 'ha' CLI not found. The Home Assistant Core container typically does not include the Supervisor CLI. Use the UI for Supervisor tasks.",
                        "retval": 127
                    }
                return {
                    "output": f"Error: Command '{cmd}' not found in system PATH.",
                    "retval": 127
                }

            # 6. Execute
            # Run in executor to avoid blocking the event loop
            def run_proc():
                # Use resolved executable for the first argument
                run_args = [executable] + args[1:]
                return subprocess.run(
                    run_args,
                    capture_output=True,
                    text=True,
                    cwd=effective_cwd,
                    timeout=30  # 30s timeout
                )

            result = await self.hass.async_add_executor_job(run_proc)

            output = result.stdout
            if result.stderr:
                output += "\n" + result.stderr

            return {
                "output": output,
                "retval": result.returncode
            }

        except subprocess.TimeoutExpired:
            return {"output": "Error: Command timed out (30s limit).", "retval": 124}
        except Exception as e:
            _LOGGER.error("Terminal execution error: %s", e)
            return {"output": f"Execution Error: {str(e)}", "retval": 1}