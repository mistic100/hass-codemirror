# CodeMirror for Home Assistant

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
- Extra themes other than light and dark
- Custom colors and fonts
- Split view
- Multi selection
- Global search & replace
- Full workspace restore (only restore open tabs)


## Installation

### HACS

The integration is available in [HACS](https://hacs.xyz/).
      
1. **Install the Integration**:

    Simply click on the button to open the repository in HACS or search for "CodeMirror" and download it through the UI.

    [![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=mistic100&repository=hass-codemirror&category=integration)

2. **Restart Home Assistant**:

    * Go to **Settings > System** and click the **Restart** button

3. **Add the Integration**:

    * Go to **Settings > Devices & Services > Add Integration**
    * Search for and select **CodeMirror**

### Manual

1. Download the latest release from the [releases page](https://github.com/mistic100/hass-codemirror/releases)
2. Extract the `code_mirror` folder to your `custom_components` directory
3. Restart Home Assistant
4. Go to **Settings > Devices & Services > Add Integration**
5. Search for and select **CodeMirror**.


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
