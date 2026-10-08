import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RoleGuard } from "@/components/karm/AppShell";
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from "@/components/karm/states";
import { Pill } from "@/components/karm/status";
import { api } from "@/api/client";

export const Route = createFileRoute("/authority/analytics")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Analytics — KARM" },
      {
        name: "description",
        content: "Average approval times, bottlenecks and rejection reasons.",
      },
      { property: "og:title", content: "Analytics — KARM" },
      {
        property: "og:description",
        content: "Average approval times, bottlenecks and rejection reasons.",
      },
    ],
  }),
  component: () => (
    <RoleGuard roles={["authority", "admin"]}>
      <Analytics />
    </RoleGuard>
  ),
});

const axis = { fill: "var(--muted-foreground)", fontSize: 12 };
const tip = {
  contentStyle: {
    background: "var(--elevated)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
    borderRadius: 6,
  },
};

function Analytics() {
  const q = useQuery({ queryKey: ["analytics"], queryFn: api.admin.analytics });
  if (q.isLoading) return <LoadingBlock rows={5} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;
  return (
    <>
      <PageHeader title="Analytics" description="Computed from live application data." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Average days per approval type</h2>
          {!d.avgDaysByApprovalType.length ? (
            <EmptyState title="No data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={d.avgDaysByApprovalType}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="approvalType"
                  tick={axis}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={axis} />
                <Tooltip {...tip} cursor={{ fill: "var(--accent)" }} />
                <Bar
                  dataKey="avgDays"
                  name="Avg days"
                  fill="var(--primary)"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Rejection & re-upload reasons</h2>
          {!d.rejectionReasons.length ? (
            <EmptyState title="No rejections yet" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={d.rejectionReasons} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={axis} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="reason"
                  tick={axis}
                  width={160}
                  tickFormatter={(v: string) => (v.length > 26 ? v.slice(0, 26) + "…" : v)}
                />
                <Tooltip {...tip} cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="count" name="Count" fill="var(--danger)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold">Bottlenecks</h2>
          {!d.bottlenecks.length ? (
            <p className="text-sm text-muted-foreground">No pending items.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Approval type</th>
                  <th>Department</th>
                  <th>Pending</th>
                  <th>Breached</th>
                </tr>
              </thead>
              <tbody>
                {d.bottlenecks.map((b) => (
                  <tr key={b.approvalType} className="border-t border-border">
                    <td className="py-2.5 font-medium">{b.approvalType}</td>
                    <td>{b.department}</td>
                    <td className="tabular-nums">{b.pending}</td>
                    <td>
                      {b.breached ? (
                        <Pill tone="danger">{b.breached} breached</Pill>
                      ) : (
                        <Pill tone="success">0</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
