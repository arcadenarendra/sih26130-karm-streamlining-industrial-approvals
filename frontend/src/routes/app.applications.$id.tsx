import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/karm/AppShell";
import { Card, ErrorState, LoadingBlock, PageHeader } from "@/components/karm/states";
import { ApplicationTimeline, DocRow, DocumentUploadField } from "@/components/karm/widgets";
import { StatusBadge, SLAClock } from "@/components/karm/status";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/api/client";
import type { ApprovalItem } from "@/api/types";
import { formatDate, isPending, slaInfo, typeOf, typeName, userName } from "@/api/utils";

export const Route = createFileRoute("/app/applications/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Application details — KARM" },
      { name: "description", content: "Status, SLA and officer comments for each approval." },
      { property: "og:title", content: "Application details — KARM" },
      {
        property: "og:description",
        content: "Status, SLA and officer comments for each approval.",
      },
    ],
  }),
  component: () => (
    <RoleGuard roles={["applicant"]}>
      <Detail />
    </RoleGuard>
  ),
});

function Detail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["application", id], queryFn: () => api.applications.get(id) });
  const [busy, setBusy] = useState(false);
  if (q.isLoading) return <LoadingBlock />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const app = q.data!.application;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["application", id] });
    qc.invalidateQueries({ queryKey: ["applications"] });
  };
  const isDraft = app.approvalItems.some((i) => i.status === "draft");
  const submit = async () => {
    setBusy(true);
    try {
      await api.applications.submit(id);
      toast.success("Application submitted");
      refresh();
    } catch (x) {
      toast.error(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async () => {
    if (!window.confirm("Withdraw this draft application? Its uploaded documents will be removed.")) return;
    setBusy(true);
    try {
      await api.applications.withdraw(id);
      toast.success("Draft application withdrawn");
      qc.invalidateQueries({ queryKey: ["applications"] });
      navigate({ to: "/app/applications" });
    } catch (x) {
      toast.error(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p className="mb-2 text-sm">
        <Link to="/app/applications" className="text-primary hover:underline">
          ← All applications
        </Link>
      </p>
      <PageHeader
        title={`Application ${app._id}`}
        description={`Created ${formatDate(app.createdAt)}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={app.overallStatus} />
            {isDraft && (
              <>
                <Button onClick={submit} disabled={busy}>
                  Submit
                </Button>
                <Button variant="outline" onClick={withdraw} disabled={busy}>
                  Withdraw draft
                </Button>
              </>
            )}
          </div>
        }
      />
      <div className="space-y-5">
        {app.approvalItems.map((i) => (
          <ItemCard key={i._id} appId={app._id} item={i} onChange={refresh} />
        ))}
      </div>
    </>
  );
}

function ItemCard({
  appId,
  item,
  onChange,
}: {
  appId: string;
  item: ApprovalItem;
  onChange: () => void;
}) {
  const t = typeOf(item.approvalTypeId);
  const s = slaInfo(item);
  const canReupload = item.status === "query_raised" || item.status === "rejected";
  const lastReason = [...item.history].reverse().find((h) => h.reason);
  const label = (dt: string) => t?.requiredDocuments.find((r) => r.docType === dt)?.label ?? dt;
  const upload = async (docType: string, f: File) => {
    try {
      if (item.status === "draft") {
        const r = await api.applications.uploadDocument(appId, item._id, f, docType);
        r.preValidationResult.status === "passed"
          ? toast.success("Document passed pre-validation")
          : toast.error("Document failed pre-validation");
      } else {
        await api.applications.reupload(appId, item._id, f, docType);
        toast.success("Re-uploaded. Sent back to the officer.");
      }
      onChange();
    } catch (x) {
      toast.error(errorMessage(x));
    }
  };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{typeName(item.approvalTypeId)}</h2>
          <p className="text-sm text-muted-foreground">
            {t?.department} · Officer: {userName(item.assignedOfficerId)}
          </p>
          <div className="mt-2">
            <StatusBadge status={item.status} />
          </div>
        </div>
        {item.submittedAt && <SLAClock {...s} active={isPending(item.status)} />}
      </div>
      {canReupload && lastReason && (
        <div
          className="mt-4 rounded-md p-3 text-sm status-tint"
          style={{
            ["--tint" as string]: item.status === "rejected" ? "var(--danger)" : "var(--warning)",
          }}
          role="note"
        >
          <b>Officer comment:</b> {lastReason.reason}
        </div>
      )}
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold">Documents</h3>
          {item.status === "draft" || canReupload ? (
            <div className="space-y-4">
              {(t?.requiredDocuments ?? []).map((r) => {
                const doc = item.documents.find((d) => d.docType === r.docType);
                return (
                  <DocumentUploadField
                    key={r.docType}
                    label={canReupload ? `Re-upload: ${r.label}` : r.label}
                    required={r.required}
                    {...(doc ? { doc } : {})}
                    onFile={(f) => upload(r.docType, f)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {item.documents.map((d) => (
                <DocRow key={d.docType} doc={d} label={label(d.docType)} />
              ))}
              {!item.documents.length && (
                <p className="text-sm text-muted-foreground">No documents.</p>
              )}
            </div>
          )}
          {item.slaDeadline && (
            <p className="mt-4 text-xs text-muted-foreground">
              SLA deadline: {formatDate(item.slaDeadline)}
            </p>
          )}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">History</h3>
          <ApplicationTimeline history={item.history} />
        </div>
      </div>
    </Card>
  );
}
