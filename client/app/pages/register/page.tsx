"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { register } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await register(email, password);
      toast.success("Account created");
      router.push("/home");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
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
        eyebrow="Get started"
        title="Create account"
        description="Save playlists and channels on TubeToCD — re-download anytime."
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
            placeholder="At least 6 characters"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Confirm password"
            type="password"
            placeholder="Repeat password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button type="submit" fullWidth size="lg" loading={loading}>
            {loading ? "Creating…" : "Create account"}
          </Button>
          <div className="relative my-1 text-center">
            <span className="relative z-10 bg-card px-2 text-xs text-muted-foreground">
              or
            </span>
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
          </div>
          <Button
            type="button"
            fullWidth
            variant="outline"
            onClick={() => toast.error("Google sign-in is not available")}
          >
            Continue with Google
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/pages/login" className="u-link font-medium">
              Log in
            </Link>
          </p>
        </form>
      </Panel>
    </PageShell>
  );
}
