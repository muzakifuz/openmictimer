"use client";

import { useEffect, useState } from "react";
import DurationInput from "./DurationInput";

export default function EditEntryModal({
  open,
  name,
  elapsedSeconds,
  performanceNote,
  showTime,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  name: string;
  elapsedSeconds: number;
  performanceNote: string;
  showTime: boolean;
  onSave: (name: string, elapsedSeconds: number, performanceNote: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [localName, setLocalName] = useState(name);
  const [localSeconds, setLocalSeconds] = useState(elapsedSeconds);
  const [localNote, setLocalNote] = useState(performanceNote);

  useEffect(() => {
    if (open) {
      setLocalName(name);
      setLocalSeconds(elapsedSeconds);
      setLocalNote(performanceNote);
    }
  }, [open, name, elapsedSeconds, performanceNote]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-lg border border-base-border bg-base-card p-6">
        <h2 className="text-lg font-semibold text-white">Edit Lineup</h2>

        <label className="mt-4 block text-sm font-semibold text-white">
          Name
        </label>
        <input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          className="mt-2 h-[50px] w-full rounded-lg border border-base-border bg-base px-3 text-white"
        />

        {showTime && (
          <>
            <label className="mt-4 block text-sm font-semibold text-white">
              Stage Time
            </label>
            <div className="mt-2 max-w-[220px]">
              <DurationInput totalSeconds={localSeconds} onChange={setLocalSeconds} />
            </div>
          </>
        )}

        <label className="mt-4 block text-sm font-semibold text-white">
          Note
        </label>
        <textarea
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          placeholder="Notes about the performance..."
          rows={3}
          className="mt-2 w-full resize-none rounded-lg border border-base-border bg-base px-3 py-2 text-sm text-white placeholder:text-white/30"
        />

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={onDelete}
            className="rounded-lg border border-status-overtime px-4 py-2 text-sm font-semibold text-status-overtime hover:bg-status-overtime/10"
          >
            Delete
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-base-border px-4 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(localName.trim(), localSeconds, localNote.trim())}
              disabled={!localName.trim()}
              className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
