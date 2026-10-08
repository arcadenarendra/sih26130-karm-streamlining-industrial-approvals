import type { ItemStatus, OverallStatus, SlaRisk } from "@/api/types";
import { slaRisk } from "@/api/utils";
import { cn } from "@/lib/utils";

const TINT: Record<string, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "var(--muted-foreground)",
};
const STATUS: Record<ItemStatus | OverallStatus, { label: string; tone: keyof typeof TINT }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  in_review: { label: "In review", tone: "info" },
  query_raised: { label: "Query raised", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  in_progress: { label: "In progress", tone: "info" },
  action_required: { label: "Action required", tone: "warning" },
};

export function Pill({
  tone,
  children,
  className,
}: {
  tone: keyof typeof TINT;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      style={{ ["--tint" as string]: TINT[tone] }}
      className={cn(
        "status-tint inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: TINT[tone] }} />
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: ItemStatus | OverallStatus }) {
  const s = STATUS[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

const RISK: Record<SlaRisk, { label: string; tone: keyof typeof TINT }> = {
  on_track: { label: "On track", tone: "success" },
  nearing: { label: "Nearing deadline", tone: "warning" },
  breached: { label: "SLA breached", tone: "danger" },
};
export function SlaRiskBadge({ risk }: { risk: SlaRisk }) {
  return <Pill tone={RISK[risk].tone}>{RISK[risk].label}</Pill>;
}

export function SLAClock({
  days,
  slaDays,
  size = 56,
  active = true,
}: {
  days: number;
  slaDays: number;
  size?: number;
  active?: boolean;
}) {
  const risk = slaRisk(days, slaDays);
  const color = !active
    ? "var(--muted-foreground)"
    : risk === "breached"
      ? "var(--danger)"
      : risk === "nearing"
        ? "var(--warning)"
        : "var(--success)";
  const r = (size - 8) / 2,
    c = 2 * Math.PI * r;
  const pct = slaDays ? Math.min(1, days / slaDays) : 0;
  return (
    <div
      className="inline-flex items-center gap-2"
      role="img"
      aria-label={`Day ${days} of ${slaDays}${active ? `, ${RISK[risk].label}` : ""}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={5}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-semibold tabular-nums">
          Day {days} / {slaDays}
        </div>
        <div className="text-xs text-muted-foreground">
          {active ? RISK[risk].label : "Clock stopped"}
        </div>
      </div>
    </div>
  );
}
