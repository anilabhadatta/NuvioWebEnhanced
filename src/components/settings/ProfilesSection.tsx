"use client";

import React, { useState } from "react";
import { useProfiles } from "@/lib/useProfiles";
import {
  PROFILE_COLORS,
  MAX_PROFILES,
  createProfile,
  updateProfile,
  deleteProfile,
  NuvioProfile,
} from "@/lib/profiles";
import { useAuth } from "@/lib/useAuth";
import ProfileAvatar from "@/components/ProfileAvatar";
import { AVATAR_PRESETS } from "@/lib/avatarPresets";

export default function ProfilesSection() {
  const { profiles, activeProfileId, loading, refresh, switchProfile } = useProfiles();
  const { isAuthenticated } = useAuth();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROFILE_COLORS[0]);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const startAdd = () => {
    setAdding(true);
    setEditingIndex(null);
    setName("");
    setColor(PROFILE_COLORS[profiles.length % PROFILE_COLORS.length]);
    setAvatarId(null);
    setAvatarUrl("");
  };

  const startEdit = (index: number) => {
    const p = profiles.find((x) => x.profile_index === index);
    if (!p) return;
    setEditingIndex(index);
    setAdding(false);
    setName(p.name);
    setColor(p.avatar_color_hex);
    setAvatarId(p.avatar_id || null);
    setAvatarUrl(p.avatar_url || "");
  };

  const cancel = () => {
    setAdding(false);
    setEditingIndex(null);
    setName("");
    setAvatarId(null);
    setAvatarUrl("");
  };

  const handleManualSync = async () => {
    setSyncing(true);
    await refresh();
    setTimeout(() => setSyncing(false), 800);
  };

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const trimmedUrl = avatarUrl.trim() ? avatarUrl.trim() : null;
    const finalAvatarId = avatarId || (name.toLowerCase().includes("tv") ? "tv" : null);

    if (adding) {
      await createProfile(profiles, name.trim(), color, finalAvatarId, trimmedUrl);
    } else if (editingIndex != null) {
      await updateProfile(profiles, editingIndex, name.trim(), color, finalAvatarId, trimmedUrl);
    }
    await refresh();
    setBusy(false);
    cancel();
  };

  const handleDelete = async (index: number) => {
    if (index === 1) return; // never delete the primary profile
    if (!confirm("Delete this profile and all its data?")) return;
    setBusy(true);
    await deleteProfile(index);
    await refresh();
    setBusy(false);
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-bold text-white">Profiles</h3>
          <p className="text-xs text-[#888]">
            Switch between profiles to keep separate addons, plugins, collections, and watch history. Up to {MAX_PROFILES} profiles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              isAuthenticated
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-white/10 text-[#888] border-white/10"
            }`}
          >
            {isAuthenticated ? "Cloud Sync" : "Local Mode"}
          </span>
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Refresh and sync profiles from cloud"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>{syncing ? "Syncing…" : "Sync"}</span>
          </button>
        </div>
      </div>

      {loading && profiles.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6 text-[#888] text-sm flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span>Loading profiles…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 my-6">
          {profiles.map((p) => {
            const active = p.profile_index === activeProfileId;
            return (
              <div
                key={p.profile_index}
                className={`relative rounded-2xl p-4 border transition-all cursor-pointer ${
                  active
                    ? "border-white/40 bg-white/10 shadow-lg"
                    : "border-white/5 bg-[#1a1a1a] hover:bg-white/5"
                }`}
                onClick={() => switchProfile(p.profile_index)}
              >
                <div className="mb-3">
                  <ProfileAvatar
                    profile={p}
                    size={48}
                    className="shadow-md"
                  />
                </div>
                <p className="text-white font-semibold text-sm truncate">{p.name || `Profile ${p.profile_index}`}</p>
                <p className="text-[#888] text-xs mt-0.5">{active ? "Active" : "Tap to switch"}</p>
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(p.profile_index);
                    }}
                    className="text-[#888] hover:text-white transition-colors p-1"
                    title="Edit profile"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                  {p.profile_index !== 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.profile_index);
                      }}
                      className="text-red-400 hover:text-red-300 transition-colors p-1"
                      title="Delete profile"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {profiles.length < MAX_PROFILES && !adding && (
            <button
              onClick={startAdd}
              className="rounded-2xl border border-dashed border-white/15 hover:border-white/30 bg-[#1a1a1a] hover:bg-white/5 p-4 flex flex-col items-center justify-center text-[#888] hover:text-white transition-all min-h-[120px] cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 mb-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-sm font-semibold">Add profile</span>
            </button>
          )}
        </div>
      )}

      {/* Edit / Add Profile Form */}
      {(adding || editingIndex != null) && (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl mb-8">
          <div className="flex items-center gap-4 mb-5 pb-4 border-b border-white/5">
            <ProfileAvatar
              name={name || "Profile"}
              colorHex={color}
              avatarId={avatarId}
              avatarUrl={avatarUrl}
              size={56}
              className="ring-2 ring-white/20"
            />
            <div>
              <p className="text-white font-bold text-base">{adding ? "Create New Profile" : "Edit Profile"}</p>
              <p className="text-xs text-[#888]">Customize your profile name, color, and icon.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5">
                Profile Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. BiraJ, Hall TV, Kids"
                className="w-full bg-[#222] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#666] outline-none text-sm focus:border-white/30"
              />
            </div>

            {/* Profile Avatar Icon Picker */}
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">
                Nuvio Profile Icon
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-2">
                {/* Initial text fallback option */}
                <button
                  type="button"
                  onClick={() => setAvatarId(null)}
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                    !avatarId
                      ? "bg-white/20 border-white text-white shadow-md"
                      : "bg-white/5 border-white/5 text-[#888] hover:bg-white/10 hover:text-white"
                  }`}
                  title="Letter Initial"
                >
                  <span className="font-bold text-sm">{(name.trim()?.[0] || "A").toUpperCase()}</span>
                </button>

                {AVATAR_PRESETS.map((p) => {
                  const isSelected = avatarId?.toLowerCase() === p.id.toLowerCase();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAvatarId(p.id)}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? "bg-white/20 border-white text-white shadow-md scale-105"
                          : "bg-white/5 border-white/5 text-[#888] hover:bg-white/10 hover:text-white"
                      }`}
                      title={p.name}
                    >
                      {p.icon(20)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Avatar Image URL */}
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5">
                Custom Image URL (Optional)
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png (or Gravatar)"
                className="w-full bg-[#222] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-[#666] outline-none text-sm focus:border-white/30"
              />
            </div>

            {/* Color Palette */}
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">
                Accent Background Color
              </label>
              <div className="flex flex-wrap gap-2">
                {PROFILE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-transform cursor-pointer ${
                      color === c ? "ring-2 ring-white scale-110 shadow-lg" : "hover:scale-105"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
            <button
              onClick={save}
              disabled={busy || !name.trim()}
              className="flex-1 bg-white hover:bg-gray-200 text-black font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-50 cursor-pointer shadow-md"
            >
              {busy ? "Saving…" : "Save Profile"}
            </button>
            <button
              onClick={cancel}
              className="px-6 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
