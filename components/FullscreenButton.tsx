"use client";

import { useCallback, useEffect, useState } from "react";

// Minimal cross-browser typing for the handful of vendor-prefixed
// Fullscreen API members Safari/older browsers still use.
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(false);

  // Detect support once on mount, and keep isFullscreen in sync with reality
  // (covers the user hitting Esc, or exiting via a browser/OS gesture).
  useEffect(() => {
    const el = document.documentElement as FullscreenElement;
    setSupported(
      typeof el.requestFullscreen === "function" ||
        typeof el.webkitRequestFullscreen === "function"
    );

    const syncState = () => {
      const doc = document as FullscreenDocument;
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    syncState();

    document.addEventListener("fullscreenchange", syncState);
    document.addEventListener("webkitfullscreenchange", syncState);
    return () => {
      document.removeEventListener("fullscreenchange", syncState);
      document.removeEventListener("webkitfullscreenchange", syncState);
    };
  }, []);

  const toggle = useCallback(async () => {
    const doc = document as FullscreenDocument;
    const el = document.documentElement as FullscreenElement;
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      } else {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      }
    } catch {
      // Some browsers reject this outside a direct user gesture or if the
      // feature is disabled (e.g. an iframe without allowfullscreen) —
      // nothing useful to do beyond leaving the UI as-is.
    }
  }, []);

  if (!supported) return null;

  return (
    <button
      onClick={toggle}
      aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
      className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
    >
      {isFullscreen ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M9 3v4a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-4a2 2 0 0 1-2-2V3" />
          <path d="M3 16h4a2 2 0 0 1 2 2v4" />
          <path d="M16 21v-4a2 2 0 0 1 2-2h4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M3 8V5a2 2 0 0 1 2-2h3" />
          <path d="M16 3h3a2 2 0 0 1 2 2v3" />
          <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
          <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
        </svg>
      )}
    </button>
  );
}
