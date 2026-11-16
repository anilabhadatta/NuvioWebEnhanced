"use client";

import React, { useState, useEffect } from "react";
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
  const [mounted, setMounted] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute resolved attributes dynamically from Nuvio account / profile
  const profileName = name || profile?.name || "Account";
  const initial = (profileName.trim()?.[0] || "A").toUpperCase();
  const bg = colorHex || profile?.avatar_color_hex || "linear-gradient(135deg, #fb923c, #ec4899)";
  const rawUrl = avatarUrl !== undefined ? avatarUrl : profile?.avatar_url;
  const rawId = avatarId !== undefined ? avatarId : profile?.avatar_id;

  const preset = getAvatarPreset(rawId);

  // Determine dynamic image source URL directly from account / profile
  let resolvedImgUrl: string | null = null;
  if (rawUrl && typeof rawUrl === "string" && rawUrl.trim()) {
    resolvedImgUrl = rawUrl.trim();
  } else if (rawId && typeof rawId === "string" && !preset) {
    if (rawId.startsWith("http://") || rawId.startsWith("https://")) {
      resolvedImgUrl = rawId.trim();
    } else {
      const baseUrl = config.avatarPublicBaseUrl || "https://api.nuvio.tv/storage/v1/object/public/avatars";
      resolvedImgUrl = `${baseUrl}/${rawId}${rawId.includes(".") ? "" : ".png"}`;
    }
  }

  const style: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    background: bg,
  };

  return (
    <div
      onClick={onClick}
      style={style}
      suppressHydrationWarning
      className={`rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden relative select-none shadow-md ${className}`}
    >
      {mounted && resolvedImgUrl && !imgError ? (
        <img
          src={resolvedImgUrl}
          alt={profileName}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : preset ? (
        <div className="flex items-center justify-center text-white drop-shadow-md">
          {preset.icon(Math.round(size * 0.55))}
        </div>
      ) : (
        <span
          suppressHydrationWarning
          className="font-bold leading-none"
          style={{ fontSize: `${Math.max(11, Math.round(size * 0.45))}px` }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
