# Deployment & operations

Pre-deployment runbook for the ESM Payment Tracker. Ordered so you can follow
it top-to-bottom the first time, then use the checklist at the end for every
later deploy.

Stack recap: Next.js on Vercel (Tokyo), Postgres on Supabase (Tokyo), Drizzle
migrations, Supabase Auth (Google + password).

---

## 1. Environment variables

Set these in Vercel → Project → Settings → Environment Variables, for the
**Production** environment (and Preview if you use branch deploys — but point
Preview at a *separate* database, never production).

| Var | Where it's used | Notes |
| --- | --- | --- |
| `DATABASE_URL` | app runtime | Pooled connection, port **6543** (pgBouncer). |
| `DIRECT_URL` | `drizzle-kit migrate` only | Direct connection, port **5432**. Not needed at runtime. |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server auth | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server auth | |
| `SUPABASE_SERVICE_ROLE_KEY` | server + provisioning script | **Server-only.** Never exposed to the browser. |
| `SENTRY_DSN` | server (optional) | Turns on error reporting. Leave unset to disable. |
| `SENTRY_AUTH_TOKEN` | build (optional) | Uploads source maps for readable stack traces. |

The app validates the required five at startup (`lib/env.ts`) and refuses to
boot if any is missing — a fast, obvious failure instead of a mysterious
runtime one.

---

## 2. Database migrations

Migrations are generated into `drizzle/` and committed to git. **They do NOT
run automatically on deploy.** Run them yourself against production, as a
deliberate step:

```bash
# with production DIRECT_URL in your environment
pnpm drizzle-kit migrate
```

Rules:
- **Back up first** (section 4). Always, even for "harmless" migrations.
- **Migrate before deploying** code that depends on the new schema.
- Follow **expand → contract**: add new columns/tables in one release, switch
  the code over, and only drop old ones in a *later* release. A re-deploy or
  rollback must never land on a schema that drops data the running code needs.
- Never edit an applied migration — generate a new one (`pnpm db:generate`).

### One-time gotcha: the charges uniqueness migration (`0004`)

`0004` adds unique indexes preventing duplicate charges. If production data
already contains duplicates, the migration **fails**. Check first:

```sql
-- year-scoped duplicates
SELECT student_id, academic_year_id, fee_name, count(*)
FROM charges WHERE academic_term_id IS NULL
GROUP BY 1,2,3 HAVING count(*) > 1;
-- term-scoped duplicates
SELECT student_id, academic_term_id, fee_name, count(*)
FROM charges WHERE academic_year_id IS NULL
GROUP BY 1,2,3 HAVING count(*) > 1;
```

Resolve any rows returned before running the migration. Applying it *before*
loading real data (section 3) sidesteps the problem entirely.

---

## 3. Initial data load

Run once against the production DB, in this order (see `schema.md` migration
order and the `load:*` scripts in `package.json`):

1. `pnpm seed` — reference tables (grade levels, years, terms, fee structures).
2. `pnpm load:students`, `load:grades`, `load:enrollments`, `load:missing-grades`
3. `pnpm load:charges-tuition`, `load:discounts`, `load:charges-tuition-overrides`
4. `pnpm load:after-clubs`, `load:club-enrollments`, `load:charges-clubs`
5. `pnpm load:charges-registration`
6. Verify: `pnpm qa:tuition-totals`.

The load scripts read from `scripts/data/` (gitignored) and use your
`.env.local`. Point `.env.local` at production **only** for this deliberate
one-time load, then switch it back.

---

## 4. Backups — do this before real data lands

Supabase's free tier does **not** give you a restore you'd want to bet payment
records on. Pick one before go-live:

- **Recommended:** upgrade Supabase to a tier with **PITR** (point-in-time
  recovery). One click, and any mistake is recoverable to the second.
- **Free-tier stopgap:** a scheduled `pg_dump` to off-Supabase storage (e.g. a
  daily GitHub Action using `DIRECT_URL`). Better than nothing, but you lose
  everything since the last dump.

Also: **back up immediately before every migration** (section 2). A manual
`pg_dump` takes seconds and has saved many a deploy.

Recovery notes already built in:
- Bank files aren't stored, but re-uploading a file re-inserts its rows
  (dedup by `transaction_id`) — safe recovery for a mistaken transaction
  delete.
- Payment writes are transactional and guarded against double-submit
  (`features/imports/api.ts`).

---

## 5. Authentication & user provisioning

Access is an **email allowlist**: only emails with a row in the `users` table
can sign in (`lib/auth.ts`). This single gate covers both sign-in methods.

### One-time: enable Google sign-in

1. Google Cloud Console → create an **OAuth 2.0 Client ID** (Web application).
   Authorized redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Providers → **Google** → paste the client ID and
   secret, enable.
3. Supabase → Authentication → URL Configuration → set **Site URL** to your
   production domain and add it to **Redirect URLs** (the app redirects to
   `https://<domain>/auth/callback`).
4. Keep "link identities with the same email" **on** (Supabase default) so a
   person can use Google and password against one account.

### Provision the staff (allowlist + password users)

1. Create `scripts/data/users.json` (gitignored) from
   `scripts/users.example.json`. Set `role` (`admin`/`accountant`) and
   `password` per person (`true` = also create a password login, `false` =
   Google-only).
2. Run:

   ```bash
   pnpm provision:users
   ```

   It's idempotent. For each new password user it prints a one-time temporary
   password — share it over a secure channel; the user resets it via Supabase's
   password-reset email. Google-only users just get their allowlist row and
   sign in with "Continue with Google".

To add someone later: add a line to `users.json` and re-run. To revoke access:
delete their `users` row (they immediately drop to 403 / login bounce).

---

## 6. Error monitoring

Unexpected 500s are logged server-side with a request context and a unique
`errorId` (returned to the client so an accountant can quote it). To get
alerts and stack traces:

1. Create a Sentry project (free tier), copy the DSN.
2. Set `SENTRY_DSN` (and optionally `SENTRY_AUTH_TOKEN` for source maps) in
   Vercel.

With no DSN set, monitoring is off and the app is unaffected — errors still go
to Vercel's function logs (note: hobby-tier logs are short-lived and not
alertable, which is exactly why Sentry is worth the 15 minutes).

---

## 7. Iterating & re-deploying

- Push to the branch Vercel builds from; Vercel builds and deploys.
- **Gate every deploy** on a green `pnpm build` and `pnpm test` (139 tests).
  Consider a tiny GitHub Action running both on push so a broken build never
  reaches production.
- If a release includes schema changes, run the migration (section 2) at the
  right point relative to the code deploy.
- Rollback: Vercel keeps previous deployments — promote the last good one. If
  the bad release migrated the DB, restore from backup / roll the schema
  forward with a new migration (never hand-edit history).

---

## Per-deploy checklist

- [ ] `pnpm test` and `pnpm build` green locally (or in CI).
- [ ] New migrations reviewed; **DB backed up**; migration run against prod at
      the right time (expand-before-contract).
- [ ] Env vars present for the target environment.
- [ ] Preview deploys are NOT pointed at the production database.
- [ ] Smoke test after deploy: sign in (Google + password), tracking view
      loads, upload → review → confirm a bank file.
