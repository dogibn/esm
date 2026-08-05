import { asc, count, eq, sql } from "drizzle-orm";

import { db } from "@/db/index";
import { operations, users, type User } from "@/db/schema";
import { recordOperation } from "@/features/history";
import { HttpError } from "@/lib/errors";

import type { CreateUserInput, UpdateUserInput, UserRole } from "./schemas";
import { strings } from "./strings";

// One row of the Users and access table. Serializable: dates go over the wire
// as ISO strings, matching how the other admin views hand rows to the client.
export type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  /** Recorded actions by this user — what would be orphaned by a delete. */
  operationCount: number;
};

/**
 * Every allowlist row, active first, then alphabetical. Small table (a handful
 * of staff), so the operation counts come from one grouped join rather than a
 * per-row query.
 */
export async function listUsers(): Promise<UserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      operationCount: count(operations.id),
    })
    .from(users)
    .leftJoin(operations, eq(operations.actorUserId, users.id))
    .groupBy(users.id)
    .orderBy(sql`${users.isActive} DESC`, asc(users.email));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role as UserRole,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    operationCount: Number(r.operationCount),
  }));
}

/**
 * Grant access to an email address.
 *
 * The row IS the grant: lib/auth.ts authorizes by looking the session email up
 * here, so nothing needs to be created on the Supabase side. The person signs
 * in with Google and is through on the first attempt. Password sign-in still
 * needs a Supabase Auth user, which `pnpm provision:users` creates.
 *
 * Re-adding an address that was previously revoked reactivates the existing
 * row instead of failing, so the person keeps their history.
 */
export async function createUser(
  actor: User,
  input: CreateUserInput,
): Promise<UserRow> {
  const existing = await findByEmail(input.email);

  if (existing && existing.isActive) {
    throw new HttpError(409, strings.errors.duplicate(input.email));
  }

  const row = await db.transaction(async (tx) => {
    const [saved] = existing
      ? await tx
          .update(users)
          .set({ role: input.role, isActive: true, updatedAt: new Date() })
          .where(eq(users.id, existing.id))
          .returning()
      : await tx
          .insert(users)
          .values({ email: input.email, role: input.role })
          .returning();

    await recordOperation(tx, {
      actorUserId: actor.id,
      kind: "user_access",
      summary: existing
        ? strings.audit.restored(input.email, input.role)
        : strings.audit.added(input.email, input.role),
      details: { targetUserId: saved!.id, email: input.email, role: input.role },
    });

    return saved!;
  });

  return { ...toRow(row), operationCount: existing ? await countOperations(row.id) : 0 };
}

/**
 * Change a user's role, revoke their access, or restore it.
 *
 * Two self-inflicted footguns are refused outright, because either one locks
 * the school out of its own admin screens:
 *   - an admin revoking their own access;
 *   - removing the last active admin (by demotion or revocation).
 */
export async function updateUser(
  actor: User,
  id: string,
  input: UpdateUserInput,
): Promise<UserRow> {
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new HttpError(404, strings.errors.notFound);

  const nextRole = input.role ?? (target.role as UserRole);
  const nextActive = input.isActive ?? target.isActive;

  if (target.id === actor.id && !nextActive) {
    throw new HttpError(400, strings.errors.selfRevoke);
  }
  if (target.id === actor.id && nextRole !== "admin") {
    throw new HttpError(400, strings.errors.selfDemote);
  }

  // Only worth checking when this change removes an active admin.
  const losesAdmin =
    target.role === "admin" && target.isActive && (nextRole !== "admin" || !nextActive);
  if (losesAdmin && (await countActiveAdmins()) <= 1) {
    throw new HttpError(400, strings.errors.lastAdmin);
  }

  const row = await db.transaction(async (tx) => {
    const [saved] = await tx
      .update(users)
      .set({ role: nextRole, isActive: nextActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    await recordOperation(tx, {
      actorUserId: actor.id,
      kind: "user_access",
      summary: summarize(target.email, {
        roleChanged: nextRole !== target.role ? nextRole : null,
        activeChanged: nextActive !== target.isActive ? nextActive : null,
      }),
      details: {
        targetUserId: id,
        email: target.email,
        from: { role: target.role, isActive: target.isActive },
        to: { role: nextRole, isActive: nextActive },
      },
    });

    return saved!;
  });

  return { ...toRow(row), operationCount: await countOperations(id) };
}

function summarize(
  email: string,
  change: { roleChanged: UserRole | null; activeChanged: boolean | null },
): string {
  const parts: string[] = [];
  if (change.activeChanged === false) parts.push(strings.audit.revoked(email));
  if (change.activeChanged === true) parts.push(strings.audit.reactivated(email));
  if (change.roleChanged) parts.push(strings.audit.roleChanged(email, change.roleChanged));
  return parts.join(" ") || strings.audit.noChange(email);
}

async function findByEmail(email: string) {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

async function countActiveAdmins(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(sql`${users.role} = 'admin' AND ${users.isActive} = TRUE`);
  return Number(row?.value ?? 0);
}

async function countOperations(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(operations)
    .where(eq(operations.actorUserId, userId));
  return Number(row?.value ?? 0);
}

function toRow(r: User): Omit<UserRow, "operationCount"> {
  return {
    id: r.id,
    email: r.email,
    role: r.role as UserRole,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  };
}
