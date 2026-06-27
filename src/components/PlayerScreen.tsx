"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { fetchExternalIds, fetchTvSeason } from "@/lib/tmdb";
import { fetchSkipIntervals, SkipInterval } from "@/lib/introDb";
import { saveWatchProgress, getResumeTime } from "@/lib/watchProgress";
import StreamPickerModal from "./StreamPickerModal";



const SAMPLE_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

function formatTime(sec: number): string {
  if (!isFinite(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}


export default function PlayerScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Menus
  const [openMenu, setOpenMenu] = useState<"sub" | "audio" | "episodes" | null>(null);
  const [hlsInstance, setHlsInstance] = useState<any>(null);
  const shakaRef = useRef<any>(null);

  const [subtitles, setSubtitles] = useState<{ id: number; name: string }[]>([{ id: -1, name: "None" }]);
  const [subTab, setSubTab] = useState<"builtin" | "addons" | "style">("builtin");
  const [audios, setAudios] = useState<{ id: number; name: string }[]>([]);

  const [selectedSub, setSelectedSub] = useState(-1);
  const [selectedAudio, setSelectedAudio] = useState(0);

  // Overlays
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showNextEpisode, setShowNextEpisode] = useState(false);

  const movieId = searchParams.get("id");
  const mediaType = searchParams.get("type");
  const streamUrl = searchParams.get("url");
  const season = searchParams.get("s");
  const episode = searchParams.get("e");

  const [resolvedSrc, setResolvedSrc] = useState<string>("");

  useEffect(() => {
    async function resolveUrl() {
      const initial = streamUrl ? decodeURIComponent(streamUrl) : SAMPLE_HLS;

      // Resolve redirects fully client-side — the browser follows all redirects natively,
      // including auth-token-embedded CDN links (Torbox, MediaFusion, etc.).
      // No server proxy required or allowed.
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(initial, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(tid);
        // res.url is the fully-resolved final URL after all redirects
        setResolvedSrc(res.url || initial);
      } catch {
        // HEAD failed (CORS or timeout) — fall back to using the original URL directly.
        // The browser will still follow redirects when the <video> element loads it.
        setResolvedSrc(initial);
      }
    }
    resolveUrl();
  }, [streamUrl]);

  const [skipIntervals, setSkipIntervals] = useState<SkipInterval[]>([]);
  const [activeSkip, setActiveSkip] = useState<SkipInterval | null>(null);

  const [episodesList, setEpisodesList] = useState<any[]>([]);
  const [showStreamPicker, setShowStreamPicker] = useState(false);
  const [targetEpisode, setTargetEpisode] = useState<number | undefined>();

  const [addonSubtitles, setAddonSubtitles] = useState<any[]>([]);
  const [loadingSubtitles, setLoadingSubtitles] = useState(false);
  const [activeExternalSub, setActiveExternalSub] = useState<string | null>(null);

  const isSeries = mediaType === "series" || mediaType === "tv" || !!season;

  useEffect(() => {
    if (isSeries && movieId && season) {
      fetchTvSeason(parseInt(movieId), parseInt(season)).then(data => {
        setEpisodesList(data.episodes || []);
      }).catch(console.error);
    }
  }, [movieId, isSeries, season]);

  // Fetch external subtitles
  useEffect(() => {
    if (movieId && mediaType) {
      setLoadingSubtitles(true);
      const type = isSeries ? "tv" : "movie";
      const fetchId = isSeries ? `tmdb:${movieId}:${season}:${episode}` : `tmdb:${movieId}`;
      
      import('@/lib/addonService').then(({ fetchAllSubtitles }) => {
        fetchAllSubtitles(type, fetchId).then(subs => {
          setAddonSubtitles(subs);
          setLoadingSubtitles(false);
        }).catch(() => setLoadingSubtitles(false));
      });
    }
  }, [movieId, mediaType, season, episode]);

  const loadExternalSubtitle = (id: string, url: string, name: string) => {
    const video = videoRef.current;
    if (!video) return;

    // Remove any previously added external tracks
    const existing = video.querySelectorAll('track.addon-sub');
    existing.forEach(t => t.remove());

    const track = document.createElement("track");
    track.className = "addon-sub";
    track.kind = "subtitles";
    track.label = name;
    track.srclang = "en";
    track.src = url;
    track.default = true;

    video.appendChild(track);
    
    // Enable the track
    setTimeout(() => {
      for (let i = 0; i < video.textTracks.length; i++) {
        if (video.textTracks[i].label === name || video.textTracks[i].mode === "showing") {
          video.textTracks[i].mode = "hidden"; // Hide others
        }
      }
      for (let i = 0; i < video.textTracks.length; i++) {
        if (video.textTracks[i].label === name) {
          video.textTracks[i].mode = "showing";
        }
      }
    }, 100);

    setActiveExternalSub(id);
    setSelectedSub(-2); // -2 indicates external
    setOpenMenu(null);
  };

  // Fetch Skip Intervals (Intro/Outro)
  useEffect(() => {
    async function loadSkips() {
      setPlayerError(null); // Reset any previous errors
      if (!movieId) return;
      
      // We only support Series intro skipping easily via IntroDB right now
      if (isSeries && season && episode) {
        try {
          const externalIds = await fetchExternalIds(movieId, "tv");
          if (externalIds.imdb_id) {
            const intervals = await fetchSkipIntervals(externalIds.imdb_id, parseInt(season), parseInt(episode));
            setSkipIntervals(intervals);
          }
        } catch (e) {
          console.error("Failed to load skip intervals", e);
        }
      }
    }
    loadSkips();
  }, [movieId, mediaType, season, episode]);

  // Initialize player on resolvedSrc change.
  // Strategy:
  //   • .m3u8  → HLS.js (or native Safari)
  //   • .mpd   → Shaka Player (DASH)
  //   • everything else (MP4/MKV direct CDN link) → native <video src>
  //     The browser follows auth-embedded redirects natively; no server proxy needed.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedSrc) return;
    let mounted = true;
    let hlsObj: any = null;

    const resumeTime = getResumeTime(
      movieId!, mediaType!,
      season ? parseInt(season) : undefined,
      episode ? parseInt(episode) : undefined
    );

    const lower = resolvedSrc.toLowerCase().split('?')[0];
    const isHls = lower.endsWith('.m3u8') || resolvedSrc.includes('.m3u8');
    const isDash = lower.endsWith('.mpd') || resolvedSrc.includes('.mpd');

    // ── Shaka for DASH manifests only ─────────────────────────────────────────
    async function initShaka() {
      const shaka = await import('shaka-player') as any;
      if (!mounted) return;

      if (shaka.polyfill?.installAll) shaka.polyfill.installAll();
      else if (shaka.default?.polyfill?.installAll) shaka.default.polyfill.installAll();

      const ShakaPlayer = shaka.Player || shaka.default?.Player;
      if (!ShakaPlayer || !ShakaPlayer.isBrowserSupported()) {
        if (video) video.src = resolvedSrc;
        return;
      }

      if (shakaRef.current) { await shakaRef.current.destroy(); shakaRef.current = null; }

      const player = new ShakaPlayer();
      await player.attach(video);
      shakaRef.current = player;

      player.addEventListener('error', (e: any) => {
        console.error('Shaka error', e.detail);
      });

      try {
        await player.load(resolvedSrc);
        if (!mounted) return;

        const variantTracks: any[] = player.getVariantTracks();
        const audioLangs = player.getAudioLanguages();
        if (audioLangs && audioLangs.length > 1) {
          setAudios(audioLangs.map((lang: string, i: number) => ({
            id: i,
            name: lang === 'und' ? `Audio ${i + 1}` : lang.toUpperCase()
          })));
        } else {
          const audioIds = [...new Set(variantTracks.map((t: any) => t.audioId).filter(Boolean))];
          setAudios(audioIds.length > 1
            ? audioIds.map((_, i) => ({ id: i, name: `Audio ${i + 1}` }))
            : [{ id: 0, name: 'Default' }]);
        }
        setSelectedAudio(0);

        const textTracks: any[] = player.getTextTracks();
        if (textTracks.length > 0) {
          setSubtitles([{ id: -1, name: 'None' }, ...textTracks.map((t: any, i: number) => ({
            id: i,
            name: t.label || t.language || `Subtitle ${i + 1}`
          }))]);
        }

        if (resumeTime > 0 && video) video.currentTime = resumeTime;
        video?.play().then(() => { if (mounted) setIsPlaying(true); }).catch(() => {});
      } catch (err) {
        console.error('Shaka load error — falling back to native video', err);
        if (mounted && video) {
          setPlayerError(null);
          video.src = resolvedSrc;
          video.load();
          if (resumeTime > 0) video.currentTime = resumeTime;
          video.play().catch(() => {});
        }
      }
    }

    // ── HLS.js for .m3u8 ──────────────────────────────────────────────────────
    function initHls() {
      import('hls.js').then(({ default: Hls }) => {
        if (!mounted) return;
        if (Hls.isSupported()) {
          hlsObj = new Hls({ maxBufferLength: 60, maxMaxBufferLength: 120 });
          hlsObj.loadSource(resolvedSrc);
          hlsObj.attachMedia(video);
          hlsObj.on(Hls.Events.MANIFEST_PARSED, () => {
            setHlsInstance(hlsObj);
            if (hlsObj.audioTracks?.length > 0) {
              setAudios(hlsObj.audioTracks.map((t: any) => ({ id: t.id, name: t.name || t.lang || `Audio ${t.id}` })));
              setSelectedAudio(hlsObj.audioTrack);
            } else {
              setAudios([{ id: 0, name: 'Default' }]);
              setSelectedAudio(0);
            }
            if (hlsObj.subtitleTracks?.length > 0) {
              setSubtitles([{ id: -1, name: 'None' }, ...hlsObj.subtitleTracks.map((t: any) => ({ id: t.id, name: t.name || t.lang || `Subtitle ${t.id}` }))]);
              setSelectedSub(hlsObj.subtitleTrack);
            }
            if (resumeTime > 0) video.currentTime = resumeTime;
            video.play().then(() => { if (mounted) setIsPlaying(true); }).catch(() => {});
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS
          video.src = resolvedSrc;
        }
      });
    }

    // ── Native video for direct CDN MP4/MKV (Torbox, etc.) ───────────────────
    // The browser handles auth-token-embedded URLs and follows redirects natively.
    // No server proxy or Shaka MSE pipeline needed — just set src directly.
    function initNative() {
      if (shakaRef.current) { shakaRef.current.destroy(); shakaRef.current = null; }

      // Add listeners BEFORE setting src so we never miss an event
      const onMeta = () => {
        if (!mounted) return;
        const vAny = video as any;
        if (vAny.audioTracks) {
          if (vAny.audioTracks.length > 1) {
            const tracks = Array.from(vAny.audioTracks) as any[];
            setAudios(tracks.map((t, i) => ({ id: i, name: t.label || t.language || `Audio ${i + 1}` })));
          } else {
            setAudios([{ id: 0, name: 'Default' }]);
          }
        } else {
          // The audioTracks API is not supported/enabled in this browser
          setAudios([{ id: -1, name: 'Audio track selection not supported natively by your browser' }]);
        }
        setSelectedAudio(0);
        if (resumeTime > 0) video.currentTime = resumeTime;
        // Attempt autoplay; show manual play button if browser blocks it
        video.play().then(() => {
          if (mounted) { setIsPlaying(true); setAutoplayBlocked(false); }
        }).catch(() => {
          // Autoplay was blocked — show a visible play button overlay
          if (mounted) setAutoplayBlocked(true);
        });
      };

      const onError = () => {
        if (!mounted) return;
        // Video element hit a decode/network error
        console.error('Video element error', video.error);
        if (video.error) {
          if (video.error.code === 4) {
            setPlayerError("Format Not Supported: The browser cannot play this file (likely unsupported HEVC video or DTS/AC3 audio). Please choose a different stream.");
          } else if (video.error.code === 3) {
            setPlayerError("Decode Error: The browser failed to decode the media. Please try a different stream.");
          } else {
            setPlayerError(`Playback Error (Code ${video.error.code}). Please try a different stream.`);
          }
        }
      };

      video.addEventListener('loadedmetadata', onMeta, { once: true });
      video.addEventListener('error', onError);

      // Set src last so the events above are definitely registered
      video.src = resolvedSrc;
    }

    if (isHls) {
      initHls();
    } else if (isDash) {
      initShaka();
    } else {
      // Direct file (MP4, MKV, WebM, etc.) — use native video
      initNative();
    }

    return () => {
      mounted = false;
      if (hlsObj) { hlsObj.destroy(); setHlsInstance(null); }
      if (shakaRef.current) { shakaRef.current.destroy(); shakaRef.current = null; }
      video.removeEventListener('error', () => {});
      video.pause();
      video.removeAttribute('src');
      video.load(); // flush MSE buffers
    };
  }, [resolvedSrc]);

  // Show/hide controls on mouse move
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) setShowControls(true);
  }, [isPlaying]);

  // Skip intro/outro triggers
  useEffect(() => {
    // Check if we are inside a skip interval
    const currentSkip = skipIntervals.find(
      (interval) => currentTime >= interval.startTime && currentTime <= interval.endTime
    );
    
    if (currentSkip) {
      setActiveSkip(currentSkip);
    } else {
      setActiveSkip(null);
    }

    if (duration > 0 && currentTime >= duration - 120) setShowNextEpisode(true);
    else setShowNextEpisode(false);
  }, [currentTime, duration, skipIntervals]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); setIsPlaying(true); }
    else { video.pause(); setIsPlaying(false); }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);
  };

  // Save progress periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && duration > 0 && movieId && mediaType) {
        saveWatchProgress({
          id: movieId,
          type: mediaType,
          title: "Stream", // We should pass title in searchParams, but for now fallback
          poster: "",
          season: season ? parseInt(season) : undefined,
          episode: episode ? parseInt(episode) : undefined,
          currentTime,
          duration,
          updatedAt: Date.now()
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, currentTime, duration, movieId, mediaType, season, episode]);

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
    if (videoRef.current) videoRef.current.volume = val;
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) { video.volume = volume || 0.7; video.muted = false; setIsMuted(false); }
    else { video.muted = true; setIsMuted(true); }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const skip = (sec: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.max(0, Math.min(video.currentTime + sec, duration));
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden"
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      style={{ cursor: showControls ? "default" : "none" }}
    >
      {/* Loading overlay — shown while resolvedSrc is empty */}
      {!resolvedSrc && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 z-10">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
          <p>Resolving stream source...</p>
        </div>
      )}

      {/* Video element is always mounted so videoRef is always valid */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}  /* also grab duration when metadata arrives */
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => { setIsBuffering(false); setAutoplayBlocked(false); }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
        playsInline
        style={{ display: resolvedSrc ? 'block' : 'none' }}
      />

      {/* Autoplay-blocked overlay — tap/click to start playback */}
      {autoplayBlocked && resolvedSrc && !playerError && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-30 cursor-pointer"
          onClick={() => {
            videoRef.current?.play().then(() => {
              setIsPlaying(true);
              setAutoplayBlocked(false);
            }).catch(() => {});
          }}
        >
          <div className="w-20 h-20 rounded-full bg-white/10 border border-white/30 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-white ml-1">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-white/60 text-sm mt-4">Click to play</p>
        </div>
      )}

      {/* Player Error Overlay */}
      {playerError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-40 p-8 text-center backdrop-blur-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-16 h-16 text-red-500 mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-white font-bold text-xl mb-2">Playback Failed</p>
          <p className="text-white/70 max-w-md">{playerError}</p>
          <button 
            onClick={() => { setTargetEpisode(undefined); setShowStreamPicker(true); }}
            className="mt-6 px-6 py-2.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Switch Stream
          </button>
        </div>
      )}

      {/* Buffering spinner */}
      {isBuffering && resolvedSrc && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Skip Segment Button — always pointer-events-auto, outside controls opacity */}
      {activeSkip && (
        <button
          onClick={() => {
            const video = videoRef.current;
            if (video) video.currentTime = activeSkip.endTime;
          }}
          className="absolute bottom-28 right-8 bg-black/80 hover:bg-black/95 border border-white/40 text-white font-semibold px-5 py-2.5 rounded-xl text-sm backdrop-blur-sm transition-all z-50 pointer-events-auto"
        >
          Skip {activeSkip.type.charAt(0).toUpperCase() + activeSkip.type.slice(1)} →
        </button>
      )}

      {/* Next Episode */}
      {showNextEpisode && showControls && (
        <div className="absolute bottom-28 right-8 bg-[#1a1a1a]/90 border border-white/20 backdrop-blur-sm rounded-2xl p-4 w-64">
          <p className="text-[#888] text-xs mb-1 font-medium">Up Next</p>
          <p className="text-white font-semibold text-sm mb-3">Next Episode</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-white hover:bg-gray-200 text-black font-bold py-2.5 rounded-xl text-sm transition-all"
          >
            ▶ Play Next
          </button>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 pointer-events-none ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-5 flex items-center gap-4 pointer-events-auto">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 flex items-center justify-center text-white transition-all"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <p className="text-white font-bold text-lg drop-shadow">Now Playing</p>
            {movieId && <p className="text-[#aaa] text-sm">ID: {movieId} · {mediaType}</p>}
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16 pb-5 px-5 pointer-events-auto">
          {/* Progress bar */}
          <div
            className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-4 group/progress relative"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-white rounded-full relative transition-all"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 translate-x-1/2 transition-opacity" />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            {/* Left side: Play, PiP, Speed, CC, Audio, Switch, Episodes, Fullscreen */}
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-white text-black hover:bg-gray-200 flex items-center justify-center transition-colors shadow-lg mr-2"
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-0.5">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* PiP */}
              <button onClick={togglePiP} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors" title="Picture in Picture">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                  <rect x="12" y="11" width="7" height="5" rx="1" ry="1" />
                </svg>
              </button>

              {/* Speed */}
              <button onClick={cycleSpeed} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors relative" title="Playback Speed">
                {playbackSpeed !== 1 && <span className="text-[10px] font-bold absolute bottom-0 right-0 bg-black/80 px-1 rounded text-white shadow">{playbackSpeed}x</span>}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 13l4-4m-4 4a2 2 0 110-4 2 2 0 010 4z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              {/* Subtitles (CC) */}
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === "sub" ? null : "sub")}
                  className={`w-10 h-10 flex items-center justify-center transition-colors ${openMenu === "sub" ? "text-white" : "text-white/80 hover:text-white"}`}
                  title="Subtitles"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                    <rect x="3" y="6" width="18" height="12" rx="2" ry="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14.5a2.5 2.5 0 01-5 0v-5a2.5 2.5 0 015 0M19 14.5a2.5 2.5 0 01-5 0v-5a2.5 2.5 0 015 0" />
                  </svg>
                </button>
                {openMenu === "sub" && (
                  <div className="absolute bottom-full left-0 mb-3 bg-[#1e1e1e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl w-[320px] z-50 flex flex-col max-h-[70vh]">
                    <div className="p-4 border-b border-white/5 shrink-0">
                      <h3 className="text-white font-bold text-lg mb-4">Subtitles</h3>
                      <div className="flex bg-black/40 rounded-xl p-1 gap-1">
                        <button onClick={() => setSubTab("builtin")} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${subTab === "builtin" ? "bg-white text-black" : "text-[#aaa] hover:text-white"}`}>Built-in</button>
                        <button onClick={() => setSubTab("addons")} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${subTab === "addons" ? "bg-white text-black" : "text-[#aaa] hover:text-white"}`}>Addons</button>
                        <button onClick={() => setSubTab("style")} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${subTab === "style" ? "bg-white text-black" : "text-[#aaa] hover:text-white"}`}>Style</button>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                      {subTab === "builtin" && (
                        <div className="flex flex-col gap-1">
                          {subtitles.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => { 
                                setSelectedSub(s.id); 
                                if (hlsInstance) hlsInstance.subtitleTrack = s.id;
                                setOpenMenu(null); 
                              }}
                              className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm transition-colors ${selectedSub === s.id ? "bg-white/10 text-white font-bold" : "text-[#bbb] bg-black/20 hover:bg-white/5"}`}
                            >
                              {s.name}
                              {selectedSub === s.id && (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-white">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {subTab === "addons" && (
                        <div className="flex flex-col h-full">
                          {loadingSubtitles ? (
                            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3" />
                              <p className="text-[#888] text-xs">Finding subtitles...</p>
                            </div>
                          ) : addonSubtitles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                              <p className="text-white font-semibold mb-2">No Subtitles Found</p>
                              <p className="text-[#888] text-xs">Ensure you have OpenSubtitles or other subtitle addons installed in Settings.</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {addonSubtitles.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => loadExternalSubtitle(s.id, s.url, s.name)}
                                  className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm transition-colors ${activeExternalSub === s.id ? "bg-white/10 text-white font-bold" : "text-[#bbb] bg-black/20 hover:bg-white/5"}`}
                                >
                                  <span className="truncate pr-4 text-left">{s.name}</span>
                                  {activeExternalSub === s.id && (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-white shrink-0">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {subTab === "style" && (
                        <div className="flex flex-col gap-4 p-2 pb-6 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-semibold">Subtitle Delay</span>
                            <div className="flex items-center gap-3 bg-black/40 rounded-full px-1 py-1">
                              <button className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">-</button>
                              <span className="text-white font-bold text-xs min-w-12 text-center">+0.000s</span>
                              <button className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">+</button>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-white font-semibold">Font Size</span>
                            <div className="flex items-center gap-3 bg-black/40 rounded-full px-1 py-1">
                              <button className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">-</button>
                              <span className="text-white font-bold text-xs min-w-10 text-center">18sp</span>
                              <button className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">+</button>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-white font-semibold">Shadow</span>
                            <button className="px-3 py-1 bg-white text-black font-bold text-xs rounded-full">On</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Audio */}
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === "audio" ? null : "audio")}
                  className={`w-10 h-10 flex items-center justify-center transition-colors ${openMenu === "audio" ? "text-white" : "text-white/80 hover:text-white"}`}
                  title="Audio Tracks"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                    <rect x="7" y="4" width="10" height="16" rx="3" ry="3" />
                    <circle cx="12" cy="15" r="2" />
                    <circle cx="12" cy="8" r="1" />
                  </svg>
                </button>
                {openMenu === "audio" && (
                  <div className="absolute bottom-full left-0 mb-3 bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-52 z-50 max-h-64 overflow-y-auto">
                    {audios.length === 1 && audios[0].id === -1 ? (
                      <div className="p-4 text-center">
                        <p className="text-white text-sm font-semibold mb-1">Track Selection Unavailable</p>
                        <p className="text-[#888] text-xs">Your browser doesn't natively support reading audio tracks from this file.</p>
                        <p className="text-[#888] text-xs mt-2">In Chrome, you can enable: <br/><span className="text-white bg-black/50 px-1 py-0.5 rounded">chrome://flags/#enable-experimental-web-platform-features</span></p>
                      </div>
                    ) : (
                      audios.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => { 
                            setSelectedAudio(a.id); 
                            if (hlsInstance) {
                              hlsInstance.audioTrack = a.id;
                            } else if (shakaRef.current) {
                              // Shaka Player: select audio language by index
                              const langs = shakaRef.current.getAudioLanguages();
                              if (langs && langs[a.id]) {
                                shakaRef.current.selectAudioLanguage(langs[a.id]);
                              } else {
                                // Fallback: select variant track by audioId
                                const tracks = shakaRef.current.getVariantTracks();
                                const audioIds = [...new Set(tracks.map((t: any) => t.audioId).filter(Boolean))];
                                if (audioIds[a.id] !== undefined) {
                                  const target = tracks.find((t: any) => t.audioId === audioIds[a.id]);
                                  if (target) shakaRef.current.selectVariantTrack(target, true);
                                }
                              }
                            } else {
                              const vAny = videoRef.current as any;
                              if (vAny?.audioTracks) {
                                for (let i = 0; i < vAny.audioTracks.length; i++) {
                                  vAny.audioTracks[i].enabled = (i === a.id);
                                }
                              }
                            }
                            setOpenMenu(null); 
                          }}
                          className={`flex items-center justify-between w-full px-4 py-2.5 text-sm transition-colors ${selectedAudio === a.id ? "bg-white/10 text-white font-semibold" : "text-[#bbb] hover:bg-white/5"}`}
                        >
                          {a.name}
                          {selectedAudio === a.id && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Switch Stream */}
              <button onClick={() => { setTargetEpisode(undefined); setShowStreamPicker(true); }} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors" title="Switch Stream">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </button>

              {/* Episodes */}
              {isSeries && (
                <div className="relative">
                  <button onClick={() => setOpenMenu(openMenu === "episodes" ? null : "episodes")} className={`w-10 h-10 flex items-center justify-center transition-colors ${openMenu === "episodes" ? "text-white" : "text-white/80 hover:text-white"}`} title="Episodes">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                      <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 16h18" />
                    </svg>
                  </button>
                  {openMenu === "episodes" && (
                    <div className="absolute bottom-full left-0 mb-3 bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-64 w-72 z-50 max-h-80 overflow-y-auto flex flex-col">
                      <div className="p-3 border-b border-white/10 shrink-0 sticky top-0 bg-[#1e1e1e] z-10">
                         <p className="text-white font-bold text-sm">Season {season}</p>
                      </div>
                      <div className="flex-1 overflow-y-auto p-1">
                        {episodesList.map((ep: any) => (
                          <button
                            key={ep.id}
                            onClick={() => {
                              setTargetEpisode(ep.episode_number);
                              setShowStreamPicker(true);
                              setOpenMenu(null);
                            }}
                            className={`flex flex-col w-full px-3 py-2 text-left transition-colors rounded-lg ${parseInt(episode || "1") === ep.episode_number ? "bg-white/10 text-white font-semibold" : "text-[#bbb] hover:bg-white/5 hover:text-white"}`}
                          >
                            <span className="text-xs text-white/50 mb-0.5">Episode {ep.episode_number}</span>
                            <span className="text-sm line-clamp-1">{ep.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                title="Fullscreen"
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                )}
              </button>
            </div>

            {/* Right side: Volume, Time */}
            <div className="flex items-center gap-4">
              {/* Volume */}
              <div className="flex items-center gap-2 group/vol">
                <button onClick={toggleMute} className="text-white/80 hover:text-white transition-colors" title="Mute">
                  {isMuted || volume === 0 ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905H6.44l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 001.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 00-1.06-1.06l-1.72 1.72-1.72-1.72z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905H6.44l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                      <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 accent-white cursor-pointer opacity-0 group-hover/vol:opacity-100 transition-opacity"
                />
              </div>

              {/* Time */}
              <span className="text-white/80 text-sm tabular-nums mr-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Click outside menus to close */}
      {openMenu && (
        <div
          className="absolute inset-0 z-40"
          onClick={() => setOpenMenu(null)}
        />
      )}

      {/* Stream Picker Modal */}
      {showStreamPicker && movieId && (
        <StreamPickerModal
          tmdbId={parseInt(movieId)}
          type={mediaType!}
          season={season ? parseInt(season) : undefined}
          episode={targetEpisode || (episode ? parseInt(episode) : undefined)}
          onClose={() => setShowStreamPicker(false)}
          onPlayStream={(stream) => {
            const url = stream.url ? encodeURIComponent(stream.url) : "";
            let route = `/player?id=${movieId}&type=${mediaType}&url=${url}`;
            if (season && (targetEpisode || episode)) {
              route += `&s=${season}&e=${targetEpisode || episode}`;
            }
            router.replace(route);
            setShowStreamPicker(false);
          }}
        />
      )}
    </div>
  );
}
