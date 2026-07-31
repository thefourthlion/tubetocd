"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { login } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Signed in");
      router.push("/home");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell width="sm">
      <PageHeader
        align="center"
        eyebrow="Welcome back"
        title="Log in"
        description="Access your TubeToCD library and keep downloads in sync."
      />

      <Panel className="animate-fade-up-delay-1">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <form className="flex w-full flex-col gap-3.5" onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Your password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" fullWidth size="lg" loading={loading}>
            Log in
          </Button>
          <Button
            type="button"
            fullWidth
            variant="outline"
            onClick={() => toast.error("Google sign-in is not available")}
          >
            Continue with Google
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/pages/register" className="u-link font-medium">
              Sign up
            </Link>
          </p>
        </form>
      </Panel>
    </PageShell>
  );
}
