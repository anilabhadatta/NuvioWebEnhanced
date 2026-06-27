"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { fetchExternalIds } from "@/lib/tmdb";
import { fetchSkipIntervals, SkipInterval } from "@/lib/introDb";

const SAMPLE_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

function formatTime(sec: number): string {
  if (!isFinite(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SUBTITLES = ["Off", "English", "Spanish", "French", "German"];
const AUDIOS = ["English (Original)", "Spanish", "French"];
const QUALITIES = ["Auto", "1080p", "720p", "480p", "360p"];

export default function PlayerScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);

  // Menus
  const [openMenu, setOpenMenu] = useState<"sub" | "audio" | "quality" | null>(null);
  const [selectedSub, setSelectedSub] = useState("Off");
  const [selectedAudio, setSelectedAudio] = useState("English (Original)");
  const [selectedQuality, setSelectedQuality] = useState("Auto");

  // Overlays
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showNextEpisode, setShowNextEpisode] = useState(false);

  const movieId = searchParams.get("id");
  const mediaType = searchParams.get("type");
  const streamUrl = searchParams.get("url");
  const season = searchParams.get("s");
  const episode = searchParams.get("e");

  const [skipIntervals, setSkipIntervals] = useState<SkipInterval[]>([]);
  const [activeSkip, setActiveSkip] = useState<SkipInterval | null>(null);

  // Fetch Skip Intervals (Intro/Outro)
  useEffect(() => {
    async function loadSkips() {
      if (!movieId) return;
      
      const type = mediaType === "series" ? "tv" : "movie";
      // We only support Series intro skipping easily via IntroDB right now
      if (type === "tv" && season && episode) {
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

  // Initialize HLS.js or Native Playback
  useEffect(() => {
    let hls: any = null;
    const video = videoRef.current;
    if (!video) return;

    const src = streamUrl ? decodeURIComponent(streamUrl) : SAMPLE_HLS;
    const isM3u8 = src.includes(".m3u8");

    import("hls.js").then(({ default: Hls }) => {
      if (isM3u8 && Hls.isSupported()) {
        hls = new Hls({ maxBufferLength: 30 });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        });
      } else {
        // Native playback for mp4/mkv (if supported) or native HLS (Safari)
        video.src = src;
        video.addEventListener("loadedmetadata", () => {
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        });
      }
    });

    return () => { if (hls) hls.destroy(); };
  }, [streamUrl]);

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

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden"
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      style={{ cursor: showControls ? "default" : "none" }}
    >
      {/* Video */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
      />

      {/* Buffering spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Skip Segment Button */}
      {activeSkip && showControls && (
        <button
          onClick={() => { if (videoRef.current) videoRef.current.currentTime = activeSkip.endTime; }}
          className="absolute bottom-28 right-8 bg-black/70 hover:bg-black/90 border border-white/40 text-white font-semibold px-5 py-2.5 rounded-xl text-sm backdrop-blur-sm transition-all"
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
            {/* Left: play, skip, volume */}
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all"
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* Skip back 10s */}
              <button onClick={() => skip(-10)} className="text-white hover:text-white/70 transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M9.195 18.44c1.25.713 2.805-.19 2.805-1.629v-2.34l6.945 3.968c1.25.714 2.805-.188 2.805-1.628V8.688c0-1.44-1.555-2.342-2.805-1.628L12 11.03v-2.34c0-1.44-1.555-2.343-2.805-1.629l-7.108 4.062c-1.26.72-1.26 2.536 0 3.256l7.108 4.061z" />
                </svg>
              </button>

              {/* Skip forward 10s */}
              <button onClick={() => skip(10)} className="text-white hover:text-white/70 transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M5.055 7.06c-1.25-.714-2.805.188-2.805 1.628v8.123c0 1.44 1.555 2.342 2.805 1.628L12 14.47v2.34c0 1.44 1.555 2.342 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256L14.805 7.06C13.555 6.346 12 7.25 12 8.688v2.34L5.055 7.06z" />
                </svg>
              </button>

              {/* Volume */}
              <div className="flex items-center gap-2 group/vol">
                <button onClick={toggleMute} className="text-white hover:text-white/70 transition-colors">
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
              <span className="text-white/80 text-sm tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right: subtitle, audio, quality, fullscreen */}
            <div className="flex items-center gap-2">
              {/* Subtitles */}
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === "sub" ? null : "sub")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${openMenu === "sub" ? "bg-white text-black" : "text-white hover:bg-white/10"}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  CC
                </button>
                {openMenu === "sub" && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-40 z-50">
                    {SUBTITLES.map((s) => (
                      <button
                        key={s}
                        onClick={() => { setSelectedSub(s); setOpenMenu(null); }}
                        className={`flex items-center justify-between w-full px-4 py-2.5 text-sm transition-colors ${selectedSub === s ? "bg-white/10 text-white font-semibold" : "text-[#bbb] hover:bg-white/5"}`}
                      >
                        {s}
                        {selectedSub === s && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Audio */}
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === "audio" ? null : "audio")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${openMenu === "audio" ? "bg-white text-black" : "text-white hover:bg-white/10"}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                  Audio
                </button>
                {openMenu === "audio" && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-52 z-50">
                    {AUDIOS.map((a) => (
                      <button
                        key={a}
                        onClick={() => { setSelectedAudio(a); setOpenMenu(null); }}
                        className={`flex items-center justify-between w-full px-4 py-2.5 text-sm transition-colors ${selectedAudio === a ? "bg-white/10 text-white font-semibold" : "text-[#bbb] hover:bg-white/5"}`}
                      >
                        {a}
                        {selectedAudio === a && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quality */}
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === "quality" ? null : "quality")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${openMenu === "quality" ? "bg-white text-black" : "text-white hover:bg-white/10"}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                  {selectedQuality}
                </button>
                {openMenu === "quality" && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-36 z-50">
                    {QUALITIES.map((q) => (
                      <button
                        key={q}
                        onClick={() => { setSelectedQuality(q); setOpenMenu(null); }}
                        className={`flex items-center justify-between w-full px-4 py-2.5 text-sm transition-colors ${selectedQuality === q ? "bg-white/10 text-white font-semibold" : "text-[#bbb] hover:bg-white/5"}`}
                      >
                        {q}
                        {selectedQuality === q && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-white/70 transition-colors p-2"
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
    </div>
  );
}
