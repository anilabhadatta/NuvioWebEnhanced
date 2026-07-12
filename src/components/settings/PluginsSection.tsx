"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Settings,
  RefreshCw,
  Trash2,
  Puzzle,
} from "lucide-react";
import {
  PluginRepository,
  fetchPlugins,
  addPluginRepo,
  removePluginRepo,
  togglePluginRepo,
  refreshPluginRepo,
  toggleScraper,
  getPluginsEnabledGlobal,
  setPluginsEnabledGlobal,
  getGroupPluginsByRepo,
  setGroupPluginsByRepo,
  loadScraperSettings,
  saveScraperSettings,
} from "@/lib/plugins";
import { executeGetSettingsLayout } from "@/lib/pluginRuntime";
import { config } from "@/lib/config";

interface SettingsModalProps {
  repoUrl: string;
  scraper: any;
  onClose: () => void;
}

function ScraperSettingsModal({ repoUrl, scraper, onClose }: SettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<any[] | null>(null);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    let isMounted = true;
    executeGetSettingsLayout(repoUrl, scraper.filename, scraper.id)
      .then((res) => {
        if (isMounted) {
          setLayout(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    const current = loadScraperSettings(scraper.id);
    setSettings(current || {});

    return () => {
      isMounted = false;
    };
  }, [repoUrl, scraper]);

  const handleSave = () => {
    saveScraperSettings(scraper.id, settings);
    onClose();
  };

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="text-base font-bold text-white">
            {scraper.name} Settings
          </h3>
          <button onClick={onClose} className="text-[#888] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <p className="text-xs text-[#888]">Loading settings layout…</p>
            </div>
          ) : !layout || layout.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#888] text-sm">This scraper does not have any configurable settings.</p>
            </div>
          ) : (
            layout.map((field: any, idx: number) => {
              const type = field.type || "info";
              const key = field.key || "";
              const label = field.label || "";
              const description = field.description || "";

              if (type === "header") {
                return (
                  <h4 key={idx} className="text-xs font-bold text-[#666] uppercase tracking-wider pt-3">
                    {label}
                  </h4>
                );
              }
              if (type === "info") {
                return (
                  <div key={idx} className="bg-white/5 border border-white/5 rounded-xl p-3">
                    <p className="text-xs text-[#aaa] leading-relaxed">{label}</p>
                  </div>
                );
              }
              if (type === "text") {
                return (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <label className="text-white text-xs font-semibold">{label}</label>
                    <input
                      type={field.isPassword ? "password" : "text"}
                      value={settings[key] ?? ""}
                      onChange={(e) => updateSetting(key, e.target.value)}
                      placeholder={field.placeholder || ""}
                      className="w-full bg-[#222] border border-white/5 rounded-xl px-4 py-2.5 text-white placeholder-[#666] outline-none text-sm focus:border-white/20 transition-colors"
                    />
                    {description && <p className="text-[#666] text-[10px]">{description}</p>}
                  </div>
                );
              }
              if (type === "select") {
                return (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <label className="text-white text-xs font-semibold">{label}</label>
                    <select
                      value={settings[key] ?? field.defaultValue ?? ""}
                      onChange={(e) => updateSetting(key, e.target.value)}
                      className="w-full bg-[#222] border border-white/5 rounded-xl px-4 py-2.5 text-white outline-none text-sm focus:border-white/20 transition-colors"
                    >
                      {(field.options || []).map((opt: any) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {description && <p className="text-[#666] text-[10px]">{description}</p>}
                  </div>
                );
              }
              if (type === "toggle") {
                const checked = settings[key] ?? field.defaultValue ?? false;
                return (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-white/5">
                    <div className="flex flex-col pr-4">
                      <span className="text-white text-xs font-semibold">{label}</span>
                      {description && <span className="text-[#666] text-[10px] mt-0.5">{description}</span>}
                    </div>
                    <button
                      onClick={() => updateSetting(key, !checked)}
                      className={`w-10 h-5.5 rounded-full relative transition-colors shrink-0 ${checked ? "bg-white" : "bg-white/10"
                        }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4.5 h-4.5 rounded-full transition-all ${checked ? "right-0.5 bg-black" : "left-0.5 bg-[#888]"
                          }`}
                      />
                    </button>
                  </div>
                );
              }
              return null;
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-white/2">
          <button onClick={onClose} className="px-4 py-2 bg-transparent hover:bg-white/5 text-white font-semibold rounded-xl text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2 bg-white hover:bg-gray-200 disabled:opacity-50 text-black font-bold rounded-xl text-sm transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PluginsSection() {
  const [repos, setRepos] = useState<PluginRepository[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [groupByRepo, setGroupByRepo] = useState(false);
  const [activeSettingsScraper, setActiveSettingsScraper] = useState<{ repoUrl: string; scraper: any } | null>(null);

  useEffect(() => {
    fetchPlugins().then(setRepos);
    setGlobalEnabled(getPluginsEnabledGlobal());
    setGroupByRepo(getGroupPluginsByRepo());
  }, []);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError("");
    const res = await addPluginRepo(url, repos);
    if (res.ok) {
      setRepos((prev) => [...prev, res.repo!]);
      setUrl("");
    } else {
      setError(res.error || "Failed to add repository.");
    }
    setBusy(false);
  };

  const handleRemove = async (u: string) => setRepos(await removePluginRepo(u, repos));
  const handleToggle = async (u: string) => setRepos(await togglePluginRepo(u, repos));
  const handleRefresh = async (u: string) => setRepos(await refreshPluginRepo(u, repos));

  const handleScraperToggle = async (repoUrl: string, scraperId: string, enabled: boolean) => {
    const updated = await toggleScraper(repoUrl, scraperId, enabled, repos);
    setRepos(updated);
  };

  const handleGlobalToggle = () => {
    const next = !globalEnabled;
    setGlobalEnabled(next);
    setPluginsEnabledGlobal(next);
  };

  const handleGroupByRepoToggle = () => {
    const next = !groupByRepo;
    setGroupByRepo(next);
    setGroupPluginsByRepo(next);
  };

  const totalProviders = repos.reduce((sum, r) => sum + (r.scrapers?.length || 0), 0);
  const hasTmdbKey = !!config.tmdbApiKey;

  // Flatten all scrapers/providers across repositories
  const allScrapers = repos.flatMap((r) =>
    (r.scrapers || []).map((s) => ({
      ...s,
      repoUrl: r.url,
      repoName: r.name,
      repoEnabled: r.enabled,
    }))
  );

  return (
    <div className="mt-8">
      {/* Title */}
      <h3 className="text-xl font-bold text-white mb-2">Plugins</h3>
      <p className="text-xs text-[#888] mb-5">
        A Plugin is a repository of scrapers. Each repository can provide many scraper sources used
        during stream discovery. Plugin scrapers require a TMDB API key (set it under Integrations).
      </p>

      {/* OVERVIEW Header */}
      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Overview</p>

      {/* Overview Card */}
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 mb-8 flex flex-col gap-4">
        {/* Overview Badges */}
        <div className="flex flex-wrap gap-2">
          <span className="text-[11px] font-semibold text-[#888] bg-[#222] border border-white/5 px-2.5 py-1 rounded-lg">
            {repos.length} repos
          </span>
          <span className="text-[11px] font-semibold text-[#888] bg-[#222] border border-white/5 px-2.5 py-1 rounded-lg">
            {totalProviders} providers
          </span>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${globalEnabled
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : "text-[#888] bg-[#222] border-white/5"
            }`}>
            Plugins {globalEnabled ? "enabled" : "disabled"}
          </span>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${hasTmdbKey
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : "text-amber-400 bg-amber-500/10 border-amber-500/20"
            }`}>
            TMDB API key {hasTmdbKey ? "set" : "missing"}
          </span>
        </div>

        {/* Divider */}
        <div className="h-[1px] bg-white/5 w-full" />

        {/* Enable globally toggle */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-white text-sm font-semibold">Enable plugin providers globally</p>
            <p className="text-[#666] text-xs mt-0.5">Use plugin providers during stream discovery.</p>
          </div>
          <button
            onClick={handleGlobalToggle}
            className={`w-11 h-6 rounded-full relative transition-colors ${globalEnabled ? "bg-white" : "bg-white/10"}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${globalEnabled ? "right-1 bg-black" : "left-1 bg-[#888]"}`} />
          </button>
        </div>

        {/* Group by repository toggle */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-white text-sm font-semibold">Group plugin providers by repository</p>
            <p className="text-[#666] text-xs mt-0.5">In Streams, show one provider per repository instead of one per source.</p>
          </div>
          <button
            onClick={handleGroupByRepoToggle}
            className={`w-11 h-6 rounded-full relative transition-colors ${groupByRepo ? "bg-white" : "bg-white/10"}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${groupByRepo ? "right-1 bg-black" : "left-1 bg-[#888]"}`} />
          </button>
        </div>
      </div>

      {/* ADD REPOSITORY Header */}
      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Add Repository</p>
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 mb-8 flex flex-col gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Plugin manifest URL"
          className="w-full bg-[#222] border border-white/5 rounded-xl px-4 py-3 text-white placeholder-[#666] outline-none text-sm focus:border-white/20 transition-colors"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={busy || !url.trim()}
          className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Installing…" : "Install Plugin Repository"}
        </button>
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
      </div>

      {/* INSTALLED REPOSITORIES Header */}
      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Installed Repositories</p>
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden mb-8">
        {repos.length === 0 ? (
          <div className="p-6">
            <p className="text-white font-semibold text-sm">No plugin repositories installed.</p>
            <p className="text-[#888] text-xs mt-1">Add a repository manifest URL to install scraper plugins.</p>
          </div>
        ) : (
          repos.map((r, i) => (
            <div key={r.url} className={`px-5 py-4 ${i < repos.length - 1 ? "border-b border-white/5" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 overflow-hidden">
                  <p className="text-white font-bold text-base truncate">{r.name}</p>
                  {r.version && <p className="text-[#888] text-xs mt-0.5">Version {r.version}{r.author ? ` · ${r.author}` : ""}</p>}
                  <p className="text-[#555] text-xs mt-0.5 truncate">{r.url}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-semibold text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                      {r.scraperCount} provider{r.scraperCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  {r.errorMessage && <p className="text-red-400 text-xs mt-1">{r.errorMessage}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0 pt-1">
                  <button onClick={() => handleToggle(r.url)} className={`w-11 h-6 rounded-full relative transition-colors ${r.enabled ? "bg-white" : "bg-white/15"}`} title={r.enabled ? "Enabled" : "Disabled"}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${r.enabled ? "right-1 bg-black" : "left-1 bg-[#888]"}`} />
                  </button>
                  <button onClick={() => handleRefresh(r.url)} className="text-[#888] hover:text-white transition-colors" title="Refresh">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleRemove(r.url)} className="text-red-400 hover:text-red-300 transition-colors" title="Uninstall">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* PROVIDERS Header */}
      {allScrapers.length > 0 && (
        <>
          <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Providers</p>
          <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
            {allScrapers.map((s) => (
              <div key={s.id} className={`px-5 py-4 flex items-center justify-between gap-4 transition-opacity ${!s.repoEnabled ? "opacity-40" : ""}`}>
                <div className="flex items-center gap-3 min-w-0">
                  {/* Logo or custom icon */}
                  {s.logo ? (
                    <img
                      src={s.logo}
                      alt={s.name}
                      className="w-10 h-10 rounded-lg object-cover bg-emerald-500/10 p-1 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <Puzzle className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-[10px] text-[#666] font-semibold uppercase tracking-wider">{s.repoName}</p>
                    <p className="text-white font-bold text-sm truncate">{s.name}</p>
                    {s.description && (
                      <p className="text-[#888] text-xs mt-0.5 truncate">{s.description}</p>
                    )}
                    {/* Badges below description */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {s.supportedTypes && s.supportedTypes.length > 0 && (
                        <span className="text-[9px] font-bold text-white/50 bg-[#222] border border-white/5 px-2 py-0.5 rounded-md">
                          {s.supportedTypes.join(" | ")}
                        </span>
                      )}
                      {s.version && (
                        <span className="text-[9px] font-bold text-white/50 bg-[#222] border border-white/5 px-2 py-0.5 rounded-md">
                          v{s.version}
                        </span>
                      )}
                      {s.contentLanguage && s.contentLanguage.length > 0 && (
                        <span className="text-[9px] font-bold text-white/50 bg-[#222] border border-white/5 px-2 py-0.5 rounded-md uppercase">
                          {s.contentLanguage.join(" | ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Scraper controls */}
                <div className="flex items-center gap-3 shrink-0">
                  {s.hasSettings && (
                    <button
                      disabled={!s.repoEnabled}
                      onClick={() => setActiveSettingsScraper({ repoUrl: s.repoUrl, scraper: s })}
                      className={`p-1.5 rounded-lg transition-all ${!s.repoEnabled ? "text-[#444] cursor-not-allowed" : "text-[#888] hover:text-white hover:bg-white/5"}`}
                      title={s.repoEnabled ? "Settings" : "Plugin repository is disabled"}
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    disabled={!s.repoEnabled}
                    onClick={() => handleScraperToggle(s.repoUrl, s.id, s.enabled !== true)}
                    className={`w-11 h-6 rounded-full relative transition-colors ${s.enabled !== false ? "bg-white" : "bg-white/10"} ${!s.repoEnabled ? "cursor-not-allowed" : ""}`}
                    title={s.repoEnabled ? (s.enabled !== false ? "Disable Provider" : "Enable Provider") : "Plugin repository is disabled"}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${s.enabled !== false ? "right-1 bg-black" : "left-1 bg-[#888]"}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Scraper Settings Modal */}
      {activeSettingsScraper && (
        <ScraperSettingsModal
          repoUrl={activeSettingsScraper.repoUrl}
          scraper={activeSettingsScraper.scraper}
          onClose={() => setActiveSettingsScraper(null)}
        />
      )}
    </div>
  );
}
