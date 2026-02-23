/**
 * ============================================================================
 * DIALOGS MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Specialized dialog utilities for issue reporting, feature requests, and
 * help dialogs (shortcuts, about). Provides user feedback and help mechanisms.
 *
 * EXPORTED FUNCTIONS:
 * - showShortcuts() - Show keyboard shortcuts dialog
 * - hideShortcuts() - Hide shortcuts dialog
 * - requestFeature(description) - Submit feature request
 * - reportIssue(description) - Submit bug report
 *
 * HOW TO ADD NEW FEATURES:
 * 1. Add new dialog: Create show/hide functions, add HTML, handle keyboard
 * 2. Add feedback type: Use fetchWithAuth() to server, validate, show toast
 * 3. Update shortcuts: Add to showShortcuts() grouped by category
 *
 * INTEGRATION: event-handlers.js, api.js, ui.js
 * COMMON PATTERNS: showShortcuts(), await reportIssue(desc)
 *
 * ============================================================================
 */
import { API_BASE } from './constants.js';
import { fetchWithAuth } from './api.js';
import { elements } from './state.js';

/**
 * Opens GitHub issue form with bug report template
 */
export async function reportIssue() {
  let haVersion = "Unknown";
  let integrationVersion = "2.3.0";

  try {
    const versionData = await fetchWithAuth(`${API_BASE}?action=get_version`);
    if (versionData.ha_version) haVersion = versionData.ha_version;
    if (versionData.integration_version) integrationVersion = versionData.integration_version;
  } catch (e) {
    console.error("Failed to fetch version info", e);
  }

  const body = `
**Describe the bug or feature request**
A clear and concise description of what the issue is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Environment**
- **Blueprint Studio Version:** ${integrationVersion}
- **Home Assistant Version:** ${haVersion}
- **Browser:** ${navigator.userAgent}

**Screenshots**
If applicable, add screenshots to help explain your problem.
  `.trim();

  const title = "[BUG] ";
  const url = `https://github.com/soulripper13/blueprint-studio/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank');
}

/**
 * Opens GitHub issue form with feature request template
 */
export function requestFeature() {
  const body = `
## Is your feature request related to a problem?
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

## Describe the solution you'd like
A clear and concise description of what you want to happen.

## Describe alternatives you've considered
A clear and concise description of any alternative solutions or features you've considered.

## Use Case
Explain how this feature would be used and who would benefit from it.

## Example
If applicable, provide an example of how this feature would work or look.

## Screenshots/Mockups
If applicable, add screenshots or mockups to help explain your feature request.

## Additional Context
Add any other context, links, or references about the feature request here.

## Checklist
- [ ] I have checked existing issues to avoid duplicates
- [ ] I have described the use case clearly
- [ ] This feature aligns with Blueprint Studio's purpose
  `.trim();

  const title = "[FEATURE] ";
  const url = `https://github.com/soulripper13/blueprint-studio/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank');
}

/**
 * Shows keyboard shortcuts overlay
 */
export function showShortcuts() {
  if (elements.shortcutsOverlay) {
    elements.shortcutsOverlay.classList.add("visible");
  }
}

/**
 * Hides keyboard shortcuts overlay
 */
export function hideShortcuts() {
  if (elements.shortcutsOverlay) {
    elements.shortcutsOverlay.classList.remove("visible");
  }
}
