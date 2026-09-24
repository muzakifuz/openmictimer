"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  OpenMicEvent,
  LineupEntry,
  Badge,
  TimingSystem,
  badgeLabel,
  computeEventBadge,
  formatDuration,
  DEFAULT_GREEN_LIGHT_SECONDS,
  DEFAULT_RED_LIGHT_SECONDS,
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
  const [timingSystem, setTimingSystem] = useState<TimingSystem>("lights");
  const [greenSeconds, setGreenSeconds] = useState(DEFAULT_GREEN_LIGHT_SECONDS);
  const [redSeconds, setRedSeconds] = useState(DEFAULT_RED_LIGHT_SECONDS);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const lightsInvalid = timingSystem === "lights" && redSeconds <= greenSeconds;

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

  const [justSavedRules, setJustSavedRules] = useState(false);
  const [showEditRulesConfirm, setShowEditRulesConfirm] = useState(false);
  const [reordering, setReordering] = useState(false);
  const lineupSectionRef = useRef<HTMLElement | null>(null);

  const runningEntry = useMemo(
    () => lineup.find((e) => e.status === "running") ?? null,
    [lineup]
  );

  // While a lineup timer is minimized (running, but we're back on the list),
  // tick a clock so the list can show the live time and light color.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!runningEntry) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [runningEntry]);

  const runningElapsed = runningEntry?.started_at
    ? Math.max(0, Math.floor((now - new Date(runningEntry.started_at).getTime()) / 1000))
    : 0;
  // Use the saved rules (what the timer screen uses), not unsaved form edits.
  const runningBadge =
    runningEntry && event && event.overtime_note_enabled
      ? computeEventBadge(runningElapsed, event)
      : null;

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
      setTimingSystem(data.timing_system === "lights" ? "lights" : "tolerance");
      setGreenSeconds(data.green_light_seconds ?? DEFAULT_GREEN_LIGHT_SECONDS);
      setRedSeconds(data.red_light_seconds ?? DEFAULT_RED_LIGHT_SECONDS);
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

  // Scroll the newly-revealed lineup section into view right after Save
  // Rules succeeds, so the person notices where to add names next.
  useEffect(() => {
    if (justSavedRules && event) {
      lineupSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setJustSavedRules(false);
    }
  }, [justSavedRules, event]);

  const saveRules = async () => {
    if (!name.trim() || lightsInvalid) return;
    setSavingRules(true);
    setRulesError(null);
    const payload = {
      id: eventId,
      name: name.trim(),
      max_time_seconds: maxSeconds,
      tolerance_seconds: toleranceSeconds,
      overtime_note_enabled: overtimeEnabled,
      timing_system: timingSystem,
      green_light_seconds: greenSeconds,
      red_light_seconds: redSeconds,
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
      setJustSavedRules(true);
    } else if (error) {
      // Most likely cause after this update: the new timing-system columns
      // haven't been added yet (re-run supabase/schema.sql).
      setRulesError(`Couldn't save the rules: ${error.message}`);
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

  // --- Reorder the lineup ---

  const moveEntry = async (entry: LineupEntry, direction: "up" | "down") => {
    const idx = lineup.findIndex((e) => e.id === entry.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (reordering || idx === -1 || swapIdx < 0 || swapIdx >= lineup.length) return;
    const other = lineup[swapIdx];
    setReordering(true);
    await Promise.all([
      supabase
        .from("lineup_entries")
        .update({ position: other.position })
        .eq("id", entry.id),
      supabase
        .from("lineup_entries")
        .update({ position: entry.position })
        .eq("id", other.id),
    ]);
    await loadLineup();
    setReordering(false);
  };

  // --- Edit / delete a lineup entry ---

  const openEdit = (entry: LineupEntry) => setEditingEntry(entry);

  const saveEditedEntry = async (
    newName: string,
    newElapsedSeconds: number,
    newPerformanceNote: string
  ) => {
    if (!editingEntry || !newName) return;
    const updates: Record<string, unknown> = {
      name: newName,
      performance_note: newPerformanceNote || null,
    };
    if (editingEntry.status === "done") {
      updates.elapsed_seconds = newElapsedSeconds;
      updates.badge = overtimeEnabled
        ? computeEventBadge(newElapsedSeconds, {
            timing_system: timingSystem,
            max_time_seconds: maxSeconds,
            tolerance_seconds: toleranceSeconds,
            green_light_seconds: greenSeconds,
            red_light_seconds: redSeconds,
          })
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

  const performanceNoteFor = (entry: LineupEntry): string => {
    return entry.performance_note?.trim() ? entry.performance_note.trim() : "-";
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
    const infoLines =
      timingSystem === "lights"
        ? [
            "Timing System: Green Light & Red Light",
            `Green Light: ${formatDuration(greenSeconds)}`,
            `Red Light: ${formatDuration(redSeconds)}`,
          ]
        : [
            "Timing System: Time Tolerance",
            `Maximum Time: ${formatDuration(maxSeconds)}`,
            `Time Tolerance: \u00B1 ${toleranceSeconds}s`,
          ];
    infoLines.push(
      `Overtime Note: ${overtimeEnabled ? "Enabled" : "Disabled"}`,
      `Generated: ${new Date().toLocaleString()}`
    );
    let infoY = 68;
    for (const line of infoLines) {
      doc.text(line, 40, infoY);
      infoY += 14;
    }

    const rows = lineup.map((entry) => [
      entry.name,
      entry.status === "done" && entry.elapsed_seconds != null
        ? formatDuration(entry.elapsed_seconds)
        : "--:--",
      noteFor(entry),
      performanceNoteFor(entry),
    ]);

    autoTable(doc, {
      startY: infoY + 6,
      head: [["Lineup Name", "Stage Time", "Timer Note", "Performance Note"]],
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
    <div className={`min-h-screen bg-base px-6 py-10 ${runningEntry ? "pb-32" : ""}`}>
      <div className="mx-auto max-w-2xl">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt=""
              aria-hidden
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
            <span className="font-semibold">Openmic Timer</span>
          </div>
          {event && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#5EA1FF] hover:opacity-80"
            >
              <RefreshIcon />
              Start a New Event
            </button>
          )}
        </header>

        <h1 className="mt-6 text-3xl font-bold">Keep the Laughs On Time.</h1>
        <p className="mt-2 text-sm text-white/60">
          Manage your lineup and keep every set on time.
        </p>

        {/* Rules card */}
        <section className="mt-8">
          {rulesLocked ? (
            <div className="rounded-lg border border-white/15 p-5">
              <label className="text-sm text-white/50">Openmic&apos;s Name</label>
              <p className="mt-1 text-lg font-bold text-white">{name}</p>

              <div className="mt-5 grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-white/50">Overtime Note</label>
                  <p className="mt-1 font-bold text-white">
                    {overtimeEnabled ? "Yes" : "No"}
                  </p>
                </div>
                {timingSystem === "lights" ? (
                  <>
                    <div>
                      <label className="text-sm text-white/50">Green Light</label>
                      <p className="mt-1 flex items-center gap-2 font-bold text-white">
                        <span className="h-2.5 w-2.5 rounded-full bg-status-ontime" />
                        {formatDuration(greenSeconds)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-white/50">Red Light</label>
                      <p className="mt-1 flex items-center gap-2 font-bold text-white">
                        <span className="h-2.5 w-2.5 rounded-full bg-status-overtime" />
                        {formatDuration(redSeconds)}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-sm text-white/50">Maximum Time</label>
                      <p className="mt-1 font-bold text-white">
                        {formatDuration(maxSeconds)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-white/50">Time Tolerance</label>
                      <p className="mt-1 font-bold text-white">
                        {toleranceSeconds} Sec.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowEditRulesConfirm(true)}
                className="mt-6 flex h-[50px] w-full items-center justify-center gap-2 rounded-lg border border-white/30 text-sm font-semibold text-white hover:bg-white/5"
              >
                <PencilIcon /> Edit Detail
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-semibold">Openmic&apos;s Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Example: Openmic StandupIndo Jakbar"
                  className="mt-2 h-[50px] w-full rounded-lg border border-base-border bg-base-card px-3 placeholder:text-white/30"
                />
              </div>

              {/* Row: Overtime Note */}
              <div className="py-4">
                <label className="flex w-fit items-center gap-2 text-sm font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={overtimeEnabled}
                    onChange={(e) => setOvertimeEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-base-border accent-brand-blue"
                  />
                  Overtime Note
                </label>
              </div>

              {/* Row: Timing System + radio */}
              <div className="py-4">
                <label className="flex items-center gap-1.5 text-sm font-semibold">
                  Timing System
                  <InfoTooltip text={"Green Light & Red Light: the screen turns green at the Green Light time and red at the Red Light time. Time Tolerance: the screen turns green within Maximum Time \u00B1 tolerance and red after it."} />
                </label>
                <div
                  role="radiogroup"
                  aria-label="Timing System"
                  className="mt-2 flex flex-wrap gap-x-6 gap-y-2"
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                    <input
                      type="radio"
                      name="timing-system"
                      value="lights"
                      checked={timingSystem === "lights"}
                      onChange={() => setTimingSystem("lights")}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    Green Light &amp; Red Light
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                    <input
                      type="radio"
                      name="timing-system"
                      value="tolerance"
                      checked={timingSystem === "tolerance"}
                      onChange={() => setTimingSystem("tolerance")}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    Time Tolerance
                  </label>
                </div>
              </div>

              {/* Row: inputs for the chosen timing system */}
              <div className="py-4">
                {timingSystem === "lights" ? (
                  <>
                    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                      <div className="w-[300px] max-w-full">
                        <label className="flex h-5 items-center gap-2 text-sm font-semibold">
                          <span className="h-2.5 w-2.5 rounded-full bg-status-ontime" />
                          Green Light
                        </label>
                        <div className="mt-2">
                          <DurationInput totalSeconds={greenSeconds} onChange={setGreenSeconds} />
                        </div>
                      </div>
                      <div className="w-[300px] max-w-full">
                        <label className="flex h-5 items-center gap-2 text-sm font-semibold">
                          <span className="h-2.5 w-2.5 rounded-full bg-status-overtime" />
                          Red Light
                        </label>
                        <div className="mt-2">
                          <DurationInput totalSeconds={redSeconds} onChange={setRedSeconds} />
                        </div>
                      </div>
                    </div>
                    {lightsInvalid && (
                      <p className="mt-2 text-xs text-[#FF6B6B]">
                        Red Light must be later than Green Light.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                    <div className="w-[300px] max-w-full">
                      <label className="flex h-5 items-center text-sm font-semibold">Maximum Time</label>
                      <div className="mt-2">
                        <DurationInput totalSeconds={maxSeconds} onChange={setMaxSeconds} />
                      </div>
                    </div>
                    <div className="w-[140px]">
                      <label className="flex h-5 items-center gap-1.5 whitespace-nowrap text-sm font-semibold">
                        Time Tolerance &plusmn;
                        <InfoTooltip text={"The number of seconds a comic can run under or over the Maximum Time and still count as \"on time\". Past that window they're flagged under or overtime."} />
                      </label>
                      <div className="mt-2">
                        <Stepper
                          value={toleranceSeconds}
                          onChange={setToleranceSeconds}
                          min={0}
                          max={300}
                        />
                        <p className="mt-1 text-center text-[11px] text-white/40">sec</p>
                      </div>
                    </div>
                  </div>
                )}

                {rulesError && (
                  <p className="mt-4 text-xs text-[#FF6B6B]">{rulesError}</p>
                )}
              </div>

              <div className="mt-2 flex gap-3">
                {event && (
                  <button
                    onClick={() => {
                      setName(event.name);
                      setMaxSeconds(event.max_time_seconds);
                      setToleranceSeconds(event.tolerance_seconds);
                      setOvertimeEnabled(event.overtime_note_enabled);
                      setTimingSystem(event.timing_system === "lights" ? "lights" : "tolerance");
                      setGreenSeconds(event.green_light_seconds ?? DEFAULT_GREEN_LIGHT_SECONDS);
                      setRedSeconds(event.red_light_seconds ?? DEFAULT_RED_LIGHT_SECONDS);
                      setRulesError(null);
                      setEditingRules(false);
                    }}
                    className="h-[50px] shrink-0 rounded-lg border border-base-border px-5 text-sm font-semibold text-white/70 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={saveRules}
                  disabled={!name.trim() || savingRules || lightsInvalid}
                  className="h-[50px] w-full rounded-lg bg-gradient-to-r from-brand-red to-brand-maroon text-sm font-semibold text-white disabled:opacity-40"
                >
                  {savingRules ? "Saving..." : "Save Rules"}
                </button>
              </div>
            </>
          )}
        </section>

        {/* Lineup: only shown once rules have been saved at least once */}
        {event && (
          <section ref={lineupSectionRef} className="mt-12">
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
                aria-label="Add to Lineup"
                className="h-[50px] shrink-0 rounded-lg bg-gradient-to-r from-brand-red to-brand-maroon px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                <span className="sm:hidden text-lg leading-none">+</span>
                <span className="hidden sm:inline">+ Add to Lineup</span>
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
                lineup.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-3 rounded-lg border border-base-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          onClick={() => moveEntry(entry, "up")}
                          disabled={index === 0 || reordering}
                          aria-label={`Move ${entry.name} up`}
                          className="flex h-6 w-6 items-center justify-center rounded border border-base-border text-white/50 hover:bg-white/5 hover:text-white disabled:opacity-20"
                        >
                          <ArrowUpIcon />
                        </button>
                        <button
                          onClick={() => moveEntry(entry, "down")}
                          disabled={index === lineup.length - 1 || reordering}
                          aria-label={`Move ${entry.name} down`}
                          className="flex h-6 w-6 items-center justify-center rounded border border-base-border text-white/50 hover:bg-white/5 hover:text-white disabled:opacity-20"
                        >
                          <ArrowDownIcon />
                        </button>
                      </div>
                      <span className="font-semibold">{entry.name}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {entry.status === "pending" && (
                        <button
                          onClick={() => startCount(entry)}
                          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-semibold text-white hover:brightness-110 sm:flex-none"
                        >
                          <ClockIcon /> Start Count
                        </button>
                      )}

                      {entry.status === "running" && (
                        <button
                          onClick={() =>
                            router.push(`/event/${eventId}/timer/${entry.id}`)
                          }
                          aria-label={`Open ${entry.name}'s timer`}
                          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-lg border border-brand-blue px-4 text-sm font-semibold text-brand-blue hover:bg-brand-blue/10 sm:flex-none"
                        >
                          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue" />
                          <span className="tabular-nums">{formatDuration(runningElapsed)}</span>
                          <span className="text-white/80">Open Timer</span>
                        </button>
                      )}

                      {entry.status === "done" && (
                        <div className="flex flex-1 items-center gap-3 sm:flex-none">
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

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setShowTransfer(true)}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-lg border border-base-border px-4 text-sm font-semibold text-white/80 sm:w-auto"
              >
                <QrIcon /> Transfer the Timer
              </button>
              <button
                onClick={() => router.push(`/event/${eventId}/casual`)}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-lg border border-white px-4 text-sm font-semibold text-white hover:bg-white/5 sm:w-auto"
              >
                <ClockIcon /> Timer for MC
              </button>
              <button
                onClick={downloadList}
                disabled={lineup.length === 0}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-red to-brand-maroon px-4 text-sm font-semibold text-white disabled:opacity-40 sm:w-auto"
              >
                <DocumentIcon /> Export List
              </button>
            </div>
          </section>
        )}

        <footer className="mt-16 text-center text-xs text-white/30">
          If you have any suggestions for this tool, send me a DM on IG: @muzakifuz
        </footer>
      </div>

      {runningEntry && (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 px-4 py-3 ${
            runningBadge === "on_time"
              ? "bg-status-ontime"
              : runningBadge === "overtime"
              ? "blink-overtime"
              : "bg-base-card"
          }`}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-white/70">On stage: {runningEntry.name}</p>
              <p className="tabular-nums text-2xl font-bold leading-tight text-white">
                {formatDuration(runningElapsed)}
              </p>
            </div>
            <button
              onClick={() => router.push(`/event/${eventId}/timer/${runningEntry.id}`)}
              className="flex h-[44px] shrink-0 items-center gap-2 rounded-lg border border-white px-4 text-sm font-semibold text-white hover:bg-white/10"
            >
              <MaximizeIcon /> Back to Timer
            </button>
          </div>
        </div>
      )}

      <TransferModal
        open={showTransfer}
        url={transferUrl}
        onClose={() => setShowTransfer(false)}
      />

      <ConfirmModal
        open={showEditRulesConfirm}
        title="Edit event rules?"
        description="Changing the name, overtime note, or timing system only applies going forward. It won't change the Stage Time, Timer Note, or Performance Note already recorded for anyone who's already been on stage."
        confirmLabel="Edit Detail"
        onConfirm={() => {
          setShowEditRulesConfirm(false);
          setEditingRules(true);
        }}
        onCancel={() => setShowEditRulesConfirm(false)}
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
        performanceNote={editingEntry?.performance_note ?? ""}
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

function MaximizeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4v5h5M20 20v-5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 15a8 8 0 0 0 13.9 3.4M19.5 9A8 8 0 0 0 5.6 5.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 19V5M5 12l7-7 7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12l7 7 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v5h5M9 13h6M9 17h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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