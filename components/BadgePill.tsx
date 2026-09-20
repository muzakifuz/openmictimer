import { Badge, badgeLabel } from "@/lib/types";

const styles: Record<Badge, string> = {
  under: "text-status-under border-status-under/50",
  on_time: "text-status-ontime border-status-ontime/60",
  overtime: "text-status-overtime border-status-overtime/60",
};

export default function BadgePill({ badge }: { badge: Badge }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium tracking-wide ${styles[badge]}`}
    >
      {badgeLabel[badge]}
    </span>
  );
}
