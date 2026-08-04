import { NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase";

/**
 * Google OAuth callback. Supabase redirects here with a `code` after the user
 * authenticates with Google; we exchange it for a session, set the auth
 * cookies, and land the user on the tracking view.
 *
 * Authorization is NOT decided here — establishing a session only proves the
 * person controls that Google account. Whether they're allowed into the app is
 * enforced downstream by the email allowlist in requireUser()/the (app) layout:
 * an email that isn't a `users` row degrades to /login (layout) or 403 (API).
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    const to = new URL("/login", url.origin);
    to.searchParams.set("error", errorDescription);
    return NextResponse.redirect(to);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const { client, applyToHeaders } = createServerClient(req);
  const { error } = await client.auth.exchangeCodeForSession(code);

  if (error) {
    const to = new URL("/login", url.origin);
    to.searchParams.set("error", error.message);
    const res = NextResponse.redirect(to);
    applyToHeaders(res.headers);
    return res;
  }

  const res = NextResponse.redirect(new URL("/students", url.origin));
  applyToHeaders(res.headers);
  return res;
}
