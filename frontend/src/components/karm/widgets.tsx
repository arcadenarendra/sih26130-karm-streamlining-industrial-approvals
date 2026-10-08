import { useId, useRef, useState } from "react";
import { Upload, CheckCircle2, XCircle, ShieldAlert, Loader2, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ApplicationDocument, ApprovalType, HistoryEntry, RiskBrief } from "@/api/types";
import { formatDateTime } from "@/api/utils";
import { ALLOWED_TYPES, MAX_BYTES } from "@/api/mock";
import { Pill } from "./status";

/* ---------- ChecklistCard ---------- */
export function ChecklistCard({
  type,
  selected,
  onToggle,
}: {
  type: ApprovalType;
  selected?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={`rounded-md border bg-card p-5 ${selected ? "border-primary ring-1 ring-primary" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{type.name}</h3>
          <p className="text-sm text-muted-foreground">{type.department}</p>
        </div>
        <span className="whitespace-nowrap rounded border border-border px-2 py-0.5 text-xs">
          SLA {type.slaDays} days
        </span>
      </div>
      {type.description && <p className="mt-3 text-sm">{type.description}</p>}
      <ul className="mt-3 space-y-1 text-sm">
        {(type.requiredDocuments ?? []).map((d) => (
          <li key={d.docType} className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            {d.label}
            {!d.required && <span className="text-xs text-muted-foreground">(optional)</span>}
          </li>
        ))}
      </ul>
      {onToggle && (
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggle}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Include in application
        </label>
      )}
    </div>
  );
}

/* ---------- DocumentUploadField ---------- */
export function clientCheck(file: File): string[] {
  const n: string[] = [];
  if (!ALLOWED_TYPES.includes(file.type)) n.push("Only PDF, JPG or PNG files are accepted.");
  if (file.size > MAX_BYTES) n.push("File exceeds the 5 MB limit.");
  return n;
}
export function DocumentUploadField({
  label,
  required,
  doc,
  onFile,
  disabled,
}: {
  label: string;
  required: boolean;
  doc?: ApplicationDocument;
  disabled?: boolean;
  onFile: (f: File) => Promise<void>;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<string[]>([]);
  const [name, setName] = useState<string | null>(null);
  const handle = async (f?: File) => {
    if (!f) return;
    setName(f.name);
    const errs = clientCheck(f);
    setLocal(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      await onFile(f);
    } finally {
      setBusy(false);
    }
  };
  const notes = local.length ? local : (doc?.preValidationNotes ?? []);
  const failed = local.length > 0 || doc?.preValidationStatus === "failed";
  const passed = !local.length && doc?.preValidationStatus === "passed";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium">
          {label}
          {required && (
            <span aria-hidden style={{ color: "var(--danger)" }}>
              {" "}
              *
            </span>
          )}
        </label>
        {passed && <Pill tone="success">Pre-validation passed</Pill>}
        {failed && <Pill tone="danger">Needs attention</Pill>}
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled) void handle(e.dataTransfer.files[0]);
        }}
        className={`flex flex-wrap items-center gap-3 rounded-md border border-dashed p-4 text-sm ${drag ? "border-primary bg-accent" : "border-border bg-surface"}`}
        style={failed ? { borderColor: "var(--danger)" } : undefined}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
        )}
        <span className="text-muted-foreground">
          {busy ? "Uploading and checking…" : (name ?? (doc ? "Uploaded" : "Drag a file here or"))}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
        >
          {doc ? "Replace file" : "Browse"}
        </Button>
        <input
          ref={input}
          id={id}
          type="file"
          className="sr-only"
          accept=".pdf,.jpg,.jpeg,.png"
          disabled={disabled}
          aria-describedby={notes.length ? `${id}-err` : `${id}-hint`}
          aria-invalid={failed}
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {notes.length > 0 ? (
        <ul id={`${id}-err`} className="mt-1.5 space-y-0.5 text-sm" role="alert">
          {notes.map((n) => (
            <li key={n} className="flex items-start gap-1.5">
              <XCircle
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                style={{ color: "var(--danger)" }}
                aria-hidden
              />
              {n}
            </li>
          ))}
        </ul>
      ) : (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
          PDF, JPG or PNG · max 5 MB
        </p>
      )}
    </div>
  );
}

/* ---------- AIRiskBriefPanel ---------- */
export function AIRiskBriefPanel({
  brief,
  loading,
  onGenerate,
}: {
  brief: RiskBrief | null;
  loading: boolean;
  onGenerate: () => void;
}) {
  const tone = !brief
    ? "neutral"
    : brief.score >= 60
      ? "danger"
      : brief.score >= 30
        ? "warning"
        : "success";
  return (
    <section aria-labelledby="risk-h" className="rounded-md border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="risk-h" className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          AI Risk Brief
        </h2>
        {brief && <Pill tone={tone}>Risk score {brief.score}/100</Pill>}
      </div>
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating brief…
        </div>
      ) : brief ? (
        <>
          <p className="mt-3 text-sm">{brief.summary}</p>
          {brief.flags.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {brief.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Generated {formatDateTime(brief.generatedAt)}
          </p>
        </>
      ) : (
        <Button className="mt-4" variant="outline" size="sm" onClick={onGenerate}>
          Generate brief
        </Button>
      )}
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        AI-assisted, not a final determination. Decisions are made only by the reviewing officer.
      </p>
    </section>
  );
}

/* ---------- ApplicationTimeline ---------- */
const ACTION_LABEL: Record<string, string> = {
  created: "Created",
  submitted: "Submitted",
  review_started: "Review started",
  approve: "Approved",
  reject: "Rejected",
  request_reupload: "Re-upload requested",
  reuploaded: "Documents re-uploaded",
};
export function ApplicationTimeline({ history }: { history: HistoryEntry[] }) {
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {[...history].reverse().map((h, i) => {
        const color =
          h.action === "approve"
            ? "var(--success)"
            : h.action === "reject"
              ? "var(--danger)"
              : h.action === "request_reupload"
                ? "var(--warning)"
                : "var(--info)";
        return (
          <li key={i} className="relative">
            <span
              aria-hidden
              className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-card"
              style={{ background: color }}
            />
            <div className="text-sm font-medium">
              {ACTION_LABEL[h.action] ?? h.action}{" "}
              <span className="font-normal capitalize text-muted-foreground">· {h.byRole}</span>
            </div>
            <div className="text-xs text-muted-foreground">{formatDateTime(h.timestamp)}</div>
            {h.reason && (
              <p className="mt-1 rounded border border-border bg-muted p-2 text-sm">{h.reason}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- ReasonModal ---------- */
export function ReasonModal({
  open,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  destructive,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (reason.trim().length < 5) {
      setErr("Please give a reason (at least 5 characters).");
      return;
    }
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      setErr("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label htmlFor={id} className="text-sm font-medium">
          Reason <span style={{ color: "var(--danger)" }}>*</span>
        </label>
        <textarea
          id={id}
          rows={4}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setErr("");
          }}
          aria-invalid={!!err}
          aria-describedby={err ? `${id}-e` : undefined}
          className="w-full rounded-md border border-border bg-surface p-2 text-sm"
        />
        {err && (
          <p id={`${id}-e`} className="text-sm" style={{ color: "var(--danger)" }}>
            {err}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={submit}
            disabled={busy}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DocRow({ doc, label }: { doc: ApplicationDocument; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
        {label}
      </span>
      {doc.preValidationStatus === "passed" ? (
        <span className="flex items-center gap-1 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--success)" }} aria-hidden />
          Passed
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs">
          <XCircle className="h-3.5 w-3.5" style={{ color: "var(--danger)" }} aria-hidden />
          Failed
        </span>
      )}
    </div>
  );
}
