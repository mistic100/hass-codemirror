"""Constants for the CodeMirror integration."""

DOMAIN = "code_mirror"
NAME = "CodeMirror"
VERSION = "1.0.0"

# File extensions allowed for editing
ALLOWED_EXTENSIONS = {
    ".yaml", ".yml", ".json", ".py", ".js", ".css", ".html", ".txt", ".csv",
    ".md", ".conf", ".cfg", ".ini", ".sh", ".log", ".gitignore", ".jinja", ".jinja2", ".j2",
    ".db", ".sqlite",
    ".pem", ".crt", ".key", ".der", ".bin", ".ota", ".cpp", ".h", ".tar", ".gz",
    ".lock",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp", ".ico",
    ".pdf", ".zip",
    ".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv", ".wmv", ".m4v",
}

# Binary file extensions that should be base64 encoded
BINARY_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".ico", ".pdf", ".zip",
    ".db", ".sqlite",
    ".der", ".bin", ".ota", ".tar", ".gz",
    ".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv", ".wmv", ".m4v",
}

# Specific filenames allowed even if they don't have an extension
ALLOWED_FILENAMES = {
    ".gitignore",
    ".ha_run.lock"
}

# Directories/patterns to exclude
EXCLUDED_PATTERNS = {
    "__pycache__",
    ".git",
    ".cache",
    "deps",
    "tts",
    ".git_credential_helper",
}

# Protected paths that cannot be deleted
PROTECTED_PATHS = {
    "configuration.yaml",
    "secrets.yaml",
    "home-assistant.log",
    ".storage",
}
