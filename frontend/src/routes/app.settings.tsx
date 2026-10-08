import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { RoleGuard } from "@/components/karm/AppShell";
import { Card, PageHeader } from "@/components/karm/states";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { USING_MOCK } from "@/api/client";
import { resetMockDb } from "@/api/mock";

export const Route = createFileRoute("/app/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — KARM" },
      { name: "description", content: "Account, theme and sign-out." },
      { property: "og:title", content: "Settings — KARM" },
      { property: "og:description", content: "Account, theme and sign-out." },
    ],
  }),
  component: () => (
    <RoleGuard roles={["applicant"]}>
      <Settings />
    </RoleGuard>
  ),
});

function Settings() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid max-w-2xl gap-4">
        <Card>
          <h2 className="font-semibold">Account</h2>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{user?.name}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user?.email}</dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{user?.phone ?? "—"}</dd>
          </dl>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/app/profile">Edit business profile</Link>
          </Button>
        </Card>
        <Card>
          <h2 className="font-semibold">Theme</h2>
          <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Theme">
            {(["light", "dark"] as const).map((t) => (
              <Button
                key={t}
                role="radio"
                aria-checked={theme === t}
                variant={theme === t ? "default" : "outline"}
                onClick={() => setTheme(t)}
                className="capitalize"
              >
                {t}
              </Button>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Session</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                logout();
                navigate({ to: "/login", replace: true });
              }}
            >
              Log out
            </Button>
            {USING_MOCK && (
              <Button
                variant="outline"
                onClick={() => {
                  resetMockDb();
                  toast.success("Sample data reset");
                }}
              >
                Reset sample data
              </Button>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
