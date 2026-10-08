import type { Types } from "mongoose";
export const overall = (statuses: string[]) =>
  statuses.includes("rejected")
    ? "rejected"
    : statuses.includes("query_raised")
      ? "action_required"
      : statuses.length > 0 && statuses.every((s) => s === "approved")
        ? "approved"
        : statuses.some((s) => ["submitted", "in_review"].includes(s))
          ? "in_progress"
          : "draft";
export const deadline = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
export const id = (v: unknown) => String(v as Types.ObjectId);
