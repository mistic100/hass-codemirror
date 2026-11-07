# CodeMirror for Home Assistant

Simple yet powerful add-on to edit your configuration directly in the browser.

This is a fork of [Blueprint Studio](https://github.com/soulripper13/blueprint-studio) with all heavy features removed.

> [!NOTE]
> Most of the original code is AI-generated, all my commits since the fork are not.

### Motivation

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

Improvements:
- Lazy loaded treeview
- Streamed file upload/download (no base64)
- Native PDF viewer
- Optimized files search (server-side)


## Installation

### Marketplace

The integration is available for Home Assistant Marketplace.

1. **Add the repository**:

   [![Open your Home Assistant instance and open a repository in the Marketplace.](https://my.home-assistant.io/badges/marketplace_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=mistic100&repository=hass-codemirror)
      
3. **Install the Integration**:

    [![Open your Home Assistant instance and browse the Marketplace.](https://my.home-assistant.io/badges/marketplace_browse.svg)](https://my.home-assistant.io/redirect/marketplace_browse/?search=CodeMirror)

### Manual

1. Download the latest release from the [releases page](https://github.com/mistic100/hass-codemirror/releases)
2. Extract the `code_mirror` folder to your `custom_components` directory
3. Restart Home Assistant
4. Go to **Settings > Devices & Services > Add Integration**
5. Search for and select **CodeMirror**.


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
