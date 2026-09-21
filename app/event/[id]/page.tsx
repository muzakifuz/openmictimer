"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  OpenMicEvent,
  LineupEntry,
  formatDuration,
} from "@/lib/types";
import BadgePill from "@/components/BadgePill";
import ConfirmModal from "@/components/ConfirmModal";
import TransferModal from "@/components/TransferModal";
import Stepper from "@/components/Stepper";

export default function EventPage({ params }: { params: { id: string } }) {
  const eventId = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<OpenMicEvent | null>(null);
  const [editingRules, setEditingRules] = useState(true);

  const [maxMinutes, setMaxMinutes] = useState(5);
  const [minMinutes, setMinMinutes] = useState(5);
  const [name, setName] = useState("");
  const [overtimeEnabled, setOvertimeEnabled] = useState(true);
  const [savingRules, setSavingRules] = useState(false);

  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [newLineupName, setNewLineupName] = useState("");
  const [addingLineup, setAddingLineup] = useState(false);
  const [lineupError, setLineupError] = useState<string | null>(null);

  const [showTransfer, setShowTransfer] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const runningEntry = useMemo(
    () => lineup.find((e) => e.status === "running") ?? null,
    [lineup]
  );

  const timeError =
    minMinutes > maxMinutes
      ? "Minimum time can't be more than maximum time."
      : null;

  const loadEvent = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();

    if (data) {
      setEvent(data as OpenMicEvent);
      setMaxMinutes(Math.round(data.max_time_seconds / 60));
      setMinMinutes(Math.round(data.min_time_seconds / 60));
      setName(data.name);
      setOvertimeEnabled(data.overtime_note_enabled);
      setEditingRules(false);
    }
    setLoading(false);
  }, [eventId]);

  const loadLineup = useCallback(async () => {
    const { data } = await supabase
      .from("lineup_entries")
      .select("*")
      .eq("event_id", eventId)
      .order("position", { ascending: true });
    setLineup((data as LineupEntry[]) ?? []);
  }, [eventId]);

  useEffect(() => {
    loadEvent();
    loadLineup();
  }, [loadEvent, loadLineup]);

  // Realtime sync: keeps this screen (and any device that scanned the
  // "Transfer the Timer" QR code) up to date as entries start/stop.
  useEffect(() => {
    const channel = supabase
      .channel(`event-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lineup_entries",
          filter: `event_id=eq.${eventId}`,
        },
        () => loadLineup()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        () => loadEvent()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, loadLineup, loadEvent]);

  const saveRules = async () => {
    if (!name.trim() || timeError) return;
    setSavingRules(true);
    const payload = {
      id: eventId,
      name: name.trim(),
      max_time_seconds: maxMinutes * 60,
      min_time_seconds: minMinutes * 60,
      overtime_note_enabled: overtimeEnabled,
    };
    const { data, error } = await supabase
      .from("events")
      .upsert(payload)
      .select()
      .single();
    setSavingRules(false);
    if (!error && data) {
      setEvent(data as OpenMicEvent);
      setEditingRules(false);
    }
  };

  const addToLineup = async () => {
    if (!newLineupName.trim()) {
      setLineupError("Please enter a name.");
      return;
    }
    if (!event) {
      setLineupError("Save rules before adding the lineup.");
      return;
    }
    setAddingLineup(true);
    setLineupError(null);
    const { error } = await supabase.from("lineup_entries").insert({
      event_id: eventId,
      name: newLineupName.trim(),
      position: lineup.length + 1,
      status: "pending",
    });
    setAddingLineup(false);
    if (!error) {
      setNewLineupName("");
      loadLineup();
    }
  };

  const startCount = async (entry: LineupEntry) => {
    if (runningEntry) {
      alert(
        `${runningEntry.name} is still on the clock. Stop that timer before starting another.`
      );
      return;
    }
    const { error } = await supabase
      .from("lineup_entries")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", entry.id);
    if (!error) {
      router.push(`/event/${eventId}/timer/${entry.id}`);
    }
  };

  const downloadList = () => {
    const rows = [["Name", "Status", "Time", "Badge"]];
    lineup.forEach((e) => {
      rows.push([
        e.name,
        e.status,
        e.elapsed_seconds != null ? formatDuration(e.elapsed_seconds) : "",
        e.badge ?? "",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event?.name || "openmic"}-lineup.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const transferUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return runningEntry
      ? `${window.location.origin}/event/${eventId}/timer/${runningEntry.id}`
      : `${window.location.origin}/event/${eventId}`;
  }, [eventId, runningEntry]);

  const confirmReset = async () => {
    setShowResetConfirm(false);
    await supabase.from("events").delete().eq("id", eventId); // cascades lineup_entries
    const newId = crypto.randomUUID();
    router.replace(`/event/${newId}`);
  };

  if (loading) {
    return <div className="min-h-screen bg-base" />;
  }

  const rulesLocked = !!event && !editingRules;

  return (
    <div className="min-h-screen bg-base px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-6 w-6 rounded-full"
              style={{
                background:
                  "conic-gradient(from 90deg, #B23A3A, #3D5CDB, #22A559, #B23A3A)",
              }}
            />
            <span className="font-semibold">Openmic Timer</span>
          </div>
          {event && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-xs text-white/40 hover:text-white/70"
            >
              Start a new event
            </button>
          )}
        </header>

        <h1 className="mt-6 text-3xl font-bold">Keep the laughs on time.</h1>
        <p className="mt-2 text-sm text-white/60">
          Manage your lineup, track laughs, and stay on top of every comic&apos;s set.
        </p>

        {/* Rules card */}
        <section className="mt-8">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold">Maximum Time (Min)</label>
              <div className="mt-2">
                <Stepper
                  value={maxMinutes}
                  onChange={setMaxMinutes}
                  disabled={rulesLocked}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">Minimum Time (Min)</label>
              <div className="mt-2">
                <Stepper
                  value={minMinutes}
                  onChange={setMinMinutes}
                  disabled={rulesLocked}
                />
              </div>
            </div>
          </div>
          {timeError && (
            <p className="mt-2 text-xs text-status-overtime">{timeError}</p>
          )}

          <div className="mt-4">
            <label className="text-sm font-semibold">Openmic&apos;s Name</label>
            <input
              disabled={rulesLocked}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example: Openmic StandupIndo Jakbar"
              className="mt-2 h-[50px] w-full rounded-lg border border-base-border bg-base-card px-3 placeholder:text-white/30 disabled:opacity-50"
            />
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold">Overtime Note</label>
            <label className="mt-2 flex w-fit items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                disabled={rulesLocked}
                checked={overtimeEnabled}
                onChange={(e) => setOvertimeEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-base-border accent-brand-blue"
              />
              Yes
            </label>
          </div>

          {rulesLocked ? (
            <button
              onClick={() => setEditingRules(true)}
              className="mt-6 h-[50px] w-full rounded-lg border border-base-border bg-base-card text-sm font-semibold text-white/50 hover:text-white/80"
            >
              Rules saved &middot; tap to edit
            </button>
          ) : (
            <button
              onClick={saveRules}
              disabled={!name.trim() || !!timeError || savingRules}
              className="mt-6 h-[50px] w-full rounded-lg bg-gradient-to-r from-brand-red to-brand-maroon text-sm font-semibold text-white disabled:opacity-40"
            >
              {savingRules ? "Saving..." : "Save Rules"}
            </button>
          )}
        </section>

        {/* Lineup: only shown once rules have been saved at least once */}
        {event && (
          <section className="mt-12">
            <label className="text-sm font-semibold">Lineup Name</label>
            <div className="mt-2 flex gap-3">
              <input
                value={newLineupName}
                onChange={(e) => {
                  setNewLineupName(e.target.value);
                  if (lineupError) setLineupError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && addToLineup()}
                placeholder="Example: Pandji Pragiwaksono"
                className="h-[50px] flex-1 rounded-lg border border-base-border bg-base-card px-3 placeholder:text-white/30"
              />
              <button
                onClick={addToLineup}
                disabled={addingLineup}
                className="h-[50px] shrink-0 rounded-lg bg-gradient-to-r from-brand-red to-brand-maroon px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                + Add to Lineup
              </button>
            </div>
            {lineupError && (
              <p className="mt-2 text-xs text-status-overtime">{lineupError}</p>
            )}

            <div className="mt-6 space-y-3">
              {lineup.length === 0 ? (
                <p className="py-10 text-center text-sm text-white/40">
                  No Data to Display
                </p>
              ) : (
                lineup.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-base-border px-5 py-4"
                  >
                    <span className="font-semibold">{entry.name}</span>

                    {entry.status === "pending" && (
                      <button
                        onClick={() => startCount(entry)}
                        className="flex h-[50px] items-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-semibold text-white hover:brightness-110"
                      >
                        <ClockIcon /> Start Count
                      </button>
                    )}

                    {entry.status === "running" && (
                      <button
                        onClick={() =>
                          router.push(`/event/${eventId}/timer/${entry.id}`)
                        }
                        className="flex h-[50px] items-center gap-2 rounded-lg border border-brand-blue px-4 text-sm font-semibold text-brand-blue"
                      >
                        <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue" />
                        Running
                      </button>
                    )}

                    {entry.status === "done" && (
                      <div className="flex items-center gap-3">
                        {entry.badge && overtimeEnabled && (
                          <BadgePill badge={entry.badge} />
                        )}
                        <div className="text-right">
                          <div className="text-xs text-white/40">Time</div>
                          <div className="tabular-nums text-sm">
                            {entry.elapsed_seconds != null
                              ? formatDuration(entry.elapsed_seconds)
                              : "--:--"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowTransfer(true)}
                className="flex h-[50px] items-center gap-2 rounded-lg border border-base-border px-4 text-sm font-semibold text-white/80"
              >
                <QrIcon /> Transfer the Timer
              </button>
              <button
                onClick={downloadList}
                disabled={lineup.length === 0}
                className="flex h-[50px] items-center gap-2 rounded-lg bg-gradient-to-r from-brand-red to-brand-maroon px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                <DownloadIcon /> Download List
              </button>
            </div>
          </section>
        )}

        <footer className="mt-16 text-center text-xs text-white/30">
          Designed and Developed by Muzakki from StandupIndo Malang &amp; Batavia Jokers
        </footer>
      </div>

      <TransferModal
        open={showTransfer}
        url={transferUrl}
        onClose={() => setShowTransfer(false)}
      />
      <ConfirmModal
        open={showResetConfirm}
        title="Start a new event?"
        description="This clears the saved rules and the entire lineup for this event. This can't be undone."
        confirmLabel="Clear and start new"
        danger
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 4v11m0 0l-4-4m4 4l4-4M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}