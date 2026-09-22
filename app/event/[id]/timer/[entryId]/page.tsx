"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { OpenMicEvent, LineupEntry, computeBadge, formatDuration } from "@/lib/types";

// Minimal cross-browser typing for the handful of vendor-prefixed
// Fullscreen API members Safari/older browsers still use.
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

export default function TimerPage({
  params,
}: {
  params: { id: string; entryId: string };
}) {
  const { id: eventId, entryId } = params;
  const router = useRouter();

  const [event, setEvent] = useState<OpenMicEvent | null>(null);
  const [entry, setEntry] = useState<LineupEntry | null>(null);
  const [now, setNow] = useState(Date.now());
  const [stopping, setStopping] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  const load = useCallback(async () => {
    const [{ data: ev }, { data: en }] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
      supabase.from("lineup_entries").select("*").eq("id", entryId).maybeSingle(),
    ]);
    if (ev) setEvent(ev as OpenMicEvent);
    if (en) setEntry(en as LineupEntry);
  }, [eventId, entryId]);

  useEffect(() => {
    load();
  }, [load]);

  // If another device (e.g. one that scanned the transfer QR code) stops
  // this timer, reflect that here immediately and head back to the list.
  useEffect(() => {
    const channel = supabase
      .channel(`timer-${entryId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lineup_entries",
          filter: `id=eq.${entryId}`,
        },
        (payload) => {
          const updated = payload.new as LineupEntry;
          setEntry(updated);
          if (updated.status === "done") {
            router.replace(`/event/${eventId}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entryId, eventId, router]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  // Detect support once on mount, and keep isFullscreen in sync with reality
  // (covers the user hitting Esc, or exiting via a browser/OS gesture).
  useEffect(() => {
    const el = document.documentElement as FullscreenElement;
    setFullscreenSupported(
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

  const toggleFullscreen = useCallback(async () => {
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

  const elapsedSeconds = useMemo(() => {
    if (!entry?.started_at) return 0;
    return Math.floor((now - new Date(entry.started_at).getTime()) / 1000);
  }, [entry, now]);

  const overtimeEnabled = event?.overtime_note_enabled ?? true;
  const maxSeconds = event?.max_time_seconds ?? Infinity;
  const toleranceSeconds = event?.tolerance_seconds ?? 0;

  const badge = overtimeEnabled
    ? computeBadge(elapsedSeconds, maxSeconds, toleranceSeconds)
    : null;

  const isOvertime = badge === "overtime";

  const bgClass =
    badge === "on_time"
      ? "bg-status-ontime"
      : isOvertime
      ? "blink-overtime"
      : "bg-base";

  const stop = async () => {
    if (!entry || stopping) return;
    setStopping(true);
    const finalBadge = overtimeEnabled
      ? computeBadge(elapsedSeconds, maxSeconds, toleranceSeconds)
      : null;
    await supabase
      .from("lineup_entries")
      .update({
        status: "done",
        elapsed_seconds: elapsedSeconds,
        badge: finalBadge,
      })
      .eq("id", entry.id);
    router.push(`/event/${eventId}`);
  };

  if (!entry) {
    return <div className="min-h-screen bg-base" />;
  }

  return (
    <div
      className={`relative flex min-h-screen flex-col items-center justify-center ${
        isOvertime ? "" : "transition-colors duration-700"
      } ${bgClass}`}
    >
      {fullscreenSupported && (
        <button
          onClick={toggleFullscreen}
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
      )}
      <p className="text-lg text-white/80">{entry.name}</p>
      <div className="mt-4 tabular-nums text-8xl font-bold text-white md:text-[200px]">
        {formatDuration(elapsedSeconds)}
      </div>
      <button
        onClick={stop}
        disabled={stopping || entry.status === "done"}
        className="mt-8 flex items-center gap-2 rounded-lg bg-status-overtime px-6 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
      >
        <span className="h-3 w-3 bg-white" /> Stop
      </button>
    </div>
  );
}
