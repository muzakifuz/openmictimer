"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// useLayoutEffect warns during server rendering; fall back to useEffect there.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REFERENCE_FONT_SIZE = 100; // px, used only for measuring

/**
 * Renders the running time so its width is always `widthRatio` of the
 * screen width (85% by default) on every device — phone, tablet, laptop,
 * projector — in portrait or landscape.
 *
 * It measures the text once at a known font size and scales from there.
 * Digits are tabular (all the same width), so the size only needs to be
 * recalculated when the shape changes (e.g. 59:59 -> 1:00:00), the window
 * is resized/rotated, or the web font finishes loading.
 */
export default function TimerDisplay({
  text,
  widthRatio = 0.85,
}: {
  text: string;
  widthRatio?: number;
}) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);

  // "03:27" and "08:15" have identical widths with tabular digits.
  const shape = text.replace(/\d/g, "0");

  useIsomorphicLayoutEffect(() => {
    const fit = () => {
      const el = measureRef.current;
      if (!el) return;
      const measuredWidth = el.getBoundingClientRect().width;
      if (!measuredWidth) return;
      const screenWidth = document.documentElement.clientWidth || window.innerWidth;
      setFontSize((REFERENCE_FONT_SIZE * screenWidth * widthRatio) / measuredWidth);
    };

    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, [shape, widthRatio]);

  return (
    <>
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible fixed left-0 top-0 whitespace-nowrap font-bold tabular-nums leading-none"
        style={{ fontSize: REFERENCE_FONT_SIZE }}
      >
        {shape}
      </span>
      <div
        className="whitespace-nowrap text-center font-bold tabular-nums leading-none text-white"
        // Before the first measurement, use a close vw-based guess so there's no jump.
        style={{ fontSize: fontSize ?? `${widthRatio * 30}vw` }}
      >
        {text}
      </div>
    </>
  );
}
