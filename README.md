<div align="center">

  <img src="public/icon-512.png" alt="Nuvio Web Enhanced Logo" width="132" height="132" style="border-radius: 30px; box-shadow: 0 12px 36px rgba(0,0,0,0.6);" />

  <h1 align="center">Nuvio Web Enhanced</h1>

  <p align="center">
    <strong>A next-generation in-browser streaming hub and hardware-accelerated media player with native external player handoff, real-time Supabase cloud sync, and zero-latency CORS resolution.</strong>
  </p>

  <p align="center">
    <a href="https://github.com/anilabhadatta/NuvioWebEnhanced/releases"><img src="https://img.shields.io/badge/Release-v1.0.0-FF5722?style=for-the-badge&logo=github&logoColor=white" alt="Release v1.0.0" /></a>
    <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16.2.11-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16" /></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-4.0+-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" /></a>
    <a href="./NuvioCorsExtension"><img src="https://img.shields.io/badge/Extension-MV3_Chromium-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Extension MV3" /></a>
    <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-Auth_%26_Cloud_Sync-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase Cloud" /></a>
    <a href="https://www.themoviedb.org"><img src="https://img.shields.io/badge/TMDB-Metadata_v3-01D277?style=for-the-badge&logo=the-movie-database&logoColor=white" alt="TMDB" /></a>
    <a href="https://trakt.tv"><img src="https://img.shields.io/badge/Trakt.tv-Scrobble_Sync-ED1C24?style=for-the-badge&logo=trakt&logoColor=white" alt="Trakt.tv" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License" /></a>
  </p>

  <p align="center">
    <a href="#overview">Overview</a> •
    <a href="#key-features">Key Features</a> •
    <a href="#nuvio-cors-extension">CORS Extension</a> •
    <a href="#external-players">External Players</a> •
    <a href="#nuvio-library--cloud-sync">Nuvio Library</a> •
    <a href="#installation--setup">Setup</a> •
    <a href="#credits--acknowledgements">Credits</a> •
    <a href="#disclaimer">Disclaimer</a>
  </p>

</div>

---

## Overview

**Nuvio Web Enhanced** is an open-source, desktop-grade media streaming platform designed from the ground up for modern web browsers. Built on Next.js 16 (App Router + Turbopack) and styled with an ultra-sleek dark glassmorphism interface, it connects seamlessly with Stremio addons, TMDB metadata catalogs, Trakt scrobbling, and debrid providers.

Whether streaming directly in your browser with hardware-accelerated MSE/WebCodecs decoding or handing off streams to your favorite desktop player (**mpv**, **VLC**, **PotPlayer**, or **IINA**), Nuvio Web Enhanced delivers a smooth, native-feeling streaming experience across Windows, macOS, Linux, and mobile devices.

---

## Key Features

### 🎬 Powerful Dual Web Player Engine
- **Movi-Player & Shaka-Player Support:** High-efficiency playback of HLS (`.m3u8`), MPEG-DASH (`.mpd`), and direct MP4/MKV video streams.
- **Local / CDN Core Toggle:** Switch between a bundled local copy of `element.js` or the jsDelivr CDN directly in **Settings -> Playback**.
- **Hardware Acceleration:** Zero-lag 4K/60fps and HDR video rendering via WebCodecs and Media Source Extensions (MSE).
- **Automated Segment Skipping:** Community-driven intro/outro/recap skips via **IntroDB** and anime opening/ending mapping via **Anime-Skip**.

### 🖥️ Native External Player Handoff (Cross-Platform)
- **Universal System Default Player:** Generates a smart Extended M3U playlist file with `#EXTINF`, `#EXTVLCOPT:start-time`, and `#EXT-MPV-OPTIONS:--start` that launches your operating system's default media player.
- **Direct Protocol Integration:** Deep-link support for **mpv** (`mpv://`), **VLC** (`vlc://` on Windows/Linux, `vlc-x-callback://` on macOS), **PotPlayer** (`potplayer://`), and **IINA** (`iina://weblink`).
- **Interactive Player Chooser:** Click to launch the default player, or right-click to open the player selector modal, copy custom CLI launch commands (`mpv --title="..." --start=...`), or copy raw stream URLs.
- **"Always External" Mode:** Dedicated toggle in **Settings -> Playback** to automatically forward all playback requests directly to your desktop player.

