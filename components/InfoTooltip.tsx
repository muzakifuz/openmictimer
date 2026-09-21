"use client";

import { useState } from "react";

export default function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        aria-label="More info"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-white/30 text-[10px] font-normal text-white/50 hover:text-white/80"
      >
        i
      </button>
      {show && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-md border border-base-border bg-base-card p-2 text-xs font-normal leading-snug text-white/80 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
