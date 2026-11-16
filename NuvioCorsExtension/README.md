# Nuvio CORS Unlocker Extension

A lightweight, high-performance Chromium extension (Manifest V3) designed for **Nuvio Web**. It unlocks Cross-Origin Resource Sharing (CORS) headers on debrid video streams and external media CDNs, enabling zero-latency playback and direct **WebCodecs hardware acceleration**.

---

## Supported Browsers

- **Google Chrome** (v102+)
- **Brave Browser** (v102+)
- **Microsoft Edge** (v102+)
- Any modern Chromium-based browser (Opera, Vivaldi, Arc, etc.)

---

## Why Is This Needed?

Some debrid providers (such as TorBox, Real-Debrid via addon redirects, and certain media hosts) do not send permissive CORS headers (`Access-Control-Allow-Origin: *`, `Access-Control-Expose-Headers: *`) on their redirect responses.

When running directly in the browser:
- Without this extension, the web app falls back to the server-side edge resolver (`/api/resolve`).
- **With this extension installed**, all video stream chunks, playlists (`.m3u8`, `.mpd`), and subtitles (`.vtt`, `.srt`) are unlocked directly on your device.
- Zero server proxy calls, faster seek times, and full hardware decoding via WebCodecs.

---

## Installation Guide

### Option 1: Install from Release ZIP (Recommended)
1. Download or locate `nuvio-cors-extension-v1.0.0.zip`.
2. Extract the ZIP file to a convenient folder on your computer.
3. Follow the browser-specific steps below.

### Option 2: Load Unpacked Source
You can load the `NuvioCorsExtension` directory directly:

#### For Google Chrome:
1. Open Chrome and navigate to `chrome://extensions/`.
2. Turn on **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left toolbar.
4. Select the `NuvioCorsExtension` folder (or extracted release folder).
5. The extension icon will appear in your extensions list and toolbar!

#### For Brave Browser:
1. Open Brave and navigate to `brave://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `NuvioCorsExtension` folder.
5. *Note:* The extension operates independently of Brave Shields; you do not need to lower shields.

#### For Microsoft Edge:
1. Open Edge and navigate to `edge://extensions/`.
2. Toggle on **Developer mode** in the left sidebar.
3. Click **Load unpacked**.
4. Select the `NuvioCorsExtension` folder.

---

## How It Works

This extension utilizes the modern **Chrome Declarative Net Request API** (`declarativeNetRequest`). Rather than intercepting and inspecting request bodies in JavaScript, the Chromium browser engine itself safely appends the necessary CORS response headers at the network layer:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, PUT, POST, DELETE, HEAD, OPTIONS, PATCH`
- `Access-Control-Allow-Headers: *`
- `Access-Control-Expose-Headers: *` *(Exposes byte-range headers critical for HLS/DASH/MP4 seeking)*
- `Cross-Origin-Resource-Policy: cross-origin`

---

## Permissions Breakdown

- `declarativeNetRequest`: Modifies response headers for CORS compliance in the browser network stack.
- `storage`: Remembers whether you have toggled the unlocker ON or OFF in the popup menu.
- `<all_urls>`: Required so the rules apply across arbitrary debrid CDN hostnames and stream providers.
