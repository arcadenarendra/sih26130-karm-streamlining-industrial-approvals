import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RoleGuard } from "@/components/karm/AppShell";
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from "@/components/karm/states";
import { DataTable } from "@/components/karm/DataTable";
import { SlaRiskBadge, StatusBadge, SLAClock } from "@/components/karm/status";
import { api } from "@/api/client";
import type { Application, ApprovalItem } from "@/api/types";
import { isPending, slaInfo, slaRisk, typeName, userName } from "@/api/utils";

export const Route = createFileRoute("/authority/inbox")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inbox — KARM Authority" },
      { name: "description", content: "Applications assigned to your department, by SLA risk." },
      { property: "og:title", content: "Inbox — KARM Authority" },
      {
        property: "og:description",
        content: "Applications assigned to your department, by SLA risk.",
      },
    ],
  }),
  component: () => (
    <RoleGuard roles={["authority", "admin"]}>
      <Inbox />
    </RoleGuard>
  ),
});

type Row = { app: Application; item: ApprovalItem; days: number; slaDays: number };
const sel = "h-9 rounded-md border border-border bg-surface px-2 text-sm";

function Inbox() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [risk, setRisk] = useState("");
  const q = useQuery({
    queryKey: ["inbox", status, risk],
    queryFn: () => api.authority.list({ status, slaRisk: risk }),
  });
  const rows: Row[] = (q.data?.applications ?? []).flatMap((app) =>
    app.approvalItems.map((item) => ({ app, item, ...slaInfo(item) })),
  );
  return (
    <>
      <PageHeader title="Inbox" description="Applications routed to your department." />
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          Status
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {["submitted", "in_review", "query_raised", "approved", "rejected"].map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          SLA risk
          <select className={sel} value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="">All</option>
            <option value="on_track">On track</option>
            <option value="nearing">Nearing</option>
            <option value="breached">Breached</option>
          </select>
        </label>
      </div>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !rows.length ? (
        <EmptyState
          title="Nothing here"
          body={
            status || risk
              ? "No items match these filters."
              : "No applications assigned to your department yet."
          }
        />
      ) : (
        <DataTable<Row>
          caption="Assigned applications"
          rows={rows}
          rowKey={(r) => r.item._id}
          filterText={(r) =>
            `${r.app._id} ${userName(r.app.applicantId)} ${typeName(r.item.approvalTypeId)}`
          }
          initialSort={{ key: "days", dir: "desc" }}
          onRowClick={(r) =>
            navigate({ to: "/authority/applications/$id", params: { id: r.app._id } })
          }
          columns={[
            {
              key: "app",
              header: "Application",
              cell: (r) => (
                <Link
                  to="/authority/applications/$id"
                  params={{ id: r.app._id }}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-primary hover:underline"
                >
                  {typeName(r.item.approvalTypeId)}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {r.app._id}
                  </span>
                </Link>
              ),
            },
            {
              key: "applicant",
              header: "Applicant",
              cell: (r) => userName(r.app.applicantId),
              sortValue: (r) => userName(r.app.applicantId),
            },
            {
              key: "status",
              header: "Status",
              cell: (r) => <StatusBadge status={r.item.status} />,
              sortValue: (r) => r.item.status,
            },
            {
              key: "days",
              header: "Days pending",
              sortValue: (r) => (isPending(r.item.status) ? r.days : -1),
              cell: (r) =>
                isPending(r.item.status) ? (
                  <SLAClock size={36} days={r.days} slaDays={r.slaDays} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              key: "risk",
              header: "SLA risk",
              cell: (r) =>
                isPending(r.item.status) ? (
                  <SlaRiskBadge risk={slaRisk(r.days, r.slaDays)} />
                ) : null,
            },
          ]}
        />
      )}
    </>
  );
}
