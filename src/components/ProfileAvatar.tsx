"use client";

import React, { useState } from "react";
import { NuvioProfile } from "@/lib/profiles";
import { getAvatarPreset } from "@/lib/avatarPresets";
import { config } from "@/lib/config";

interface ProfileAvatarProps {
  profile?: NuvioProfile | null;
  name?: string;
  colorHex?: string;
  avatarUrl?: string | null;
  avatarId?: string | null;
  size?: number;
  className?: string;
  onClick?: () => void;
}

export default function ProfileAvatar({
  profile,
  name,
  colorHex,
  avatarUrl,
  avatarId,
  size = 36,
  className = "",
  onClick,
}: ProfileAvatarProps) {
  const [imgError, setImgError] = useState(false);

  // Compute resolved attributes
  const profileName = name || profile?.name || "Account";
  const initial = (profileName.trim()?.[0] || "A").toUpperCase();
  const bg = colorHex || profile?.avatar_color_hex || "linear-gradient(135deg, #fb923c, #ec4899)";
  const rawUrl = avatarUrl !== undefined ? avatarUrl : profile?.avatar_url;
  const rawId = avatarId !== undefined ? avatarId : profile?.avatar_id;

  // Check if rawId is a known built-in preset or infer from name if unset
  let preset = getAvatarPreset(rawId);
  if (!preset && !rawUrl && !rawId) {
    const lower = profileName.toLowerCase();
    if (lower.includes("tv")) preset = getAvatarPreset("tv");
    else if (lower.includes("anime")) preset = getAvatarPreset("anime");
    else if (lower.includes("film") || lower.includes("movie") || lower.includes("cinema")) preset = getAvatarPreset("film");
    else if (lower.includes("game") || lower.includes("play")) preset = getAvatarPreset("gamepad");
    else if (lower.includes("cat") || lower.includes("pet") || lower.includes("kid")) preset = getAvatarPreset("cat");
    else if (lower.includes("popcorn")) preset = getAvatarPreset("popcorn");
    else if (lower.includes("rocket")) preset = getAvatarPreset("rocket");
    else if (lower.includes("nuvio")) preset = getAvatarPreset("nuvio");
  }

  // Determine image source URL if any
  let resolvedImgUrl: string | null = null;
  if (rawUrl && rawUrl.trim()) {
    resolvedImgUrl = rawUrl.trim();
  } else if (rawId && !preset) {
    if (rawId.startsWith("http://") || rawId.startsWith("https://")) {
      resolvedImgUrl = rawId;
    } else if (config.avatarPublicBaseUrl) {
      resolvedImgUrl = `${config.avatarPublicBaseUrl}/${rawId}${rawId.includes(".") ? "" : ".png"}`;
    }
  }

  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: bg,
  };

  return (
    <div
      onClick={onClick}
      style={style}
      className={`rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden relative select-none shadow-md ${className}`}
    >
      {resolvedImgUrl && !imgError ? (
        <img
          src={resolvedImgUrl}
          alt={profileName}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
          onError={() => setImgError(true)}
        />
      ) : preset ? (
        <div className="flex items-center justify-center text-white drop-shadow-md">
          {preset.icon(Math.round(size * 0.55))}
        </div>
      ) : (
        <span
          className="font-bold leading-none"
          style={{ fontSize: Math.max(11, Math.round(size * 0.45)) }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
