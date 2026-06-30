"use client";

import React, { useEffect, useState } from "react";
import {
  Collection,
  pullCollections,
  pushCollections,
  importCollectionsJson,
  exportCollectionsJson,
  validateCollectionsJson,
} from "@/lib/collections";

export default function CollectionsSection() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [jsonText, setJsonText] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pullCollections().then((c) => {
      setCollections(c);
      if (c.length > 0) setJsonText(exportCollectionsJson(c));
    });
  }, []);

  const handleValidate = () => {
    const v = validateCollectionsJson(jsonText);
    if (v.valid) {
      setMessage({ kind: "ok", text: `Valid: ${v.collectionCount} collection(s), ${v.folderCount} folder(s).` });
    } else {
      setMessage({ kind: "error", text: v.error || "Invalid JSON." });
    }
  };

  const handleImport = async () => {
    const res = importCollectionsJson(jsonText);
    if (!res.ok) {
      setMessage({ kind: "error", text: res.error || "Import failed." });
      return;
    }
    setBusy(true);
    setCollections(res.collections!);
    await pushCollections(res.collections!);
    setBusy(false);
    setMessage({ kind: "ok", text: `Imported and synced ${res.collections!.length} collection(s).` });
  };

  const handleClear = async () => {
    if (!confirm("Remove all collections?")) return;
    setBusy(true);
    setCollections([]);
    setJsonText("");
    await pushCollections([]);
    setBusy(false);
    setMessage({ kind: "ok", text: "Collections cleared." });
  };

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold text-white mb-2">Collections</h3>
      <p className="text-xs text-[#888] mb-5">
        Collections are custom home layouts made of folders backed by catalog, TMDB, or Trakt sources.
        Build a collection in the{" "}
        <a href="https://imkaptain.github.io/Kaptain-Collection/" target="_blank" rel="noreferrer" className="text-white underline">
          Kaptain Collection editor
        </a>
        , then paste the exported JSON below. Imported collections sync across your devices.
      </p>

      {collections.length > 0 && (
        <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 mb-6">
          <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Active Collections</p>
          <div className="flex flex-wrap gap-2">
            {collections.map((c) => (
              <span key={c.id} className="text-sm text-white bg-white/10 px-3 py-1.5 rounded-full">
                {c.title} <span className="text-[#888]">({c.folders?.length || 0})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Collections JSON</p>
      <textarea
        value={jsonText}
        onChange={(e) => { setJsonText(e.target.value); setMessage(null); }}
        placeholder='[{ "id": "...", "title": "...", "folders": [] }]'
        rows={12}
        className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 text-white placeholder-[#555] outline-none text-xs font-mono focus:border-white/20 resize-y"
      />

      {message && (
        <p className={`text-xs mt-2 ${message.kind === "ok" ? "text-green-400" : "text-red-400"}`}>{message.text}</p>
      )}

      <div className="flex gap-3 mt-4">
        <button onClick={handleValidate} className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-sm transition-colors">
          Validate
        </button>
        <button onClick={handleImport} disabled={busy || !jsonText.trim()} className="px-4 py-2.5 bg-white text-black font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
          {busy ? "Importing…" : "Import & Sync"}
        </button>
        {collections.length > 0 && (
          <button onClick={handleClear} disabled={busy} className="px-4 py-2.5 bg-red-400/10 hover:bg-red-400/20 text-red-400 font-semibold rounded-xl text-sm transition-colors ml-auto disabled:opacity-50">
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
