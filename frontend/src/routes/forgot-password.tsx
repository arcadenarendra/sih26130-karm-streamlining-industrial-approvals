import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthLayout, Field, inputCls } from "@/components/karm/AuthLayout";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — KARM" },
      { name: "description", content: "Request a KARM password reset." },
      { property: "og:title", content: "Reset password — KARM" },
      { property: "og:description", content: "Request a KARM password reset." },
    ],
  }),
  component: Forgot,
});

// NEEDS DECISION: reset flow/backend contract TBD — this screen is a stub.
function Forgot() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setErr("Enter a valid email");
      return;
    }
    setSent(true);
  };
  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a reset link.">
      {sent ? (
        <p className="text-sm">
          If an account exists for <b>{email}</b>, a reset link will be sent.{" "}
          <Link to="/login" className="text-primary underline">
            Back to sign in
          </Link>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="email" label="Email" {...(err ? { error: err } : {})}>
            <input
              id="email"
              type="email"
              className={inputCls}
              value={email}
              aria-invalid={!!err}
              aria-describedby={err ? "email-error" : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                setErr("");
              }}
            />
          </Field>
          <Button type="submit" className="w-full">
            Send reset link
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="text-primary underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
