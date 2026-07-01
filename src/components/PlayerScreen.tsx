"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { fetchExternalIds, fetchNextEpisode, fetchTvDetails, fetchTvSeason, NextEpisodeMeta } from "@/lib/tmdb";
import { fetchSkipIntervals, SkipInterval } from "@/lib/introDb";
import { saveWatchProgress } from "@/lib/watchProgress";
import { isTraktConnected, traktScrobble } from "@/lib/trakt";
import { autoResolveFirstStream } from "@/lib/addonService";
import StreamPickerModal from "./StreamPickerModal";

function formatTime(sec: number): string {
  if (!isFinite(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// --- Custom subtitle parser & renderer (player-agnostic) ---
interface SubtitleCue { start: number; end: number; text: string; }

function parseTimeToSec(t: string): number {
  // Handles HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS.mmm
  const clean = t.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
}

function parseSubtitleText(raw: string): SubtitleCue[] {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const cues: SubtitleCue[] = [];
  const isVtt = text.startsWith('WEBVTT');
  // Split on double-newline blocks
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;
    // Find the timing line (contains '-->')
    let timingIdx = lines.findIndex(l => l.includes('-->'));
    if (timingIdx === -1) continue;
    const timingLine = lines[timingIdx];
    const match = timingLine.match(/([\d:,.]+)\s+-->\s+([\d:,.]+)/);
    if (!match) continue;
    const start = parseTimeToSec(match[1]);
    const end = parseTimeToSec(match[2]);
    // Everything after timing line is cue text
    const cueLines = lines.slice(timingIdx + 1)
      .filter(l => isVtt ? !l.startsWith('NOTE') && !l.startsWith('REGION') : true)
      // Strip basic HTML/VTT tags like <i>, <b>, <c.white>
      .map(l => l.replace(/<[^>]*>/g, ''));
    const cueText = cueLines.join('\n').trim();
    if (cueText) cues.push({ start, end, text: cueText });
  }
  return cues;
}

// movi-player's built-in color palette (matches MoviElement.SUBTITLE_COLOR_PALETTE)
const SUBTITLE_COLOR_SWATCHES = [
  { label: "White", value: "#FFFFFF" },
  { label: "Yellow", value: "#FFEB3B" },
  { label: "Green", value: "#69F0AE" },
  { label: "Cyan", value: "#80DEEA" },
  { label: "Blue", value: "#82B1FF" },
  { label: "Magenta", value: "#FF80AB" },
  { label: "Red", value: "#FF5252" },
  { label: "Black", value: "#000000" },
];

const SUBTITLE_EDGE_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Shadow", value: "shadow" },
  { label: "Outline", value: "outline" },
  { label: "Raised", value: "raised" },
] as const;

const SUBTITLE_BG_COLOR_SWATCHES = [
  { label: "Transparent", value: "transparent" },
  { label: "Black", value: "#000000" },
  { label: "Dark", value: "#1a1a2e" },
  { label: "Navy", value: "#0d1b2a" },
  { label: "Maroon", value: "#4a0000" },
  { label: "White", value: "#FFFFFF" },
];

type SubtitleEdge = "none" | "shadow" | "outline" | "raised";

interface SubtitleStyle {
  color: string;    // hex e.g. "#FFFFFF"
  bgColor: string;  // hex or "auto" (auto = movi-player picks contrast color)
  sizePct: number;  // 50–200
  bgPct: number;    // 0–100
  edge: SubtitleEdge;
}

const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  color: "#FFFFFF",
  bgColor: "transparent",
  sizePct: 100,
  bgPct: 0,
  edge: "outline",
};

// Hex color string to "r, g, b" format for --movi-sub-bg-rgb
function hexToRgbStr(hex: string): string {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// Push style onto the live movi-player element via its native attribute API.
// movi-player handles persistence to localStorage["movi.subtitleSettings"] internally.
//
// NOTE: Each setAttribute call triggers movi-player's attributeChangedCallback which
// synchronously calls applySubtitleSettings(), resetting --movi-sub-bg-rgb to its
// auto-contrast value. We must set our override in a deferred microtask so it wins.
function applySubtitleStyleToPlayer(player: any, style: SubtitleStyle) {
  if (!player) return;
  player.setAttribute("subtitlecolor", style.color);
  player.setAttribute("subtitlesize", String(style.sizePct));
  player.setAttribute("subtitlebg", String(style.bgPct));
  player.setAttribute("subtitleedge", style.edge);
  // Defer so we run AFTER movi-player's synchronous applySubtitleSettings() resets the var
  setTimeout(() => {
    if (!player.isConnected) return;
    if (style.bgColor !== "auto" && style.bgColor !== "transparent") {
      player.style.setProperty("--movi-sub-bg-rgb", hexToRgbStr(style.bgColor));
    } else {
      player.style.removeProperty("--movi-sub-bg-rgb");
    }

    // Force movi-player to ALWAYS apply the background, even on non-VTT (SRT/embedded) tracks.
    // By default movi-player only applies it to .movi-subtitle-format-vtt.
    const shadow = player.shadowRoot;
    if (shadow) {
      let override = shadow.querySelector("style.nuvio-bg-override");
      if (!override) {
        override = document.createElement("style");
        override.className = "nuvio-bg-override";
        shadow.appendChild(override);
      }
      if (style.bgPct > 0) {
        override.textContent = `
          .movi-subtitle-block, video::cue {
            background-color: rgba(var(--movi-sub-bg-rgb, 8,8,8), var(--movi-sub-bg-alpha, 0.75)) !important;
          }
        `;
      } else {
        override.textContent = "";
      }
    }
  }, 0);
}

// Singleton promise that resolves once movi-player has been loaded into the
// page. We bypass Next.js's bundler for this dependency because the SWC
// minifier produces invalid JavaScript ("octal escape sequences are not
// allowed in template strings") when it processes movi-player's prebuilt
// bundle. Loading the upstream IIFE from jsdelivr keeps the original (valid)
// code intact; jsdelivr serves it with Cross-Origin-Resource-Policy:
// cross-origin so it's compatible with our COEP: require-corp headers.
const MOVI_PLAYER_CDN_URL = "https://cdn.jsdelivr.net/npm/movi-player@0.3.2/dist/element.js";

let moviPlayerLoadPromise: Promise<void> | null = null;
function ensureMoviPlayerLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (moviPlayerLoadPromise) return moviPlayerLoadPromise;
  if (customElements.get("movi-player")) return Promise.resolve();
  moviPlayerLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-nuvio-movi-player]') as HTMLScriptElement | null;
    if (existing) {
      // Another mount started the load — just wait for the element to register.
      customElements.whenDefined("movi-player").then(() => resolve());
      return;
    }
    const s = document.createElement("script");
    s.type = "module";
    s.src = MOVI_PLAYER_CDN_URL;
    s.async = false;
    s.crossOrigin = "anonymous";
    s.dataset.nuvioMoviPlayer = "true";
    s.onload = () => {
      customElements.whenDefined("movi-player").then(() => resolve());
    };
    s.onerror = () => reject(new Error(`Failed to load ${MOVI_PLAYER_CDN_URL}`));
    document.head.appendChild(s);
  });
  return moviPlayerLoadPromise;
}

const MoviPlayerWrapper = React.memo(({ resolvedSrc, onInit }: { resolvedSrc: string, onInit: (p: any) => void }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [moviReady, setMoviReady] = useState(false);

  // Phase 1: Create the element as a plain HTMLElement (before the custom
  // element class is registered), then import the module. The import triggers
  // customElements.define() which makes the browser "upgrade" our already-in-
  // DOM element — the upgrade path is allowed to set attributes in the
  // constructor, unlike document.createElement() after registration.
  useEffect(() => {
    if (!wrapperRef.current) return;
    let cancelled = false;

    // Create immediately as a plain, unregistered element
    let player = wrapperRef.current.querySelector("movi-player") as any;
    if (!player) {
      wrapperRef.current.innerHTML = `<movi-player class="w-full h-full object-contain" playsinline="true"></movi-player>`;
      player = wrapperRef.current.querySelector("movi-player") as any;
      playerRef.current = player;
      onInit(player);
    }

    ensureMoviPlayerLoaded().then(() => {
      if (!cancelled) setMoviReady(true);
    });

    return () => {
      cancelled = true;
      if (player) {
        try {
          if (player.player && typeof player.player.destroy === "function") {
            player.player.destroy();
          } else if (player.player && typeof player.player.unload === "function") {
            player.player.unload();
          }
          if (typeof player.destroy === "function") {
            player.destroy();
          }
          if (player.parentNode) {
            player.parentNode.removeChild(player);
          }
        } catch (e) {
          console.error("Error during movi-player cleanup", e);
        }
      }
    };
  }, [onInit]);

  // Phase 2: Set/update src only AFTER the custom element is fully upgraded.
  // This guarantees movi-player's attributeChangedCallback processes the src
  // and starts its internal Shaka player.
  useEffect(() => {
    const player = playerRef.current ?? wrapperRef.current?.querySelector("movi-player");
    if (!player || !moviReady) return;

    if (resolvedSrc && player.getAttribute("src") !== resolvedSrc) {
      // Aggressively clean up internal WebCodecs state before source switch
      if (player.player) {
        try {
          if (typeof player.player.unload === "function") {
            player.player.unload(); // Frees VideoFrames
          }
        } catch (_) { }
      }
      player.setAttribute("src", resolvedSrc);
      player.style.display = "block";
    } else if (!resolvedSrc) {
      player.style.display = "none";
    }
  }, [resolvedSrc, moviReady]);

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full object-contain absolute inset-0 z-0 bg-black"
    />
  );
}, (prev, next) => prev.resolvedSrc === next.resolvedSrc);

