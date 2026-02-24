/**
 * ============================================================================
 * CONSTANTS MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Centralized configuration and constant values used throughout CodeMirror.
 * Modify these values to change app-wide behavior without hunting
 * through code.
 *
 * EXPORTED CONSTANTS:
 * - API_BASE: Base URL for API endpoints
 * - MOBILE_BREAKPOINT: Screen width for mobile detection (px)
 * - STORAGE_KEY: LocalStorage key for settings
 * - MAX_RECENT_FILES: Maximum recent files to track
 * - TEXT_FILE_EXTENSIONS: Set of text file extensions
 * - BINARY_FILE_EXTENSIONS: Set of binary file extensions
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new constant:
 *    - Export as const
 *    - Use UPPER_SNAKE_CASE naming
 *    - Group with related constants
 *    - Document purpose in comment
 *    - Example: export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
 *
 * 2. Adding a new file extension:
 *    - Add to TEXT_FILE_EXTENSIONS for text files
 *    - Add to BINARY_FILE_EXTENSIONS for binary files
 *    - Update utils.js isTextFile() if special handling needed
 *
 * 3. Changing API endpoint:
 *    - Modify API_BASE constant
 *    - All API calls will automatically use new endpoint
 *    - Coordinate with backend server changes
 *
 * 4. Adjusting UI thresholds:
 *    - Modify MOBILE_BREAKPOINT for mobile detection
 *    - Modify MAX_RECENT_FILES for recent files limit
 *    - Changes apply app-wide immediately
 *
 * INTEGRATION POINTS:
 * - api.js: Uses API_BASE
 * - state.js: Uses MOBILE_BREAKPOINT
 * - settings.js: Uses STORAGE_KEY
 * - utils.js: Uses file extension sets
 * - recent-files.js: Uses MAX_RECENT_FILES
 *
 * FILE EXTENSION SETS:
 * - TEXT_FILE_EXTENSIONS: Files that can be edited as text
 * - BINARY_FILE_EXTENSIONS: Files that need special preview
 * - Used by isTextFile() in utils.js
 * - Determines editor vs preview mode
 *
 * ARCHITECTURE NOTES:
 * - Immutable constants - never modify at runtime
 * - Single source of truth for configuration
 * - Changes here affect entire application
 * - No logic in this file - just data
 *
 * COMMON PATTERNS:
 * - Import specific constant: import { API_BASE } from './constants.js'
 * - Check file type: TEXT_FILE_EXTENSIONS.has(extension)
 * - API calls: fetchWithAuth(API_BASE, options)
 * - Mobile check: window.innerWidth <= MOBILE_BREAKPOINT
 *
 * CONFIGURATION GUIDELINES:
 * - Keep constants simple and atomic
 * - Don't add computed values (use getters instead)
 * - Don't add state here (use state.js)
 * - Document units (px, ms, bytes, etc.)
 * - Use sensible defaults
 *
 * ============================================================================
 */

export const API_BASE = "/api/code_mirror";
export const MOBILE_BREAKPOINT = 768;
export const STORAGE_KEY = "code_mirror_settings";
export const MAX_RECENT_FILES = 10;

// File Size Limits
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB - Hard limit to prevent OOM crashes
export const TEXT_FILE_WARNING_SIZE = 2 * 1024 * 1024; // 2MB - Warning for text files

export const TEXT_FILE_EXTENSIONS = new Set([
  "yaml", "yml", "json", "py", "js", "css", "html", "txt", "csv",
  "md", "conf", "cfg", "ini", "sh", "log", "svg", "jinja", "jinja2", "j2",
  "pem", "crt", "key", "cpp", "h", "gitignore", "lock"
]);

