"AI management for Blueprint Studio."
from __future__ import annotations

import logging
import re
import yaml
import time
from aiohttp import web
from homeassistant.core import HomeAssistant

from .util import json_response, json_message

_LOGGER = logging.getLogger(__name__)

# Common YAML errors and their solutions
YAML_ERROR_PATTERNS = {
    "legacy_service": {
        "pattern": r"^\s*service:\s*(\w+\.\w+)",
        "message": "Legacy 'service:' syntax detected",
        "solution": "Replace 'service:' with 'action:' (modern 2024+ syntax)",
        "example": "service: light.turn_on  →  action: light.turn_on"
    },
    "missing_id": {
        "pattern": r"^-\s+alias:",
        "message": "Automation missing unique 'id:' field",
        "solution": "Add 'id: \"XXXXXXXXXXXXX\"' (13-digit timestamp) before 'alias:'",
        "example": "- alias: My Auto  →  - id: '1738012345678'\n  alias: My Auto"
    },
    "singular_trigger": {
        "pattern": r"^\s*trigger:\s*$",
        "message": "Legacy singular 'trigger:' key detected",
        "solution": "Use modern plural 'triggers:' instead",
        "example": "trigger:  →  triggers:"
    },
    "singular_condition": {
        "pattern": r"^\s*condition:\s*$",
        "message": "Legacy singular 'condition:' key detected",
        "solution": "Use modern plural 'conditions:' instead",
        "example": "condition:  →  conditions:"
    },
    "singular_action": {
        "pattern": r"^\s*action:\s*$",
        "message": "Legacy singular 'action:' key detected at top level",
        "solution": "Use modern plural 'actions:' at automation level",
        "example": "action:  →  actions:"
    },
    "old_trigger_syntax": {
        "pattern": r"^\s*-\s+platform:\s+(\w+)",
        "message": "Legacy 'platform:' trigger syntax detected",
        "solution": "Use modern '- trigger: platform' syntax",
        "example": "- platform: time  →  - trigger: time"
    },
    "missing_metadata": {
        "pattern": r"(action:\s+\w+\.\w+)(?!.*metadata:)",
        "message": "Action missing 'metadata: {}' field",
        "solution": "Add 'metadata: {}' after action declaration",
        "example": "action: light.turn_on\ntarget:  →  action: light.turn_on\nmetadata: {}\ntarget:"
    },
    "malformed_entity_id": {
        "pattern": r"entity_id:\s+([a-zA-Z_]+)(?!\.[a-zA-Z_])",
        "message": "Malformed entity_id (missing domain or entity name)",
        "solution": "Entity IDs must follow format: domain.entity_name",
        "example": "entity_id: kitchen  →  entity_id: light.kitchen"
    },
    "invalid_domain": {
        "pattern": r"entity_id:\s+([a-zA-Z0-9_]+)\.",
        "message": "Potentially invalid domain in entity_id",
        "solution": "Check if domain exists in Home Assistant",
        "example": "Common domains: light, switch, sensor, binary_sensor, climate, etc."
    },
}

# Common Jinja2 template patterns for Home Assistant
JINJA_PATTERNS = {
    "state": {
        "templates": [
            "{{ states('sensor.temperature') }}",
            "{{ states('light.kitchen') }}",
            "{{ state_attr('light.kitchen', 'brightness') }}",
        ],
        "description": "Get entity state or attribute"
    },
    "condition": {
        "templates": [
            "{% if states('light.kitchen') == 'on' %}...{% endif %}",
            "{% if is_state('light.kitchen', 'on') %}...{% endif %}",
            "{% if state_attr('light.kitchen', 'brightness') > 100 %}...{% endif %}",
        ],
        "description": "Conditional logic"
    },
    "loop": {
        "templates": [
            "{% for state in states.light %}{{ state.name }}{% endfor %}",
            "{% for entity in expand('group.all_lights') %}...{% endfor %}",
        ],
        "description": "Loop through entities"
    },
    "time": {
        "templates": [
            "{{ now() }}",
            "{{ now().strftime('%H:%M') }}",
            "{{ as_timestamp(now()) }}",
            "{{ today_at('19:00') }}",
        ],
        "description": "Time and date functions"
    },
    "math": {
        "templates": [
            "{{ (states('sensor.temp') | float) * 1.8 + 32 }}",
            "{{ states('sensor.value') | float | round(2) }}",
        ],
        "description": "Mathematical operations"
    },
    "filters": {
        "templates": [
            "{{ value | default(0) }}",
            "{{ value | float }}",
            "{{ value | int }}",
            "{{ value | round(2) }}",
            "{{ value | lower }}",
            "{{ value | upper }}",
            "{{ value | title }}",
        ],
        "description": "Common Jinja filters"
    },
}

