export type OpenMicEvent = {
  id: string;
  name: string;
  max_time_seconds: number;
  min_time_seconds: number;
  overtime_note_enabled: boolean;
  created_at: string;
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
  created_at: string;
};

export function computeBadge(
  elapsedSeconds: number,
  minSeconds: number,
  maxSeconds: number
): Badge {
  if (elapsedSeconds < minSeconds) return "under";
  if (elapsedSeconds <= maxSeconds) return "on_time";
  return "overtime";
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
