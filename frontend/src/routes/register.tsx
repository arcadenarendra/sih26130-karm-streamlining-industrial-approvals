import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLayout, Field, inputCls } from "@/components/karm/AuthLayout";
import { api, errorMessage, fieldErrors } from "@/api/client";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — KARM" },
      { name: "description", content: "Register as an entrepreneur on KARM." },
      { property: "og:title", content: "Create account — KARM" },
      { property: "og:description", content: "Register as an entrepreneur on KARM." },
    ],
  }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrs({});
    try {
      await api.auth.register(f);
      toast.success("Account created. Please sign in.");
      navigate({ to: "/login" });
    } catch (x) {
      setErrs(fieldErrors(x));
      toast.error(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  const input = (k: keyof typeof f, type = "text") => (
    <input
      id={k}
      type={type}
      className={inputCls}
      value={f[k]}
      aria-invalid={!!errs[k]}
      aria-describedby={errs[k] ? `${k}-error` : undefined}
      onChange={(e) => setF({ ...f, [k]: e.target.value })}
    />
  );
  return (
    <AuthLayout
      title="Create applicant account"
      subtitle="For entrepreneurs and business owners. Officer accounts are provisioned by an admin."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="name" label="Full name" {...(errs["name"] ? { error: errs["name"] } : {})}>
          {input("name")}
        </Field>
        <Field id="email" label="Email" {...(errs["email"] ? { error: errs["email"] } : {})}>
          {input("email", "email")}
        </Field>
        <Field
          id="password"
          label="Password"
          hint="At least 8 characters"
          {...(errs["password"] ? { error: errs["password"] } : {})}
        >
          {input("password", "password")}
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          Create account
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link to="/login" className="text-primary underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