export default function PlayerScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoRef = useRef<any>(null);

  const [resolvedSrc, setResolvedSrc] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Menus
  const [openMenu, setOpenMenu] = useState<"sub" | "audio" | "speed" | null>(null);
  const [subActiveTab, setSubActiveTab] = useState<"tracks" | "style">("tracks");
  const [audios, setAudios] = useState<{ id: number; name: string }[]>([{ id: 0, name: "Default" }]);
  const [subtitles, setSubtitles] = useState<{ id: number; name: string }[]>([{ id: -1, name: "None" }]);
  const [selectedAudio, setSelectedAudio] = useState(0);
  const [selectedSub, setSelectedSub] = useState(-1);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [referrerUrl, setReferrerUrl] = useState("/dashboard");
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  // Referrer tracking for absolute bulletproof Back button navigation
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ref = document.referrer;
      if (ref && ref.includes(window.location.origin) && !ref.includes("/player")) {
        sessionStorage.setItem("nuvio_player_referrer", ref);
        setReferrerUrl(ref);
      } else {
        const saved = sessionStorage.getItem("nuvio_player_referrer");
        if (saved) {
          setReferrerUrl(saved);
        }
      }
    }
  }, []);

  // Draggable Seek Progress (PointerEvent supports both touch/mouse)
  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    e.preventDefault(); // Prevents native browser selection / drag session
    setIsDraggingProgress(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDragProgress(ratio * 100);
    setCurrentTime(ratio * duration);
  };

  const handleProgressPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingProgress || !duration) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDragProgress(ratio * 100);
    setCurrentTime(ratio * duration);
  };

  const handleProgressPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingProgress) return;
    setIsDraggingProgress(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    const video = videoRef.current;
    if (video && duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetTime = ratio * duration;
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleProgressLostPointerCapture = () => {
    setIsDraggingProgress(false);
  };

  // Click/Touch middle screen handler
  const handleMiddleScreenClick = (e: React.PointerEvent<HTMLDivElement>) => {
    // Touch event: toggle control overlay visibility (iPad)
    if (e.pointerType === "touch") {
      setShowControls((prev) => !prev);
      resetControlsTimeout();
    } else {
      // Mouse click: toggle play/pause (Desktop)
      togglePlay();
      resetControlsTimeout();
    }
  };

  // Capture all console errors and Shaka Player errors to the screen for iPad debugging
  useEffect(() => {
    const addLog = (msg: string) => {
      setDebugLogs((prev) => [...prev, msg].slice(-10)); // Keep last 10 logs
    };

    const originalError = console.error;
    console.error = (...args) => {
      originalError.apply(console, args);
      addLog(`[ERR] ${args.map(a => typeof a === 'object' && a !== null ? JSON.stringify(a, Object.getOwnPropertyNames(a)) : String(a)).join(' ')}`);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      addLog(`[Promise] ${event.reason?.message || String(event.reason)}`);
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      console.error = originalError;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Tracks the last blob URL we created for an addon subtitle, so we can revoke it.
  const lastAddonSubBlobUrl = useRef<string | null>(null);

  // Subtitle style — backed by movi-player's native attribute API.
  // We read movi-player's own localStorage key on mount so the UI
  // reflects whatever the player last persisted.
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(() => {
    try {
      const raw = localStorage.getItem("movi.subtitleSettings");
      const bgColorSaved = localStorage.getItem("nuvio.subBgColor") ?? DEFAULT_SUBTITLE_STYLE.bgColor;
      if (raw) {
        const p = JSON.parse(raw);
        return {
          color: typeof p.color === "string" ? p.color : DEFAULT_SUBTITLE_STYLE.color,
          bgColor: bgColorSaved,
          sizePct: typeof p.sizeMult === "number" ? Math.round(p.sizeMult * 100) : DEFAULT_SUBTITLE_STYLE.sizePct,
          bgPct: typeof p.bgAlpha === "number" ? Math.round(p.bgAlpha * 100) : DEFAULT_SUBTITLE_STYLE.bgPct,
          edge: (["none", "shadow", "outline", "raised"] as SubtitleEdge[]).includes(p.edge) ? p.edge : DEFAULT_SUBTITLE_STYLE.edge,
        };
      }
      return { ...DEFAULT_SUBTITLE_STYLE, bgColor: bgColorSaved };
    } catch { /* fall through */ }
    return DEFAULT_SUBTITLE_STYLE;
  });

  const subtitleStyleRef = useRef(subtitleStyle);

  const updateSubtitleStyle = (newStyle: SubtitleStyle) => {
    subtitleStyleRef.current = newStyle;
    setSubtitleStyle(newStyle);
    applySubtitleStyleToPlayer(videoRef.current, newStyle);
    // Persist bgColor separately — movi-player's own save would overwrite our field
    try { localStorage.setItem("nuvio.subBgColor", newStyle.bgColor); } catch { /* ok */ }
  };

  const resetSubtitleStyle = () => updateSubtitleStyle(DEFAULT_SUBTITLE_STYLE);

  // Subtitle timing offset (seconds). Positive = subtitles appear later.
  // Applies to BOTH the custom external-subtitle overlay (via activeSubCue, which
  // reads subtitleDelay state) and movi-player's own renderer for built-in/muxed
  // tracks (via its subtitleDelay setter).
  const applySubtitleDelay = useCallback((value: number) => {
    const clamped = Math.round(Math.max(-60, Math.min(60, value)) * 10) / 10; // 0.1s grid
    subtitleDelayRef.current = clamped;
    setSubtitleDelayState(clamped);
    const v = videoRef.current;
    if (v) {
      try { v.subtitleDelay = clamped; } catch { /* ok */ }
    }
  }, []);

  // Re-apply subtitle style whenever it changes or when the player is first initialised.
  // Uses movi-player's native setAttribute API — the element translates these into
  // CSS variables (--movi-sub-color, --movi-sub-size-mult, etc.) consumed by its
  // own shadow-DOM subtitle renderer.
  useEffect(() => {
    subtitleStyleRef.current = subtitleStyle;
    applySubtitleStyleToPlayer(videoRef.current, subtitleStyle);
  }, [subtitleStyle]);

  // External Subtitles
  const [addonSubtitles, setAddonSubtitles] = useState<any[]>([]);
  const [activeExternalSub, setActiveExternalSub] = useState<string | null>(null);
  // Subtitle timing offset in seconds. Positive = show subtitles LATER (mpv/VLC
  // convention), which fixes subtitles that appear ahead of the audio.
  const [subtitleDelay, setSubtitleDelayState] = useState(0);
  const subtitleDelayRef = useRef(0);
  // Parsed cues for the custom overlay renderer
  const [externalSubCues, setExternalSubCues] = useState<SubtitleCue[]>([]);

  // Modal & Overlays
  const [showStreamPicker, setShowStreamPicker] = useState(false);
  const [streamPickerSeason, setStreamPickerSeason] = useState<number | null>(null);
  const [streamPickerEpisode, setStreamPickerEpisode] = useState<number | null>(null);
  const [skipIntervals, setSkipIntervals] = useState<SkipInterval[]>([]);

  // Next-episode (series) + auto-play
  const [nextEpisode, setNextEpisode] = useState<NextEpisodeMeta | null>(null);
  const [showNextEpisodeCard, setShowNextEpisodeCard] = useState(false);
  const [autoNextEnabled, setAutoNextEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("nuvio.autoNextEpisode");
    return stored == null ? true : stored === "true";
  });
  const [nextSearching, setNextSearching] = useState(false);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);

  // Playback speed
  const [playbackRate, setPlaybackRate] = useState(1);

  // External player picker
  const [showExternalPlayer, setShowExternalPlayer] = useState(false);

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Episodes panel (TV shows only)
  const [showEpisodesPanel, setShowEpisodesPanel] = useState(false);
  const [episodesData, setEpisodesData] = useState<any[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [totalSeasons, setTotalSeasons] = useState<number>(1);

  // Extended menu union (audio | sub | speed)
  // Note: existing openMenu type only had "audio" | "sub" — we widen via local string.

  const movieId = searchParams.get("id");
  const mediaType = searchParams.get("type");
  const streamUrl = searchParams.get("url");
  const season = searchParams.get("s");
  const episode = searchParams.get("e");
  const streamHash = searchParams.get("hash");

  // Gate to ignore stale currentTime/duration from the PREVIOUS episode until the
  // newly-loaded stream reports its own fresh time. Without this, the old episode's
  // near-end time (e.g. 21:37/21:58) briefly satisfies the next-episode threshold on
  // the render right after navigation, prematurely showing the following episode's
  // card (e.g. E4 while E3 is still loading). Reset synchronously during render the
  // moment the stream URL changes — before any effect runs.
  const prevStreamUrlRef = useRef(streamUrl);
  const awaitingFreshTimeRef = useRef(false);
  if (prevStreamUrlRef.current !== streamUrl) {
    prevStreamUrlRef.current = streamUrl;
    awaitingFreshTimeRef.current = true;
  }

  const [episodesSeasonNum, setEpisodesSeasonNum] = useState<number>(() => {
    const s = searchParams.get("s");
    return s ? parseInt(s) : 1;
  });

  // movi-player module loading is now handled inside MoviPlayerWrapper
  // to guarantee custom-element registration before element creation.

  // --------------------------------------------------------------------------------
  // 1. STRICT API CALL LIMITERS (Exactly 1 call per stream)
  // --------------------------------------------------------------------------------
  const lastResolvedUrl = useRef<string | null>(null);
  useEffect(() => {
    if (!streamUrl) {
      setResolvedSrc("");
      lastResolvedUrl.current = null;
      return;
    }
    const decoded = decodeURIComponent(streamUrl);
    if (lastResolvedUrl.current === decoded) return;
    lastResolvedUrl.current = decoded;

    // Reset resolvedSrc immediately to show the loading screen during resolution
    setResolvedSrc("");
    setPlayerError(null);

    async function resolveUrl() {
      // Strategy:
      // 1. Direct fetch with redirect: "follow" — works for CORS-clean streams.
      // 2. If CORS-blocked (debrid redirect chains like TorBox), fall back to
      //    /api/resolve which follows redirects server-side and returns the final
      //    CDN URL. The CDN itself is CORS-clean so movi-player plays directly.
      // 3. Last resort: hand the raw URL to the player.

      // Step 1: direct (covers most streams — no server call, zero latency overhead)
      const controller = new AbortController();
      try {
        const res = await fetch(decoded, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          redirect: "follow",
          signal: controller.signal,
        });
        setResolvedSrc(res.url || decoded);
        controller.abort();
        return;
      } catch (_directErr) {
        // CORS blocked — fall through to server-side resolver
      }

      // Step 2: server-side resolve (handles TorBox/debrid CORS blocks)
      try {
        const resolverRes = await fetch(`/api/resolve?url=${encodeURIComponent(decoded)}`);
        if (resolverRes.ok) {
          const data = await resolverRes.json();
          if (data.url && typeof data.url === "string" && data.url.startsWith("http")) {
            setResolvedSrc(data.url);
            return;
          }
        }
      } catch (_resolverErr) {
        // Resolver unavailable — fall through
      }

      // Step 3: last resort — hand raw URL to player
      setResolvedSrc(decoded);
    }
    resolveUrl();
  }, [streamUrl]);

  const lastFetchedSubsId = useRef<string | null>(null);
  useEffect(() => {
    if (!movieId || !mediaType) return;
    const isSeries = mediaType === "series" || mediaType === "tv" || season;
    const fetchId = isSeries ? `${movieId}:${season}:${episode}` : movieId;

    if (lastFetchedSubsId.current === fetchId) return;
    lastFetchedSubsId.current = fetchId;

    async function loadSubtitles() {
      try {
        const { fetchAllSubtitles } = await import("@/lib/addonService");
        const stremioType = isSeries ? "series" : "movie";
        let imdbId = null;
        try {
          const tmdbType = isSeries ? "tv" : "movie";
          const externalIds = await fetchExternalIds(parseInt(movieId!), tmdbType);
          if (externalIds?.imdb_id) imdbId = externalIds.imdb_id;
        } catch (e) { }

        const baseId = imdbId || `tmdb:${movieId}`;
        const searchId = isSeries ? `${baseId}:${season}:${episode}` : baseId;

        const subs = await fetchAllSubtitles(stremioType, searchId, streamHash);
        setAddonSubtitles(subs);
      } catch (e) {
        console.error("Failed to fetch addon subtitles", e);
      }
    }
    loadSubtitles();
  }, [movieId, mediaType, season, episode, streamHash]);

  // Load skip intervals exactly once
  const lastFetchedSkipsId = useRef<string | null>(null);
  useEffect(() => {
    if (!movieId) return;
    const isSeries = mediaType === "series" || mediaType === "tv" || season;
    if (!isSeries || !season || !episode) return;

    const fetchId = `${movieId}:${season}:${episode}`;
    if (lastFetchedSkipsId.current === fetchId) return;
    lastFetchedSkipsId.current = fetchId;

    async function loadSkips() {
      try {
        const externalIds = await fetchExternalIds(parseInt(movieId!), "tv");
        if (externalIds?.imdb_id) {
          const intervals = await fetchSkipIntervals(externalIds.imdb_id, parseInt(season!), parseInt(episode!));
          setSkipIntervals(intervals);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadSkips();
  }, [movieId, mediaType, season, episode]);

  // Load next-episode metadata from TMDB when on a TV show.
  const lastFetchedNextId = useRef<string | null>(null);
  // Synchronous lock held from the moment playNextEpisode starts until the
  // new episode's metadata loads. This strictly prevents chain-firing.
  const autoNextLockRef = useRef(false);

  useEffect(() => {
    if (!movieId) { setNextEpisode(null); return; }
    const isSeries = mediaType === "series" || mediaType === "tv" || season;
    if (!isSeries || !season || !episode) { setNextEpisode(null); return; }

    const fetchId = `${movieId}:${season}:${episode}`;
    if (lastFetchedNextId.current === fetchId) return;
    lastFetchedNextId.current = fetchId;

    // Release the lock so this freshly loaded episode can fire its auto-next
    autoNextLockRef.current = false;

    setShowNextEpisodeCard(false);
    setNextSearching(false);
    setNextCountdown(null);

    (async () => {
      try {
        const next = await fetchNextEpisode(parseInt(movieId!), parseInt(season!), parseInt(episode!));
        setNextEpisode(next);
      } catch (e) {
        console.error("fetchNextEpisode failed", e);
        setNextEpisode(null);
      }
    })();
  }, [movieId, mediaType, season, episode]);

  // Fetch total seasons count for the episodes panel
  useEffect(() => {
    if (!movieId) return;
    const isSeries = mediaType === "series" || mediaType === "tv" || season;
    if (!isSeries) return;
    (async () => {
      try {
        const details = await fetchTvDetails(parseInt(movieId));
        if (details?.number_of_seasons) setTotalSeasons(details.number_of_seasons);
      } catch (_) { /* ignore */ }
    })();
  }, [movieId, mediaType, season]);

  // Fetch episodes when the episodes panel is opened or season changes
  useEffect(() => {
    if (!showEpisodesPanel || !movieId) return;
    setEpisodesLoading(true);
    (async () => {
      try {
        const data = await fetchTvSeason(parseInt(movieId), episodesSeasonNum);
        setEpisodesData(data?.episodes || []);
      } catch (e) {
        console.error("Failed to fetch season episodes", e);
        setEpisodesData([]);
      } finally {
        setEpisodesLoading(false);
      }
    })();
  }, [showEpisodesPanel, movieId, episodesSeasonNum]);


  // --------------------------------------------------------------------------------
  // 2. STABLE EVENT LISTENERS (Prevents React Re-render Loop Crashes)
  // --------------------------------------------------------------------------------
  const onStateChangeRef = useRef<((e: any) => void) | null>(null);
  const onTracksChangeRef = useRef<((e: any) => void) | null>(null);
  const onTimeUpdateRef = useRef<(() => void) | null>(null);

  // Track state refs for deep comparison to prevent infinite loop re-renders
  const audiosCache = useRef(JSON.stringify([{ id: 0, name: "Default" }]));
  const subtitlesCache = useRef(JSON.stringify([{ id: -1, name: "None" }]));

  // Assign refs DIRECTLY during render — no useEffect needed.
  // Refs don't trigger re-renders so this is safe and avoids infinite loops.
  onStateChangeRef.current = (e: any) => {
    const video = videoRef.current;
    if (!video || !resolvedSrc) return;
    if (video.getAttribute("src") !== resolvedSrc) return;

    const state = e.detail;
    if (state === 'playing') {
      setIsBuffering(false);
      setIsPlaying(true);
      setPlayerError(null);
      // NOTE: Do NOT sync volume/muted here — doing so on every buffering→playing
      // transition causes audio jitter. Volume is synced only on explicit user actions
      // (togglePlay, handleVolumeChange, keyboard shortcuts).
    }
    else if (state === 'paused') { setIsPlaying(false); }
    else if (state === 'buffering' || state === 'seeking' || state === 'loading') { setIsBuffering(true); }
    else if (state === 'ready') { setIsBuffering(false); setPlayerError(null); }
    else if (state === 'error') { setIsBuffering(false); setPlayerError("Failed to decode stream"); }
  };

  onTracksChangeRef.current = (e: any) => {
    const video = videoRef.current;
    if (!video || !resolvedSrc) return;
    if (video.getAttribute("src") !== resolvedSrc) return;

    const { audio, subtitle } = e.detail;
    if (audio?.length > 0) {
      const newAudios = audio.map((t: any, i: number) => {
        const parts = [t.language, t.label, t.codec ? `[${t.codec}]` : '', t.channels ? `${t.channels}ch` : ''];
        const niceName = parts.filter(Boolean).join(' ') || `Audio ${i + 1}`;
        return { id: t.id, name: niceName };
      });
      const strAudios = JSON.stringify(newAudios);
      if (audiosCache.current !== strAudios) {
        audiosCache.current = strAudios;
        setAudios(newAudios);
      }
      const active = audio.find((t: any) => t.active);
      if (active && selectedAudio !== active.id) {
        setSelectedAudio(active.id);
      }
    }
    if (subtitle?.length > 0) {
      const newSubs = [{ id: -1, name: 'None' }, ...subtitle.map((t: any, i: number) => {
        const niceName = [t.language, t.label].filter(Boolean).join(' ') || `Subtitle ${i + 1}`;
        return { id: t.id, name: niceName };
      })];
      const strSubs = JSON.stringify(newSubs);
      if (subtitlesCache.current !== strSubs) {
        subtitlesCache.current = strSubs;
        setSubtitles(newSubs);
      }
      const active = subtitle.find((t: any) => t.active);
      if (active && selectedSub !== active.id) {
        setSelectedSub(active.id);
      }
    }
  };

  onTimeUpdateRef.current = () => {
    const video = videoRef.current;
    if (!video || !resolvedSrc) return;
    if (video.getAttribute("src") !== resolvedSrc) return;

    const t = video.currentTime ?? 0;

    // Clear the "awaiting fresh time" gate only when the NEW stream reports an
    // early position. A navigated episode always starts near 0, so a low time
    // means the new stream is genuinely live. A stale tick lingering from the
    // previous episode (near its end, e.g. 21:37) must NOT clear the gate —
    // otherwise the next-episode threshold fires immediately and shows the
    // following episode's card while this one is still loading.
    if (t < 60) awaitingFreshTimeRef.current = false;

    setCurrentTime(t);
    setDuration(video.duration || 0);
  };

  const stableStateChange = useCallback((e: any) => onStateChangeRef.current?.(e), []);
  const stableTracksChange = useCallback((e: any) => onTracksChangeRef.current?.(e), []);
  const stableTimeUpdate = useCallback(() => onTimeUpdateRef.current?.(), []);

  // Attach strictly once to the player element
  const playerListenersAttached = useRef(false);
  useEffect(() => {
    const player = videoRef.current;
    if (!player || playerListenersAttached.current) return;
    playerListenersAttached.current = true;

    player.addEventListener("timeupdate", stableTimeUpdate);
    player.addEventListener("loadedmetadata", stableTimeUpdate);
    player.addEventListener("statechange", stableStateChange);
    player.addEventListener("trackschange", stableTracksChange);

    return () => {
      player.removeEventListener("timeupdate", stableTimeUpdate);
      player.removeEventListener("loadedmetadata", stableTimeUpdate);
      player.removeEventListener("statechange", stableStateChange);
      player.removeEventListener("trackschange", stableTracksChange);
      playerListenersAttached.current = false;
    };
  }, [resolvedSrc, stableTimeUpdate, stableStateChange, stableTracksChange]);


  // --------------------------------------------------------------------------------
  // 3. UI CONTROLS & HEARTBEAT
  // --------------------------------------------------------------------------------

  // Refs for tracking video state inside the heartbeat without re-running the interval
  const isPlayingRef = useRef(isPlaying);
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  // Watch Progress Hearbeat
  useEffect(() => {
    if (!movieId) return;
    const interval = setInterval(() => {
      if (isPlayingRef.current && durationRef.current > 0 && movieId && mediaType) {
        saveWatchProgress({
          id: movieId, type: mediaType, title: "Stream", poster: "",
          season: season ? parseInt(season) : undefined,
          episode: episode ? parseInt(episode) : undefined,
          currentTime: currentTimeRef.current,
          duration: durationRef.current,
          updatedAt: Date.now()
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [movieId, mediaType, season, episode]);

  // Trakt scrobbling — start when playback begins, stop on pause/unmount. Mirrors
  // NuvioMobile's scrobble flow. Uses the TMDB id (movieId) which Trakt accepts.
  const traktStartedRef = useRef(false);
  useEffect(() => {
    if (!movieId || !mediaType) return;
    if (!isTraktConnected()) return;

    const buildPayload = (progress: number) => {
      const tmdbId = parseInt(movieId);
      if (!Number.isFinite(tmdbId)) return null;
      const isSeries = mediaType === "tv" || mediaType === "series" || !!season;
      return {
        type: isSeries ? ("episode" as const) : ("movie" as const),
        ids: { tmdb: tmdbId },
        season: season ? parseInt(season) : undefined,
        episode: episode ? parseInt(episode) : undefined,
        progress,
      };
    };

    if (isPlaying && !traktStartedRef.current) {
      const pct = durationRef.current > 0 ? (currentTimeRef.current / durationRef.current) * 100 : 0;
      const payload = buildPayload(pct);
      if (payload) {
        traktStartedRef.current = true;
        traktScrobble("start", payload);
      }
    } else if (!isPlaying && traktStartedRef.current) {
      const pct = durationRef.current > 0 ? (currentTimeRef.current / durationRef.current) * 100 : 0;
      const payload = buildPayload(pct);
      if (payload) {
        traktStartedRef.current = false;
        traktScrobble("pause", payload);
      }
    }
  }, [isPlaying, movieId, mediaType, season, episode]);

  // Skip segment — derived value, no setState needed
  const activeSkip = skipIntervals.find(i => currentTime >= i.startTime && currentTime <= i.endTime) || null;

  // Ref used by the threshold/ended effects to invoke playNextEpisode without
  // a direct lexical reference (the callback is declared further down).
  const playNextRef = useRef<(() => void) | null>(null);

  // Show next-episode card when we get near the end of the current episode.
  // Threshold: <= 30s remaining OR position >= 95% (whichever fires first).
  // Auto-starts if autoNextEnabled is true.
  useEffect(() => {
    if (autoNextLockRef.current) return;
    if (!nextEpisode || duration <= 0) return;

    // Ignore stale time from the previous episode until the new stream reports
    // its own fresh time (cleared in onTimeUpdate). This prevents the following
    // episode's card from flashing while the just-started episode is still loading.
    if (awaitingFreshTimeRef.current) return;

    // CRITICAL GUARD: Do not process threshold during the first 60 seconds of ANY episode.
    // This absolutely guarantees that stale currentTime/duration from the previous
    // episode cannot trigger a chain-fire to the next-next episode before the
    // player state has settled.
    if (currentTime < 60) return;

    const remaining = duration - currentTime;
    const pctPlayed = currentTime / duration;
    const shouldShow = remaining <= 30 || pctPlayed >= 0.95;

    if (shouldShow && !showNextEpisodeCard) {
      setShowNextEpisodeCard(true);
      if (autoNextEnabled && nextEpisode.hasAired) {
        playNextRef.current?.();
      }
    } else if (!shouldShow && showNextEpisodeCard && remaining > 60) {
      setShowNextEpisodeCard(false);
    }
  }, [currentTime, duration, nextEpisode, autoNextEnabled, showNextEpisodeCard]);

  // Fallback: Show card (and auto-play) if the video ends but the threshold
  // somehow didn't fire (e.g. user seeked past the threshold right to the end).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnded = () => {
      if (autoNextLockRef.current) return;
      if (awaitingFreshTimeRef.current) return; // ignore until the new stream is live
      if (!nextEpisode) return;
      if (nextSearching || nextCountdown != null) return;

      setShowNextEpisodeCard(true);
      if (autoNextEnabled && nextEpisode.hasAired) {
        setTimeout(() => { playNextRef.current?.(); }, 300);
      }
    };
    v.addEventListener("ended", onEnded);
    return () => v.removeEventListener("ended", onEnded);
  }, [nextEpisode, autoNextEnabled, nextSearching, nextCountdown]);

  // ─── SIMPLIFIED AUTOPLAY ────────────────────────────────────────────────
  // Rule: always play unless the user explicitly paused. We just call play()
  // on statechange===ready. If the browser blocks unmuted autoplay we show
  // the play button (setUserPaused(true)). That's it — no hasStarted tracking.
  const userPausedRef = useRef(false);
  useEffect(() => { userPausedRef.current = userPaused; }, [userPaused]);

  useEffect(() => {
    // Reset on new stream
    userPausedRef.current = false;
  }, [resolvedSrc]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onStateChange = (e: any) => {
      if (e.detail === 'ready' && !userPausedRef.current) {
        const p = typeof v.play === 'function' ? v.play() : null;
        if (p && typeof p.catch === 'function') {
          p.catch((err: any) => {
            if (err?.name === 'NotAllowedError') setUserPaused(true);
          });
        }
      }
    };
    const onCanPlay = () => {
      if (!userPausedRef.current && typeof v.play === 'function') {
        const p = v.play();
        if (p && typeof p.catch === 'function') {
          p.catch((err: any) => {
            if (err?.name === 'NotAllowedError') setUserPaused(true);
          });
        }
      }
    };
    const onError = (e: any) => {
      const errObj = v.error || (v.video && v.video.error);
      const detail = e.detail || {};

      // Shaka Player error fields
      const shakaCode = detail.code || e.code || e.detail?.code;
      const shakaCategory = detail.category || e.detail?.category;
      const shakaSeverity = detail.severity || e.detail?.severity;
      const shakaData = detail.data || e.detail?.data;
      const msg = detail.message || e.message || errObj?.message || 'none';

      // Gather all top-level keys
      const collected: any = {};
      const target = e.detail || e;
      if (target) {
        const keys = Object.getOwnPropertyNames(target);
        for (const key of keys) {
          try {
            const val = target[key];
            if (typeof val !== 'function' && typeof val !== 'object') {
              collected[key] = val;
            }
          } catch {}
        }
      }

      const errMsg = `[Player Error]
NativeCode: ${errObj?.code || 'none'}
NativeMsg: ${errObj?.message || 'none'}
ShakaCode: ${shakaCode || 'none'} (Cat: ${shakaCategory || 'none'}, Sev: ${shakaSeverity || 'none'})
Msg: ${msg}
ShakaData: ${JSON.stringify(shakaData || [])}
EventDump: ${JSON.stringify(collected)}`;

      console.error(errMsg);
    };

    v.addEventListener('statechange', onStateChange);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('error', onError);
    return () => {
      v.removeEventListener('statechange', onStateChange);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('error', onError);
    };
  }, [resolvedSrc]);

  // Reflect playback rate on the player.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try { v.playbackRate = playbackRate; } catch (_) { /* ignore */ }
  }, [playbackRate, resolvedSrc]);

  // Clear stale state IMMEDIATELY when the requested stream URL changes.
  // This prevents the threshold effect from accidentally chain-firing if the
  // previous episode's currentTime lingers while the new metadata loads.
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setUserPaused(false);
    setShowNextEpisodeCard(false);
    // Reset subtitle timing offset — a new episode/file has its own sync.
    setSubtitleDelayState(0);
    subtitleDelayRef.current = 0;
  }, [streamUrl]);

  // Close any open menu when the controls auto-hide.
  useEffect(() => {
    if (!showControls && openMenu !== null) setOpenMenu(null);
  }, [showControls, openMenu]);

  // Track fullscreen state changes so the toggle button reflects the truth.
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Persist auto-next-episode preference.
  useEffect(() => {
    try { localStorage.setItem("nuvio.autoNextEpisode", String(autoNextEnabled)); } catch (_) { /* ignore */ }
  }, [autoNextEnabled]);

  // Controls UI visibility
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      // Don't auto-hide while a menu (subtitle/audio/speed) is open
      if (isPlaying && !openMenu) setShowControls(false);
    }, 3000);
  }, [isPlaying, openMenu]);

  useEffect(() => { if (!isPlaying) setShowControls(true); }, [isPlaying]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!userPaused) { // user thinks it is playing or trying to play, so they want to pause
      if (typeof video.pause === 'function') video.pause();
      setUserPaused(true);
    } else { // user thinks it is paused, so they want to play
      if (typeof video.play === 'function') video.play();
      setUserPaused(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    video.currentTime = ratio * duration;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    const video = videoRef.current;
    if (video && typeof video.volume !== 'undefined') video.volume = val;
    if (video && typeof video.muted !== 'undefined') video.muted = (val === 0);
  };

  // -- Next episode autoplay flow ---------------------------------------------
  const playNextEpisode = useCallback(async () => {
    if (autoNextLockRef.current) return;
    if (!nextEpisode || !movieId || !mediaType) return;
    if (!nextEpisode.hasAired) return;
    if (nextSearching || nextCountdown != null) return;

    // Take the lock synchronously so the threshold/ended effects can't
    // re-trigger us during the resolve + countdown + navigate window.
    autoNextLockRef.current = true;
    setNextSearching(true);
    setNextCountdown(null);
    try {
      // Resolve IMDb id (most addons want ttXXXXXX)
      let baseId = `tmdb:${movieId}`;
      try {
        const ids = await fetchExternalIds(parseInt(movieId), "tv");
        if (ids?.imdb_id) baseId = ids.imdb_id;
      } catch (_) { /* fall back to tmdb id */ }

      const videoId = `${baseId}:${nextEpisode.season}:${nextEpisode.episode}`;
      // Prefer the same addon the current episode is playing from. The addon
      // manifest URL is tracked in sessionStorage (not the route) so we never
      // pollute the addon URL with custom query params.
      const preferredAddon = typeof window !== "undefined"
        ? sessionStorage.getItem("nuvio.currentAddonUrl")
        : null;
      const stream = await autoResolveFirstStream("series", videoId, 12000, preferredAddon);

      if (!stream || !stream.url) {
        // Auto-resolve failed — surface the picker. Release the lock so the
        // user can still trigger manual playback later.
        autoNextLockRef.current = false;
        setNextSearching(false);
        setShowNextEpisodeCard(false);
        setShowStreamPicker(true);
        return;
      }

      setNextSearching(false);

      // Remember the addon the next episode resolved from for the episode after.
      if (typeof window !== "undefined" && stream.addonUrl) {
        try { sessionStorage.setItem("nuvio.currentAddonUrl", stream.addonUrl); } catch { /* ok */ }
      }

      // 3-second countdown then navigate.
      for (let i = 3; i >= 1; i -= 1) {
        setNextCountdown(i);
        await new Promise((r) => setTimeout(r, 1000));
      }

      const u = encodeURIComponent(stream.url);
      router.replace(
        `/player?id=${movieId}&type=${mediaType}&url=${u}&s=${nextEpisode.season}&e=${nextEpisode.episode}`
      );
    } catch (err) {
      console.error("playNextEpisode failed", err);
      autoNextLockRef.current = false;
      setNextSearching(false);
      setNextCountdown(null);
    }
  }, [movieId, mediaType, nextEpisode, nextSearching, nextCountdown, router]);

  // Play a specific episode from the episodes panel
  const playEpisode = useCallback(async (targetSeason: number, targetEpisode: number) => {
    if (!movieId || !mediaType) return;
    // Don't replay the current episode
    if (season && episode && parseInt(season) === targetSeason && parseInt(episode) === targetEpisode) return;

    setShowEpisodesPanel(false);

    // Instead of resolving immediately or changing the URL params (which breaks highlights
    // if the user backs out), we set target season/episode in state and open the stream picker.
    setStreamPickerSeason(targetSeason);
    setStreamPickerEpisode(targetEpisode);
    setShowStreamPicker(true);
  }, [movieId, mediaType, season, episode]);

  // Keep the ref used by the threshold/ended effects in sync.
  useEffect(() => {
    playNextRef.current = () => { void playNextEpisode(); };
  }, [playNextEpisode]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    try {
      const player = videoRef.current; // This is <movi-player>
      const nativeVideo = player?.video || player?.querySelector('video');

      // Detect iOS/iPadOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(navigator.userAgent));

      if (isIOS && nativeVideo && typeof nativeVideo.webkitEnterFullscreen === 'function') {
        nativeVideo.webkitEnterFullscreen();
        return;
      }

      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      } else {
        if (player?.requestFullscreen) {
          player.requestFullscreen();
        } else if (player?.webkitRequestFullscreen) {
          player.webkitRequestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        }
      }
    } catch (e) {
      console.error("Fullscreen toggle failed", e);
    }
  }, []);

  // Keyboard shortcuts (YouTube-style)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when the user is typing in an input
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          togglePlay();
          resetControlsTimeout();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
        case "M": {
          e.preventDefault();
          const next = !isMuted;
          setIsMuted(next);
          if (typeof video.muted !== "undefined") video.muted = next;
          resetControlsTimeout();
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (typeof video.currentTime === "number") {
            video.currentTime = Math.max(0, video.currentTime - 10);
          }
          resetControlsTimeout();
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (typeof video.currentTime === "number" && duration > 0) {
            video.currentTime = Math.min(duration, video.currentTime + 10);
          }
          resetControlsTimeout();
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const nv = Math.min(1, volume + 0.05);
          setVolume(nv);
          setIsMuted(nv === 0);
          if (typeof video.volume !== "undefined") video.volume = nv;
          if (typeof video.muted !== "undefined") video.muted = (nv === 0);
          resetControlsTimeout();
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const nv = Math.max(0, volume - 0.05);
          setVolume(nv);
          setIsMuted(nv === 0);
          if (typeof video.volume !== "undefined") video.volume = nv;
          if (typeof video.muted !== "undefined") video.muted = (nv === 0);
          resetControlsTimeout();
          break;
        }
        case "0": case "1": case "2": case "3": case "4":
        case "5": case "6": case "7": case "8": case "9": {
          e.preventDefault();
          if (duration > 0) {
            const fraction = parseInt(e.key, 10) / 10;
            video.currentTime = duration * fraction;
          }
          resetControlsTimeout();
          break;
        }
        case "n":
        case "N":
          if (nextEpisode && !nextSearching) {
            e.preventDefault();
            playNextEpisode();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [duration, isMuted, volume, togglePlay, toggleFullscreen, resetControlsTimeout, nextEpisode, nextSearching, playNextEpisode]);

  // External player URL schemes. Web has no equivalent of NuvioDesktop's
  // file-system detection, so we offer the well-known URL handlers that
  // major external players register on each OS — the browser confirms with
  // the user when it launches, so unsupported schemes degrade safely.
  const externalPlayers = useMemo(() => {
    if (typeof navigator === "undefined") return [];
    const ua = navigator.userAgent.toLowerCase();
    const isMac = ua.includes("mac");
    const list: { id: string; name: string; build: (u: string) => string }[] = [
      { id: "vlc", name: "VLC media player", build: (u) => `vlc://${u}` },
      { id: "potplayer", name: "PotPlayer", build: (u) => `potplayer://${u}` },
      { id: "mpv", name: "mpv", build: (u) => `mpv://${u}` },
    ];
    if (isMac) {
      list.push({ id: "iina", name: "IINA", build: (u) => `iina://weblink?url=${encodeURIComponent(u)}` });
    }
    return list;
  }, []);

  const openInExternalPlayer = useCallback((id: string) => {
    const target = externalPlayers.find((p) => p.id === id);
    if (!target || !resolvedSrc) return;
    try {
      const handlerUrl = target.build(resolvedSrc);
      window.open(handlerUrl, "_self");
    } catch (e) {
      console.error("External open failed", e);
    }
    setShowExternalPlayer(false);
  }, [externalPlayers, resolvedSrc]);

  const copyStreamUrl = useCallback(async () => {
    if (!resolvedSrc) return;
    try {
      await navigator.clipboard.writeText(resolvedSrc);
    } catch (_) { /* ignore */ }
    setShowExternalPlayer(false);
  }, [resolvedSrc]);

  const handleAudioChange = (id: number) => {
    setSelectedAudio(id);
    const video = videoRef.current;
    if (video) {
      const numId = Number(id);
      console.log("[handleAudioChange] Selected Audio ID:", numId);
      try {
        const player = video.player;
        if (player) {
          if (typeof player.isNativeAudioActive === 'function' && player.isNativeAudioActive()) {
            console.log("[handleAudioChange] Native audio is active, reverting to muxed audio first.");
            player.useMuxedAudio();
          }
          if (typeof player.selectAudioTrack === 'function') {
            player.selectAudioTrack(numId);
            console.log("[handleAudioChange] Switched track via player.selectAudioTrack");
          }
        } else if (typeof video.selectAudioTrack === 'function') {
          video.selectAudioTrack(numId);
          console.log("[handleAudioChange] Switched track via video.selectAudioTrack");
        }

        // Corrective seek/flush to apply track changes immediately in WASM mode
        if (typeof video.currentTime === 'number') {
          const curr = video.currentTime;
          video.currentTime = curr;
          console.log("[handleAudioChange] Performed corrective seek to time:", curr);
        }
      } catch (err) {
        console.error("[handleAudioChange] Failed to select audio track:", err);
      }
    }
    setOpenMenu(null);
  };

  const handleSubtitleChange = (id: number) => {
    setSelectedSub(id);
    setActiveExternalSub(null); // Clear external subtitle selection
    setExternalSubCues([]);     // Clear custom overlay cues
    const moviEl = videoRef.current;
    if (moviEl) {
      // Clean any previously injected sidecar <track> children from <movi-player>
      const existing = moviEl.querySelectorAll('track.addon-sub');
      existing.forEach((t: any) => {
        if (t.src && t.src.startsWith('blob:')) URL.revokeObjectURL(t.src);
        t.remove();
      });
      // Deactivate external subtitle lang on the element
      if (typeof moviEl.selectSubtitleLang === 'function') {
        moviEl.selectSubtitleLang(null).catch(() => { });
      }

      const numId = id === -1 ? null : Number(id);
      console.log("[handleSubtitleChange] Selected Subtitle ID:", numId);
      try {
        const internalPlayer = moviEl.player;
        if (numId === null) {
          // Turn off built-in subs
          if (internalPlayer && typeof internalPlayer.selectSubtitleTrack === 'function') {
            internalPlayer.selectSubtitleTrack(null);
          }
        } else {
          // Select built-in sub by numeric track id
          if (internalPlayer && typeof internalPlayer.selectSubtitleTrack === 'function') {
            internalPlayer.selectSubtitleTrack(numId);
            console.log("[handleSubtitleChange] Switched via player.selectSubtitleTrack:", numId);
          }
        }
        // Corrective seek/flush to apply track changes immediately
        if (typeof moviEl.currentTime === 'number') {
          moviEl.currentTime = moviEl.currentTime;
        }
      } catch (err) {
        console.error("[handleSubtitleChange] Failed to select subtitle track:", err);
      }
    }
    setOpenMenu(null);
  };

  const loadExternalSubtitle = async (id: string, url: string, name: string) => {
    try {
      setOpenMenu(null);
      // Disable any active built-in subtitle first
      const moviEl = videoRef.current;
      if (moviEl?.player && typeof moviEl.player.selectSubtitleTrack === 'function') {
        try { moviEl.player.selectSubtitleTrack(null); } catch { }
      }
      const res = await fetch(url);
      const text = await res.text();
      const cues = parseSubtitleText(text);
      if (cues.length === 0) {
        console.warn('[loadExternalSubtitle] No cues parsed from', url);
      }
      // Revoke previous blob if any
      if (lastAddonSubBlobUrl.current) {
        try { URL.revokeObjectURL(lastAddonSubBlobUrl.current); } catch { }
        lastAddonSubBlobUrl.current = null;
      }
      setSelectedSub(-1);       // Reset built-in selection to "Off"
      setExternalSubCues(cues);
      setActiveExternalSub(id);
    } catch (e) {
      console.error('[loadExternalSubtitle] failed:', e);
    }
  };


  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Active cue for the external subtitle overlay. Apply the user's timing offset:
  // a positive delay shows each cue LATER (mpv/VLC convention), fixing subtitles
  // that run ahead of the audio.
  const adjustedSubTime = currentTime - subtitleDelay;
  const activeSubCue = externalSubCues.find(c => adjustedSubTime >= c.start && adjustedSubTime <= c.end) ?? null;

  return (
    <div
      className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden"
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      style={{ cursor: showControls ? "default" : "none" }}
    >
      <MoviPlayerWrapper
        key="movi-wrapper"
        resolvedSrc={resolvedSrc}
        onInit={useCallback((p: any) => {
          videoRef.current = p;
          // Apply persisted subtitle style immediately after player element is created
          applySubtitleStyleToPlayer(p, subtitleStyleRef.current);
        }, [])}
      />

      {/* Transparent Click Catcher for Middle of Screen (z-10) */}
      <div
        className="absolute inset-0 z-10"
        onPointerDown={handleMiddleScreenClick}
      />

      {/* External subtitle overlay — rendered by our own parser, works with any player */}
      {activeSubCue && (
        <div
          className="absolute bottom-[88px] left-0 right-0 flex justify-center z-30 pointer-events-none px-8"
          style={{ userSelect: 'none' }}
        >
          <div
            style={{
              backgroundColor: subtitleStyle.bgPct > 0
                ? `rgba(0,0,0,${subtitleStyle.bgPct / 100})`
                : 'transparent',
              color: subtitleStyle.color,
              fontSize: `${subtitleStyle.sizePct}%`,
              textShadow: subtitleStyle.edge === 'shadow' ? '1px 1px 4px #000, -1px -1px 4px #000' :
                subtitleStyle.edge === 'outline' ? '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' :
                  subtitleStyle.edge === 'raised' ? '1px 1px 0 #fff, 2px 2px 0 #888' : 'none',
              padding: subtitleStyle.bgPct > 0 ? '4px 10px' : '0',
              borderRadius: 4,
              fontFamily: 'Arial, sans-serif',
              fontWeight: 600,
              lineHeight: 1.4,
              maxWidth: '80vw',
              textAlign: 'center',
              whiteSpace: 'pre-line',
            }}
          >
            {activeSubCue.text}
          </div>
        </div>
      )}

      {/* States */}
      {!resolvedSrc && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 z-10 pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
          <p>Resolving stream source...</p>
        </div>
      )}

      {isBuffering && resolvedSrc && !playerError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {playerError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-40 p-8 text-center backdrop-blur-sm">
          <p className="text-white font-bold text-xl mb-2">Playback Failed</p>
          <p className="text-white/70 max-w-md">{playerError}</p>
          <button onClick={() => setShowStreamPicker(true)} className="mt-6 px-6 py-2.5 bg-white text-black font-semibold rounded-xl">Switch Stream</button>
        </div>
      )}

      {/* Skip Button (left) */}
      {activeSkip && isPlaying && (
        <button
          onClick={() => { if (videoRef.current) videoRef.current.currentTime = activeSkip.endTime; }}
          className="absolute bottom-28 left-8 bg-black/80 hover:bg-black/95 border border-white/40 text-white font-semibold px-5 py-2.5 rounded-xl z-50 pointer-events-auto transition-all"
        >
          Skip {activeSkip.type} →
        </button>
      )}

      {/* Next Episode card (right) */}
      {nextEpisode && showNextEpisodeCard && (
        <div className="absolute bottom-28 right-8 z-50 pointer-events-auto animate-[slide-in_260ms_ease-out] w-[292px] max-w-[80vw]">
          <div className="bg-[#191919]/90 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 flex items-center gap-2 shadow-2xl">
            <button
              onClick={() => nextEpisode.hasAired && playNextEpisode()}
              disabled={!nextEpisode.hasAired || nextSearching}
              className="w-[78px] h-[44px] rounded-lg overflow-hidden bg-black/60 flex-shrink-0 relative disabled:opacity-60"
              title="Play next episode"
            >
              {nextEpisode.thumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={nextEpisode.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/5" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-[10px] font-medium uppercase tracking-wide leading-tight">Next Episode</p>
              <p className="text-white text-xs font-semibold mt-0.5 truncate">
                S{nextEpisode.season}E{nextEpisode.episode} {nextEpisode.title}
              </p>
              <p className="text-white/70 text-[10px] mt-0.5 truncate">
                {!nextEpisode.hasAired
                  ? `Airs ${nextEpisode.airDate ?? "TBA"}`
                  : nextSearching
                    ? "Finding source…"
                    : nextCountdown != null
                      ? `Playing in ${nextCountdown}s`
                      : "Click to play"}
              </p>
            </div>
            <button
              onClick={() => setShowNextEpisodeCard(false)}
              className="text-white/50 hover:text-white text-xs px-1.5"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Overlay UI */}
      <div className={`absolute inset-0 transition-opacity duration-300 pointer-events-none z-20 flex flex-col justify-between ${showControls ? "opacity-100" : "opacity-0"}`}>

        {/* Top Bar */}
        <div className="bg-gradient-to-b from-black/80 to-transparent p-6 flex items-center pointer-events-auto">
          <button onClick={() => { window.location.href = referrerUrl; }} className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 flex items-center justify-center text-white transition-all mr-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          </button>
          <div>
            <p className="text-white font-bold text-lg drop-shadow">Now Playing</p>
            {movieId && <p className="text-[#aaa] text-sm">ID: {movieId} · {mediaType}</p>}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pointer-events-auto">
          {/* Progress / Seek */}
          {(() => {
            const displayProgress = isDraggingProgress ? dragProgress : progress;
            return (
              <div
                className="w-full h-2 bg-white/20 rounded-full cursor-pointer mb-6 group relative"
                style={{ touchAction: "none" }}
                onPointerDown={handleProgressPointerDown}
                onPointerMove={handleProgressPointerMove}
                onPointerUp={handleProgressPointerUp}
                onPointerCancel={handleProgressLostPointerCapture}
                onLostPointerCapture={handleProgressLostPointerCapture}
              >
                <div className="h-full bg-white rounded-full" style={{ width: `${displayProgress}%` }} />
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `calc(${displayProgress}% - 8px)` }} />
              </div>
            );
          })()}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Play / Pause */}
              <button onClick={togglePlay} className="w-12 h-12 rounded-full bg-white text-black hover:bg-gray-200 flex items-center justify-center transition-colors shadow-lg">
                {!userPaused
                  ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" /></svg>
                  : <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-1"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>}
              </button>

              {/* Volume */}
              <div className="flex items-center gap-2 group/vol w-32">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white/80"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905H6.44l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" /></svg>
                <input type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="w-full h-1 accent-white cursor-pointer" />
              </div>

              {/* Time */}
              <span className="text-white/80 text-sm tabular-nums ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Audio Menu */}
              <div className="relative">
                <button onClick={() => setOpenMenu(openMenu === "audio" ? null : "audio")} className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${openMenu === "audio" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`}>
                  Audio
                </button>
                {openMenu === "audio" && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-48 max-h-64 overflow-y-auto z-50">
                    {audios.map(a => (
                      <button key={a.id} onClick={() => handleAudioChange(a.id)} className={`block w-full text-left px-4 py-3 text-sm transition-colors ${selectedAudio === a.id ? "bg-white/10 text-white font-bold" : "text-[#bbb] hover:bg-white/5 hover:text-white"}`}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subtitle Menu */}
              <div className="relative">
                <button onClick={() => setOpenMenu(openMenu === "sub" ? null : "sub")} className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${openMenu === "sub" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`}>
                  Subtitles
                </button>
                {openMenu === "sub" && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[280px] max-h-[420px] flex flex-col z-50">
                    {/* Tab Selector */}
                    <div className="flex border-b border-white/10 bg-black/20">
                      <button
                        onClick={() => setSubActiveTab("tracks")}
                        className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${subActiveTab === "tracks" ? "text-white bg-white/5 border-b-2 border-white" : "text-white/60 hover:text-white"}`}
                      >
                        Tracks
                      </button>
                      <button
                        onClick={() => setSubActiveTab("style")}
                        className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${subActiveTab === "style" ? "text-white bg-white/5 border-b-2 border-white" : "text-white/60 hover:text-white"}`}
                      >
                        Style
                      </button>
                    </div>

                    {subActiveTab === "style" ? (
                      <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[380px] text-white text-xs select-none">

                        {/* Text Color */}
                        <div className="flex flex-col gap-2">
                          <span className="text-white/80 font-medium">Text Color</span>
                          <div className="flex flex-wrap gap-2">
                            {SUBTITLE_COLOR_SWATCHES.map(({ label, value }) => (
                              <button
                                key={value}
                                title={label}
                                onClick={() => updateSubtitleStyle({ ...subtitleStyle, color: value })}
                                className={`w-6 h-6 rounded-full border-2 transition-all ${subtitleStyle.color === value
                                    ? "border-white scale-110 shadow-lg"
                                    : "border-transparent opacity-75 hover:opacity-100 hover:scale-105"
                                  }`}
                                style={{ backgroundColor: value }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Font Size */}
                        <div className="flex items-center justify-between">
                          <span className="text-white/80 font-medium">Font Size</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateSubtitleStyle({ ...subtitleStyle, sizePct: Math.max(50, subtitleStyle.sizePct - 25) })}
                              className="w-6 h-6 rounded bg-white/10 text-white hover:bg-white/20 active:scale-95 flex items-center justify-center font-bold"
                            >-</button>
                            <span className="font-bold w-10 text-center">{subtitleStyle.sizePct}%</span>
                            <button
                              onClick={() => updateSubtitleStyle({ ...subtitleStyle, sizePct: Math.min(200, subtitleStyle.sizePct + 25) })}
                              className="w-6 h-6 rounded bg-white/10 text-white hover:bg-white/20 active:scale-95 flex items-center justify-center font-bold"
                            >+</button>
                          </div>
                        </div>

                        {/* Edge Style */}
                        <div className="flex flex-col gap-2">
                          <span className="text-white/80 font-medium">Edge Style</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {SUBTITLE_EDGE_OPTIONS.map(({ label, value }) => (
                              <button
                                key={value}
                                onClick={() => updateSubtitleStyle({
                                  ...subtitleStyle,
                                  edge: value,
                                  // selecting an edge style clears background
                                  ...(value !== "none" ? { bgColor: "transparent", bgPct: 0 } : {}),
                                })}
                                className={`py-1.5 px-2 rounded text-xs font-bold transition-colors ${subtitleStyle.edge === value
                                    ? "bg-white text-black"
                                    : "bg-white/10 text-white hover:bg-white/20"
                                  }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Background Color */}
                        <div className="flex flex-col gap-2">
                          <span className="text-white/80 font-medium">Background Color</span>
                          <div className="flex flex-wrap gap-2">
                            {SUBTITLE_BG_COLOR_SWATCHES.map(({ label, value }) => (
                              <button
                                key={value}
                                title={label}
                                onClick={() => {
                                  if (value === "transparent") {
                                    updateSubtitleStyle({
                                      ...subtitleStyle,
                                      bgColor: value,
                                      bgPct: 0,
                                      ...(subtitleStyle.edge === "none" ? { edge: "shadow" } : {})
                                    });
                                  } else {
                                    updateSubtitleStyle({
                                      ...subtitleStyle,
                                      bgColor: value,
                                      bgPct: subtitleStyle.bgPct === 0 ? 75 : subtitleStyle.bgPct,
                                      edge: "none",
                                    });
                                  }
                                }}
                                className={`w-6 h-6 rounded-full border-2 transition-all ${subtitleStyle.bgColor === value || (value === "transparent" && subtitleStyle.bgPct === 0)
                                    ? "border-white scale-110 shadow-lg"
                                    : "border-white/30 opacity-75 hover:opacity-100 hover:scale-105"
                                  }`}
                                style={{
                                  backgroundColor: value === "transparent" ? "transparent" : value,
                                  backgroundImage: value === "transparent" ? "linear-gradient(135deg, #555 25%, transparent 25%, transparent 75%, #555 75%), linear-gradient(135deg, #555 25%, transparent 25%, transparent 75%, #555 75%)" : undefined,
                                  backgroundSize: value === "transparent" ? "6px 6px" : undefined,
                                  backgroundPosition: value === "transparent" ? "0 0, 3px 3px" : undefined,
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Background Opacity */}
                        <div className="flex items-center justify-between">
                          <span className="text-white/80 font-medium">Background Opacity</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const newPct = Math.max(0, subtitleStyle.bgPct - 25);
                                updateSubtitleStyle({
                                  ...subtitleStyle,
                                  bgPct: newPct,
                                  ...(newPct > 0 ? { edge: "none" } : {})
                                });
                              }}
                              className="w-6 h-6 rounded bg-white/10 text-white hover:bg-white/20 active:scale-95 flex items-center justify-center font-bold"
                            >-</button>
                            <span className="font-bold w-10 text-center">{subtitleStyle.bgPct}%</span>
                            <button
                              onClick={() => {
                                const newPct = Math.min(100, subtitleStyle.bgPct + 25);
                                updateSubtitleStyle({
                                  ...subtitleStyle,
                                  bgPct: newPct,
                                  ...(newPct > 0 ? { edge: "none" } : {})
                                });
                              }}
                              className="w-6 h-6 rounded bg-white/10 text-white hover:bg-white/20 active:scale-95 flex items-center justify-center font-bold"
                            >+</button>
                          </div>
                        </div>

                        {/* Subtitle Delay / Timing Shift */}
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-white/80 font-medium">Subtitle Delay</span>
                            <span className="text-white/40 text-[10px] mt-0.5">
                              {subtitleDelay === 0
                                ? "In sync"
                                : subtitleDelay > 0
                                  ? "Subtitles shown later"
                                  : "Subtitles shown earlier"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => applySubtitleDelay(subtitleDelay - 0.1)}
                              className="w-6 h-6 rounded bg-white/10 text-white hover:bg-white/20 active:scale-95 flex items-center justify-center font-bold"
                              title="Subtitles earlier (-0.1s)"
                            >-</button>
                            <span className="font-bold w-14 text-center tabular-nums">
                              {subtitleDelay > 0 ? "+" : ""}{subtitleDelay.toFixed(1)}s
                            </span>
                            <button
                              onClick={() => applySubtitleDelay(subtitleDelay + 0.1)}
                              className="w-6 h-6 rounded bg-white/10 text-white hover:bg-white/20 active:scale-95 flex items-center justify-center font-bold"
                              title="Subtitles later (+0.1s)"
                            >+</button>
                            <button
                              onClick={() => applySubtitleDelay(0)}
                              className="ml-1 px-2 h-6 rounded bg-white/10 text-white/70 hover:bg-white/20 active:scale-95 flex items-center justify-center text-[10px] font-bold uppercase"
                              title="Reset subtitle delay"
                            >Reset</button>
                          </div>
                        </div>

                        {/* Reset */}
                        <button
                          onClick={resetSubtitleStyle}
                          className="mt-2 w-full py-2 bg-white/10 hover:bg-white/25 active:scale-[0.98] transition-all text-white font-bold rounded-lg"
                        >
                          Reset Defaults
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col flex-1 overflow-hidden">
                        {/* Unified subtitle list: None → Built-in → Addon */}
                        <div className="overflow-y-auto flex-1">
                          {/* OFF */}
                          <button
                            onClick={() => handleSubtitleChange(-1)}
                            className={`flex items-center gap-3 w-full text-left px-4 py-3 text-sm transition-colors border-b border-white/5 ${selectedSub === -1 && !activeExternalSub ? "bg-white/10 text-white font-bold" : "text-[#bbb] hover:bg-white/5 hover:text-white"}`}
                          >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedSub === -1 && !activeExternalSub ? "bg-white" : "bg-white/20"}`} />
                            Off
                          </button>

                          {/* Built-in tracks */}
                          {subtitles.filter(s => s.id !== -1).length > 0 && (
                            <>
                              <div className="px-4 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest border-b border-white/5">Built-in</div>
                              {subtitles.filter(s => s.id !== -1).map(s => (
                                <button
                                  key={s.id}
                                  onClick={() => handleSubtitleChange(s.id)}
                                  className={`flex items-center gap-3 w-full text-left px-4 py-3 text-sm transition-colors border-b border-white/5 ${selectedSub === s.id && !activeExternalSub ? "bg-white/10 text-white font-bold" : "text-[#bbb] hover:bg-white/5 hover:text-white"}`}
                                >
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedSub === s.id && !activeExternalSub ? "bg-white" : "bg-white/20"}`} />
                                  {s.name}
                                </button>
                              ))}
                            </>
                          )}

                          {/* Addon tracks */}
                          {addonSubtitles.length > 0 && (
                            <>
                              <div className="px-4 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest border-b border-white/5">Addons</div>
                              {addonSubtitles.map(s => (
                                <button
                                  key={s.id}
                                  onClick={() => loadExternalSubtitle(s.id, s.url, s.name)}
                                  className={`flex items-center gap-3 w-full text-left px-4 py-3 text-sm truncate transition-colors border-b border-white/5 ${activeExternalSub === s.id ? "bg-white/10 text-white font-bold" : "text-[#bbb] hover:bg-white/5 hover:text-white"}`}
                                >
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeExternalSub === s.id ? "bg-[#a78bfa]" : "bg-white/20"}`} />
                                  <span className="truncate">{s.name}</span>
                                </button>
                              ))}
                            </>
                          )}

                          {addonSubtitles.length === 0 && subtitles.filter(s => s.id !== -1).length === 0 && (
                            <div className="px-4 py-6 text-xs text-[#888] text-center">No subtitles available</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Episodes (TV shows only) */}
              {(mediaType === "series" || mediaType === "tv" || season) && (
                <button
                  onClick={() => setShowEpisodesPanel(!showEpisodesPanel)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${showEpisodesPanel ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
                  title="Episodes"
                >
                  Episodes
                </button>
              )}

              {/* Switch Stream */}
              <button onClick={() => setShowStreamPicker(true)} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-lg ml-2" title="Switch Stream">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
              </button>

              {/* Playback speed */}
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === "speed" ? null : "speed")}
                  className={`px-3 py-2 rounded-lg font-semibold text-sm transition-colors tabular-nums ${openMenu === "speed" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
                  title="Playback speed"
                >
                  {playbackRate}×
                </button>
                {openMenu === "speed" && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-32 z-50">
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                      <button
                        key={r}
                        onClick={() => { setPlaybackRate(r); setOpenMenu(null); }}
                        className={`block w-full text-left px-4 py-2.5 text-sm tabular-nums transition-colors ${playbackRate === r ? "bg-white/10 text-white font-bold" : "text-[#bbb] hover:bg-white/5 hover:text-white"}`}
                      >
                        {r}×{r === 1 ? "  (Normal)" : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Next Episode (series only) */}
              {nextEpisode && (
                <button
                  onClick={playNextEpisode}
                  disabled={!nextEpisode.hasAired || nextSearching}
                  className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title={nextEpisode.hasAired ? `Next: S${nextEpisode.season}E${nextEpisode.episode}` : `Airs ${nextEpisode.airDate ?? "TBA"}`}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M5.25 5.25a.75.75 0 011.166-.624l11.5 6.75a.75.75 0 010 1.248l-11.5 6.75A.75.75 0 015.25 18.75V5.25z" />
                    <path d="M19.5 5.25a.75.75 0 00-1.5 0v13.5a.75.75 0 001.5 0V5.25z" />
                  </svg>
                </button>
              )}

              {/* Auto-next toggle */}
              {nextEpisode && (
                <button
                  onClick={() => setAutoNextEnabled((v) => !v)}
                  className={`px-3 py-2 rounded-lg font-semibold text-[11px] transition-colors uppercase tracking-wider ${autoNextEnabled ? "bg-white/20 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
                  title={autoNextEnabled ? "Auto-play next episode is ON" : "Auto-play next episode is OFF"}
                >
                  Auto
                </button>
              )}

              {/* Open externally */}
              <button
                onClick={() => setShowExternalPlayer(true)}
                disabled={!resolvedSrc}
                className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50"
                title="Open in external player"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-lg"
                title="Fullscreen (F)"
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes Panel */}
      {showEpisodesPanel && (
        <div className="absolute inset-0 z-[60] flex items-center justify-end bg-black/50" onClick={() => setShowEpisodesPanel(false)}>
          <div className="h-full w-full max-w-sm bg-[#141414]/95 backdrop-blur-md border-l border-white/10 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-white font-bold text-lg">Episodes</h2>
              <button onClick={() => setShowEpisodesPanel(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Season Selector */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <button
                disabled={episodesSeasonNum <= 1}
                onClick={() => setEpisodesSeasonNum((n) => Math.max(1, n - 1))}
                className="w-7 h-7 rounded bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 flex items-center justify-center font-bold text-sm"
              >‹</button>
              <span className="text-white font-semibold text-sm flex-1 text-center">
                Season {episodesSeasonNum} of {totalSeasons}
              </span>
              <button
                disabled={episodesSeasonNum >= totalSeasons}
                onClick={() => setEpisodesSeasonNum((n) => Math.min(totalSeasons, n + 1))}
                className="w-7 h-7 rounded bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 flex items-center justify-center font-bold text-sm"
              >›</button>
            </div>
            {/* Episode List */}
            <div className="flex-1 overflow-y-auto">
              {episodesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              ) : episodesData.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-8">No episodes found</p>
              ) : (
                episodesData.map((ep: any) => {
                  const isCurrent = season && episode && parseInt(season) === episodesSeasonNum && parseInt(episode) === ep.episode_number;
                  return (
                    <button
                      key={ep.episode_number}
                      onClick={() => playEpisode(episodesSeasonNum, ep.episode_number)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-white/5 ${isCurrent ? "bg-white/10" : "hover:bg-white/5"}`}
                    >
                      <span className={`text-xs font-bold mt-0.5 w-6 text-center flex-shrink-0 ${isCurrent ? "text-white" : "text-white/50"}`}>
                        {ep.episode_number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isCurrent ? "text-white" : "text-white/80"}`}>
                          {ep.name || `Episode ${ep.episode_number}`}
                        </p>
                        {ep.overview && (
                          <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{ep.overview}</p>
                        )}
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0 mt-0.5">Now</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* External Player Modal */}
      {showExternalPlayer && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-6" onClick={() => setShowExternalPlayer(false)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">Open in external player</h2>
              <button onClick={() => setShowExternalPlayer(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-[#888] text-xs mb-3">Your browser will ask to launch the selected app. Make sure the player is installed and its URL handler is registered.</p>
            <div className="flex flex-col gap-2">
              {externalPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openInExternalPlayer(p.id)}
                  className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white font-semibold text-sm transition-colors"
                >
                  {p.name}
                </button>
              ))}
              <button
                onClick={copyStreamUrl}
                className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white font-semibold text-sm transition-colors mt-1"
              >
                Copy stream URL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside menus to close */}
      {openMenu && <div className="absolute inset-0 z-10" onClick={() => setOpenMenu(null)} />}

      {showStreamPicker && movieId && (
        <StreamPickerModal
          tmdbId={parseInt(movieId)} type={mediaType!}
          season={streamPickerSeason ?? (season ? parseInt(season) : undefined)}
          episode={streamPickerEpisode ?? (episode ? parseInt(episode) : undefined)}
          onClose={() => {
            setShowStreamPicker(false);
            setStreamPickerSeason(null);
            setStreamPickerEpisode(null);
          }}
          onPlayStream={(stream) => {
            const url = stream.url ? encodeURIComponent(stream.url) : "";
            const activeSeason = streamPickerSeason ?? (season ? parseInt(season) : undefined);
            const activeEpisode = streamPickerEpisode ?? (episode ? parseInt(episode) : undefined);
            let route = `/player?id=${movieId}&type=${mediaType}&url=${url}`;
            if (activeSeason && activeEpisode) route += `&s=${activeSeason}&e=${activeEpisode}`;
            // Remember which addon this stream came from (in sessionStorage, NOT the
            // route) so the next episode resolves from the same source without
            // polluting the addon URL with query params.
            try {
              if (stream.addonUrl) sessionStorage.setItem("nuvio.currentAddonUrl", stream.addonUrl);
              else sessionStorage.removeItem("nuvio.currentAddonUrl");
            } catch { /* ok */ }
            router.replace(route);
            setShowStreamPicker(false);
            setStreamPickerSeason(null);
            setStreamPickerEpisode(null);
          }}
        />
      )}
      {/* On-Screen Debug Console */}
      {debugLogs.length > 0 && (
        <div className="absolute top-16 left-4 z-[9999] bg-black/90 text-red-500 font-mono text-[10px] sm:text-xs p-4 rounded w-[90%] sm:max-w-2xl overflow-y-auto max-h-[50vh] pointer-events-auto whitespace-pre-wrap break-all border border-red-500/30 shadow-2xl">
          <div className="flex items-center justify-between font-bold text-white mb-2 pb-2 border-b border-white/20">
            <span>iPad Debug Console (Take Screenshot)</span>
            <button
              onClick={() => setDebugLogs([])}
              className="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 border border-red-500/40 rounded text-[10px] text-red-400 font-bold transition-all pointer-events-auto cursor-pointer"
            >
              ✕ Clear & Close
            </button>
          </div>
          {debugLogs.map((log, i) => (
            <div key={i} className="mb-2 leading-relaxed">{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}