# Common Jinja errors and solutions
JINJA_ERROR_PATTERNS = {
    "missing_quotes": {
        "pattern": r"states\((\w+\.\w+)\)",
        "message": "Entity ID should be in quotes",
        "solution": "Wrap entity_id in quotes",
        "example": "states(sensor.temp) → states('sensor.temp')"
    },
    "wrong_brackets": {
        "pattern": r"\{\{\s*\{",
        "message": "Too many opening brackets",
        "solution": "Use {{ for expressions, not {{{",
        "example": "{{{ value }}} → {{ value }}"
    },
    "missing_pipe": {
        "pattern": r"states\(['\"][\w\.]+['\"]\)\s*(float|int|round|default)",
        "message": "Missing pipe | for filter",
        "solution": "Use | before filter name",
        "example": "states('sensor.temp') float → states('sensor.temp') | float"
    },
}


class AIManager:
    """Class to handle AI operations with advanced natural language understanding."""

    def __init__(self, hass: HomeAssistant | None, data: dict) -> None:
        """Initialize AI manager."""
        self.hass = hass
        self.data = data

    def check_yaml(self, content: str) -> web.Response:
        """Check for YAML syntax errors and provide smart solutions."""
        syntax_errors = []
        best_practice_warnings = []

        # First check basic YAML syntax
        try:
            class HAYamlLoader(yaml.SafeLoader): pass
            def ha_constructor(loader, node): return loader.construct_scalar(node)
            tags = ['!include', '!include_dir_list', '!include_dir_named', '!include_dir_merge_list', '!include_dir_merge_named', '!secret', '!env_var', '!input']
            for tag in tags: HAYamlLoader.add_constructor(tag, ha_constructor)
            parsed = yaml.load(content, Loader=HAYamlLoader)
        except yaml.YAMLError as e:
            return json_response({
                "valid": False,
                "error": str(e),
                "type": "syntax_error",
                "suggestions": [
                    "Check for proper indentation (use 2 spaces, not tabs)",
                    "Ensure all quotes are properly closed",
                    "Verify that list items start with '-' followed by a space",
                    "Check for special characters that need quoting"
                ]
            })
        except Exception as e:
            return json_response({"valid": False, "error": str(e)})

        # Advanced validation - check for common mistakes and legacy syntax
        lines = content.split('\n')

        for line_num, line in enumerate(lines, 1):
            # Check for legacy service: syntax
            if re.search(YAML_ERROR_PATTERNS["legacy_service"]["pattern"], line):
                best_practice_warnings.append({
                    "line": line_num,
                    "type": "legacy_syntax",
                    "message": YAML_ERROR_PATTERNS["legacy_service"]["message"],
                    "solution": YAML_ERROR_PATTERNS["legacy_service"]["solution"],
                    "example": YAML_ERROR_PATTERNS["legacy_service"]["example"],
                    "original": line.strip()
                })

            # Check for old trigger platform: syntax
            if re.search(YAML_ERROR_PATTERNS["old_trigger_syntax"]["pattern"], line):
                best_practice_warnings.append({
                    "line": line_num,
                    "type": "legacy_trigger",
                    "message": YAML_ERROR_PATTERNS["old_trigger_syntax"]["message"],
                    "solution": YAML_ERROR_PATTERNS["old_trigger_syntax"]["solution"],
                    "example": YAML_ERROR_PATTERNS["old_trigger_syntax"]["example"],
                    "original": line.strip()
                })

            # Check for singular keys
            if re.match(r"^\s*trigger:\s*$", line):
                best_practice_warnings.append({
                    "line": line_num,
                    "type": "singular_key",
                    "message": YAML_ERROR_PATTERNS["singular_trigger"]["message"],
                    "solution": YAML_ERROR_PATTERNS["singular_trigger"]["solution"],
                    "example": YAML_ERROR_PATTERNS["singular_trigger"]["example"],
                    "original": line.strip()
                })

            if re.match(r"^\s*condition:\s*$", line):
                best_practice_warnings.append({
                    "line": line_num,
                    "type": "singular_key",
                    "message": YAML_ERROR_PATTERNS["singular_condition"]["message"],
                    "solution": YAML_ERROR_PATTERNS["singular_condition"]["solution"],
                    "example": YAML_ERROR_PATTERNS["singular_condition"]["example"],
                    "original": line.strip()
                })

            # Check for malformed entity_id
            entity_match = re.search(r"entity_id:\s+([^\s\n]+)", line)
            if entity_match:
                entity_id = entity_match.group(1)
                # Remove quotes if present
                entity_id = entity_id.strip('"\'')
                if '.' not in entity_id and not entity_id.startswith('['):
                    syntax_errors.append({
                        "line": line_num,
                        "type": "malformed_entity_id",
                        "message": f"Malformed entity_id: '{entity_id}'",
                        "solution": "Entity IDs must follow format: domain.entity_name",
                        "example": f"entity_id: light.{entity_id}",
                        "original": line.strip()
                    })

        # Check for missing automation id
        if isinstance(parsed, list):
            for idx, item in enumerate(parsed):
                if isinstance(item, dict) and 'alias' in item and 'id' not in item:
                    # Find the line with this alias
                    alias_value = item['alias']
                    for line_num, line in enumerate(lines, 1):
                        if f"alias: {alias_value}" in line or f'alias: "{alias_value}"' in line or f"alias: '{alias_value}'" in line:
                            best_practice_warnings.append({
                                "line": line_num,
                                "type": "missing_id",
                                "message": f"Automation '{alias_value}' missing unique 'id:' field",
                                "solution": YAML_ERROR_PATTERNS["missing_id"]["solution"],
                                "example": f"- id: '{int(time.time() * 1000)}'\n  alias: {alias_value}",
                                "original": line.strip()
                            })
                            break

        # Return results
        if syntax_errors:
            return json_response({
                "valid": False,
                "errors": syntax_errors,
                "error_count": len(syntax_errors),
                "message": f"Found {len(syntax_errors)} syntax error(s)"
            })

        if best_practice_warnings:
            return json_response({
                "valid": True,
                "warnings": best_practice_warnings,
                "warning_count": len(best_practice_warnings),
                "message": f"YAML is valid but found {len(best_practice_warnings)} best practice issue(s)"
            })

        return json_response({
            "valid": True,
            "message": "YAML is valid and follows best practices!"
        })

    def check_jinja(self, content: str) -> web.Response:
        """Check Jinja2 template syntax and provide intelligent suggestions."""
        errors = []
        suggestions = []

        lines = content.split('\n')

        for line_num, line in enumerate(lines, 1):
            # Check for missing quotes in states()
            if re.search(JINJA_ERROR_PATTERNS["missing_quotes"]["pattern"], line):
                errors.append({
                    "line": line_num,
                    "type": "syntax_error",
                    "message": JINJA_ERROR_PATTERNS["missing_quotes"]["message"],
                    "solution": JINJA_ERROR_PATTERNS["missing_quotes"]["solution"],
                    "example": JINJA_ERROR_PATTERNS["missing_quotes"]["example"],
                    "original": line.strip()
                })

            # Check for wrong brackets
            if re.search(JINJA_ERROR_PATTERNS["wrong_brackets"]["pattern"], line):
                errors.append({
                    "line": line_num,
                    "type": "syntax_error",
                    "message": JINJA_ERROR_PATTERNS["wrong_brackets"]["message"],
                    "solution": JINJA_ERROR_PATTERNS["wrong_brackets"]["solution"],
                    "example": JINJA_ERROR_PATTERNS["wrong_brackets"]["example"],
                    "original": line.strip()
                })

            # Check for missing pipe
            if re.search(JINJA_ERROR_PATTERNS["missing_pipe"]["pattern"], line):
                errors.append({
                    "line": line_num,
                    "type": "syntax_error",
                    "message": JINJA_ERROR_PATTERNS["missing_pipe"]["message"],
                    "solution": JINJA_ERROR_PATTERNS["missing_pipe"]["solution"],
                    "example": JINJA_ERROR_PATTERNS["missing_pipe"]["example"],
                    "original": line.strip()
                })

        # Provide helpful suggestions based on content
        if "states(" in content:
            suggestions.append({
                "type": "tip",
                "message": "Using states() function",
                "examples": JINJA_PATTERNS["state"]["templates"]
            })

        if "{% if" in content or "{% for" in content:
            suggestions.append({
                "type": "tip",
                "message": "Control structures detected",
                "examples": JINJA_PATTERNS["condition"]["templates"] if "{% if" in content else JINJA_PATTERNS["loop"]["templates"]
            })

        if "now()" in content or "timestamp" in content:
            suggestions.append({
                "type": "tip",
                "message": "Time functions available",
                "examples": JINJA_PATTERNS["time"]["templates"]
            })

        if errors:
            return json_response({
                "valid": False,
                "errors": errors,
                "suggestions": suggestions,
                "error_count": len(errors),
                "message": f"Found {len(errors)} error(s) in Jinja template"
            })

        return json_response({
            "valid": True,
            "suggestions": suggestions,
            "message": "Jinja template syntax looks good!",
            "tip": "Use {{ }} for expressions and {% %} for statements"
        })
