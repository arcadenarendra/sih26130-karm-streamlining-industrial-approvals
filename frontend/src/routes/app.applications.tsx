import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/applications")({
  ssr: false,
  component: () => <Outlet />,
});
