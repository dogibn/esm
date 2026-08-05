/**
 * Layout/server-component variant of requireUser ...
 *
 * NOT currently wired in. The (app) layout does a bare getUser() session
 * check only. The users-row check below is intentionally deferred — API
 * routes' requireUser() already enforces it (403 on missing row), so a
 * deactivated user's session degrades to empty data rather than rendering
 * a usable shell. Swap the layout's inline getUser() for this call when
 * shell-level bounce-on-deactivation becomes worth the extra query.
 */
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient as supabaseCreateServerClient } from '@supabase/ssr';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { HttpError } from '@/lib/errors';

type User = InferSelectModel<typeof users>;

export async function requireUser(req: Request): Promise<{ user: User; applyAuthCookies: (h: Headers) => void }> {
  const { client, applyToHeaders } = createServerClient(req);
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  // Authorize by email against the `users` allowlist. This is the single gate
  // for BOTH sign-in methods: a password identity and a Google identity for the
  // same address both resolve to the same allowlist row. A verified Supabase
  // session with an email that isn't on the allowlist gets 403 — that's how
  // "Google sign-in" stays restricted to ESM staff and never becomes open
  // signup. Emails are stored/compared lowercased.
  const email = data.user.email?.toLowerCase();
  if (!email) {
    throw new HttpError(403, 'Forbidden');
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (rows.length === 0) {
    throw new HttpError(403, 'Forbidden');
  }

  return { user: rows[0]!, applyAuthCookies: applyToHeaders };
}

export async function requireAdmin(req: Request): Promise<{ user: User; applyAuthCookies: (h: Headers) => void }> {
  const { user, applyAuthCookies } = await requireUser(req);

  if (user.role !== 'admin') {
    throw new HttpError(403, 'Forbidden');
  }

  return { user, applyAuthCookies };
}

/**
 * Layout/server-component variant of requireUser. Reads the session from
 * next/headers cookies and redirects to /login on failure. API route
 * handlers should keep using requireUser() above.
 */
export async function requireUserForLayout(): Promise<User> {
  return (await resolveLayoutSession()).user;
}

/**
 * Like requireUserForLayout, but also carries the display bits that only the
 * Supabase identity knows: the name and avatar Google hands back on OAuth
 * sign-in. The `users` allowlist row has no name column (see db/schema.ts), so
 * password-only accounts fall back to null here and the UI derives initials
 * from the email.
 */
export type LayoutUserProfile = {
  user: User;
  displayName: string | null;
  avatarUrl: string | null;
};

export async function requireUserProfileForLayout(): Promise<LayoutUserProfile> {
  const { user, metadata } = await resolveLayoutSession();

  const str = (key: string): string | null => {
    const value = metadata[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
  };

  return {
    user,
    displayName: str('full_name') ?? str('name'),
    avatarUrl: str('avatar_url') ?? str('picture'),
  };
}

async function resolveLayoutSession(): Promise<{
  user: User;
  metadata: Record<string, unknown>;
}> {
  const cookieStore = await cookies();
  const client = supabaseCreateServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const cookie of cookiesToSet) {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            }
          } catch {
            // Server Component render: setting cookies is a no-op here.
            // The middleware/route handlers handle session refresh.
          }
        },
      },
    }
  );

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    redirect('/login');
  }

  // Same email allowlist as requireUser() (see there for rationale).
  const email = data.user.email?.toLowerCase();
  if (!email) {
    redirect('/login');
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (rows.length === 0) {
    // Authenticated (e.g. via Google) but not on the allowlist. Carry a reason
    // so the login page can explain the bounce instead of looping silently.
    redirect('/login?error=not_authorized');
  }

  return { user: rows[0]!, metadata: data.user.user_metadata ?? {} };
}
