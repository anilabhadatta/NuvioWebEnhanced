"use client";

import React, { useEffect } from "react";

interface ToastProps {
  message: string;
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className="fixed top-6 left-1/2 -translate-x-1/2 bg-black/85 border border-white/10 px-4 py-2.5 rounded-full shadow-2xl z-70 flex items-center gap-2.5 animate-slide-down pointer-events-none"
      style={{
        backdropFilter: "blur(12px)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5), 0 0 10px rgba(251, 146, 60, 0.05)",
      }}
    >
      <style>{`
        @keyframes toastSlideDown {
          from {
            transform: translate(-50%, -16px);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
        .animate-slide-down {
          animation: toastSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      
      {/* Premium pulsing gradient dot indicator */}
      <span className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 animate-pulse shrink-0" />
      
      <span className="text-white text-xs font-semibold tracking-wide whitespace-nowrap">
        {message}
      </span>
    </div>
  );
}
