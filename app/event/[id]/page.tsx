"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  OpenMicEvent,
  LineupEntry,
  Badge,
  badgeLabel,
  computeBadge,
  formatDuration,
} from "@/lib/types";
import BadgePill from "@/components/BadgePill";
import ConfirmModal from "@/components/ConfirmModal";
import TransferModal from "@/components/TransferModal";
import Stepper from "@/components/Stepper";
import DurationInput from "@/components/DurationInput";
import InfoTooltip from "@/components/InfoTooltip";
import EditEntryModal from "@/components/EditEntryModal";

const DEFAULT_MAX_SECONDS = 300; // 5 min
const DEFAULT_TOLERANCE_SECONDS = 15;

export default function EventPage({ params }: { params: { id: string } }) {
  const eventId = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<OpenMicEvent | null>(null);
  const [editingRules, setEditingRules] = useState(true);

  const [maxSeconds, setMaxSeconds] = useState(DEFAULT_MAX_SECONDS);
  const [toleranceSeconds, setToleranceSeconds] = useState(DEFAULT_TOLERANCE_SECONDS);
  const [name, setName] = useState("");
  const [overtimeEnabled, setOvertimeEnabled] = useState(true);
  const [savingRules, setSavingRules] = useState(false);

  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [newLineupName, setNewLineupName] = useState("");
  const [addingLineup, setAddingLineup] = useState(false);
  const [lineupError, setLineupError] = useState<string | null>(null);

  const [showTransfer, setShowTransfer] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [editingEntry, setEditingEntry] = useState<LineupEntry | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const [pendingNames, setPendingNames] = useState<string[]>([]);

  const runningEntry = useMemo(
    () => lineup.find((e) => e.status === "running") ?? null,
    [lineup]
  );

  const loadEvent = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();

    if (data) {
      setEvent(data as OpenMicEvent);
      setMaxSeconds(data.max_time_seconds);
      setToleranceSeconds(data.tolerance_seconds);
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
    if (!name.trim()) return;
    setSavingRules(true);
    const payload = {
      id: eventId,
      name: name.trim(),
      max_time_seconds: maxSeconds,
      tolerance_seconds: toleranceSeconds,
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

  // --- Edit / delete a lineup entry ---

  const openEdit = (entry: LineupEntry) => setEditingEntry(entry);

  const saveEditedEntry = async (newName: string, newElapsedSeconds: number) => {
    if (!editingEntry || !newName) return;
    const updates: Record<string, unknown> = { name: newName };
    if (editingEntry.status === "done") {
      updates.elapsed_seconds = newElapsedSeconds;
      updates.badge = overtimeEnabled
        ? computeBadge(newElapsedSeconds, maxSeconds, toleranceSeconds)
        : null;
    }
    await supabase.from("lineup_entries").update(updates).eq("id", editingEntry.id);
    setEditingEntry(null);
    loadLineup();
  };

  const confirmDeleteEntry = async () => {
    if (!editingEntry) return;
    await supabase.from("lineup_entries").delete().eq("id", editingEntry.id);
    setShowDeleteConfirm(false);
    setEditingEntry(null);
    loadLineup();
  };

  // --- PDF export ---

  const noteFor = (entry: LineupEntry): string => {
    if (entry.status !== "done") return "Not yet on stage";
    if (!overtimeEnabled) return "-";
    return entry.badge ? badgeLabel[entry.badge as Badge] : "-";
  };

  const buildAndDownloadPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ unit: "pt", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(event?.name || "Openmic", 40, 48);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Maximum Time: ${formatDuration(maxSeconds)}`, 40, 68);
    doc.text(`Time Tolerance: \u00B1 ${toleranceSeconds}s`, 40, 82);
    doc.text(
      `Overtime Note: ${overtimeEnabled ? "Enabled" : "Disabled"}`,
      40,
      96
    );
    doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 110);

    const rows = lineup.map((entry) => [
      entry.name,
      entry.status === "done" && entry.elapsed_seconds != null
        ? formatDuration(entry.elapsed_seconds)
        : "--:--",
      noteFor(entry),
    ]);

    autoTable(doc, {
      startY: 130,
      head: [["Lineup Name", "Stage Time", "Note"]],
      body: rows,
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [178, 58, 58], textColor: 255 },
      columnStyles: { 1: { halign: "center" } },
    });

    doc.save(`${event?.name || "openmic"}-lineup.pdf`);
  };

  const downloadList = () => {
    const notYetOnStage = lineup.filter((e) => e.status !== "done");
    if (notYetOnStage.length > 0) {
      setPendingNames(notYetOnStage.map((e) => e.name));
      setShowDownloadConfirm(true);
      return;
    }
    buildAndDownloadPdf();
  };

  const confirmDownloadAnyway = () => {
    setShowDownloadConfirm(false);
    buildAndDownloadPdf();
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
          <div>
            <label className="text-sm font-semibold">Openmic&apos;s Name</label>
            <input
              disabled={rulesLocked}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example: Openmic StandupIndo Jakbar"
              className="mt-2 h-[50px] w-full rounded-lg border border-base-border bg-base-card px-3 placeholder:text-white/30 disabled:opacity-50"
            />
          </div>

          <label className="mt-4 flex w-fit items-center gap-2 text-sm font-semibold text-white">
            <input
              type="checkbox"
              disabled={rulesLocked}
              checked={overtimeEnabled}
              onChange={(e) => setOvertimeEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-base-border accent-brand-blue"
            />
            Overtime Note
          </label>

          <div className="mt-4">
            <label className="text-sm font-semibold">Maximum Time</label>
            <div className="mt-2 max-w-[220px]">
              <DurationInput
                totalSeconds={maxSeconds}
                onChange={setMaxSeconds}
                disabled={rulesLocked}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-1.5 text-sm font-semibold">
              Time Tolerance &plusmn;
              <InfoTooltip text={"The number of seconds a comic can run under or over the Maximum Time and still count as \"on time\". Past that window they're flagged under or overtime."} />
            </label>
            <div className="mt-2 max-w-[140px]">
              <Stepper
                value={toleranceSeconds}
                onChange={setToleranceSeconds}
                min={0}
                max={300}
                disabled={rulesLocked}
              />
            </div>
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
              disabled={!name.trim() || savingRules}
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

                    <div className="flex items-center gap-3">
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
                          <div className="tabular-nums text-[18px] text-white">
                            Time:{" "}
                            {entry.elapsed_seconds != null
                              ? formatDuration(entry.elapsed_seconds)
                              : "--:--"}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => openEdit(entry)}
                        aria-label={`Edit ${entry.name}`}
                        className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-lg border border-base-border text-white/60 hover:bg-white/5 hover:text-white"
                      >
                        <PencilIcon />
                      </button>
                    </div>
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

      <footer class="mt-16 text-center text-xs text-white/30">
        If you have any suggestions for these tools, send me a DM on IG:
        <a href="https://www.instagram.com/muzakifuz/" target="_blank">@muzakifuz</a>
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

      <ConfirmModal
        open={showDownloadConfirm}
        title="Some comics haven't been on stage yet"
        description={`${pendingNames
          .map((n) => `\u2022 ${n} - Not yet on stage`)
          .join("\n")}\n\nDownload the list anyway?`}
        confirmLabel="Download anyway"
        onConfirm={confirmDownloadAnyway}
        onCancel={() => setShowDownloadConfirm(false)}
      />

      <EditEntryModal
        open={!!editingEntry}
        name={editingEntry?.name ?? ""}
        elapsedSeconds={editingEntry?.elapsed_seconds ?? 0}
        showTime={editingEntry?.status === "done"}
        onSave={saveEditedEntry}
        onDelete={() => setShowDeleteConfirm(true)}
        onClose={() => setEditingEntry(null)}
      />

      <ConfirmModal
        open={showDeleteConfirm}
        title="Remove from lineup?"
        description={`This removes ${
          editingEntry?.name ?? "this comic"
        } from the lineup. This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteEntry}
        onCancel={() => setShowDeleteConfirm(false)}
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

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20h4L18.5 9.5a2.121 2.121 0 0 0-3-3L5 17v3zM14.5 6.5l3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
