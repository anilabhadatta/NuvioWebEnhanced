"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { fetchExternalIds } from "@/lib/tmdb";
import { fetchSkipIntervals, SkipInterval } from "@/lib/introDb";
import { saveWatchProgress, getResumeTime } from "@/lib/watchProgress";
import StreamPickerModal from "./StreamPickerModal";

function formatTime(sec: number): string {
  if (!isFinite(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const hexToRgba = (hex: string, alpha: number) => {
  if (hex === "transparent") return "transparent";
  let c = hex.substring(1);
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// movi-player's built-in color palette (matches MoviElement.SUBTITLE_COLOR_PALETTE)
const SUBTITLE_COLOR_SWATCHES = [
  { label: "White",   value: "#FFFFFF" },
  { label: "Yellow",  value: "#FFEB3B" },
  { label: "Green",   value: "#69F0AE" },
  { label: "Cyan",    value: "#80DEEA" },
  { label: "Blue",    value: "#82B1FF" },
  { label: "Magenta", value: "#FF80AB" },
  { label: "Red",     value: "#FF5252" },
  { label: "Black",   value: "#000000" },
];

const SUBTITLE_EDGE_OPTIONS = [
  { label: "None",    value: "none" },
  { label: "Shadow",  value: "shadow" },
  { label: "Outline", value: "outline" },
  { label: "Raised",  value: "raised" },
] as const;

const SUBTITLE_BG_COLOR_SWATCHES = [
  { label: "Transparent", value: "transparent" },
  { label: "Black",   value: "#000000" },
  { label: "Dark",    value: "#1a1a2e" },
  { label: "Navy",    value: "#0d1b2a" },
  { label: "Maroon",  value: "#4a0000" },
  { label: "White",   value: "#FFFFFF" },
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
  if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
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
  player.setAttribute("subtitlesize",  String(style.sizePct));
  player.setAttribute("subtitlebg",    String(style.bgPct));
  player.setAttribute("subtitleedge",  style.edge);
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

const MoviPlayerWrapper = React.memo(({ resolvedSrc, onInit }: { resolvedSrc: string, onInit: (p: any) => void }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;

    let player = wrapperRef.current.querySelector("movi-player") as any;
    if (!player) {
      player = document.createElement("movi-player");
      player.className = "w-full h-full object-contain";
      player.setAttribute("playsinline", "true");
      wrapperRef.current.appendChild(player);
      onInit(player);
    }

    if (resolvedSrc && player.getAttribute("src") !== resolvedSrc) {
      player.setAttribute("src", resolvedSrc);
      player.style.display = "block";
    } else if (!resolvedSrc) {
      player.style.display = "none";
    }
  }, [resolvedSrc, onInit]);

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
  const [isBuffering, setIsBuffering] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Menus
  const [openMenu, setOpenMenu] = useState<"sub" | "audio" | null>(null);
  const [subActiveTab, setSubActiveTab] = useState<"tracks" | "style">("tracks");
  const [audios, setAudios] = useState<{ id: number; name: string }[]>([{ id: 0, name: "Default" }]);
  const [subtitles, setSubtitles] = useState<{ id: number; name: string }[]>([{ id: -1, name: "None" }]);
  const [selectedAudio, setSelectedAudio] = useState(0);
  const [selectedSub, setSelectedSub] = useState(-1);

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
          color:   typeof p.color   === "string" ? p.color : DEFAULT_SUBTITLE_STYLE.color,
          bgColor: bgColorSaved,
          sizePct: typeof p.sizeMult === "number" ? Math.round(p.sizeMult * 100) : DEFAULT_SUBTITLE_STYLE.sizePct,
          bgPct:   typeof p.bgAlpha  === "number" ? Math.round(p.bgAlpha  * 100) : DEFAULT_SUBTITLE_STYLE.bgPct,
          edge:    (["none","shadow","outline","raised"] as SubtitleEdge[]).includes(p.edge) ? p.edge : DEFAULT_SUBTITLE_STYLE.edge,
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

  // Modal & Overlays
  const [showStreamPicker, setShowStreamPicker] = useState(false);
  const [skipIntervals, setSkipIntervals] = useState<SkipInterval[]>([]);

  const movieId = searchParams.get("id");
  const mediaType = searchParams.get("type");
  const streamUrl = searchParams.get("url");
  const season = searchParams.get("s");
  const episode = searchParams.get("e");
  const streamHash = searchParams.get("hash");

  // Load movi-player module globally once
  useEffect(() => { import("movi-player").catch(console.error); }, []);

  // --------------------------------------------------------------------------------
  // 1. STRICT API CALL LIMITERS (Exactly 1 call per stream)
  // --------------------------------------------------------------------------------
  const lastResolvedUrl = useRef<string | null>(null);
  useEffect(() => {
    if (!streamUrl) return;
    const decoded = decodeURIComponent(streamUrl);
    if (lastResolvedUrl.current === decoded) return;
    lastResolvedUrl.current = decoded;

    async function resolveUrl() {
      try {
        // Fetch HEAD exactly once to resolve CDN redirects so the player doesn't loop
        const res = await fetch(decoded, { method: 'HEAD', redirect: 'follow' });
        setResolvedSrc(res.url || decoded);
      } catch (err) {
        console.error("Failed HEAD pre-resolve", err);
        setResolvedSrc(decoded);
      }
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
    const state = e.detail;
    if (state === 'playing') {
      setIsBuffering(false);
      setIsPlaying(true);
      // Synchronize volume and muted state when playback successfully starts/resumes
      const video = videoRef.current;
      if (video) {
        if (typeof video.volume !== 'undefined') video.volume = volume;
        if (typeof video.muted !== 'undefined') video.muted = isMuted;
      }
    }
    else if (state === 'paused') { setIsPlaying(false); }
    else if (state === 'buffering' || state === 'seeking' || state === 'loading') { setIsBuffering(true); }
    else if (state === 'ready') { setIsBuffering(false); }
    else if (state === 'error') { setIsBuffering(false); setPlayerError("Failed to decode stream"); }
  };

  onTracksChangeRef.current = (e: any) => {
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
    if (!video) return;
    setCurrentTime(video.currentTime ?? 0);
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

  // Skip segment — derived value, no setState needed
  const activeSkip = skipIntervals.find(i => currentTime >= i.startTime && currentTime <= i.endTime) || null;

  // Controls UI visibility
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => { if (!isPlaying) setShowControls(true); }, [isPlaying]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    // Explicitly sync volume and muted on user interaction to bypass autoplay policy restrictions
    if (typeof video.volume !== 'undefined') video.volume = volume;
    if (typeof video.muted !== 'undefined') video.muted = isMuted;

    if (isPlaying) {
      if (typeof video.pause === 'function') video.pause();
      setIsPlaying(false);
    } else {
      if (typeof video.play === 'function') video.play();
      setIsPlaying(true);
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
    const video = videoRef.current;
    if (video) {
      const numId = id === -1 ? null : Number(id);
      console.log("[handleSubtitleChange] Selected Subtitle ID:", numId);
      try {
        const player = video.player;
        if (player && typeof player.selectSubtitleTrack === 'function') {
          player.selectSubtitleTrack(numId);
          console.log("[handleSubtitleChange] Switched track via player.selectSubtitleTrack");
        } else if (typeof video.selectSubtitleTrack === 'function') {
          video.selectSubtitleTrack(numId);
          console.log("[handleSubtitleChange] Switched track via video.selectSubtitleTrack");
        }

        // Enable text track visibility when selecting a subtitle
        if (numId !== null) {
          if (player && typeof player.setTextTrackVisibility === 'function') {
            player.setTextTrackVisibility(true);
          } else if (typeof video.setTextTrackVisibility === 'function') {
            video.setTextTrackVisibility(true);
          }
          // Enable native tracks
          const tracks = video.textTracks;
          if (tracks) {
            for (let i = 0; i < tracks.length; i++) {
              if (i === numId) {
                tracks[i].mode = 'showing';
              } else {
                tracks[i].mode = 'disabled';
              }
            }
          }
        } else {
          // Disable text track visibility when selecting "None" (-1)
          if (player && typeof player.setTextTrackVisibility === 'function') {
            player.setTextTrackVisibility(false);
          } else if (typeof video.setTextTrackVisibility === 'function') {
            video.setTextTrackVisibility(false);
          }
          // Disable native tracks
          const tracks = video.textTracks;
          if (tracks) {
            for (let i = 0; i < tracks.length; i++) {
              tracks[i].mode = 'disabled';
            }
          }
        }

        // Corrective seek/flush to apply track changes immediately
        if (typeof video.currentTime === 'number') {
          const curr = video.currentTime;
          video.currentTime = curr;
        }
      } catch (err) {
        console.error("[handleSubtitleChange] Failed to select subtitle track:", err);
      }
    }
    setOpenMenu(null);
  };

  const loadExternalSubtitle = async (id: string, url: string, name: string) => {
    try {
      const res = await fetch(url);
      let text = await res.text();
      if (!text.includes("WEBVTT")) {
        text = "WEBVTT\n\n" + text.replace(/\r\n|\r|\n/g, '\n').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
      }

      const video = videoRef.current;
      if (!video) return;

      const blob = new Blob([text], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);

      // Clean existing addon tracks
      const existing = video.querySelectorAll('track.addon-sub');
      existing.forEach((t: any) => {
        if (t instanceof HTMLTrackElement && t.src.startsWith('blob:')) URL.revokeObjectURL(t.src);
        t.remove();
      });

      const track = document.createElement("track");
      track.className = "addon-sub";
      track.kind = "subtitles";
      track.label = name;
      track.srclang = "en";
      track.src = blobUrl;
      track.default = true;

      video.appendChild(track);
      
      // Ensure all other native text tracks are disabled
      const tracks = video.textTracks;
      if (tracks) {
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = 'disabled';
        }
      }
      if (track.track) {
        track.track.mode = 'showing';
      } else {
        (track as any).mode = 'showing';
      }

      const player = video.player;
      if (player && typeof player.setTextTrackVisibility === 'function') {
        player.setTextTrackVisibility(true);
      } else if (typeof video.setTextTrackVisibility === 'function') {
        video.setTextTrackVisibility(true);
      }

      // Perform a corrective seek to update display
      if (typeof video.currentTime === 'number') {
        video.currentTime = video.currentTime;
      }

      setActiveExternalSub(id);
      setSelectedSub(-2);
    } catch (e) {
      console.error(e);
    }
    setOpenMenu(null);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

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

      {/* Skip Button */}
      {activeSkip && (
        <button
          onClick={() => { if (videoRef.current) videoRef.current.currentTime = activeSkip.endTime; }}
          className="absolute bottom-28 right-8 bg-black/80 hover:bg-black/95 border border-white/40 text-white font-semibold px-5 py-2.5 rounded-xl z-50 pointer-events-auto transition-all"
        >
          Skip {activeSkip.type} →
        </button>
      )}

      {/* Overlay UI */}
      <div className={`absolute inset-0 transition-opacity duration-300 pointer-events-none z-20 flex flex-col justify-between ${showControls ? "opacity-100" : "opacity-0"}`}>

        {/* Top Bar */}
        <div className="bg-gradient-to-b from-black/80 to-transparent p-6 flex items-center pointer-events-auto">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 flex items-center justify-center text-white transition-all mr-4">
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
          <div className="w-full h-2 bg-white/20 rounded-full cursor-pointer mb-6 group relative" onClick={handleSeek}>
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `calc(${progress}% - 8px)` }} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Play / Pause */}
              <button onClick={togglePlay} className="w-12 h-12 rounded-full bg-white text-black hover:bg-gray-200 flex items-center justify-center transition-colors shadow-lg">
                {isPlaying
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
                                className={`w-6 h-6 rounded-full border-2 transition-all ${
                                  subtitleStyle.color === value
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
                                className={`py-1.5 px-2 rounded text-xs font-bold transition-colors ${
                                  subtitleStyle.edge === value
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
                                className={`w-6 h-6 rounded-full border-2 transition-all ${
                                  subtitleStyle.bgColor === value || (value === "transparent" && subtitleStyle.bgPct === 0)
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
                        <div className="p-3 bg-black/40 border-b border-white/10 font-bold text-white text-xs uppercase tracking-wider sticky top-0">Built-in</div>
                        <div className="overflow-y-auto max-h-[140px]">
                          {subtitles.map(s => (
                            <button key={s.id} onClick={() => handleSubtitleChange(s.id)} className={`block w-full text-left px-4 py-3 text-sm transition-colors ${selectedSub === s.id ? "bg-white/10 text-white font-bold" : "text-[#bbb] hover:bg-white/5 hover:text-white"}`}>
                              {s.name}
                            </button>
                          ))}
                        </div>
                        <div className="p-3 bg-black/40 border-y border-white/10 font-bold text-white text-xs uppercase tracking-wider sticky top-0">Addons</div>
                        <div className="overflow-y-auto flex-1 max-h-[140px]">
                          {addonSubtitles.map(s => (
                            <button key={s.id} onClick={() => loadExternalSubtitle(s.id, s.url, s.name)} className={`block w-full text-left px-4 py-3 text-sm truncate transition-colors ${activeExternalSub === s.id ? "bg-white/10 text-white font-bold" : "text-[#bbb] hover:bg-white/5 hover:text-white"}`}>
                              {s.name}
                            </button>
                          ))}
                          {addonSubtitles.length === 0 && <div className="px-4 py-4 text-xs text-[#888] text-center">No addons found</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Switch Stream */}
              <button onClick={() => setShowStreamPicker(true)} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-lg ml-2" title="Switch Stream">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Click outside menus to close */}
      {openMenu && <div className="absolute inset-0 z-10" onClick={() => setOpenMenu(null)} />}

      {showStreamPicker && movieId && (
        <StreamPickerModal
          tmdbId={parseInt(movieId)} type={mediaType!}
          season={season ? parseInt(season) : undefined}
          episode={episode ? parseInt(episode) : undefined}
          onClose={() => setShowStreamPicker(false)}
          onPlayStream={(stream) => {
            const url = stream.url ? encodeURIComponent(stream.url) : "";
            let route = `/player?id=${movieId}&type=${mediaType}&url=${url}`;
            if (season && episode) route += `&s=${season}&e=${episode}`;
            router.replace(route);
            setShowStreamPicker(false);
          }}
        />
      )}
    </div>
  );
}
