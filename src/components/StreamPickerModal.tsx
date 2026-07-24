"use client";

import React, { useState, useEffect } from "react";
import { TMDBMovie, fetchExternalIds, resolveStremioIdToMovie } from "@/lib/tmdb";
import { NuvioAddon, StreamItem, fetchUserAddons, fetchStreamsFromAddon } from "@/lib/addonService";
import {
  fetchPlugins,
  getPluginsEnabledGlobal,
  getGroupPluginsByRepo,
  loadScraperSettings,
} from "@/lib/plugins";
import { config } from "@/lib/config";
import { executeScraper } from "@/lib/pluginRuntime";

interface StreamPickerModalProps {
  tmdbId: number | string;
  type: string;
  season?: number;
  episode?: number;
  onClose: () => void;
  onPlayStream: (stream: StreamItem) => void;
}

export default function StreamPickerModal({ tmdbId, type: mediaType, season, episode, onClose, onPlayStream }: StreamPickerModalProps) {
  const [addons, setAddons] = useState<NuvioAddon[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddonFilter, setSelectedAddonFilter] = useState<string>("All");
  const [movieData, setMovieData] = useState<TMDBMovie | null>(null);
  const streamProxyEnabled = config.streamProxyEnabled;

  const isSeries = mediaType === "tv" || mediaType === "series" || !!season;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setStreams([]);
    setError(null);

    async function loadStreams() {
      if (!tmdbId || tmdbId === "NaN" || (typeof tmdbId === "number" && Number.isNaN(tmdbId))) {
        if (isMounted) {
          setError("Invalid metadata ID.");
          setLoading(false);
        }
        return;
      }

      try {
        const type = isSeries ? "tv" : "movie";

        // Fetch metadata so we can display the title in the header
        const metaId = (typeof tmdbId === 'string' && tmdbId.startsWith('tt')) ? tmdbId : `tmdb:${tmdbId}`;
        resolveStremioIdToMovie(metaId, type).then((meta) => {
          if (isMounted && meta) setMovieData(meta);
        }).catch(() => {});

        const addons = await fetchUserAddons();
        if (!addons || addons.length === 0) {
          if (isMounted) setError("No addons installed.");
          return;
        }

        // Fetch IMDB ID for proper addon compatibility (many addons only support ttXXXXXX)
        let imdbId = null;
        if (typeof tmdbId === 'string' && tmdbId.startsWith('tt')) {
          imdbId = tmdbId;
        } else {
          try {
            const externalIds = await fetchExternalIds(tmdbId, type);
            if (externalIds && externalIds.imdb_id) {
              imdbId = externalIds.imdb_id;
            }
          } catch (e) {
            console.error("Failed to fetch IMDB ID", e);
          }
        }

        const baseId = imdbId ? imdbId : "tmdb:" + tmdbId;
        const safeSeason = season ?? 1;
        const safeEpisode = episode ?? 1;
        const videoId = isSeries ? `${baseId}:${safeSeason}:${safeEpisode}` : baseId;
        const addonMediaType = isSeries ? "series" : "movie";

        // Helper: reveal results immediately when the first stream from any source arrives
        let firstResultShown = false;
        function onFirstResult() {
          if (!firstResultShown && isMounted) {
            firstResultShown = true;
            setLoading(false);
          }
        }

        const promises = addons.map((addon) =>
          fetchStreamsFromAddon(addon, addonMediaType, videoId)
            .then((res) => {
              if (isMounted && res && res.length > 0) {
                // Annotate Stremio streams with their origin addon.
                // Force proxy for Penguplay (Google Drive links require Origin stripping via streamProbe)
                const isPenguplay = addon.name.toLowerCase().includes("pengu") || addon.url.toLowerCase().includes("pengu");
                const mappedRes = res.map((s: any) => ({
                  ...s,
                  addonName: addon.name,
                  addonUrl: addon.url,
                  proxy: streamProxyEnabled ? (isPenguplay ? true : s.proxy) : false,
                }));
                
                setStreams((prev) => [...prev, ...mappedRes]);
                onFirstResult();
              }
            })
            .catch(() => []) // Ignore failed addons
        );

        const pluginPromises: Promise<any>[] = [];
        const pluginsEnabled = getPluginsEnabledGlobal();

        if (pluginsEnabled) {
          try {
            const repos = await fetchPlugins();
            const groupByRepo = getGroupPluginsByRepo();

            repos.filter((r) => r.enabled).forEach((repo) => {
              const enabledScrapers = (repo.scrapers || []).filter((s) => s.enabled);
              enabledScrapers.forEach((scraper) => {
                const type = addonMediaType === "series" ? "tv" : addonMediaType;
                if (scraper.supportedTypes && !scraper.supportedTypes.includes(type)) {
                  return;
                }

                const idArg = ["anikototv", "hianime", "animepahe", "allanime", "anikoto"].includes(scraper.id)
                  ? String(tmdbId)
                  : (imdbId || String(tmdbId));

                const settings = loadScraperSettings(scraper.id);

                const promise = executeScraper(
                  repo.url,
                  scraper.filename,
                  idArg,
                  type,
                  safeSeason,
                  safeEpisode,
                  scraper.id,
                  settings
                )
                  .then((results) => {
                    if (isMounted && results && results.length > 0) {
                      const mapped: StreamItem[] = results.map((res: any) => ({
                        name: res.title || res.name || `Stream from ${scraper.name}`,
                        title: res.title || res.name || `Stream from ${scraper.name}`,
                        description: [
                          res.quality ? `${res.quality}` : null,
                          res.size ? `${res.size}` : null,
                          res.language ? `Lang: ${res.language}` : null,
                          res.seeders !== undefined ? `Seeders: ${res.seeders}` : null,
                        ].filter(Boolean).join(" | ") || res.provider || scraper.name,
                        url: res.url,
                        infoHash: res.infoHash,
                        addonName: groupByRepo ? repo.name : scraper.name,
                        addonUrl: repo.url,
                        headers: res.headers,
                        subtitles: res.subtitles,
                        proxy: streamProxyEnabled, // allow proxy only when enabled by environment
                      }));
                      setStreams((prev) => [...prev, ...mapped]);
                      onFirstResult();
                    }
                  })
                  .catch((e) => {
                    console.error(`Failed to fetch streams from plugin scraper: ${scraper.name}`, e);
                  });

                pluginPromises.push(promise);
              });
            });
          } catch (pluginErr) {
            console.error("Error loading plugin scrapers", pluginErr);
          }
        }

        await Promise.all([...promises, ...pluginPromises]);

        if (isMounted) {
          setLoading(false);
          setStreams((prev) => {
            if (prev.length === 0) setError("No streams found.");
            return prev;
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setError("Error loading streams.");
          setLoading(false);
        }
      }
    }

    loadStreams();

    return () => { isMounted = false; };
  }, [tmdbId, isSeries, season, episode]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const modalContent = (
    <div
      className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="slide-up relative bg-[#1a1a1a] rounded-2xl overflow-hidden w-full max-w-xl max-h-[80vh] flex flex-col shadow-2xl border border-white/10">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white line-clamp-1">{movieData ? movieData.title || movieData.name : "Select Stream"}</h2>
            <p className="text-[#888] text-sm mt-1">
              {movieData 
                ? (isSeries && season && episode ? `S${season} E${episode}` : (movieData.release_date || movieData.first_air_date || "").split("-")[0]) 
                : "Stream Selection" + (isSeries && season && episode ? ` - S${season} E${episode}` : "")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && streams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
              <p className="text-[#888] text-sm">Searching addons for streams...</p>
            </div>
          ) : streams.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white font-semibold mb-2">No streams found</p>
              <p className="text-[#888] text-sm">We couldn't find any streams for this content. Check your installed addons in Settings.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Filter Chips */}
              {streams.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setSelectedAddonFilter("All")}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedAddonFilter === "All" ? "bg-white text-black" : "bg-white/10 text-[#aaa] hover:bg-white/20"
                    }`}
                  >
                    All
                  </button>
                  {Array.from(new Set(streams.map((s) => s.addonName))).filter(Boolean).map((addonName) => (
                    <button
                      key={addonName}
                      onClick={() => setSelectedAddonFilter(addonName as string)}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                        selectedAddonFilter === addonName ? "bg-white text-black" : "bg-white/10 text-[#aaa] hover:bg-white/20"
                      }`}
                    >
                      {addonName}
                    </button>
                  ))}
                  {loading && (
                    <div className="ml-2 w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" title="Searching for more..." />
                  )}
                </div>
              )}

              {/* Streams List */}
              <div className="flex flex-col gap-3">
                {streams
                  .filter((s) => selectedAddonFilter === "All" || s.addonName === selectedAddonFilter)
                  .map((stream, idx) => (
                    <div
                      key={idx}
                      className="w-full bg-[#222] hover:bg-[#333] border border-white/5 rounded-xl flex transition-colors group overflow-hidden"
                    >
                      <button
                        onClick={() => onPlayStream(stream)}
                        className="flex-1 min-w-0 p-4 text-left"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-white font-semibold text-sm line-clamp-1 pr-4 break-all">
                            {stream.title || stream.name || "Unknown Stream"}
                          </span>
                          <span className="text-xs bg-white/10 text-[#aaa] px-2 py-1 rounded whitespace-nowrap flex-shrink-0">
                            {stream.addonName}
                          </span>
                        </div>
                        {stream.description && (
                          <p className="text-[#888] text-xs line-clamp-2 pr-2 break-words">{stream.description}</p>
                        )}
                      </button>
                      {stream.url && !stream.url.startsWith("intent:") && (
                        <div className="flex flex-col border-l border-white/5 flex-shrink-0 w-12">
                          <button
                            title="Copy link"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(stream.url!);
                            }}
                            className="flex-1 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors border-b border-white/5"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                            </svg>
                          </button>
                          <a
                            href={stream.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={movieData ? `${movieData.title || movieData.name}.mp4` : "video.mp4"}
                            title="Download stream"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
              
              {loading && (
                <div className="py-4 text-center">
                  <span className="text-[#666] text-xs flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-[#666] border-t-[#ccc] rounded-full animate-spin" />
                    Still searching remaining addons...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );

  // State to track fullscreen element so we can portal into it
  const [fsNode, setFsNode] = useState<Element | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const updateFs = () => setFsNode(document.fullscreenElement || null);
    updateFs();
    document.addEventListener("fullscreenchange", updateFs);
    document.addEventListener("webkitfullscreenchange", updateFs);
    return () => {
      document.removeEventListener("fullscreenchange", updateFs);
      document.removeEventListener("webkitfullscreenchange", updateFs);
    };
  }, []);

  if (typeof window !== "undefined") {
    const { createPortal } = require("react-dom");
    return createPortal(modalContent, fsNode || document.body);
  }
  return null;
}
