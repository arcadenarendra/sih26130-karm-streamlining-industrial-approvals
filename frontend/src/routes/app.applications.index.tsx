import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RoleGuard } from "@/components/karm/AppShell";
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from "@/components/karm/states";
import { DataTable } from "@/components/karm/DataTable";
import { StatusBadge, SLAClock } from "@/components/karm/status";
import { Button } from "@/components/ui/button";
import { api } from "@/api/client";
import type { Application } from "@/api/types";
import { formatDate, isPending, slaInfo, typeName } from "@/api/utils";

export const Route = createFileRoute("/app/applications/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My applications — KARM" },
      { name: "description", content: "Track all your approval applications and SLA clocks." },
      { property: "og:title", content: "My applications — KARM" },
      {
        property: "og:description",
        content: "Track all your approval applications and SLA clocks.",
      },
    ],
  }),
  component: () => (
    <RoleGuard roles={["applicant"]}>
      <List />
    </RoleGuard>
  ),
});

function maxDays(a: Application) {
  return Math.max(
    0,
    ...a.approvalItems.filter((i) => isPending(i.status)).map((i) => slaInfo(i).days),
  );
}

function List() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["applications"], queryFn: api.applications.list });
  const newBtn = (
    <Button asChild>
      <Link to="/app/applications/new">New application</Link>
    </Button>
  );
  return (
    <>
      <PageHeader
        title="Applications"
        description="Every application and its Days Pending Approval."
        actions={newBtn}
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.applications.length ? (
        <EmptyState
          title="No applications yet"
          body="Start one from your personalised checklist."
          action={newBtn}
        />
      ) : (
        <DataTable
          caption="Your applications"
          rows={q.data.applications}
          rowKey={(a) => a._id}
          onRowClick={(a) => navigate({ to: "/app/applications/$id", params: { id: a._id } })}
          filterText={(a) =>
            a.approvalItems.map((i) => typeName(i.approvalTypeId)).join(" ") + a._id
          }
          initialSort={{ key: "created", dir: "desc" }}
          columns={[
            {
              key: "title",
              header: "Application",
              cell: (a) => (
                <Link
                  to="/app/applications/$id"
                  params={{ id: a._id }}
                  className="font-medium text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {a.approvalItems.map((i) => typeName(i.approvalTypeId)).join(", ")}
                  <span className="block text-xs font-normal text-muted-foreground">{a._id}</span>
                </Link>
              ),
            },
            {
              key: "status",
              header: "Status",
              cell: (a) => <StatusBadge status={a.overallStatus} />,
              sortValue: (a) => a.overallStatus,
            },
            {
              key: "pending",
              header: "Days pending",
              sortValue: maxDays,
              cell: (a) => (
                <div className="flex flex-wrap gap-3">
                  {a.approvalItems
                    .filter((i) => isPending(i.status))
                    .map((i) => {
                      const s = slaInfo(i);
                      return <SLAClock key={i._id} size={36} {...s} />;
                    })}
                  {!a.approvalItems.some((i) => isPending(i.status)) && (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              ),
            },
            {
              key: "created",
              header: "Created",
              sortValue: (a) => a.createdAt,
              cell: (a) => formatDate(a.createdAt),
            },
          ]}
        />
      )}
    </>
  );
}
