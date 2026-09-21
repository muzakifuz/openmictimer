"use client";

import Stepper from "./Stepper";

export default function DurationInput({
  totalSeconds,
  onChange,
  disabled = false,
}: {
  totalSeconds: number;
  onChange: (totalSeconds: number) => void;
  disabled?: boolean;
}) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Stepper
          value={minutes}
          onChange={(m) => onChange(m * 60 + seconds)}
          min={0}
          max={59}
          disabled={disabled}
        />
        <p className="mt-1 text-center text-[11px] text-white/40">min</p>
      </div>
      <span className="pb-6 text-white/40">:</span>
      <div className="flex-1">
        <Stepper
          value={seconds}
          onChange={(s) => onChange(minutes * 60 + s)}
          min={0}
          max={59}
          disabled={disabled}
        />
        <p className="mt-1 text-center text-[11px] text-white/40">sec</p>
      </div>
    </div>
  );
}
