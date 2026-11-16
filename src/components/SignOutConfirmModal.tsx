"use client";

import React, { useEffect } from "react";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

interface SignOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  userDisplayName?: string | null;
  signingOut?: boolean;
}

export default function SignOutConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  userDisplayName,
  signingOut = false,
}: SignOutConfirmModalProps) {
  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !signingOut) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, signingOut, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overscroll-contain"
      style={{ overscrollBehavior: "contain" }}
      onClick={() => {
        if (!signingOut) onClose();
      }}
    >
      <div
        className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative overscroll-contain animate-in fade-in zoom-in-95 duration-150"
        style={{ overscrollBehavior: "contain" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sign Out Warning Icon */}
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
            />
          </svg>
        </div>

        {/* Heading & Information */}
        <h3 className="text-white text-lg font-bold">Sign Out?</h3>
        <p className="text-[#888] text-xs sm:text-sm mt-1.5 leading-relaxed">
          Are you sure you want to sign out? Your cloud library, addons, and profile settings will remain safely synced to your account.
        </p>

        {userDisplayName && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] text-[#aaa]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Signed in as <strong className="text-white">{userDisplayName}</strong></span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={signingOut}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm()}
            disabled={signingOut}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-red-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {signingOut ? (
              <>
                <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>Signing out...</span>
              </>
            ) : (
              "Sign Out"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
