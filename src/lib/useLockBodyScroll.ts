"use client";

import { useEffect } from "react";

/**
 * Global reference count for body scroll locks.
 * Supports stacked/nested modals (e.g. MovieModal -> StreamPickerModal -> ExternalPlayerModal).
 * Scrolling is only re-enabled when all modals have unmounted or unlocked.
 */
let lockCount = 0;
let originalBodyOverflow = "";
let originalDocOverflow = "";
let originalPaddingRight = "";
let originalBodyOverscroll = "";
let originalDocOverscroll = "";

export function useLockBodyScroll(locked: boolean = true) {
  useEffect(() => {
    if (!locked || typeof window === "undefined") return;

    if (lockCount === 0) {
      originalBodyOverflow = document.body.style.overflow || "";
      originalDocOverflow = document.documentElement.style.overflow || "";
      originalPaddingRight = document.body.style.paddingRight || "";
      originalBodyOverscroll = document.body.style.overscrollBehavior || "";
      originalDocOverscroll = document.documentElement.style.overscrollBehavior || "";

      // Compensate for scrollbar width to prevent page shift on desktop browsers
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }

      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
      document.body.style.overscrollBehavior = "none";

      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
    }

    lockCount++;

    return () => {
      lockCount--;
      if (lockCount <= 0) {
        lockCount = 0;
        document.documentElement.style.overflow = originalDocOverflow;
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.paddingRight = originalPaddingRight;
        document.documentElement.style.overscrollBehavior = originalDocOverscroll;
        document.body.style.overscrollBehavior = originalBodyOverscroll;

        document.documentElement.classList.remove("modal-open");
        document.body.classList.remove("modal-open");
      }
    };
  }, [locked]);
}

export default useLockBodyScroll;
