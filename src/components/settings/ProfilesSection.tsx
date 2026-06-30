"use client";

import React, { useState } from "react";
import { useProfiles } from "@/lib/useProfiles";
import {
  PROFILE_COLORS,
  MAX_PROFILES,
  createProfile,
  updateProfile,
  deleteProfile,
} from "@/lib/profiles";

export default function ProfilesSection() {
  const { profiles, activeProfileId, loading, refresh, switchProfile } = useProfiles();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROFILE_COLORS[0]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const startAdd = () => {
    setAdding(true);
    setEditingIndex(null);
    setName("");
    setColor(PROFILE_COLORS[profiles.length % PROFILE_COLORS.length]);
  };

  const startEdit = (index: number) => {
    const p = profiles.find((x) => x.profile_index === index);
    if (!p) return;
    setEditingIndex(index);
    setAdding(false);
    setName(p.name);
    setColor(p.avatar_color_hex);
  };

  const cancel = () => {
    setAdding(false);
    setEditingIndex(null);
    setName("");
  };

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    if (adding) {
      await createProfile(profiles, name.trim(), color);
    } else if (editingIndex != null) {
      await updateProfile(profiles, editingIndex, name.trim(), color);
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
      <h3 className="text-lg font-bold text-white mb-2">Profiles</h3>
      <p className="text-xs text-[#888] mb-5">
        Switch between profiles to keep separate addons, plugins, collections, and watch history.
        Up to {MAX_PROFILES} profiles.
      </p>

      {loading ? (
        <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6 text-[#888] text-sm">Loading profiles…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {profiles.map((p) => {
            const active = p.profile_index === activeProfileId;
            const initial = (p.name?.trim()?.[0] || "?").toUpperCase();
            return (
              <div
                key={p.profile_index}
                className={`relative rounded-2xl p-4 border transition-colors cursor-pointer ${active ? "border-white/40 bg-white/10" : "border-white/5 bg-[#1a1a1a] hover:bg-white/5"}`}
                onClick={() => switchProfile(p.profile_index)}
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mb-3" style={{ background: p.avatar_color_hex }}>
                  {initial}
                </div>
                <p className="text-white font-semibold text-sm truncate">{p.name || `Profile ${p.profile_index}`}</p>
                <p className="text-[#888] text-xs mt-0.5">{active ? "Active" : "Tap to switch"}</p>
                <div className="absolute top-3 right-3 flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); startEdit(p.profile_index); }} className="text-[#888] hover:text-white" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                  {p.profile_index !== 1 && (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p.profile_index); }} className="text-red-400 hover:text-red-300" title="Delete">
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
            <button onClick={startAdd} className="rounded-2xl border border-dashed border-white/15 hover:border-white/30 bg-[#1a1a1a] hover:bg-white/5 p-4 flex flex-col items-center justify-center text-[#888] hover:text-white transition-colors min-h-[120px]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 mb-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-sm font-semibold">Add profile</span>
            </button>
          )}
        </div>
      )}

      {(adding || editingIndex != null) && (
        <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-3">{adding ? "New profile" : "Edit profile"}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Profile name"
            className="w-full bg-[#222] border border-white/5 rounded-xl px-4 py-3 text-white placeholder-[#666] outline-none text-sm focus:border-white/20 mb-4"
          />
          <div className="flex flex-wrap gap-2 mb-4">
            {PROFILE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-transform ${color === c ? "ring-2 ring-white scale-110" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={busy || !name.trim()} className="flex-1 bg-white text-black font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
            <button onClick={cancel} className="px-5 bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 rounded-xl text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
