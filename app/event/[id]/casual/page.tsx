"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/types";
import TimerDisplay from "@/components/TimerDisplay";
import FullscreenButton from "@/components/FullscreenButton";

type Light = "none" | "green" | "red";

/**
 * Casual Timer: for the MC or anyone who speaks but isn't on the lineup.
 * Starts counting the moment the page opens, lights are switched by hand,
 * and nothing is saved — it lives only in this browser tab.
 */
export default function CasualTimerPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const [light, setLight] = useState<Light>("none");

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));

  // Tapping the light that's already on turns it off again.
  const toggleLight = (next: Exclude<Light, "none">) =>
    setLight((current) => (current === next ? "none" : next));

  const stop = () => router.push(`/event/${params.id}`);

  const bgClass =
    light === "green" ? "bg-status-ontime" : light === "red" ? "blink-overtime" : "bg-base";

  return (
    <div
      className={`relative flex min-h-screen flex-col items-center justify-center overflow-hidden ${
        light === "red" ? "" : "transition-colors duration-700"
      } ${bgClass}`}
    >
      <FullscreenButton />
      <p className="text-lg text-white/80">Casual Timer</p>
      <div className="mt-4">
        <TimerDisplay text={formatDuration(elapsedSeconds)} />
      </div>

      <div className="mt-8 grid w-full max-w-md grid-cols-3 gap-2 px-4 sm:gap-3 sm:px-6">
        <button
          onClick={() => toggleLight("red")}
          aria-pressed={light === "red"}
          className={`flex h-[50px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border-2 bg-status-overtime px-2 text-sm font-semibold text-white hover:brightness-110 ${
            light === "red" ? "border-white" : "border-white/30"
          }`}
        >
          <span
            className={`hidden h-2.5 w-2.5 shrink-0 rounded-full sm:block ${
              light === "red" ? "bg-white" : "bg-white/40"
            }`}
          />
          Red Light
        </button>
        <button
          onClick={() => toggleLight("green")}
          aria-pressed={light === "green"}
          className={`flex h-[50px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border-2 bg-status-ontime px-2 text-sm font-semibold text-white hover:brightness-110 ${
            light === "green" ? "border-white" : "border-white/30"
          }`}
        >
          <span
            className={`hidden h-2.5 w-2.5 shrink-0 rounded-full sm:block ${
              light === "green" ? "bg-white" : "bg-white/40"
            }`}
          />
          Green Light
        </button>
        <button
          onClick={stop}
          className="flex h-[50px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border-2 border-white bg-white px-2 text-sm font-semibold text-[#12142B] hover:bg-white/90"
        >
          <span className="h-3 w-3 shrink-0 bg-[#12142B]" /> Stop
        </button>
      </div>
    </div>
  );
}
