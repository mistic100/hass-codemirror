# Contributing to Blueprint Studio

First off, thank you for considering contributing to Blueprint Studio! It's people like you that make Blueprint Studio such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our commitment to providing a welcoming and inspiring community for all. Please be respectful and constructive in your interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

**Bug Report Template:**
- **Description**: Clear description of the bug
- **Steps to Reproduce**: Numbered steps to reproduce the behavior
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Screenshots**: If applicable
- **Environment**:
  - Home Assistant version
  - Blueprint Studio version
  - Browser and version
  - Operating System

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear title** and description
- **Use case**: Why this enhancement would be useful
- **Possible implementation**: If you have ideas on how to implement it
- **Examples**: From other projects if applicable

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes**:
   - Follow the existing code style
   - Add comments for complex logic
   - Update documentation if needed
3. **Test thoroughly**:
   - Test in a real Home Assistant environment
   - Check for errors in Home Assistant logs
   - Test in multiple browsers if changing frontend
4. **Commit your changes**:
   - Use clear, descriptive commit messages
   - Reference issues and pull requests when relevant
5. **Push to your fork** and submit a pull request

## Development Setup

### Prerequisites
- Home Assistant installation (development instance recommended)
- Git
- Text editor or IDE
- Basic knowledge of Python and JavaScript

### Setting Up Development Environment

1. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/blueprint-studio.git
   cd blueprint-studio
   ```

2. **Link to Home Assistant**:
   ```bash
   # Create symlink in your Home Assistant config directory
   ln -s $(pwd)/custom_components/blueprint_studio /path/to/homeassistant/config/custom_components/blueprint_studio
   ```

3. **Restart Home Assistant** to load the integration

4. **Make changes** and test:
   - Edit files in your cloned repository
   - Restart Home Assistant after Python changes
   - Refresh browser after frontend changes
   - Check logs for errors

### Project Structure

```
blueprint-studio/
├── custom_components/
│   └── blueprint_studio/
│       ├── __init__.py          # Main integration setup
│       ├── config_flow.py       # Configuration flow
│       ├── const.py             # Constants
│       ├── manifest.json        # Integration metadata
│       ├── strings.json         # UI strings
│       ├── translations/        # Translations
│       ├── panels/              # Frontend HTML
│       └── www/                 # Frontend JS/CSS
├── .github/
│   └── workflows/               # CI/CD workflows
├── images/                      # Screenshots and images
├── .gitignore
├── hacs.json                    # HACS configuration
├── info.md                      # HACS info page
├── LICENSE
└── README.md
```

## Coding Standards

### Python Code
- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/)
- Use type hints where appropriate
- Use descriptive variable and function names
- Add docstrings for functions and classes
- Keep functions focused and concise

**Example:**
```python
async def _read_file(self, hass: HomeAssistant, path: str) -> web.Response:
    """Read the contents of a file.

    Args:
        hass: Home Assistant instance
        path: Relative path to the file

    Returns:
        JSON response with file content or error
    """
    # Implementation here
```

### JavaScript Code
- Use modern ES6+ syntax
- Use descriptive variable names
- Add comments for complex logic
- Keep functions small and focused

### Frontend
- Maintain the VS Code-inspired design language
- Ensure responsive design where possible
- Test in multiple browsers (Chrome, Firefox, Safari, Edge)
- Ensure accessibility (keyboard navigation, screen readers)

## Testing

Before submitting a pull request:

1. **Manual Testing**:
   - Test all affected functionality
   - Test error cases and edge cases
   - Check Home Assistant logs for errors/warnings
   - Test in a fresh Home Assistant installation if possible

2. **File Operations Testing**:
   - Create, read, update, delete files
   - Test with various file types
   - Test path traversal protection
   - Test file size limits

3. **Browser Testing**:
   - Test in Chrome/Chromium
   - Test in Firefox
   - Test in Safari (if available)
   - Test on mobile browsers

## Commit Messages

Write clear, descriptive commit messages:

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit first line to 72 characters
- Reference issues and PRs when relevant

**Examples:**
```
Add file upload functionality

Fix YAML validation error handling

Update README with troubleshooting section

Refs #123: Implement dark theme toggle
```

## Version Numbering

We use [Semantic Versioning](https://semver.org/):
- **MAJOR** version: Incompatible API changes
- **MINOR** version: New functionality (backwards compatible)
- **PATCH** version: Bug fixes (backwards compatible)

## Questions?

Feel free to open an issue with your question or contact the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Thank You!

Your contributions to open source, large or small, make projects like this possible. Thank you for taking the time to contribute!
