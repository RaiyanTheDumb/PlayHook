# PlayHook

Keyboard shortcuts for controlling video playback on any website — seek, play/pause, speed, mute, and fullscreen — with per-site and per-tab controls.

## Features

- `←` / `→` — seek backward/forward (configurable: 1s to 10min)
- `Space` — play/pause
- `0`–`9` — jump to 0%–90%
- `M` — mute/unmute
- `F` — fullscreen
- `Shift + ,` / `Shift + .` — decrease/increase speed (0.25x–3x)
- Exclude a website or pause the extension, either everywhere or just for the current tab
- Automatically detects the active video, even on sites like Facebook/Instagram/TikTok that keep multiple videos in the DOM at once

## Installation (unpacked, for development)

1. Clone this repo or download it as a ZIP and extract it.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.

## Files

- `manifest.json` — extension configuration
- `content.js` — keyboard shortcut logic, injected into every page
- `popup.html` / `popup.js` — the settings popup
- `icon16.png` / `icon48.png` / `icon128.png` — extension icons

## License

MIT
