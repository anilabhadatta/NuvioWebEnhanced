import React from "react";
import NuvioIcon from "@/components/NuvioIcon";

export interface AvatarPreset {
  id: string;
  name: string;
  icon: (size?: number) => React.ReactNode;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "nuvio",
    name: "Nuvio",
    icon: (size = 24) => <NuvioIcon size={size} />,
  },
  {
    id: "tv",
    name: "Hall TV",
    icon: (size = 24) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
        <polyline points="17 2 12 7 7 2" />
      </svg>
    ),
  },
  {
    id: "film",
    name: "Cinema",
    icon: (size = 24) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="17" x2="22" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
      </svg>
    ),
  },
  {
    id: "anime",
    name: "Anime / Star",
    icon: (size = 24) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    id: "popcorn",
    name: "Popcorn",
    icon: (size = 24) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a3 3 0 00-3 3c0 .3.05.6.14.88A3.5 3.5 0 007 9H5a2 2 0 00-2 2v2l2 9h14l2-9v-2a2 2 0 00-2-2h-2a3.5 3.5 0 00-2.14-3.12A3 3 0 0012 2z" />
        <line x1="9" y1="13" x2="9" y2="22" />
        <line x1="15" y1="13" x2="15" y2="22" />
      </svg>
    ),
  },
  {
    id: "gamepad",
    name: "Gaming",
    icon: (size = 24) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="6" y1="12" x2="10" y2="12" />
        <line x1="8" y1="10" x2="8" y2="14" />
        <line x1="15" y1="13" x2="15.01" y2="13" />
        <line x1="18" y1="11" x2="18.01" y2="11" />
        <rect x="2" y="6" width="20" height="12" rx="2" />
      </svg>
    ),
  },
  {
    id: "rocket",
    name: "Rocket",
    icon: (size = 24) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m-15 15c0-3.5 1.5-6 4.5-9 1.5-1.5 3-2.5 4.5-3.5l6-2.5-2.5 6c-1 1.5-2 3-3.5 4.5-3 3-5.5 4.5-9 4.5z" />
      </svg>
    ),
  },
  {
    id: "sparkles",
    name: "Magic",
    icon: (size = 24) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    id: "cat",
    name: "Pet / Cat",
    icon: (size = 24) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4.97 0-9 3.58-9 8 0 2.27 1.09 4.33 2.85 5.77L5 21l4.47-1.49c.8.32 1.65.49 2.53.49 4.97 0 9-3.58 9-8s-4.03-8-9-8z" />
        <circle cx="9" cy="11" r="1.5" fill="currentColor" />
        <circle cx="15" cy="11" r="1.5" fill="currentColor" />
        <path strokeLinecap="round" d="M3 6L6 9M21 6l-3 3" />
      </svg>
    ),
  },
  {
    id: "crown",
    name: "VIP / Crown",
    icon: (size = 24) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5m14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
      </svg>
    ),
  },
  {
    id: "user",
    name: "User Profile",
    icon: (size = 24) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

export function getAvatarPreset(id?: string | null): AvatarPreset | undefined {
  if (!id) return undefined;
  return AVATAR_PRESETS.find((p) => p.id.toLowerCase() === id.toLowerCase());
}