export const THEME_PRESETS = {
  dark: {
    name: "Dark (Default)",
    colors: {
      bgPrimary: "#1e1e1e",
      bgSecondary: "#252526",
      bgTertiary: "#2d2d30",
      bgHover: "#3c3c3c",
      bgActive: "#094771",
      textPrimary: "#cccccc",
      textSecondary: "#858585",
      textMuted: "#6e6e6e",
      borderColor: "#3c3c3c",
      accentColor: "#0e639c",
      accentHover: "#1177bb",
      successColor: "#4ec9b0",
      warningColor: "#dcdcaa",
      errorColor: "#f14c4c",
      iconFolder: "#dcb67a",
      iconYaml: "#cb4b16",
      iconJson: "#cbcb41",
      iconPython: "#3572a5",
      iconJs: "#f1e05a",
      iconDefault: "#858585",
      modalBg: "#2d2d30",
      inputBg: "#3c3c3c",
      shadowColor: "rgba(0, 0, 0, 0.5)",
      cmTheme: "material-darker",
      bgGutter: "#2d2d30"
    }
  },
  light: {
    name: "Light",
    colors: {
      bgPrimary: "#ffffff",
      bgSecondary: "#f3f3f3",
      bgTertiary: "#e8e8e8",
      bgHover: "#e0e0e0",
      bgActive: "#0060c0",
      textPrimary: "#1e1e1e",
      textSecondary: "#616161",
      textMuted: "#9e9e9e",
      borderColor: "#d4d4d4",
      accentColor: "#0066b8",
      accentHover: "#0078d4",
      successColor: "#16825d",
      warningColor: "#bf8803",
      errorColor: "#e51400",
      iconFolder: "#c09553",
      iconYaml: "#a83232",
      iconJson: "#b89500",
      iconPython: "#2b5b84",
      iconJs: "#b8a000",
      iconDefault: "#616161",
      modalBg: "#ffffff",
      inputBg: "#ffffff",
      shadowColor: "rgba(0, 0, 0, 0.2)",
      cmTheme: "default"
    }
  },
};

// NOTE: Icon themes were reverted. Keep a single, consistent icon mapping in utils.js.
export const SYNTAX_THEMES = {
  dracula: {
    name: "Dracula",
    description: "Dark purple & pink tones",
    colors: {
      comment:  "#6272a4",
      keyword:  "#ff79c6",
      string:   "#f1fa8c",
      number:   "#bd93f9",
      boolean:  "#bd93f9",
      key:      "#8be9fd",
      tag:      "#50fa7b"
    }
  },
  nord: {
    name: "Nord",
    description: "Cool arctic blue tones",
    colors: {
      comment:  "#616e88",
      keyword:  "#81a1c1",
      string:   "#a3be8c",
      number:   "#b48ead",
      boolean:  "#b48ead",
      key:      "#88c0d0",
      tag:      "#ebcb8b"
    }
  },
  monokai: {
    name: "Monokai",
    description: "Vibrant yellow & green",
    colors: {
      comment:  "#75715e",
      keyword:  "#f92672",
      string:   "#e6db74",
      number:   "#ae81ff",
      boolean:  "#ae81ff",
      key:      "#a6e22e",
      tag:      "#66d9e8"
    }
  },
  solarized: {
    name: "Solarized",
    description: "Warm amber & teal",
    colors: {
      comment:  "#586e75",
      keyword:  "#859900",
      string:   "#2aa198",
      number:   "#d33682",
      boolean:  "#d33682",
      key:      "#268bd2",
      tag:      "#b58900"
    }
  },
  oneDark: {
    name: "One Dark",
    description: "Soft pastel atom colors",
    colors: {
      comment:  "#5c6370",
      keyword:  "#c678dd",
      string:   "#98c379",
      number:   "#d19a66",
      boolean:  "#56b6c2",
      key:      "#61afef",
      tag:      "#e06c75"
    }
  }
};

