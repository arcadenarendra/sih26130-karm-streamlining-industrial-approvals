import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ClipboardList,
  FileText,
  BarChart3,
  Building2,
  Inbox,
  LogOut,
  Menu,
  Settings,
  Users,
  Layers,
  X,
  PlusCircle,
} from "lucide-react";
import { useAuth, homeFor } from "@/lib/auth";
import { ThemeToggle } from "@/lib/theme";
import { USING_MOCK } from "@/api/client";
import type { Role } from "@/api/types";

const NAV: Record<Role, { to: string; label: string; icon: typeof Bell }[]> = {
  applicant: [
    { to: "/app/applications", label: "Applications", icon: FileText },
    { to: "/app/applications/new", label: "New application", icon: PlusCircle },
    { to: "/app/checklist", label: "Checklist", icon: ClipboardList },
    { to: "/app/profile", label: "Business profile", icon: Building2 },
    { to: "/app/notifications", label: "Notifications", icon: Bell },
    { to: "/app/settings", label: "Settings", icon: Settings },
  ],
  authority: [
    { to: "/authority/inbox", label: "Inbox", icon: Inbox },
    { to: "/authority/analytics", label: "Analytics", icon: BarChart3 },
  ],
  department_admin: [
    { to: "/authority/inbox", label: "Applications", icon: Inbox },
    { to: "/authority/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/admin/approval-types", label: "Services", icon: Layers },
    { to: "/admin/users", label: "Authorities", icon: Users },
  ],
  admin: [
    { to: "/admin/approval-types", label: "Approval types", icon: Layers },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/authority/inbox", label: "Applications", icon: Inbox },
    { to: "/authority/analytics", label: "Analytics", icon: BarChart3 },
  ],
};

/** RoleGuard + shell: redirects unauthenticated users to /login and wrong roles to their own home. */
export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const ok = !!user && roles.includes(user.role);
  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login", replace: true });
    else if (!roles.includes(user.role)) navigate({ to: homeFor(user.role), replace: true });
  }, [loading, user, roles, navigate]);
  if (!ok)
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
        role="status"
      >
        Loading…
      </div>
    );
  return <AppShell role={user.role}>{children}</AppShell>;
}

function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const items = NAV[role];
  const active = (to: string) =>
    path === to ||
    (to !== "/app/applications" && path.startsWith(to + "/")) ||
    (to === "/app/applications" && /^\/app\/applications\/(?!new)/.test(path));

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1 p-3">
      {items.map((i) => (
        <Link
          key={i.to}
          to={i.to}
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${active(i.to) ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <i.icon className="h-4 w-4" aria-hidden />
          {i.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link to={homeFor(role)} className="flex items-center gap-2 font-bold tracking-tight">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-primary text-xs text-primary-foreground">
            K
          </span>
          KARM
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            {role === "applicant"
              ? "Applicant Portal"
              : role === "authority"
                ? `Authority · ${user?.department}`
                : "Admin"}
          </span>
        </Link>
        {USING_MOCK && (
          <span className="hidden rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground lg:inline">
            Sample data
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden text-right text-xs leading-tight sm:block">
            <div className="font-medium">{user?.name}</div>
            <div className="text-muted-foreground capitalize">{role}</div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate({ to: "/login", replace: true });
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm hover:bg-accent"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>
      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-border bg-surface md:block">
          {nav}
        </aside>
        {open && (
          <aside className="fixed inset-x-0 top-14 z-20 border-b border-border bg-surface md:hidden">
            {nav}
          </aside>
        )}
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
