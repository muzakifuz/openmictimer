"use client";

export default function Stepper({
  value,
  onChange,
  min = 1,
  max = 120,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div
      className={`flex h-[50px] items-center justify-between rounded-lg border border-base-border bg-base-card px-2 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label="Decrease"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/70 hover:bg-white/10 disabled:opacity-30"
      >
        <MinusIcon />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-12 bg-transparent text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={inc}
        disabled={disabled || value >= max}
        aria-label="Increase"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/70 hover:bg-white/10 disabled:opacity-30"
      >
        <PlusIcon />
      </button>
    </div>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}