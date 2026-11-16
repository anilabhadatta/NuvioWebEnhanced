export type ExternalPlayerId = "chooser" | "system" | "mpv" | "vlc" | "potplayer" | "iina";

export interface ExternalPlayerMediaMeta {
  url: string;
  title?: string;
  currentTime?: number;
  duration?: number;
  subtitleUrl?: string;
  subtitleLabel?: string;
}

export interface ExternalPlayerOption {
  id: ExternalPlayerId;
  name: string;
  description: string;
  protocol: string;
  supportedOS: ("windows" | "mac" | "linux")[];
}

export const EXTERNAL_PLAYER_OPTIONS: ExternalPlayerOption[] = [
  {
    id: "mpv",
    name: "mpv",
    description: "Lightweight, ultra-fast, hardware accelerated video player",
    protocol: "mpv://",
    supportedOS: ["windows", "mac", "linux"],
  },
  {
    id: "system",
    name: "System Default Player",
    description: "Opens stream in your operating system's default media player via native playlist handoff",
    protocol: ".m3u",
    supportedOS: ["windows", "mac", "linux"],
  },
  {
    id: "vlc",
    name: "VLC media player",
    description: "Popular open-source media player with broad codec support",
    protocol: "vlc://",
    supportedOS: ["windows", "mac", "linux"],
  },
  {
    id: "potplayer",
    name: "PotPlayer",
    description: "Feature-rich multimedia player with advanced filter options",
    protocol: "potplayer://",
    supportedOS: ["windows"],
  },
  {
    id: "iina",
    name: "IINA",
    description: "Modern, beautiful media player designed specifically for macOS",
    protocol: "iina://",
    supportedOS: ["mac"],
  },
  {
    id: "chooser",
    name: "Always Ask (Chooser)",
    description: "Show the player selection menu each time you click open externally",
    protocol: "menu",
    supportedOS: ["windows", "mac", "linux"],
  },
];

export function getClientOS(): "windows" | "mac" | "linux" {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac") || ua.includes("darwin")) return "mac";
  if (ua.includes("linux")) return "linux";
  return "windows";
}

export function getDefaultExternalPlayer(): ExternalPlayerId {
  if (typeof window === "undefined") return "system";
  const saved = localStorage.getItem("nuvio.default_external_player");
  if (saved && (saved === "mpv" || saved === "system" || saved === "vlc" || saved === "potplayer" || saved === "iina" || saved === "chooser")) {
    return saved as ExternalPlayerId;
  }
  return "system"; // Default to System Default player
}

export function setDefaultExternalPlayer(player: ExternalPlayerId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("nuvio.default_external_player", player);
}

export function getAlwaysExternalPlayer(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("nuvio.always_external_player") === "true";
}

export function setAlwaysExternalPlayer(val: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("nuvio.always_external_player", val ? "true" : "false");
}

/**
 * Generates an Extended M3U playlist file content with all playback metadata.
 * MPV, VLC, PotPlayer, and IINA natively parse #EXTINF and #EXTVLCOPT / #EXT-MPV-OPTIONS.
 */
export function buildM3UContent(meta: ExternalPlayerMediaMeta): string {
  const title = meta.title || "Stream";
  const startTime = meta.currentTime && meta.currentTime > 0 ? Math.floor(meta.currentTime) : 0;
  const lines = [
    "#EXTM3U",
    `#EXTINF:-1 tvg-name="${title}"${startTime > 0 ? ` tvg-time="${startTime}"` : ""},${title}`,
  ];

  if (startTime > 0) {
    lines.push(`#EXTVLCOPT:start-time=${startTime}`);
    lines.push(`#EXT-MPV-OPTIONS:--start=${startTime}`);
  }

  if (meta.subtitleUrl) {
    lines.push(`#EXTVLCOPT:sub-file=${meta.subtitleUrl}`);
    lines.push(`#EXT-MPV-OPTIONS:--sub-file=${meta.subtitleUrl}`);
  }

  lines.push(meta.url);
  return lines.join("\n") + "\n";
}

/**
 * Downloads a generated .m3u playlist file to hand off to the OS default video player.
 */