### 📚 Nuvio Library with Real-Time Cloud Sync
- **Native Supabase Bi-Directional Sync:** Connects directly with the Nuvio Android app backend using Supabase RPCs (`sync_pull_library` & `sync_push_library`) and the `library_items` table.
- **Profile-Scoped Storage:** Library content automatically separates across profiles (`BiraJ`, `Hall TV`, etc.) matching the official Nuvio mobile architecture.
- **Smart Categorization:** Filter saved items by **All Items**, **Movies**, **TV Series**, and **Anime** with category switcher menus on card hover.
- **Live TMDB Catalog Search:** Add any title on the fly using the integrated **+ Add to Library** multi-search modal.
- **TorBox Cloud Integration:** Browse, manage, and stream files stored in your remote TorBox cloud storage.
- **Polished Skeleton States & Manual Sync:** Real-time sync feedback with a manual sync refresh button and skeleton loading placeholders.

### 🌐 Dual CORS Resolution Architecture
- **Serverless Edge Resolver (`/api/resolve`):** Automatically resolves and unwraps debrid CDN redirects (TorBox, Real-Debrid, etc.) server-side. Works universally across Safari, Chrome, Firefox, iOS, and Android without requiring extensions.
- **Nuvio CORS Extension (Client Acceleration):** Dedicated Manifest V3 browser extension for Google Chrome, Brave, and Microsoft Edge that unlocks direct client-to-CDN streaming with zero proxy overhead.

### 🎨 Design & UX Polish
- **Background Scroll Locking:** Completely prevents background window scrolling whenever modal dialogs (`MovieModal`, `StreamPickerModal`, `ExternalPlayerModal`, `FolderDetailModal`) are active.
- **Overscroll Containment:** Prevents rubber-banding and scroll chaining using `overscroll-behavior: contain`.
- **Responsive Layout & Visual Hierarchy:** Fluid grid system, refined segmented buttons with 1px dividers, and high-clarity typography.
- **Multi-Resolution Brand Suite:** Tailored high-DPI squircle icons (16px to 512px, 7-layer multi-resolution ICO, Apple Touch, and social OpenGraph cards).

---

## Nuvio CORS Extension

Some debrid providers and media CDNs do not include permissive CORS response headers on their streaming endpoints. While Nuvio's serverless edge resolver handles this automatically, the **Nuvio CORS Unlocker Extension** allows your browser to stream directly from CDNs at full local network throughput.

<div align="center">
  <img src="public/favicon.svg" alt="Extension Logo" width="56" height="56" />
  <p><strong>Nuvio CORS Unlocker Extension v1.0.0 (Manifest V3)</strong></p>
  <p>Engineered for <strong>Google Chrome</strong>, <strong>Brave Browser</strong>, and <strong>Microsoft Edge</strong></p>
  <p>
    <a href="./releases/nuvio-cors-extension-v1.0.0.zip"><strong>📥 Download Ready-to-Install ZIP (v1.0.0)</strong></a>
  </p>
</div>

### What the Extension Does
The extension utilizes the high-performance Chromium **Declarative Net Request API** (`declarativeNetRequest`) to adjust response headers directly inside the browser networking pipeline:
* `Access-Control-Allow-Origin: *`
* `Access-Control-Allow-Methods: GET, PUT, POST, DELETE, HEAD, OPTIONS, PATCH`
* `Access-Control-Allow-Headers: *`
* `Access-Control-Expose-Headers: *` *(Exposes critical `Content-Range` and `Accept-Ranges` headers for fast video seeking)*
* `Cross-Origin-Resource-Policy: cross-origin`

