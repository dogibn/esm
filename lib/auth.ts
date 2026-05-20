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

  const rows = await db.select().from(users).where(eq(users.id, data.user.id)).limit(1);

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

  const rows = await db.select().from(users).where(eq(users.id, data.user.id)).limit(1);
  if (rows.length === 0) {
    redirect('/login');
  }

  return rows[0]!;
}
