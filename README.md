# CodeMirror for Home Assistant

**DRAFT**

Simple yet powerful add-on to edit your configuration directly in the browser.

This is a fork of [Blueprint Studio](https://github.com/soulripper13/blueprint-studio) with all heavy features removed.

**Motivation**

Blueprint Studio started as a nice alternative to the official File editor add-on and much more lighter than the VS Code add-on. However I believe it became bloated with advanced features that make it slower to start and pose potential security risks (AI and SSH terminal mainly). Being itself mostly written with AI, I don't think it is viable on the long term.

As a result I forked the project according to the MIT license and had for objective to go back to the basics: pure local file editing, using the power of CodeMirror.

The following features have been removed:
- SFTP integration 
- Git integration 
- AI agents
- Terminal panel
- PDF viewer
- Extra themes other than light and dark
- Custom colors and fonts

---

## Installation
This integration is best installed via the [Home Assistant Community Store (HACS)](https://hacs.xyz/).

### HACS (Recommended)

1. **Add the Custom Repository**:
    * Ensure HACS is installed.
    * Go to **HACS > Integrations > ... (three dots) > Custom repositories**.
    * Add this repository's URL: `https://github.com/mistic100/hass-codemirror`
    * Select the category **Integration** and click **Add**.
      
2. **Install the Integration**:
    * In HACS, search for "CodeMirror" and click **Download**.
    * Follow the prompts to complete the download.

3. **Restart Home Assistant**:
    * Go to **Settings > System** and click the **Restart** button.

4. **Add the Integration**:
    * Go to **Settings > Devices & Services > Add Integration**.
    * Search for and select **CodeMirror**.
    * The setup wizard will guide you through the final configuration steps.

### Manual Installation
1. Download the latest release from the [releases page](https://github.com/mistic100/hass-codemirror/releases)
2. Extract the `code_mirror` folder to your `custom_components` directory
3. Restart Home Assistant
4. Go to Settings → Devices & Services → Add Integration → CodeMirror

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