export function downloadM3UPlaylist(meta: ExternalPlayerMediaMeta): void {
  if (typeof document === "undefined") return;
  const content = buildM3UContent(meta);
  const blob = new Blob([content], { type: "audio/x-mpegurl;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const cleanTitle = (meta.title || "stream").replace(/[^a-zA-Z0-9_\- ]/g, "").trim().replace(/\s+/g, "_");
  a.href = url;
  a.download = `${cleanTitle}.m3u`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Builds the URL protocol string for launching a specific player with all parameters.
 */
export function buildPlayerProtocolUrl(
  playerId: ExternalPlayerId,
  meta: ExternalPlayerMediaMeta
): string {
  const url = meta.url;
  const title = meta.title || "Stream";
  const startTime = meta.currentTime && meta.currentTime > 0 ? Math.floor(meta.currentTime) : 0;
  const subUrl = meta.subtitleUrl;
  const os = getClientOS();

  switch (playerId) {
    case "mpv": {
      // Direct mpv:// protocol handler.
      // mpv natively strips mpv:// and plays the URL.
      // For mpv-handler, query parameters like ?url=...&title=...&start=... are passed.
      if (startTime > 0 || subUrl || title) {
        let params = `url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
        if (startTime > 0) params += `&start=${startTime}`;
        if (subUrl) params += `&sub_file=${encodeURIComponent(subUrl)}`;
        // mpv-handler format
        return `mpv://play/?${params}`;
      }
      return `mpv://${url}`;
    }

    case "vlc": {
      if (os === "mac") {
        let vlcMac = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}`;
        if (subUrl) vlcMac += `&sub=${encodeURIComponent(subUrl)}`;
        return vlcMac;
      }
      return `vlc://${url}`;
    }

    case "potplayer": {
      let pot = `potplayer://${url}`;
      if (startTime > 0) pot += ` /seek=${startTime}`;
      if (subUrl) pot += ` /sub=${encodeURIComponent(subUrl)}`;
      if (title) pot += ` /title=${encodeURIComponent(title)}`;
      return pot;
    }

    case "iina": {
      let iina = `iina://weblink?url=${encodeURIComponent(url)}`;
      if (title) iina += `&mpv_title=${encodeURIComponent(title)}`;
      if (startTime > 0) iina += `&mpv_time-pos=${startTime}`;
      if (subUrl) iina += `&mpv_sub-file=${encodeURIComponent(subUrl)}`;
      return iina;
    }

    default:
      return url;
  }
}

/**
 * Copies the ready-to-run terminal mpv command line to clipboard.
 */
export function buildMpvCommandLine(meta: ExternalPlayerMediaMeta): string {
  const startTime = meta.currentTime && meta.currentTime > 0 ? Math.floor(meta.currentTime) : 0;
  let cmd = `mpv "${meta.url}"`;
  if (meta.title) cmd += ` --title="${meta.title}"`;
  if (startTime > 0) cmd += ` --start=${startTime}`;
  if (meta.subtitleUrl) cmd += ` --sub-file="${meta.subtitleUrl}"`;
  return cmd;
}

/**
 * Dispatches playback to the chosen external player with cross-platform protocol handling.
 */
export function launchExternalPlayer(
  playerId: ExternalPlayerId,
  meta: ExternalPlayerMediaMeta
): { success: boolean; message: string } {
  if (!meta.url) {
    return { success: false, message: "No stream URL available" };
  }

  if (playerId === "system") {
    downloadM3UPlaylist(meta);
    return { success: true, message: "Handed off to System Default Player (.m3u)" };
  }

  const targetUrl = buildPlayerProtocolUrl(playerId, meta);

  try {
    // Hidden anchor click avoids opening empty about:blank browser tabs
    const a = document.createElement("a");
    a.href = targetUrl;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const playerName = EXTERNAL_PLAYER_OPTIONS.find((p) => p.id === playerId)?.name || playerId;
    return { success: true, message: `Opening in ${playerName}...` };
  } catch (err) {
    // Fallback: window.location.href
    try {
      window.location.href = targetUrl;
      return { success: true, message: `Launching ${playerId}...` };
    } catch {
      return { success: false, message: `Failed to invoke ${playerId}` };
    }
  }
}
