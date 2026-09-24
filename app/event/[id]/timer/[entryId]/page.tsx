"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { OpenMicEvent, LineupEntry, computeEventBadge, formatDuration } from "@/lib/types";
import TimerDisplay from "@/components/TimerDisplay";
import FullscreenButton from "@/components/FullscreenButton";

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

  const elapsedSeconds = useMemo(() => {
    if (!entry?.started_at) return 0;
    return Math.floor((now - new Date(entry.started_at).getTime()) / 1000);
  }, [entry, now]);

  const overtimeEnabled = event?.overtime_note_enabled ?? true;

  // Works for both timing systems: Time Tolerance (Maximum Time ± tolerance)
  // and Green Light & Red Light.
  const badge =
    event && overtimeEnabled ? computeEventBadge(elapsedSeconds, event) : null;

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
    const finalBadge =
      event && overtimeEnabled ? computeEventBadge(elapsedSeconds, event) : null;
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
      className={`relative flex min-h-screen flex-col items-center justify-center overflow-hidden ${
        isOvertime ? "" : "transition-colors duration-700"
      } ${bgClass}`}
    >
      <FullscreenButton />
      <p className="text-lg text-white/80">{entry.name}</p>
      <div className="mt-4">
        <TimerDisplay text={formatDuration(elapsedSeconds)} />
      </div>
      <div className="mt-8 flex items-center gap-3">
        {/* Minimize: back to the list without stopping. The timer keeps
            running (it's based on started_at in the database), and the list
            shows a "Back to Timer" bar to return here. */}
        <button
          onClick={() => router.push(`/event/${eventId}`)}
          disabled={stopping}
          className="flex items-center gap-2 rounded-lg border border-white px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Minimize
        </button>
        <button
          onClick={stop}
          disabled={stopping || entry.status === "done"}
          className="flex items-center gap-2 rounded-lg bg-status-overtime px-6 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          <span className="h-3 w-3 bg-white" /> Stop
        </button>
      </div>
    </div>
  );
}
