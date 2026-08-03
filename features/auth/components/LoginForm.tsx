"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserClient } from "@/lib/supabase-browser";

import { strings } from "../strings";

export function LoginForm() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Surface an error handed back by the OAuth callback / layout bounce
  // (?error=... on the login URL) without pulling in useSearchParams, which
  // would force a Suspense boundary on this otherwise-static page.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("error");
    if (!param) return;
    setError(
      param === "not_authorized" ? strings.login.notAllowed : param,
    );
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message || strings.login.genericError);
      return;
    }
    router.push("/students");
    router.refresh();
  }

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser navigates to Google; we only reach here on error.
    if (authError) {
      setGoogleLoading(false);
      setError(authError.message || strings.login.googleError);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        onClick={onGoogle}
        disabled={googleLoading || loading}
      >
        {strings.login.googleSubmit}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>{strings.login.divider}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>{strings.login.emailLabel}</span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder={strings.login.emailPlaceholder}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{strings.login.passwordLabel}</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        <Button type="submit" disabled={loading || googleLoading}>
          {loading ? strings.login.submitting : strings.login.submit}
        </Button>
      </form>
    </div>
  );
}
