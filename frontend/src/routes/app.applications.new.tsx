import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/karm/AppShell";
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from "@/components/karm/states";
import { ChecklistCard, DocumentUploadField } from "@/components/karm/widgets";
import { Button } from "@/components/ui/button";
import { api, ApiError, errorMessage, USING_MOCK } from "@/api/client";
import type { Application } from "@/api/types";
import { typeOf } from "@/api/utils";

export const Route = createFileRoute("/app/applications/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New application — KARM" },
      {
        name: "description",
        content: "Select approvals and upload documents with instant pre-validation.",
      },
      { property: "og:title", content: "New application — KARM" },
      {
        property: "og:description",
        content: "Select approvals and upload documents with instant pre-validation.",
      },
    ],
  }),
  component: () => (
    <RoleGuard roles={["applicant"]}>
      <NewApp />
    </RoleGuard>
  ),
});

function NewApp() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const checklist = useQuery({ queryKey: ["checklist"], queryFn: api.checklist.get, retry: false });
  const departments = useQuery({ queryKey: ["departments"], queryFn: api.departments.list, retry: false });
  const profile = useQuery({ queryKey: ["profile"], queryFn: api.profile.get, retry: false });
  const [departmentId, setDepartmentId] = useState("");
  const services = useQuery({
    queryKey: ["department-services", departmentId],
    queryFn: () => api.departments.services(departmentId),
    enabled: Boolean(departmentId) && !USING_MOCK,
    retry: false,
  });
  const [sel, setSel] = useState<string[]>([]);
  const [app, setApp] = useState<Application | null>(null);
  const [busy, setBusy] = useState(false);

  if (checklist.isLoading || profile.isLoading || (!USING_MOCK && departments.isLoading)) return <LoadingBlock />;
  if (checklist.error instanceof ApiError && checklist.error.status === 404)
    return (
      <EmptyState
        title="Create your business profile first"
        body="Your checklist is generated from it."
        action={
          <Button asChild>
            <Link to="/app/profile">Set up profile</Link>
          </Button>
        }
      />
    );
  if (checklist.isError)
    return <ErrorState error={checklist.error} onRetry={() => checklist.refetch()} />;
  if (!USING_MOCK && services.isError && departmentId)
    return <ErrorState error={services.error} onRetry={() => services.refetch()} />;

  const start = async () => {
    setBusy(true);
    try {
      const r = await api.applications.create({
        businessProfileId: profile.data!.profile._id,
        approvalTypeIds: sel,
      });
      setApp(r.application);
      qc.invalidateQueries({ queryKey: ["applications"] });
    } catch (x) {
      toast.error(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  const upload = async (itemId: string, docType: string, file: File) => {
    try {
      const r = await api.applications.uploadDocument(app!._id, itemId, file, docType);
      setApp(
        (a) =>
          a && {
            ...a,
            approvalItems: a.approvalItems.map((i) =>
              i._id !== itemId
                ? i
                : {
                    ...i,
                    documents: i.documents.filter((d) => d.docType !== docType).concat(r.document),
                  },
            ),
          },
      );
      r.preValidationResult.status === "passed"
        ? toast.success("Document passed pre-validation")
        : toast.error("Document failed pre-validation");
    } catch (x) {
      toast.error(errorMessage(x));
    }
  };
  const submit = async () => {
    setBusy(true);
    try {
      await api.applications.submit(app!._id);
      toast.success("Application submitted. SLA clocks have started.");
      qc.invalidateQueries({ queryKey: ["applications"] });
      navigate({ to: "/app/applications/$id", params: { id: app!._id } });
    } catch (x) {
      toast.error(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };

  if (!app) {
    const items = USING_MOCK ? checklist.data!.items : (services.data?.services ?? []);
    const availableDepartments = departments.data?.departments ?? [];
    return (
      <>
        <PageHeader
          title="New application"
          description="Step 1 of 3 · Choose a department, then select its service."
        />
        {!USING_MOCK && (
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium" htmlFor="department">
              Department
            </label>
            <select
              id="department"
              className="h-10 w-full max-w-xl rounded-md border border-border bg-surface px-3"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setSel([]);
              }}
            >
              <option value="">Select a department</option>
              {availableDepartments.map((d) => (
                <option key={d._id} value={d.departmentId}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((t) => (
            <ChecklistCard
              key={t._id}
              type={t}
              selected={sel.includes(t._id)}
              onToggle={() =>
                setSel((s) => (s.includes(t._id) ? s.filter((x) => x !== t._id) : [...s, t._id]))
              }
            />
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Button disabled={!sel.length || busy} onClick={start}>
            Continue with {sel.length} approval{sel.length === 1 ? "" : "s"}
          </Button>
          <Button variant="outline" onClick={() => setSel(items.map((t) => t._id))}>
            Select all
          </Button>
        </div>
      </>
    );
  }

  const ready = app.approvalItems.every((i) =>
    (typeOf(i.approvalTypeId)?.requiredDocuments ?? []).every((r) => {
      const d = i.documents.find((x) => x.docType === r.docType);
      return (!r.required || d) && d?.preValidationStatus !== "failed";
    }),
  );
  return (
    <>
      <PageHeader
        title="Upload documents"
        description={`Step 2 of 2 · Application ${app._id}. Files are checked instantly.`}
      />
      <div className="space-y-5">
        {app.approvalItems.map((i) => {
          const t = typeOf(i.approvalTypeId)!;
          return (
            <Card key={i._id}>
              <h2 className="font-semibold">{t.name}</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {t.department} · SLA {t.slaDays} days
              </p>
              <div className="space-y-4">
                {(t.requiredDocuments ?? []).map((r) => {
                  const doc = i.documents.find((d) => d.docType === r.docType);
                  return (
                    <DocumentUploadField
                      key={r.docType}
                      label={r.label}
                      required={r.required}
                      {...(doc ? { doc } : {})}
                      onFile={(f) => upload(i._id, r.docType, f)}
                    />
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button disabled={!ready || busy} onClick={submit}>
          Submit application
        </Button>
        {!ready && (
          <span className="text-sm text-muted-foreground">
            Upload all required documents and fix any errors to submit.
          </span>
        )}
        <Button variant="outline" asChild>
          <Link to="/app/applications/$id" params={{ id: app._id }}>
            Save as draft
          </Link>
        </Button>
      </div>
    </>
  );
}
