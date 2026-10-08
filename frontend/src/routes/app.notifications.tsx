import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/karm/AppShell";
import { NotificationsPage } from "@/components/karm/NotificationsPage";

export const Route = createFileRoute("/app/notifications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notifications — KARM" },
      { name: "description", content: "Updates on your approval applications." },
      { property: "og:title", content: "Notifications — KARM" },
      { property: "og:description", content: "Updates on your approval applications." },
    ],
  }),
  component: () => (
    <RoleGuard roles={["applicant"]}>
      <NotificationsPage />
    </RoleGuard>
  ),
});
