export type TimingSystem = "tolerance" | "lights";

export type OpenMicEvent = {
  id: string;
  name: string;
  max_time_seconds: number;
  tolerance_seconds: number;
  overtime_note_enabled: boolean;
  timing_system: TimingSystem;
  green_light_seconds: number;
  red_light_seconds: number;
  created_at: string;
};

export const DEFAULT_GREEN_LIGHT_SECONDS = 240; // 4:00
export const DEFAULT_RED_LIGHT_SECONDS = 300; // 5:00

// The subset of an event's rules needed to decide under / on time / overtime.
export type TimingRules = {
  timing_system?: TimingSystem | null;
  max_time_seconds: number;
  tolerance_seconds: number;
  green_light_seconds?: number | null;
  red_light_seconds?: number | null;
};

export type LineupStatus = "pending" | "running" | "done";
export type Badge = "under" | "on_time" | "overtime";

export type LineupEntry = {
  id: string;
  event_id: string;
  name: string;
  position: number;
  status: LineupStatus;
  started_at: string | null;
  elapsed_seconds: number | null;
  badge: Badge | null;
  performance_note: string | null;
  created_at: string;
};

export function computeBadge(
  elapsedSeconds: number,
  maxSeconds: number,
  toleranceSeconds: number
): Badge {
  const lower = maxSeconds - toleranceSeconds;
  const upper = maxSeconds + toleranceSeconds;
  if (elapsedSeconds < lower) return "under";
  if (elapsedSeconds <= upper) return "on_time";
  return "overtime";
}

// Green Light & Red Light: under before the green light, on time from the
// green light until the red light, overtime once the red light is on.
export function computeLightsBadge(
  elapsedSeconds: number,
  greenSeconds: number,
  redSeconds: number
): Badge {
  if (elapsedSeconds < greenSeconds) return "under";
  if (elapsedSeconds < redSeconds) return "on_time";
  return "overtime";
}

export function computeEventBadge(elapsedSeconds: number, rules: TimingRules): Badge {
  if (rules.timing_system === "lights") {
    return computeLightsBadge(
      elapsedSeconds,
      rules.green_light_seconds ?? DEFAULT_GREEN_LIGHT_SECONDS,
      rules.red_light_seconds ?? DEFAULT_RED_LIGHT_SECONDS
    );
  }
  return computeBadge(elapsedSeconds, rules.max_time_seconds, rules.tolerance_seconds);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm.padStart(2, "0")}:${ss}`;
}

export const badgeLabel: Record<Badge, string> = {
  under: "UNDER",
  on_time: "ON TIME",
  overtime: "OVERTIME",
};
