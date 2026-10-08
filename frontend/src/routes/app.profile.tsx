import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/karm/AppShell";
import { Card, ErrorState, LoadingBlock, PageHeader } from "@/components/karm/states";
import { Field, inputCls } from "@/components/karm/AuthLayout";
import { Button } from "@/components/ui/button";
import { api, ApiError, errorMessage, fieldErrors } from "@/api/client";
import { PROJECT_SIZES, SECTORS, STAGES, STATES } from "@/api/fixtures";

export const Route = createFileRoute("/app/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Business profile — KARM" },
      {
        name: "description",
        content: "Tell us about your business to get a personalised approval checklist.",
      },
      { property: "og:title", content: "Business profile — KARM" },
      {
        property: "og:description",
        content: "Tell us about your business to get a personalised approval checklist.",
      },
    ],
  }),
  component: () => (
    <RoleGuard roles={["applicant"]}>
      <Profile />
    </RoleGuard>
  ),
});

const empty = { businessName: "", sector: "", state: "", district: "", projectSize: "", stage: "" };

function Profile() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["profile"], queryFn: api.profile.get, retry: false });
  const missing = q.error instanceof ApiError && q.error.status === 404;
  const [f, setF] = useState(empty);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const p = q.data?.profile;
    if (p)
      setF({
        businessName: p.businessName,
        sector: p.sector,
        state: p.location.state,
        district: p.location.district,
        projectSize: p.projectSize,
        stage: p.stage,
      });
  }, [q.data]);
  if (q.isLoading) return <LoadingBlock rows={6} />;
  if (q.isError && !missing) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrs({});
    const body = {
      businessName: f.businessName,
      sector: f.sector,
      location: { state: f.state, district: f.district },
      projectSize: f.projectSize,
      stage: f.stage,
    };
    try {
      missing ? await api.profile.create(body) : await api.profile.update(body);
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["checklist"] });
      if (missing) navigate({ to: "/app/checklist" });
    } catch (x) {
      setErrs(fieldErrors(x));
      toast.error(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  const err = (k: string) => (errs[k] ? { error: errs[k] } : {});
  const aria = (k: string) => ({
    "aria-invalid": !!errs[k],
    "aria-describedby": errs[k] ? `${k}-error` : undefined,
  });
  const select = (id: string, k: keyof typeof f, opts: string[]) => (
    <select
      id={id}
      className={inputCls}
      value={f[k]}
      {...aria(id)}
      onChange={(e) => setF({ ...f, [k]: e.target.value })}
    >
      <option value="">Select…</option>
      {opts.map((o) => (
        <option key={o} value={o} className="capitalize">
          {o}
        </option>
      ))}
    </select>
  );
  return (
    <>
      <PageHeader
        title="Business profile"
        description={
          missing
            ? "Create your profile to generate your approval checklist."
            : "Changes update your checklist."
        }
      />
      <Card className="max-w-2xl">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="sm:col-span-2">
            <Field id="businessName" label="Business name" {...err("businessName")}>
              <input
                id="businessName"
                className={inputCls}
                value={f.businessName}
                {...aria("businessName")}
                onChange={(e) => setF({ ...f, businessName: e.target.value })}
              />
            </Field>
          </div>
          <Field id="sector" label="Sector" hint="Illustrative list" {...err("sector")}>
            {select("sector", "sector", SECTORS)}
          </Field>
          <Field id="projectSize" label="Project size" {...err("projectSize")}>
            {select("projectSize", "projectSize", PROJECT_SIZES)}
          </Field>
          <Field id="location.state" label="State" {...err("location.state")}>
            {select("location.state", "state", STATES)}
          </Field>
          <Field id="location.district" label="District" {...err("location.district")}>
            <input
              id="location.district"
              className={inputCls}
              value={f.district}
              {...aria("location.district")}
              onChange={(e) => setF({ ...f, district: e.target.value })}
            />
          </Field>
          <Field id="stage" label="Stage" {...err("stage")}>
            {select("stage", "stage", STAGES)}
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {missing ? "Create profile" : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
