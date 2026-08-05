/**
 * One-time (idempotent) user provisioning for the ESM Payment Tracker.
 *
 * The `users` table is the access allowlist: only emails with a row here can
 * sign in (see lib/auth.ts). This script seeds that allowlist and, for staff
 * who use a password, creates the matching Supabase Auth user.
 *
 * Because authorization is by email, ONE allowlist row covers both sign-in
 * methods for a person:
 *   - Google:   they click "Continue with Google"; Supabase creates/links the
 *               auth user on first login. Nothing to create here — the row is
 *               enough. (Set "password": false for Google-only staff.)
 *   - Password: this script creates the Supabase Auth user with a temporary
 *               password (printed once below) that they change via Supabase's
 *               reset-password email.
 * With Supabase's default "link identities with the same email" on, a person
 * can use BOTH against the same account.
 *
 * Input: a JSON array at scripts/data/users.json (gitignored — real emails),
 * override with USERS_FILE=/path. See scripts/users.example.json for the shape.
 *
 * Usage:
 *   pnpm provision:users
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";

import { db } from "@/db/index";
import { users } from "@/db/schema";

type Role = "admin" | "accountant";
interface AllowlistEntry {
  email: string;
  role: Role;
  /** Create a password Supabase Auth user? Default true. false = Google-only. */
  password?: boolean;
}

function loadAllowlist(): AllowlistEntry[] {
  const path = resolve(
    process.cwd(),
    process.env["USERS_FILE"] ?? "scripts/data/users.json",
  );
  const parsed = JSON.parse(readFileSync(path, "utf-8"));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${path} is empty or not a JSON array.`);
  }
  return parsed.map((e: AllowlistEntry) => {
    const email = String(e.email).trim().toLowerCase();
    if (!email.includes("@")) throw new Error(`Invalid email: ${e.email}`);
    if (e.role !== "admin" && e.role !== "accountant") {
      throw new Error(`Invalid role for ${email}: ${e.role}`);
    }
    return { email, role: e.role, password: e.password ?? true };
  });
}

function tempPassword(): string {
  // 24 url-safe chars; the user resets it on first sign-in.
  return randomBytes(18).toString("base64url");
}

/**
 * Built on first use, not up front. Only password users need it, and
 * constructing a Supabase client pulls in RealtimeClient, which requires a
 * global WebSocket that Node < 22 doesn't provide. A Google-only allowlist
 * (every entry "password": false) must not depend on that.
 */
let adminClient: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRole = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceRole) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }
  adminClient = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

async function main(): Promise<void> {
  const allowlist = loadAllowlist();
  console.log(`Provisioning ${allowlist.length} user(s)...\n`);

  for (const entry of allowlist) {
    // 1. Allowlist row (the authorization gate). Idempotent on email.
    //
    // `is_active` is deliberately NOT reset here. An admin who revoked this
    // person on the Users and access screen made a decision the script has no
    // business quietly undoing — re-running provisioning must never re-grant
    // access. The row is reported below instead, so it isn't invisible either.
    const [row] = await db
      .insert(users)
      .values({ email: entry.email, role: entry.role })
      .onConflictDoUpdate({
        target: users.email,
        set: { role: sql`excluded.role`, updatedAt: new Date() },
      })
      .returning({ isActive: users.isActive });

    if (row && !row.isActive) {
      console.log(
        `  ${entry.email} [${entry.role}] — role set, but access is REVOKED.` +
          " Restore it on the Users and access screen if that's wrong.",
      );
      continue;
    }

    // 2. Password auth user, if requested.
    if (!entry.password) {
      console.log(`  ${entry.email} [${entry.role}] — allowlisted (Google-only)`);
      continue;
    }

    const password = tempPassword();
    const { error } = await getAdmin().auth.admin.createUser({
      email: entry.email,
      password,
      email_confirm: true,
    });

    if (!error) {
      console.log(
        `  ${entry.email} [${entry.role}] — created. Temp password: ${password}`,
      );
    } else if (/already.*registered|exists/i.test(error.message)) {
      console.log(
        `  ${entry.email} [${entry.role}] — allowlisted (auth user already exists, password unchanged)`,
      );
    } else {
      console.error(`  ${entry.email} — auth create FAILED: ${error.message}`);
    }
  }

  console.log(
    "\nDone. Share each temp password with its owner over a secure channel;" +
      " they should reset it via the Supabase password-reset email.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
