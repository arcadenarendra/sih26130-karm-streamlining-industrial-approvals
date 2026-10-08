import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { RoleGuard } from "@/components/karm/AppShell";
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from "@/components/karm/states";
import { DataTable } from "@/components/karm/DataTable";
import { Field, inputCls } from "@/components/karm/AuthLayout";
import { Pill } from "@/components/karm/status";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, errorMessage, fieldErrors } from "@/api/client";
import type { ApprovalType, RequiredDocument } from "@/api/types";

export const Route = createFileRoute("/admin/approval-types")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Approval types — KARM Admin" },
      { name: "description", content: "Manage the approval rules engine." },
      { property: "og:title", content: "Approval types — KARM Admin" },
      { property: "og:description", content: "Manage the approval rules engine." },
    ],
  }),
  component: () => (
    <RoleGuard roles={["admin"]}>
      <Types />
    </RoleGuard>
  ),
});

type Draft = {
  _id?: string;
  name: string;
  department: string;
  slaDays: number;
  description: string;
  isActive: boolean;
  requiredDocuments: RequiredDocument[];
};
const blank: Draft = {
  name: "",
  department: "",
  slaDays: 15,
  description: "",
  isActive: true,
  requiredDocuments: [],
};

function Types() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["approval-types"], queryFn: api.admin.listApprovalTypes });
  const [edit, setEdit] = useState<Draft | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["approval-types"] });
  const toggle = async (t: ApprovalType) => {
    try {
      await api.admin.updateApprovalType(t._id, { isActive: !t.isActive });
      toast.success(`${t.name} ${t.isActive ? "deactivated" : "activated"}`);
      refresh();
    } catch (x) {
      toast.error(errorMessage(x));
    }
  };
  const del = async (t: ApprovalType) => {
    if (!confirm(`Delete "${t.name}"? In-flight applications keep their frozen requirements.`))
      return;
    try {
      await api.admin.deleteApprovalType(t._id);
      toast.success("Deleted");
      refresh();
    } catch (x) {
      toast.error(errorMessage(x));
    }
  };
  return (
    <>
      <PageHeader
        title="Approval types"
        description="Rules engine entries used to build applicant checklists."
        actions={
          <Button onClick={() => setEdit({ ...blank })}>
            <Plus className="h-4 w-4" />
            New type
          </Button>
        }
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          title="No approval types"
          action={<Button onClick={() => setEdit({ ...blank })}>Create one</Button>}
        />
      ) : (
        <DataTable<ApprovalType>
          caption="Approval types"
          rows={q.data}
          rowKey={(t) => t._id}
          filterText={(t) => t.name + t.department}
          columns={[
            {
              key: "name",
              header: "Name",
              sortValue: (t) => t.name,
              cell: (t) => (
                <button
                  className="font-medium text-primary hover:underline"
                  onClick={() => setEdit({ ...t })}
                >
                  {t.name}
                </button>
              ),
            },
            {
              key: "dept",
              header: "Department",
              sortValue: (t) => t.department,
              cell: (t) => t.department,
            },
            {
              key: "docs",
              header: "Required docs",
              cell: (t) => (
                <span className="text-muted-foreground">
                  {t.requiredDocuments.map((d) => d.label).join(", ") || "—"}
                </span>
              ),
            },
            {
              key: "sla",
              header: "SLA days",
              sortValue: (t) => t.slaDays,
              cell: (t) => <span className="tabular-nums">{t.slaDays}</span>,
            },
            {
              key: "active",
              header: "Active",
              cell: (t) => (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={t.isActive}
                    onCheckedChange={() => toggle(t)}
                    aria-label={`Toggle ${t.name} active`}
                  />
                  {t.isActive ? (
                    <Pill tone="success">Active</Pill>
                  ) : (
                    <Pill tone="neutral">Inactive</Pill>
                  )}
                </div>
              ),
            },
            {
              key: "x",
              header: "",
              cell: (t) => (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${t.name}`}
                  onClick={() => del(t)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ),
            },
          ]}
        />
      )}
      {edit && (
        <Editor
          draft={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function Editor({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Draft>(draft);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setErrs({});
    const body = {
      name: f.name,
      department: f.department,
      slaDays: Number(f.slaDays),
      description: f.description,
      isActive: f.isActive,
      requiredDocuments: f.requiredDocuments
        .filter((d) => d.label.trim())
        .map((d) => ({ ...d, docType: d.docType || d.label.toLowerCase().replace(/\W+/g, "_") })),
    };
    try {
      f._id
        ? await api.admin.updateApprovalType(f._id, body)
        : await api.admin.createApprovalType(body);
      toast.success("Saved");
      onSaved();
    } catch (x) {
      setErrs(fieldErrors(x));
      toast.error(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  const e = (k: string) => (errs[k] ? { error: errs[k] } : {});
  const a = (k: string) => ({
    "aria-invalid": !!errs[k],
    "aria-describedby": errs[k] ? `${k}-error` : undefined,
  });
  const setDoc = (i: number, p: Partial<RequiredDocument>) =>
    setF({
      ...f,
      requiredDocuments: f.requiredDocuments.map((d, j) => (j === i ? { ...d, ...p } : d)),
    });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{f._id ? "Edit approval type" : "New approval type"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field id="name" label="Name" {...e("name")}>
            <input
              id="name"
              className={inputCls}
              value={f.name}
              {...a("name")}
              onChange={(x) => setF({ ...f, name: x.target.value })}
            />
          </Field>
          <Field id="department" label="Department" {...e("department")}>
            <input
              id="department"
              className={inputCls}
              value={f.department}
              {...a("department")}
              onChange={(x) => setF({ ...f, department: x.target.value })}
            />
          </Field>
          <Field id="slaDays" label="SLA days" {...e("slaDays")}>
            <input
              id="slaDays"
              type="number"
              min={1}
              className={inputCls}
              value={f.slaDays}
              {...a("slaDays")}
              onChange={(x) => setF({ ...f, slaDays: Number(x.target.value) })}
            />
          </Field>
          <Field id="description" label="Description">
            <textarea
              id="description"
              rows={2}
              className="w-full rounded-md border border-border bg-surface p-2 text-sm"
              value={f.description}
              onChange={(x) => setF({ ...f, description: x.target.value })}
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Required documents</legend>
            {f.requiredDocuments.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label="Document label"
                  className={inputCls}
                  value={d.label}
                  onChange={(x) => setDoc(i, { label: x.target.value })}
                />
                <label className="flex items-center gap-1 whitespace-nowrap text-xs">
                  <input
                    type="checkbox"
                    checked={d.required}
                    onChange={(x) => setDoc(i, { required: x.target.checked })}
                  />
                  Required
                </label>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove document"
                  onClick={() =>
                    setF({ ...f, requiredDocuments: f.requiredDocuments.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setF({
                  ...f,
                  requiredDocuments: [
                    ...f.requiredDocuments,
                    { docType: "", label: "", required: true },
                  ],
                })
              }
            >
              <Plus className="h-4 w-4" />
              Add document
            </Button>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={f.isActive} onCheckedChange={(v) => setF({ ...f, isActive: v })} />
            Active
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