export const HA_SCHEMA = {
  // Core configuration keys
  configuration: [
    { text: "homeassistant:", type: "domain", description: "Core Home Assistant configuration" },
    { text: "automation:", type: "domain", description: "Automation configuration" },
    { text: "script:", type: "domain", description: "Script configuration" },
    { text: "scene:", type: "domain", description: "Scene configuration" },
    { text: "sensor:", type: "domain", description: "Sensor configuration" },
    { text: "binary_sensor:", type: "domain", description: "Binary sensor configuration" },
    { text: "template:", type: "domain", description: "Template entities" },
    { text: "input_boolean:", type: "domain", description: "Input boolean helper" },
    { text: "input_number:", type: "domain", description: "Input number helper" },
    { text: "input_text:", type: "domain", description: "Input text helper" },
    { text: "input_select:", type: "domain", description: "Input select helper" },
    { text: "input_datetime:", type: "domain", description: "Input datetime helper" },
    { text: "input_button:", type: "domain", description: "Input button helper" },
    { text: "counter:", type: "domain", description: "Counter helper" },
    { text: "timer:", type: "domain", description: "Timer helper" },
    { text: "group:", type: "domain", description: "Group configuration" },
    { text: "person:", type: "domain", description: "Person configuration" },
    { text: "zone:", type: "domain", description: "Zone configuration" },
    { text: "light:", type: "domain", description: "Light configuration" },
    { text: "switch:", type: "domain", description: "Switch configuration" },
    { text: "cover:", type: "domain", description: "Cover configuration" },
    { text: "climate:", type: "domain", description: "Climate configuration" },
    { text: "fan:", type: "domain", description: "Fan configuration" },
    { text: "lock:", type: "domain", description: "Lock configuration" },
    { text: "camera:", type: "domain", description: "Camera configuration" },
    { text: "media_player:", type: "domain", description: "Media player configuration" },
    { text: "notify:", type: "domain", description: "Notification configuration" },
    { text: "tts:", type: "domain", description: "Text-to-speech configuration" },
    { text: "mqtt:", type: "domain", description: "MQTT configuration" },
    { text: "http:", type: "domain", description: "HTTP configuration" },
    { text: "logger:", type: "domain", description: "Logger configuration" },
    { text: "recorder:", type: "domain", description: "Recorder configuration" },
    { text: "history:", type: "domain", description: "History configuration" },
    { text: "logbook:", type: "domain", description: "Logbook configuration" },
    { text: "frontend:", type: "domain", description: "Frontend configuration" },
    { text: "config:", type: "domain", description: "Configuration UI" },
    { text: "api:", type: "domain", description: "API configuration" },
    { text: "websocket_api:", type: "domain", description: "WebSocket API" },
    { text: "mobile_app:", type: "domain", description: "Mobile app integration" },
    { text: "shopping_list:", type: "domain", description: "Shopping list" },
    { text: "conversation:", type: "domain", description: "Conversation integration" },
    { text: "default_config:", type: "domain", description: "Default configuration" },
    { text: "system_health:", type: "domain", description: "System health monitoring" },
  ],

  // Common keys for automations
  automation: [
    { text: "alias:", type: "key", description: "Automation friendly name" },
    { text: "description:", type: "key", description: "Automation description" },
    { text: "id:", type: "key", description: "Unique automation ID" },
    { text: "mode:", type: "key", description: "Automation execution mode" },
    { text: "max:", type: "key", description: "Maximum concurrent runs" },
    { text: "max_exceeded:", type: "key", description: "Behavior when max exceeded" },
    { text: "trigger:", type: "key", description: "Automation triggers" },
    { text: "condition:", type: "key", description: "Automation conditions" },
    { text: "action:", type: "key", description: "Automation actions" },
  ],

  // Automation modes
  automation_modes: [
    { text: "single", type: "value", description: "Only one run at a time" },
    { text: "restart", type: "value", description: "Restart automation on new trigger" },
    { text: "queued", type: "value", description: "Queue runs" },
    { text: "parallel", type: "value", description: "Run in parallel" },
  ],

  // Trigger types
  triggers: [
    { text: "platform: state", type: "trigger", description: "State change trigger" },
    { text: "platform: numeric_state", type: "trigger", description: "Numeric state trigger" },
    { text: "platform: event", type: "trigger", description: "Event trigger" },
    { text: "platform: time", type: "trigger", description: "Time trigger" },
    { text: "platform: time_pattern", type: "trigger", description: "Time pattern trigger" },
    { text: "platform: mqtt", type: "trigger", description: "MQTT trigger" },
    { text: "platform: webhook", type: "trigger", description: "Webhook trigger" },
    { text: "platform: zone", type: "trigger", description: "Zone trigger" },
    { text: "platform: geo_location", type: "trigger", description: "Geo location trigger" },
    { text: "platform: homeassistant", type: "trigger", description: "Home Assistant event trigger" },
    { text: "platform: sun", type: "trigger", description: "Sun event trigger" },
    { text: "platform: tag", type: "trigger", description: "NFC tag trigger" },
    { text: "platform: template", type: "trigger", description: "Template trigger" },
    { text: "platform: calendar", type: "trigger", description: "Calendar trigger" },
    { text: "platform: conversation", type: "trigger", description: "Conversation trigger" },
  ],

  // Condition types
  conditions: [
    { text: "condition: state", type: "condition", description: "State condition" },
    { text: "condition: numeric_state", type: "condition", description: "Numeric state condition" },
    { text: "condition: template", type: "condition", description: "Template condition" },
    { text: "condition: time", type: "condition", description: "Time condition" },
    { text: "condition: zone", type: "condition", description: "Zone condition" },
    { text: "condition: sun", type: "condition", description: "Sun condition" },
    { text: "condition: and", type: "condition", description: "AND condition" },
    { text: "condition: or", type: "condition", description: "OR condition" },
    { text: "condition: not", type: "condition", description: "NOT condition" },
    { text: "condition: device", type: "condition", description: "Device condition" },
  ],

  // Common services
  services: [
    { text: "service: homeassistant.turn_on", type: "service", description: "Turn on entity" },
    { text: "service: homeassistant.turn_off", type: "service", description: "Turn off entity" },
    { text: "service: homeassistant.toggle", type: "service", description: "Toggle entity" },
    { text: "service: homeassistant.reload_config_entry", type: "service", description: "Reload config entry" },
    { text: "service: homeassistant.restart", type: "service", description: "Restart Home Assistant" },
    { text: "service: homeassistant.stop", type: "service", description: "Stop Home Assistant" },
    { text: "service: homeassistant.update_entity", type: "service", description: "Update entity" },
    { text: "service: light.turn_on", type: "service", description: "Turn on light" },
    { text: "service: light.turn_off", type: "service", description: "Turn off light" },
    { text: "service: light.toggle", type: "service", description: "Toggle light" },
    { text: "service: switch.turn_on", type: "service", description: "Turn on switch" },
    { text: "service: switch.turn_off", type: "service", description: "Turn off switch" },
    { text: "service: switch.toggle", type: "service", description: "Toggle switch" },
    { text: "service: cover.open_cover", type: "service", description: "Open cover" },
    { text: "service: cover.close_cover", type: "service", description: "Close cover" },
    { text: "service: cover.stop_cover", type: "service", description: "Stop cover" },
    { text: "service: climate.set_temperature", type: "service", description: "Set climate temperature" },
    { text: "service: climate.set_hvac_mode", type: "service", description: "Set HVAC mode" },
    { text: "service: notify.notify", type: "service", description: "Send notification" },
    { text: "service: script.turn_on", type: "service", description: "Run script" },
    { text: "service: automation.turn_on", type: "service", description: "Enable automation" },
    { text: "service: automation.turn_off", type: "service", description: "Disable automation" },
    { text: "service: automation.trigger", type: "service", description: "Trigger automation" },
    { text: "service: automation.reload", type: "service", description: "Reload automations" },
    { text: "service: scene.turn_on", type: "service", description: "Activate scene" },
    { text: "service: input_boolean.turn_on", type: "service", description: "Turn on input boolean" },
    { text: "service: input_boolean.turn_off", type: "service", description: "Turn off input boolean" },
    { text: "service: input_boolean.toggle", type: "service", description: "Toggle input boolean" },
    { text: "service: input_number.set_value", type: "service", description: "Set input number value" },
    { text: "service: input_text.set_value", type: "service", description: "Set input text value" },
    { text: "service: input_select.select_option", type: "service", description: "Select input option" },
    { text: "service: input_datetime.set_datetime", type: "service", description: "Set datetime" },
    { text: "service: input_button.press", type: "service", description: "Press input button" },
    { text: "service: counter.increment", type: "service", description: "Increment counter" },
    { text: "service: counter.decrement", type: "service", description: "Decrement counter" },
    { text: "service: counter.reset", type: "service", description: "Reset counter" },
    { text: "service: timer.start", type: "service", description: "Start timer" },
    { text: "service: timer.pause", type: "service", description: "Pause timer" },
    { text: "service: timer.cancel", type: "service", description: "Cancel timer" },
    { text: "service: persistent_notification.create", type: "service", description: "Create notification" },
    { text: "service: persistent_notification.dismiss", type: "service", description: "Dismiss notification" },
    { text: "service: tts.speak", type: "service", description: "Speak text" },
    { text: "service: media_player.media_play", type: "service", description: "Play media" },
    { text: "service: media_player.media_pause", type: "service", description: "Pause media" },
    { text: "service: media_player.media_stop", type: "service", description: "Stop media" },
    { text: "service: media_player.volume_up", type: "service", description: "Increase volume" },
    { text: "service: media_player.volume_down", type: "service", description: "Decrease volume" },
    { text: "service: media_player.volume_set", type: "service", description: "Set volume" },
  ],

  // Common action keys
  actionKeys: [
    { text: "entity_id:", type: "key", description: "Target entity ID" },
    { text: "device_id:", type: "key", description: "Target device ID" },
    { text: "area_id:", type: "key", description: "Target area ID" },
    { text: "data:", type: "key", description: "Service data" },
    { text: "target:", type: "key", description: "Service target" },
    { text: "delay:", type: "key", description: "Delay action" },
    { text: "wait_template:", type: "key", description: "Wait for template" },
    { text: "wait_for_trigger:", type: "key", description: "Wait for trigger" },
    { text: "choose:", type: "key", description: "Choose action based on condition" },
    { text: "repeat:", type: "key", description: "Repeat action" },
    { text: "if:", type: "key", description: "Conditional action" },
    { text: "then:", type: "key", description: "If condition is true" },
    { text: "else:", type: "key", description: "If condition is false" },
    { text: "parallel:", type: "key", description: "Run actions in parallel" },
    { text: "sequence:", type: "key", description: "Sequence of actions" },
  ],

  // Common config keys
  commonKeys: [
    { text: "name:", type: "key", description: "Entity name" },
    { text: "unique_id:", type: "key", description: "Unique entity ID" },
    { text: "icon:", type: "key", description: "Entity icon (mdi:icon-name)" },
    { text: "device_class:", type: "key", description: "Device class" },
    { text: "unit_of_measurement:", type: "key", description: "Unit of measurement" },
    { text: "state:", type: "key", description: "Entity state" },
    { text: "state_topic:", type: "key", description: "MQTT state topic" },
    { text: "command_topic:", type: "key", description: "MQTT command topic" },
    { text: "availability_topic:", type: "key", description: "MQTT availability topic" },
    { text: "payload_on:", type: "key", description: "Payload for ON state" },
    { text: "payload_off:", type: "key", description: "Payload for OFF state" },
    { text: "payload_available:", type: "key", description: "Payload for available" },
    { text: "payload_not_available:", type: "key", description: "Payload for not available" },
    { text: "value_template:", type: "key", description: "Template for value" },
    { text: "availability_template:", type: "key", description: "Template for availability" },
    { text: "attributes:", type: "key", description: "Entity attributes" },
    { text: "friendly_name:", type: "key", description: "Friendly entity name" },
  ],

  // YAML tags
  yamlTags: [
    { text: "!include ", type: "tag", description: "Include another YAML file (no space after !)" },
    { text: "!include_dir_list ", type: "tag", description: "Include directory as list (no space after !)" },
    { text: "!include_dir_named ", type: "tag", description: "Include directory as named entries (no space after !)" },
    { text: "!include_dir_merge_list ", type: "tag", description: "Include and merge directory as list (no space after !)" },
    { text: "!include_dir_merge_named ", type: "tag", description: "Include and merge directory as named (no space after !)" },
    { text: "!secret ", type: "tag", description: "Reference secret from secrets.yaml (no space after !)" },
    { text: "!env_var ", type: "tag", description: "Use environment variable (no space after !)" },
    { text: "!input ", type: "tag", description: "Blueprint input (no space after !)" },
  ],

  // Sensor platforms
  sensorPlatforms: [
    { text: "platform: template", type: "platform", description: "Template sensor" },
    { text: "platform: mqtt", type: "platform", description: "MQTT sensor" },
    { text: "platform: statistics", type: "platform", description: "Statistics sensor" },
    { text: "platform: time_date", type: "platform", description: "Time and date sensor" },
    { text: "platform: rest", type: "platform", description: "REST sensor" },
    { text: "platform: command_line", type: "platform", description: "Command line sensor" },
    { text: "platform: sql", type: "platform", description: "SQL sensor" },
    { text: "platform: file", type: "platform", description: "File sensor" },
    { text: "platform: folder", type: "platform", description: "Folder sensor" },
    { text: "platform: history_stats", type: "platform", description: "History statistics sensor" },
    { text: "platform: trend", type: "platform", description: "Trend sensor" },
    { text: "platform: min_max", type: "platform", description: "Min/Max sensor" },
    { text: "platform: filter", type: "platform", description: "Filter sensor" },
  ],

  snippets: [
    {
      text: "snip:automation",
      label: "Automation Snippet",
      type: "snippet",
      description: "Standard automation template",
      content: "- alias: \"New Automation\"\n  description: \"Description of the automation\"\n  trigger:\n    - platform: state\n      entity_id: light.example\n      to: \"on\"\n  condition: []\n  action:\n    - service: light.turn_on\n      target:\n        entity_id: light.example\n  mode: single"
    },
    {
      text: "snip:script",
      label: "Script Snippet",
      type: "snippet",
      description: "Standard script template",
      content: "new_script:\n  alias: \"New Script\"\n  sequence:\n    - service: light.turn_on\n      target:\n        entity_id: light.example\n  mode: single"
    },
    {
      text: "snip:sensor",
      label: "Template Sensor Snippet",
      type: "snippet",
      description: "Modern template sensor",
      content: "template:\n  - sensor:\n      - name: \"My Sensor\"\n        state: >\n          {{ states('sensor.source') }}\n        unit_of_measurement: \"°C\"\n        device_class: temperature"
    }
  ]
};
