# Nuvio CORS Unlocker Extension

A lightweight, high-performance universal WebExtension (Manifest V3) designed for **Nuvio Web**. It unlocks Cross-Origin Resource Sharing (CORS) headers on debrid video streams and external media CDNs, enabling zero-latency playback and direct **WebCodecs hardware acceleration**.

---

## Universal Multi-Platform Compatibility

| Operating System | Supported Browsers | Installation Method |
|---|---|---|
| **Windows** | Chrome, Brave, Edge, Opera, Vivaldi, Firefox | Load unpacked or ZIP via `chrome://extensions` or `about:debugging` |
| **macOS** | Chrome, Brave, Edge, Safari, Firefox, Orion | Load unpacked in Chrome/Brave/Edge or convert to Safari via `xcrun` |
| **Linux** | Chrome, Chromium, Brave, Edge, Firefox | Load unpacked or ZIP in browser extension manager |
| **Android** | Kiwi Browser, Lemur Browser, Firefox Nightly, Iceraven | Load unpacked folder or install ZIP via browser Extensions menu |
| **iPadOS & iOS** | Orion Browser (native Chrome/Firefox extension support), Safari (via Web Extension App) | Install directly in Orion via Extensions menu, or build for Safari |

---

## Why Is This Needed?

Some debrid providers (such as TorBox, Real-Debrid via addon redirects, and certain media hosts) do not send permissive CORS headers (`Access-Control-Allow-Origin: *`, `Access-Control-Expose-Headers: *`) on their redirect responses.

When running directly in the browser:
- Without this extension, the web app falls back to the server-side edge resolver (`/api/resolve`).
- **With this extension installed**, all video stream chunks, playlists (`.m3u8`, `.mpd`), and subtitles (`.vtt`, `.srt`) are unlocked directly on your device.
- Zero server proxy calls, faster seek times, and full hardware decoding via WebCodecs.

---

## Installation Guide by Platform

### 1. Windows / macOS / Linux (Desktop Chromium)
1. Download or extract `nuvio-cors-extension-v1.0.0.zip`.
2. Open your browser and navigate to the extension manager:
   - **Chrome:** `chrome://extensions/`
   - **Brave:** `brave://extensions/`
   - **Edge:** `edge://extensions/`
3. Toggle on **Developer mode** (top-right switch).
4. Click **Load unpacked** and select the `NuvioCorsExtension` directory.
5. Pin the Nuvio icon to your toolbar.

### 2. Desktop Firefox
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `manifest.json` inside the `NuvioCorsExtension` directory.

### 3. Android (Kiwi Browser or Lemur Browser)
1. Install **Kiwi Browser** or **Lemur Browser** from Google Play or GitHub.
2. Download or copy `nuvio-cors-extension-v1.0.0.zip` to your device.
3. Open Kiwi/Lemur, tap the 3-dot menu (`⋮`), and select **Extensions**.
4. Enable **Developer mode**.
5. Tap **+(from .zip / .crx / .user.js)** and select the ZIP file.
6. The extension is now active on Android!

### 4. iPadOS & iOS (Orion Browser - Recommended)
1. Install **Orion Browser by Kagi** from the App Store (iPad and iPhone).
2. Open Orion, tap the gear icon / menu (`⋯`), and tap **Extensions**.
3. Tap **Install from File...** or install the unpacked folder.
4. Orion runs the extension using its native WebKit WebExtensions engine!

### 5. macOS / iPadOS / iOS (Apple Safari via Xcode Converter)
On a Mac, you can package this extension into a signed Safari Extension for macOS and iOS/iPadOS using Apple's official tool:
```bash
xcrun safari-web-extension-converter NuvioCorsExtension --app-name "Nuvio CORS Unlocker"
```
Open the generated Xcode project, build, and enable under Safari Settings > Extensions.

---

## How It Works

This extension utilizes the W3C standard **Declarative Net Request API** (`declarativeNetRequest`). Rather than intercepting and inspecting request bodies in JavaScript, the browser network stack itself appends the necessary CORS response headers at the lowest layer:

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
