import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthLayout, Field, inputCls } from "@/components/karm/AuthLayout";
import { useAuth, homeFor } from "@/lib/auth";
import { errorMessage } from "@/api/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — KARM" },
      { name: "description", content: "Sign in to KARM to track industrial approvals." },
      { property: "og:title", content: "Sign in — KARM" },
      { property: "og:description", content: "Sign in to KARM to track industrial approvals." },
    ],
  }),
  component: Login,
});

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const u = await login(email, password);
      navigate({ to: homeFor(u.role) });
    } catch (x) {
      setErr(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout title="Sign in" subtitle="Use your registered account to continue.">
      <form onSubmit={submit} className="space-y-4">
        <Field id="email" label="Email">
          <input
            id="email"
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field id="password" label="Password" {...(err ? { error: err } : {})}>
          <input
            id="password"
            type="password"
            className={inputCls}
            value={password}
            aria-invalid={!!err}
            aria-describedby={err ? "password-error" : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          Sign in
        </Button>
        <div className="flex justify-between text-sm">
          <Link to="/register" className="text-primary underline">
            Create account
          </Link>
          <Link to="/forgot-password" className="text-primary underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
