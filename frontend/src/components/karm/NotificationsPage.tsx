import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from "./states";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/api/client";
import { formatDateTime } from "@/api/utils";

export function NotificationsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: api.notifications.list });
  const mark = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (x) {
      toast.error(errorMessage(x));
    }
  };
  return (
    <>
      <PageHeader title="Notifications" />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.notifications.length ? (
        <EmptyState
          title="You're all caught up"
          body="Updates on your applications will appear here."
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {q.data.notifications.map((n) => (
            <li key={n._id} className="flex items-start gap-3 p-4">
              <span
                aria-hidden
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: n.read ? "transparent" : "var(--info)" }}
              />
              <div className="flex-1">
                <p className={`text-sm ${n.read ? "text-muted-foreground" : "font-medium"}`}>
                  {n.message}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(n.createdAt)}
                  {!n.read && <span className="sr-only"> · unread</span>}
                </p>
              </div>
              {!n.read && (
                <Button size="sm" variant="outline" onClick={() => mark(n._id)}>
                  Mark read
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
