"use client";

import React, { useEffect, useState } from "react";
import { PlaybackSettings, pullPlaybackSettings, pushPlaybackSettings, DEFAULT_PLAYBACK_SETTINGS } from "@/lib/playbackSettings";
import { AVAILABLE_LANGUAGES } from "@/lib/languageUtils";

const SUBTITLE_STARTUP_OPTIONS = ["Preferred only", "Always on", "Always off"];

export default function PlaybackSection() {
  const [settings, setSettings] = useState<PlaybackSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [playerEngine, setPlayerEngine] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nuvio.player_engine") || "movi-player";
    }
    return "movi-player";
  });
  const [elementJsSource, setElementJsSource] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nuvio.element_js_source") || "cdn";
    }
    return "cdn";
  });

  useEffect(() => {
    let mounted = true;
    pullPlaybackSettings().then(s => {
      if (mounted) setSettings(s);
    });
    return () => { mounted = false; };
  }, []);

  const updateSetting = <K extends keyof PlaybackSettings>(key: K, value: PlaybackSettings[K]) => {
    if (!settings) return;
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Auto save with debounce or immediately
    setSaving(true);
    pushPlaybackSettings(newSettings).then(() => setSaving(false));
  };

  if (!settings) {
    return <div className="mt-8 text-[#888]">Loading playback settings...</div>;
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Playback</h2>
        {saving && <span className="text-xs text-[#888]">Saving...</span>}
      </div>

      {/* Engine Selection */}
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 mb-8">
        <p className="text-white font-semibold text-sm">Player Engine</p>
        <p className="text-[#888] text-xs mt-1 mb-4">
          Select the media playback engine to use for streaming.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => {
              localStorage.setItem("nuvio.player_engine", "movi-player");
              setPlayerEngine("movi-player");
            }}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${playerEngine === "movi-player"
              ? "bg-white text-black border-white"
              : "bg-white/5 text-white border-white/10 hover:bg-white/10"
              }`}
          >
            movi-player (Default)
          </button>
        </div>

        {playerEngine === "movi-player" && (
          <div className="mt-5 pt-5 border-t border-white/5">
            <p className="text-white font-semibold text-sm">movi-player Core Source (element.js)</p>
            <p className="text-[#888] text-xs mt-1 mb-4">
              Switch between loading the player core from jsDelivr CDN or using the local element.js copy.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  localStorage.setItem("nuvio.element_js_source", "cdn");
                  setElementJsSource("cdn");
                }}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${elementJsSource === "cdn"
                  ? "bg-white text-black border-white"
                  : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                  }`}
              >
                CDN (v0.3.5)
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("nuvio.element_js_source", "local");
                  setElementJsSource("local");
                }}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${elementJsSource === "local"
                  ? "bg-white text-black border-white"
                  : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                  }`}
              >
                Local element.js
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Subtitle and Audio</p>
      <p className="text-[#888] text-xs mb-4">Preferred audio and subtitle language behavior</p>

      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl divide-y divide-white/5 mb-8">
        {/* Preferred Audio */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Preferred Audio Language</p>
          </div>
          <select
            className="bg-[#222] border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none w-48"
            value={settings.preferredAudioLanguage}
            onChange={e => updateSetting("preferredAudioLanguage", e.target.value)}
          >
            <option value="none">None</option>
            {AVAILABLE_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>

        {/* Secondary Audio */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Secondary Audio Language</p>
          </div>
          <select
            className="bg-[#222] border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none w-48"
            value={settings.secondaryAudioLanguage}
            onChange={e => updateSetting("secondaryAudioLanguage", e.target.value)}
          >
            <option value="none">None</option>
            {AVAILABLE_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>

        {/* Preferred Subtitle */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Preferred subtitle language</p>
          </div>
          <select
            className="bg-[#222] border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none w-48"
            value={settings.preferredSubtitleLanguage}
            onChange={e => updateSetting("preferredSubtitleLanguage", e.target.value)}
          >
            <option value="none">None</option>
            {AVAILABLE_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>

        {/* Secondary Subtitle */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Secondary Preferred Language</p>
          </div>
          <select
            className="bg-[#222] border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none w-48"
            value={settings.secondarySubtitleLanguage}
            onChange={e => updateSetting("secondarySubtitleLanguage", e.target.value)}
          >
            <option value="none">None</option>
            {AVAILABLE_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>


        {/* Show Only Preferred */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Show Only Preferred Languages</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={settings.showOnlyPreferredLanguages} onChange={e => updateSetting("showOnlyPreferredLanguages", e.target.checked)} />
            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white/30"></div>
          </label>
        </div>

        {/* Use Forced Subtitles */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Use Forced Subtitles</p>
            <p className="text-[#888] text-xs mt-0.5">Automatically enable matching forced subtitle tracks when available.</p>
          </div>
          <label className="relative inline-flex inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={settings.useForcedSubtitles} onChange={e => updateSetting("useForcedSubtitles", e.target.checked)} />
            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white/30"></div>
          </label>
        </div>

        {/* Addon Subtitle Startup */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Addon Subtitle Startup</p>
          </div>
          <select
            className="bg-[#222] border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none w-48"
            value={settings.addonSubtitleStartup}
            onChange={e => updateSetting("addonSubtitleStartup", e.target.value)}
          >
            {SUBTITLE_STARTUP_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Subtitle Rendering</p>
      <p className="text-[#888] text-xs mb-4">Style subtitles while keeping app defaults intact</p>

      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl divide-y divide-white/5 mb-8">
        {/* Subtitle Size */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Subtitle Size</p>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range" min="8" max="48"
              value={settings.subtitleSize}
              onChange={e => updateSetting("subtitleSize", Number(e.target.value))}
              className="w-48 accent-white cursor-pointer"
            />
            <span className="text-white text-sm w-8 text-right">{settings.subtitleSize}sp</span>
          </div>
        </div>

        {/* Vertical Offset */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Vertical Offset</p>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range" min="0" max="100"
              value={settings.verticalOffset}
              onChange={e => updateSetting("verticalOffset", Number(e.target.value))}
              className="w-48 accent-white cursor-pointer"
            />
            <span className="text-white text-sm w-8 text-right">{settings.verticalOffset}</span>
          </div>
        </div>

        {/* Bold */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Bold</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={settings.subtitleBold} onChange={e => updateSetting("subtitleBold", e.target.checked)} />
            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white/30"></div>
          </label>
        </div>

        {/* Text Color */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Text Color</p>
            <p className="text-[#888] text-xs mt-0.5">Use app color strings such as #FFFFFFFF.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.subtitleTextColor.length >= 7 ? settings.subtitleTextColor.slice(0, 7) : "#FFFFFF"}
              onChange={e => {
                const alpha = settings.subtitleTextColor.length === 9 ? settings.subtitleTextColor.slice(7) : "FF";
                updateSetting("subtitleTextColor", e.target.value.toUpperCase() + alpha);
              }}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-md"
            />
            <input
              type="text"
              value={settings.subtitleTextColor}
              onChange={e => updateSetting("subtitleTextColor", e.target.value)}
              className="bg-[#222] border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none w-36 font-mono"
            />
          </div>
        </div>

        {/* Background Color */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Background Color</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.subtitleBackgroundColor.length >= 7 ? settings.subtitleBackgroundColor.slice(0, 7) : "#000000"}
              onChange={e => {
                const alpha = settings.subtitleBackgroundColor.length === 9 ? settings.subtitleBackgroundColor.slice(7) : "00";
                updateSetting("subtitleBackgroundColor", e.target.value.toUpperCase() + alpha);
              }}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-md"
            />
            <input
              type="text"
              value={settings.subtitleBackgroundColor}
              onChange={e => updateSetting("subtitleBackgroundColor", e.target.value)}
              className="bg-[#222] border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none w-36 font-mono"
            />
          </div>
        </div>

        {/* Outline */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Outline</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={settings.subtitleOutline} onChange={e => updateSetting("subtitleOutline", e.target.checked)} />
            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white/30"></div>
          </label>
        </div>
      </div>

      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Skip Segments</p>
      <p className="text-[#888] text-xs mb-4">Automatically detect intros, outros, and recaps</p>

      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl divide-y divide-white/5 mb-8">
        {/* Skip Intro */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Skip Intro, Outro, Recap</p>
            <p className="text-[#888] text-xs mt-0.5">Show skip buttons based on community-submitted IntroDB segments.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={settings.skipIntroEnabled} onChange={e => updateSetting("skipIntroEnabled", e.target.checked)} />
            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white/30"></div>
          </label>
        </div>

        {/* Anime Skip */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Anime Skip</p>
            <p className="text-[#888] text-xs mt-0.5">Automatically map episodes to MyAnimeList and show skip buttons for Anime OPs and EDs.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={settings.animeSkipEnabled} onChange={e => updateSetting("animeSkipEnabled", e.target.checked)} />
            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white/30"></div>
          </label>
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 mb-8">
        <p className="text-white font-semibold text-sm">External player</p>
        <p className="text-[#888] text-xs mt-1">
          When playing, use the &quot;Open externally&quot; option to copy the stream link or hand it off to a
          desktop player (VLC, PotPlayer) via protocol links.
        </p>
      </div>
    </div>
  );
}
