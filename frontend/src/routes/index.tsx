import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthLayout } from "@/components/karm/AuthLayout";
import { useAuth, homeFor } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KARM — Industrial Approvals & Compliance" },
      {
        name: "description",
        content: "Personalised approval checklists, document pre-validation and live SLA tracking.",
      },
      { property: "og:title", content: "KARM — Industrial Approvals & Compliance" },
      {
        property: "og:description",
        content: "Personalised approval checklists, document pre-validation and live SLA tracking.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) navigate({ to: homeFor(user.role), replace: true });
  }, [user, navigate]);
  return (
    <AuthLayout
      title="Welcome to KARM"
      subtitle="Industrial approvals, compliance and SLA tracking in one place."
    >
      <ul className="mb-6 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Personalised checklist of required approvals</li>
        <li>Instant document pre-validation</li>
        <li>Live “Days Pending Approval” clock for every item</li>
      </ul>
      <div className="grid gap-2">
        <Link
          to="/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Sign in
        </Link>
        <Link
          to="/register"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border text-sm font-medium hover:bg-accent"
        >
          Create applicant account
        </Link>
      </div>
    </AuthLayout>
  );
}
