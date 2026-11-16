"use client";

import React, { useState, useEffect } from "react";
import {
  getDatabaseStats,
  exportLocalBackup,
  restoreLocalBackup,
  resetWebSettingsAndLocalDB,
} from "@/lib/db";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

export default function AdvancedSection() {
  const [stats, setStats] = useState({
    libraryCount: 0,
    historyCount: 0,
    addonsCount: 0,
    pluginsCount: 0,
    storageType: "IndexedDB (Dexie.js)",
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Two-step confirmation modal for resetting local database & web preferences
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetting, setResetting] = useState(false);

  useLockBodyScroll(showResetConfirm);

  const loadStats = async () => {
    try {
      const res = await getDatabaseStats();
      setStats(res);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setStatusMessage(null);
    try {
      const jsonStr = await exportLocalBackup();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `nuvio-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage({ type: "success", text: "Local backup exported successfully." });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err?.message || "Failed to export backup." });
    } finally {
      setExporting(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setStatusMessage(null);
    try {
      const text = await file.text();
      const res = await restoreLocalBackup(text);
      if (res.success) {
        setStatusMessage({ type: "success", text: res.message });
        await loadStats();
      } else {
        setStatusMessage({ type: "error", text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: "Failed to read backup file." });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleResetExecute = async () => {
    setResetting(true);
    try {
      await resetWebSettingsAndLocalDB();
      setShowResetConfirm(false);
      setResetStep(1);
      setStatusMessage({
        type: "success",
        text: "Web preferences and local database reset to defaults. Cloud-synced data will re-sync from your account.",
      });
      await loadStats();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: "Failed to reset local database." });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-white mb-2">Advanced</h2>
      <p className="text-[#888] text-sm mb-8">
        Manage local storage, offline database backups, and web client preferences.
      </p>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-2xl border text-sm flex items-center justify-between ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 shrink-0">
              {statusMessage.type === "success" ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              )}
            </svg>
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-white/60 hover:text-white text-xs font-semibold px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Data Management & Backup Container (Theme-matched to Nuvio glassmorphism) */}
      <div className="bg-[#18181b] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none rounded-full blur-3xl" />

        {/* Header with Database Icon */}
        <div className="flex items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-lg shadow-indigo-500/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Data Management & Backup</h3>
              <p className="text-[#888] text-xs sm:text-sm mt-0.5">
                100% offline, stored securely in your browser&apos;s IndexedDB
              </p>
            </div>
          </div>

          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 hidden sm:inline-block">
            Dexie.js Offline DB
          </span>
        </div>

        {/* Real-time Stats Grid */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 my-6">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#888] mb-1">Saved Items</p>
            <p className="text-xl sm:text-2xl font-black text-white">
              {loadingStats ? "..." : stats.libraryCount}
            </p>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90 mb-1">Watch History</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-400">
              {loadingStats ? "..." : stats.historyCount}
            </p>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90 mb-1">Addons / Plugins</p>
            <p className="text-xl sm:text-2xl font-black text-amber-400">
              {loadingStats ? "..." : stats.addonsCount + stats.pluginsCount}
            </p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="space-y-3.5">
          {/* Export Card */}
          <div className="bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
            <div>
              <p className="text-white font-semibold text-sm">Export Local Backup</p>
              <p className="text-[#888] text-xs mt-0.5 max-w-xl">
                Download a complete JSON snapshot of all your local library items, watch history records, addons, and web player preferences.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer shrink-0 disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>{exporting ? "Exporting..." : "Export"}</span>
            </button>
          </div>

          {/* Import / Restore Card */}
          <div className="bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
            <div>
              <p className="text-white font-semibold text-sm">Restore from Backup</p>
              <p className="text-[#888] text-xs mt-0.5 max-w-xl">
                Merge or restore records from a previously exported JSON backup file into your offline IndexedDB database.
              </p>
            </div>
            <label className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span>{importing ? "Importing..." : "Import"}</span>
              <input type="file" accept=".json" onChange={handleFileImport} className="sr-only" />
            </label>
          </div>

          {/* Reset Database Card with Two-Step Trigger */}
          <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm">Reset Local Database</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wide">
                  Web Client Only
                </span>
              </div>
              <p className="text-[#777] text-xs mt-0.5">
                Clear all local progress records and reset web settings to defaults. Account-based cloud profiles remain safe in Supabase.
              </p>
            </div>
            <button
              onClick={() => {
                setResetStep(1);
                setShowResetConfirm(true);
              }}
              className="text-red-400 hover:text-red-300 font-semibold text-xs px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer self-start sm:self-auto shrink-0"
            >
              Reset Database
            </button>
          </div>
        </div>

        {/* Footer info badge */}
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-[#666]">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-2.48 7.425A9 9 0 1121 12a8.966 8.966 0 01-2.48 6.175z" />
            </svg>
            <span>Storage engine: IndexedDB (Dexie.js) + Supabase Cloud Sync</span>
          </div>
          <span>Zero cloud tracking</span>
        </div>
      </div>

      {/* Two-Step Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overscroll-contain animate-fade-in"
          style={{ overscrollBehavior: "contain" }}
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="bg-[#18181b] border border-white/15 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overscroll-contain"
            style={{ overscrollBehavior: "contain" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning Icon Badge */}
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 shadow-lg shadow-red-500/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            {resetStep === 1 ? (
              <>
                <h3 className="text-lg font-bold text-white mb-2">Reset Web Settings & Local Cache?</h3>
                <p className="text-[#aaa] text-xs leading-relaxed mb-4">
                  This action will clear your offline IndexedDB watch history cache and reset web-only playback preferences back to defaults.
                </p>
                <div className="bg-white/5 border border-white/5 rounded-xl p-3 mb-6 text-xs text-[#888]">
                  <p className="text-white font-semibold mb-1">What stays safe?</p>
                  <p>
                    Your Supabase account profiles, online library, and mobile sync remain safely stored in the cloud and will automatically re-sync when signed in.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#aaa] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setResetStep(2)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20 cursor-pointer"
                  >
                    Continue to Confirmation
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-red-400 mb-2">Step 2: Are you absolutely sure?</h3>
                <p className="text-[#ccc] text-xs leading-relaxed mb-6">
                  Clicking confirm will wipe local IndexedDB records and re-initialize the System Default external player setting.
                </p>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setResetStep(1);
                      setShowResetConfirm(false);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#aaa] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetExecute}
                    disabled={resetting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 transition-all shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-60"
                  >
                    {resetting ? (
                      <>
                        <svg className="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        <span>Resetting...</span>
                      </>
                    ) : (
                      <span>Yes, Reset Local Database</span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
