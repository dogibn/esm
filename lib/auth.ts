import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase';
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