### How to Install the Extension

The ready-to-use extension is packaged at [`releases/nuvio-cors-extension-v1.0.0.zip`](./releases/nuvio-cors-extension-v1.0.0.zip) and source files are located in [`NuvioCorsExtension/`](./NuvioCorsExtension/).

#### 1. Google Chrome
1. Download [`releases/nuvio-cors-extension-v1.0.0.zip`](./releases/nuvio-cors-extension-v1.0.0.zip) and extract it to a folder (or use the repository's `NuvioCorsExtension` directory).
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** via the toggle switch in the upper-right corner.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the extracted `NuvioCorsExtension` folder.
6. The Nuvio CORS Unlocker is now running in your browser toolbar!

#### 2. Brave Browser
1. Open Brave and go to `brave://extensions/`.
2. Toggle on **Developer mode** in the upper-right corner.
3. Click **Load unpacked** and select the `NuvioCorsExtension` folder.
4. *(Note: The extension works harmoniously alongside Brave Shields; you do not need to disable shields).*

#### 3. Microsoft Edge
1. Open Edge and navigate to `edge://extensions/`.
2. Turn on **Developer mode** in the left sidebar menu.
3. Click **Load unpacked** and choose the `NuvioCorsExtension` folder.

---

## External Players

Nuvio Web Enhanced gives you complete freedom to stream inside your browser or hand off playback to a native desktop media player.

| Player | Protocol / Method | OS Compatibility | Features |
| :--- | :--- | :--- | :--- |
| **System Default** | Extended `.m3u` Smart Playlist | Windows, macOS, Linux | Launches your OS default video app; includes title and seek offset metadata |
| **mpv** | `mpv://` & CLI Generator | Windows, macOS, Linux | Ultra-fast GPU decoding, custom shaders, automated `--start` seek and `--title` |
| **VLC media player** | `vlc://` / `vlc-x-callback://` | Windows, macOS, Linux | Wide codec support, network buffering, external subtitle track autoloading |
| **PotPlayer** | `potplayer://` | Windows | Native seek command parameters, rich hardware acceleration options |
| **IINA** | `iina://weblink?url=...` | macOS | Polished native macOS design, picture-in-picture, trackpad gestures |

### How to Use External Players
* **Default Single-Click:** Hover over any stream or media card and click the external player icon to immediately launch your configured player.
* **Right-Click for Options:** Right-click the external player button to open the **External Player Modal**:
  * Switch active player on the fly (**System Default**, **mpv**, **VLC**, **PotPlayer**, **IINA**).
  * Copy pre-formatted CLI terminal commands (e.g. `mpv "https://..." --start=1240 --title="..."`).
  * Download the generated Extended `.m3u` playlist file.
  * Copy raw direct stream links to clipboard.
* **Make External Player Default:** Navigate to **Settings -> Playback -> External Player** to select your preferred player and toggle **"Always Open in External Player"**.

### Registering `mpv://` on Windows
To open `mpv://` links directly from your browser on Windows, run the provided helper script:
```powershell
python scripts/register_mpv_protocol.py
```
*(Alternatively, associate `.m3u` files with your favorite player in Windows Settings to use the recommended System Default method).*

---

## Nuvio Library & Cloud Sync

The **Library** tab delivers seamless cross-device synchronization between your desktop browser and the Nuvio mobile app:

```
┌────────────────────────────────────────────────────────┐
│  Library               [ Saved ]   [ Cloud ]           │
│                                                        │
│  [All Items 6]  [Movies 4]  [TV Series 1]  [Anime 1]   │
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Decision │  │   Gone   │  │   The    │  │ Heart of │ │
│  │ to Leave │  │   Girl   │  │Machinist │  │the Beast │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└────────────────────────────────────────────────────────┘
```

* **Instant Optimistic Updates:** Items added or removed reflect immediately in the UI.
* **Supabase Cloud Sync:** Background synchronization uses `sync_push_library` and `sync_pull_library` with local profile isolation.
* **Playable Directly:** Click any card to launch the video player or browse available streams.
* **Hover Category Selection:** Re-categorize items between Movie, Series, and Anime directly from card hover menus.

---

## Installation & Setup

### Prerequisites
* **Node.js:** `v20.x` or `v22.x+` (Recommended: `v22.13.0+`)
* **Package Manager:** `npm`, `pnpm`, or `yarn`

### 1. Clone the Repository
```bash
git clone https://github.com/Biraj2004/NuvioWebEnhanced.git
cd NuvioWebEnhanced
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_v3_api_key
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
npm run start
```

---

## Repository Structure

```
NuvioWebEnhanced/
├── NuvioCorsExtension/         # Chromium MV3 CORS Extension (Chrome, Brave, Edge)
│   ├── icons/                  # 16, 32, 48, 128px high-DPI brand icons
│   ├── manifest.json           # Manifest V3 configuration & declarativeNetRequest rules
│   ├── popup.html / popup.js   # Extension toggle popup controller
│   └── rules.json              # Declarative response header modifications
├── public/                     # High-DPI brand icons, favicons, manifests & web workers
│   ├── favicon.ico             # 7-layer multi-resolution ICO (16px to 256px)
│   ├── favicon.svg             # Clean vector squircle icon
│   ├── apple-touch-icon.png    # 180×180 iOS Touch icon
│   ├── icon-192.png / 512.png  # PWA standard and maskable icons
│   └── og-image.png            # 1200×630 OpenGraph and Twitter card
├── releases/                   # Production-ready zipped artifacts
│   └── nuvio-cors-extension-v1.0.0.zip
├── scripts/                    # Test suites, packaging, and asset generators
│   ├── package_extension.py    # Automates extension release packaging
│   ├── register_mpv_protocol.py# Registers mpv:// URL handler on Windows
│   ├── test_suite.py           # Validates assets, manifests, and extension
│   └── test_external_player.py # Tests protocol generators and settings
└── src/
    ├── app/                    # Next.js 16 App Router pages & API route handlers
    │   ├── api/resolve/        # Serverless debrid edge redirect resolver
    │   ├── dashboard/          # Home dashboard catalog
    │   ├── library/            # Nuvio Library view
    │   ├── player/             # In-browser video player
    │   ├── search/             # TMDB live search & discovery
    │   └── settings/           # User settings (Playback, Profiles, Addons, TorBox)
    ├── components/             # Reusable React components (Player, Modals, Library)
    └── lib/                    # Supabase client, TMDB API, Stremio addons & sync logic
```

---

## Credits & Acknowledgements

* **Lead Architect & Developer:** [@Biraj2004](https://github.com/Biraj2004) — Core web architecture, Supabase cloud sync, external player integration, brand identity, and release management.
* **Co-Developer & Contributor:** [@anilabhadatta](https://github.com/anilabhadatta) — Project co-development, feature implementation, and collaborative maintenance.
* **Original Vision & Foundational Inspiration:** Heartfelt gratitude to the **Nuvio Team** — **Tapframe and friends** for creating the original Nuvio Android application, brand vision, and mobile ecosystem that inspired this web project.

---

## Disclaimer

**Nuvio Web Enhanced** is an open-source media interface and collection manager created strictly for personal and educational use.

* This application does **not** host, store, cache, or distribute any media files, video streams, or copyright-protected content.
* All catalog metadata is fetched via legitimate third-party APIs (such as [The Movie Database - TMDB](https://www.themoviedb.org/)).
* Video streaming links are retrieved dynamically through user-configured third-party Stremio community addons or user-provided personal debrid API credentials.
* Users are solely responsible for ensuring that their media consumption complies with all applicable local laws, regulations, and terms of service. The developers assume no liability for third-party addon content or user activities.

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/Biraj2004">@Biraj2004</a>, <a href="https://github.com/anilabhadatta">@anilabhadatta</a>, and the Nuvio community.</p>
</div>
