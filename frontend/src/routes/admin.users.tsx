import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/karm/AppShell";
import { ErrorState, LoadingBlock, PageHeader } from "@/components/karm/states";
import { DataTable } from "@/components/karm/DataTable";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/api/client";
import type { Role, User } from "@/api/types";

export const Route = createFileRoute("/admin/users")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Users — KARM Admin" },
      { name: "description", content: "View users and manage roles and departments." },
      { property: "og:title", content: "Users — KARM Admin" },
      { property: "og:description", content: "View users and manage roles and departments." },
    ],
  }),
  component: () => (
    <RoleGuard roles={["admin"]}>
      <Users />
    </RoleGuard>
  ),
});

function Users() {
  const q = useQuery({ queryKey: ["admin-users"], queryFn: api.admin.users });
  return (
    <>
      <PageHeader
        title="Users"
        description="Basic role and department management (scope pending decision)."
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <DataTable<User>
          caption="Users"
          rows={q.data!.users}
          rowKey={(u) => u._id}
          filterText={(u) => u.name + u.email + (u.department ?? "")}
          columns={[
            {
              key: "name",
              header: "Name",
              sortValue: (u) => u.name,
              cell: (u) => (
                <>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </>
              ),
            },
            {
              key: "edit",
              header: "Role & department",
              cell: (u) => <UserEditor key={u._id + u.updatedAt} user={u} />,
            },
          ]}
        />
      )}
    </>
  );
}

function UserEditor({ user }: { user: User }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<Role>(user.role);
  const [dept, setDept] = useState(user.department ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = role !== user.role || (role !== "applicant" && dept !== (user.department ?? ""));
  const save = async () => {
    setBusy(true);
    try {
      await api.admin.updateUser(user._id, {
        role,
        department: role === "applicant" ? null : dept,
      });
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (x) {
      toast.error(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`Role for ${user.name}`}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
      >
        <option value="applicant">Applicant</option>
        <option value="authority">Authority</option>
        <option value="admin">Admin</option>
      </select>
      {role !== "applicant" && (
        <input
          aria-label={`Department for ${user.name}`}
          placeholder="Department"
          className="h-9 w-56 rounded-md border border-border bg-surface px-2 text-sm"
          value={dept}
          onChange={(e) => setDept(e.target.value)}
        />
      )}
      {dirty && (
        <Button size="sm" onClick={save} disabled={busy}>
          Save
        </Button>
      )}
    </div>
  );
}
