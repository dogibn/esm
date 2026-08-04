# ESM Payment Tracker

## What this is
A web application for tracking student payments at English School of Mongolia (~1000 students). Replaces the current Excel-based workflow with bank-transaction import and a faster way to view payment status across the school.

## Who uses it
Five accountants at ESM. One admin manages fee structures; the other four record and review payments. Internal tool — no parent or student access.

## v1 scope
- **Tracking view.** All students with current outstanding balance, filterable by grade and payment status, with global search.
- **Bank transaction import.** Upload a bank Excel file, review proposed matches to students, correct mismatches, confirm.
- **Year/term-start scripts** (admin only, run from CLI). Pull roster, classes, and club enrollments from esmlh.edu.mn.

## Not in v1
- Per-student detail page
- Adding/editing fee structures, students, or enrollments through the UI
- Printing or sending invoices
- Discount rule engine (v1 records discount amounts, not the formulas behind them)
- Family / siblings modeling
- Refunds

## Non-goals
- Not a general accounting system. Tracks student payments only — no salaries, vendor payments, or expenses.
- Doesn't process payments. Records what happened at the bank; funds never move through this app.
- Not a parent or student portal.
- Single-tenant for ESM.

## Documentation
- `domain_model.md` — entities, lifecycle, decisions
- `schema.md` — DB tables, columns, constraints
- `tech_stack.md` — frameworks, conventions, folder structure
- `scraping_esmlh.md` — esmlh.edu.mn data import
- `user_flows.md` — UI workflows
- `history_and_reversibility.md` — activity log, undo window, History view, roles
- `import_matching_plan.md` — bank-import matching pipeline: what changed and why
- `deployment.md` — deploy & operations runbook (env, migrations, backups, users)
- `CLAUDE.md` — AI entry point

## Running locally

1. **Install:** `pnpm install` (Node 20 LTS).
2. **Env:** copy `.env.local.example` to `.env.local` and fill in the Supabase
   values (see `deployment.md` §1 for what each var is).
3. **Migrate:** `pnpm drizzle-kit migrate` applies the schema to your DB.
4. **Seed / load data:** `pnpm seed`, then the `load:*` scripts as needed
   (see `deployment.md` §3 for order).
5. **Users:** create `scripts/data/users.json` from `scripts/users.example.json`
   and run `pnpm provision:users` to allowlist yourself.
6. **Run:** `pnpm dev` → http://localhost:3000.
7. **Test:** `pnpm test`.

## Deploying

See `deployment.md` for the full runbook and the per-deploy checklist.
