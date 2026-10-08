import type { ApprovalItem, ApprovalType, ApprovalTypeRef, SlaRisk, UserRef } from "./types";

export const DAY = 86_400_000;

export function typeOf(ref: ApprovalTypeRef): ApprovalType | null {
  return typeof ref === "string" ? null : ref;
}
export function typeName(ref: ApprovalTypeRef) {
  return typeof ref === "string" ? ref : ref.name;
}
export function userName(ref: UserRef | null) {
  if (!ref) return "—";
  return typeof ref === "string" ? ref : ref.name;
}

/** Days elapsed since submission and SLA length for an item. */
export function slaInfo(item: ApprovalItem) {
  const t = typeOf(item.approvalTypeId);
  const slaDays =
    t?.slaDays ??
    (item.submittedAt && item.slaDeadline
      ? Math.round((+new Date(item.slaDeadline) - +new Date(item.submittedAt)) / DAY)
      : 0);
  const days = item.submittedAt
    ? Math.max(0, Math.floor((Date.now() - +new Date(item.submittedAt)) / DAY))
    : 0;
  return { days, slaDays };
}

export const NEARING_RATIO = 0.75;

export function slaRisk(days: number, slaDays: number): SlaRisk {
  if (!slaDays) return "on_track";
  if (days >= slaDays) return "breached";
  if (days / slaDays >= NEARING_RATIO) return "nearing";
  return "on_track";
}

export const isPending = (s: ApprovalItem["status"]) => s === "submitted" || s === "in_review";

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
