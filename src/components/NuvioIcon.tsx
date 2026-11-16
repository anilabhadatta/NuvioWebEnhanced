import React from "react";

interface NuvioIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  withBackground?: boolean;
}

export default function NuvioIcon({
  size = 32,
  withBackground = false,
  className = "",
  ...props
}: NuvioIconProps) {
  if (withBackground) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width={size}
        height={size}
        className={className}
        {...props}
      >
        <defs>
          <radialGradient id="ni-bg" cx="50%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#1e182a" />
            <stop offset="50%" stopColor="#100d17" />
            <stop offset="100%" stopColor="#060608" />
          </radialGradient>
          <linearGradient id="ni-border" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#ff3366" stopOpacity="0.28" />
          </linearGradient>
          <radialGradient id="ni-glow" cx="50%" cy="50%" r="48%">
            <stop offset="0%" stopColor="#FF5722" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#E11D48" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ni-stemL" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF7A1A" />
            <stop offset="100%" stopColor="#FF1A66" />
          </linearGradient>
          <linearGradient id="ni-stemR" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="ni-ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFA033" />
            <stop offset="28%" stopColor="#FF2A6D" />
            <stop offset="68%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <filter id="ni-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="-4" dy="6" stdDeviation="9" floodColor="#000000" floodOpacity="0.75" />
          </filter>
          <linearGradient id="ni-sheen" x1="0%" y1="0%" x2="50%" y2="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#ni-bg)" />
        <rect x="20" y="20" width="472" height="472" rx="112" fill="none" stroke="url(#ni-border)" strokeWidth="2.5" />
        <circle cx="256" cy="256" r="160" fill="url(#ni-glow)" />

        <rect x="130" y="118" width="62" height="276" rx="31" fill="url(#ni-stemL)" />
        <rect x="320" y="118" width="62" height="276" rx="31" fill="url(#ni-stemR)" />
        <path
          d="M 137.82 169.58 A 31 31 0 1 1 184.18 128.42 L 374.18 342.42 A 31 31 0 1 1 327.82 383.58 Z"
          fill="url(#ni-ribbon)"
          filter="url(#ni-shadow)"
        />
        <path
          d="M 161 120 A 29 29 0 0 1 182 129 L 260 220 C 248 215 236 210 224 205 L 137 165 A 29 29 0 0 1 161 120 Z"
          fill="url(#ni-sheen)"
        />
      </svg>
    );
  }

  // Pure symbol without container box
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="120 108 272 296"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="ni-bare-stemL" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF7A1A" />
          <stop offset="100%" stopColor="#FF1A66" />
        </linearGradient>
        <linearGradient id="ni-bare-stemR" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="ni-bare-ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFA033" />
          <stop offset="28%" stopColor="#FF2A6D" />
          <stop offset="68%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <filter id="ni-bare-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="-3" dy="5" stdDeviation="6" floodColor="#000000" floodOpacity="0.5" />
        </filter>
        <linearGradient id="ni-bare-sheen" x1="0%" y1="0%" x2="50%" y2="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="130" y="118" width="62" height="276" rx="31" fill="url(#ni-bare-stemL)" />
      <rect x="320" y="118" width="62" height="276" rx="31" fill="url(#ni-bare-stemR)" />
      <path
        d="M 137.82 169.58 A 31 31 0 1 1 184.18 128.42 L 374.18 342.42 A 31 31 0 1 1 327.82 383.58 Z"
        fill="url(#ni-bare-ribbon)"
        filter="url(#ni-bare-shadow)"
      />
      <path
        d="M 161 120 A 29 29 0 0 1 182 129 L 260 220 C 248 215 236 210 224 205 L 137 165 A 29 29 0 0 1 161 120 Z"
        fill="url(#ni-bare-sheen)"
      />
    </svg>
  );
}
