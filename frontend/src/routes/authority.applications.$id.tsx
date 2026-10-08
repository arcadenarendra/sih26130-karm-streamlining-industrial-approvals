import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/karm/AppShell";
import { Card, ErrorState, LoadingBlock, PageHeader } from "@/components/karm/states";
import {
  AIRiskBriefPanel,
  ApplicationTimeline,
  DocRow,
  ReasonModal,
} from "@/components/karm/widgets";
import { StatusBadge, SLAClock } from "@/components/karm/status";
import { Button } from "@/components/ui/button";
import { api, assetUrl, errorMessage, USING_MOCK } from "@/api/client";
import type { ApprovalItem, Decision, RiskBrief } from "@/api/types";
import { formatDateTime, isPending, slaInfo, typeOf, typeName, userName } from "@/api/utils";

export const Route = createFileRoute("/authority/applications/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Review application — KARM Authority" },
      { name: "description", content: "Review documents, AI risk brief and decide." },
      { property: "og:title", content: "Review application — KARM Authority" },
      { property: "og:description", content: "Review documents, AI risk brief and decide." },
    ],
  }),
  component: () => (
    <RoleGuard roles={["authority", "admin"]}>
      <Review />
    </RoleGuard>
  ),
});

function Review() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["authority-app", id], queryFn: () => api.authority.get(id) });
  const [itemId, setItemId] = useState<string | null>(null);
  if (q.isLoading) return <LoadingBlock rows={6} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const app = q.data!.application;
  const item = app.approvalItems.find((i) => i._id === itemId) ?? app.approvalItems[0]!;
  return (
    <>
      <p className="mb-2 text-sm">
        <Link to="/authority/inbox" className="text-primary hover:underline">
          ← Inbox
        </Link>
      </p>
      <PageHeader
        title={`Application ${app._id}`}
        description={`Applicant: ${userName(app.applicantId)}`}
      />
      {app.approvalItems.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist">
          {app.approvalItems.map((i) => (
            <Button
              key={i._id}
              role="tab"
              aria-selected={i._id === item._id}
              variant={i._id === item._id ? "default" : "outline"}
              size="sm"
              onClick={() => setItemId(i._id)}
            >
              {typeName(i.approvalTypeId)}
            </Button>
          ))}
        </div>
      )}
      <ItemReview key={item._id} appId={app._id} item={item} />
    </>
  );
}

function ItemReview({ appId, item }: { appId: string; item: ApprovalItem }) {
  const qc = useQueryClient();
  const t = typeOf(item.approvalTypeId);
  const s = slaInfo(item);
  const [docIdx, setDocIdx] = useState(0);
  const [brief, setBrief] = useState<RiskBrief | null>(item.documents[0]?.riskBrief ?? null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [modal, setModal] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const doc = item.documents[docIdx];
  const label = (dt: string) => t?.requiredDocuments.find((r) => r.docType === dt)?.label ?? dt;
  const documentUrl = doc ? assetUrl(doc.fileUrl) : "";
  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(doc?.fileUrl ?? "");
  const isBrowserPreview =
    !!doc &&
    !doc.fileUrl.startsWith("sample://") &&
    (!USING_MOCK || doc.fileUrl.startsWith("blob:"));

  useEffect(() => {
    setPreviewFailed(false);
  }, [doc?.fileUrl]);

  const loadBrief = async () => {
    setBriefLoading(true);
    try {
      setBrief((await api.authority.riskBrief(appId, item._id)).riskBrief);
    } catch (x) {
      toast.error(errorMessage(x));
    } finally {
      setBriefLoading(false);
    }
  };
  useEffect(() => {
    if (!brief && isPending(item.status) && item.documents.length) void loadBrief();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (decision: Decision, reason = "") => {
    setBusy(true);
    try {
      await api.authority.decide(appId, item._id, { decision, reason });
      toast.success(
        decision === "approve"
          ? "Approved"
          : decision === "reject"
            ? "Rejected"
            : "Re-upload requested",
      );
      setModal(null);
      qc.invalidateQueries({ queryKey: ["authority-app", appId] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    } catch (x) {
      toast.error(errorMessage(x));
      throw x;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{typeName(item.approvalTypeId)}</h2>
              <p className="text-sm text-muted-foreground">{t?.department}</p>
              <div className="mt-2">
                <StatusBadge status={item.status} />
              </div>
            </div>
            {item.submittedAt && <SLAClock {...s} active={isPending(item.status)} />}
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">Documents</h3>
          {!item.documents.length ? (
            <p className="text-sm text-muted-foreground">No documents uploaded.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
              <ul className="space-y-1">
                {item.documents.map((d, i) => (
                  <li key={d.docType}>
                    <button
                      onClick={() => setDocIdx(i)}
                      aria-current={i === docIdx}
                      className={`w-full rounded-md border px-3 py-2 text-left ${i === docIdx ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}
                    >
                      <DocRow doc={d} label={label(d.docType)} />
                    </button>
                  </li>
                ))}
              </ul>
              {doc && (
                <div className="min-h-72 rounded-md border border-border bg-muted p-3">
                  {!previewFailed && isImage ? (
                    <img
                      src={documentUrl}
                      alt={label(doc.docType)}
                      className="max-h-96 w-full rounded bg-surface object-contain"
                      onError={() => setPreviewFailed(true)}
                    />
                  ) : !previewFailed && isBrowserPreview ? (
                    <iframe
                      src={documentUrl}
                      title={label(doc.docType)}
                      className="h-96 w-full rounded bg-surface"
                      onError={() => setPreviewFailed(true)}
                    />
                  ) : (
                    <div className="flex h-72 flex-col items-center justify-center text-center text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{label(doc.docType)}</p>
                      <a
                        href={documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 text-primary underline"
                      >
                        Open uploaded document
                      </a>
                      <p className="mt-1 text-xs">Uploaded {formatDateTime(doc.uploadedAt)}</p>
                    </div>
                  )}
                  {doc.preValidationNotes.length > 0 && (
                    <ul className="mt-3 list-disc pl-5 text-sm" style={{ color: "var(--danger)" }}>
                      {doc.preValidationNotes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">History</h3>
          <ApplicationTimeline history={item.history} />
        </Card>
      </div>
      <div className="space-y-5">
        <AIRiskBriefPanel brief={brief} loading={briefLoading} onGenerate={loadBrief} />
        <Card>
          <h3 className="font-semibold">Decision</h3>
          {isPending(item.status) ? (
            <div className="mt-3 grid gap-2">
              <Button disabled={busy} onClick={() => void decide("approve").catch(() => {})}>
                Approve
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setModal("request_reupload")}
              >
                Request re-upload
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => setModal("reject")}>
                Reject
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No decision pending for this item.</p>
          )}
        </Card>
      </div>
      <ReasonModal
        open={modal === "reject"}
        destructive
        title="Reject approval"
        description="The applicant will see this reason."
        confirmLabel="Reject"
        onClose={() => setModal(null)}
        onConfirm={(r) => decide("reject", r)}
      />
      <ReasonModal
        open={modal === "request_reupload"}
        title="Request re-upload"
        description="Explain what the applicant must fix."
        confirmLabel="Send request"
        onClose={() => setModal(null)}
        onConfirm={(r) => decide("request_reupload", r)}
      />
    </div>
  );
}
