import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RoleGuard } from "@/components/karm/AppShell";
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from "@/components/karm/states";
import { ChecklistCard } from "@/components/karm/widgets";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/api/client";

export const Route = createFileRoute("/app/checklist")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Approval checklist — KARM" },
      { name: "description", content: "Approvals your business needs, with documents and SLA." },
      { property: "og:title", content: "Approval checklist — KARM" },
      {
        property: "og:description",
        content: "Approvals your business needs, with documents and SLA.",
      },
    ],
  }),
  component: () => (
    <RoleGuard roles={["applicant"]}>
      <Checklist />
    </RoleGuard>
  ),
});

function Checklist() {
  const q = useQuery({ queryKey: ["checklist"], queryFn: api.checklist.get, retry: false });
  return (
    <>
      <PageHeader
        title="Your approval checklist"
        description="Generated from your business profile. Sample data — not real regulatory guidance."
        actions={
          <Button asChild>
            <Link to="/app/applications/new">Start application</Link>
          </Button>
        }
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.error instanceof ApiError && q.error.status === 404 ? (
        <EmptyState
          title="No business profile yet"
          body="Create one to generate your checklist."
          action={
            <Button asChild>
              <Link to="/app/profile">Set up profile</Link>
            </Button>
          }
        />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.items.length ? (
        <EmptyState title="No approvals required" body="Nothing matches your profile right now." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.items.map((t) => (
            <ChecklistCard key={t._id} type={t} />
          ))}
        </div>
      )}
    </>
  );
}
