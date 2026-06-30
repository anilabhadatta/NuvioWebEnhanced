"use client";

import React, { useEffect, useState } from "react";
import {
  hasTraktCredentials,
  isTraktConnected,
  loadTraktAuth,
  beginTraktAuth,
  disconnectTrakt,
  refreshTraktUserSettings,
} from "@/lib/trakt";
import { getTorboxApiKey, setTorboxApiKey, validateTorboxKey } from "@/lib/torbox";
import { getMdbListApiKey, setMdbListApiKey } from "@/lib/mdblist";
import { config } from "@/lib/config";

function KeyRow({
  title,
  description,
  placeholder,
  initialValue,
  onSave,
  onValidate,
}: {
  title: string;
  description: string;
  placeholder: string;
  initialValue: string;
  onSave: (v: string) => void;
  onValidate?: (v: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<"idle" | "saved" | "checking" | "valid" | "invalid">("idle");

  const save = async () => {
    onSave(value);
    if (onValidate && value.trim()) {
      setStatus("checking");
      const ok = await onValidate(value.trim());
      setStatus(ok ? "valid" : "invalid");
    } else {
      setStatus("saved");
    }
  };

  return (
    <div className="px-5 py-4">
      <p className="text-white font-semibold text-sm">{title}</p>
      <p className="text-[#888] text-xs mt-0.5 mb-3">{description}</p>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setStatus("idle"); }}
          placeholder={placeholder}
          className="flex-1 bg-[#222] border border-white/5 rounded-xl px-4 py-2.5 text-white placeholder-[#666] outline-none text-sm focus:border-white/20"
        />
        <button onClick={save} className="px-4 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-xl text-sm transition-colors">
          Save
        </button>
      </div>
      {status === "saved" && <p className="text-green-400 text-xs mt-2">Saved.</p>}
      {status === "checking" && <p className="text-[#888] text-xs mt-2">Validating…</p>}
      {status === "valid" && <p className="text-green-400 text-xs mt-2">Saved and validated.</p>}
      {status === "invalid" && <p className="text-red-400 text-xs mt-2">Saved, but the key could not be validated.</p>}
    </div>
  );
}

export default function IntegrationsSection() {
  const [traktConnected, setTraktConnected] = useState(false);
  const [traktUser, setTraktUser] = useState<string | null>(null);

  useEffect(() => {
    setTraktConnected(isTraktConnected());
    setTraktUser(loadTraktAuth()?.username ?? null);
    if (isTraktConnected()) {
      refreshTraktUserSettings().then((u) => u && setTraktUser(u));
    }
  }, []);

  const connectTrakt = () => {
    const url = beginTraktAuth();
    window.location.href = url;
  };

  const disconnect = async () => {
    await disconnectTrakt();
    setTraktConnected(false);
    setTraktUser(null);
  };

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold text-white mb-6">Integrations</h3>

      {/* Trakt */}
      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Trakt</p>
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 mb-8">
        {!hasTraktCredentials() ? (
          <p className="text-[#888] text-sm">
            Trakt credentials are not configured. Set <code className="text-white">NEXT_PUBLIC_TRAKT_CLIENT_ID</code> and{" "}
            <code className="text-white">NEXT_PUBLIC_TRAKT_CLIENT_SECRET</code> to enable Trakt.
          </p>
        ) : traktConnected ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-sm">Connected{traktUser ? ` as ${traktUser}` : ""}</p>
              <p className="text-[#888] text-xs mt-0.5">Scrobbling and sync are active.</p>
            </div>
            <button onClick={disconnect} className="px-4 py-2 bg-red-400/10 hover:bg-red-400/20 text-red-400 font-semibold rounded-xl text-sm transition-colors">
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-sm">Not connected</p>
              <p className="text-[#888] text-xs mt-0.5">Connect Trakt to sync your watch history and scrobble playback.</p>
            </div>
            <button onClick={connectTrakt} className="px-4 py-2 bg-white text-black font-bold rounded-xl text-sm transition-colors">
              Connect
            </button>
          </div>
        )}
      </div>

      {/* TorBox */}
      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">TorBox</p>
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden mb-8">
        <KeyRow
          title="TorBox API Key"
          description="Connect your TorBox account to browse your cloud library from the Library page."
          placeholder="TorBox API key"
          initialValue={getTorboxApiKey()}
          onSave={setTorboxApiKey}
          onValidate={validateTorboxKey}
        />
      </div>

      {/* TMDB + MDBList */}
      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Metadata</p>
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
        <div className="px-5 py-4">
          <p className="text-white font-semibold text-sm">TMDB API Key</p>
          <p className="text-[#888] text-xs mt-0.5">
            {config.tmdbApiKey
              ? "A TMDB key is configured at the environment level and used for metadata."
              : "No TMDB key configured. Set NEXT_PUBLIC_TMDB_API_KEY to enable metadata and plugin scrapers."}
          </p>
        </div>
        <KeyRow
          title="MDBList API Key"
          description="Adds external ratings (IMDb, TMDB, Rotten Tomatoes, Metacritic) to detail pages."
          placeholder="MDBList API key"
          initialValue={getMdbListApiKey()}
          onSave={setMdbListApiKey}
        />
      </div>
    </div>
  );
}
