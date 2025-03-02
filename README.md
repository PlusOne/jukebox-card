# Lovelace Jukebox Card Extended

This custom Lovelace card provides a media player interface for Home Assistant. It allows you to select speakers, adjust volume, and control media playback—including a sleep timer to automatically stop media after a specified duration.

## Pre-release Note
**This version is in its pre-pre phase and has been adapted to build in some of the most wanted features by the community.** Expect further improvements and refinements as new feedback is incorporated.

## Features
- **Speaker Selection:** Toggle between media players.
- **Volume Control:** Adjust volume and mute/unmute.
- **Stop Button:** Immediately stop media playback.
- **Sleep Timer:** Prompts for minutes and stops media after the delay.
- **Station List:** Quick access to predefined streaming URLs.

## Installation

1. **Copy the File:**  
   Place `jukebox-card-ext.js` in your Home Assistant configuration under the directory:  
   `/config/www/community_plugin/jukebox-card-extended/`

2. **Configure Lovelace Resource:**  
   In your Lovelace configuration (either YAML or UI resources), add:

   ```yaml
   resources:
     - url: /community_plugin/jukebox-card-extended/jukebox-card-ext.js
       type: module
   ```

## Example Configuration

Below is an example configuration snippet for your Lovelace dashboard:

```yaml
views:
  - title: Example
    cards:
      - type: "custom:jukebox-card-ext"
        entities:
          - media_player.living_room
          - media_player.kitchen
        links:
          - name: Jazz Station
            url: http://example.com/jazz-stream
          - name: Rock Station
            url: http://example.com/rock-stream
```

## HACS Integration

If you're using HACS, ensure that your `hacs.json` is configured as follows:

```json
{
    "name": "Lovelace Jukebox Card Extended",
    "render_readme": true,
    "filename": "jukebox-card-ext.js"
}
```

## Troubleshooting

- **Resource URL:** Verify that the resource URL in your Lovelace config points correctly to `/community_plugin/jukebox-card-extended/jukebox-card-ext.js`.
- **Card Type:** Make sure the card type in your configuration is `"custom:jukebox-card-ext"`.
- **Sleep Timer:** If the sleep timer isn’t stopping the media, check your Home Assistant logs and browser console for errors. Confirm that the service `media_player.media_stop` is available and that your entity IDs are correct.

## Acknowledgements

Thanks to the Home Assistant community for the inspiration and foundational work that led to this extended card.

Enjoy your enhanced media experience with Lovelace Jukebox Card Extended!
