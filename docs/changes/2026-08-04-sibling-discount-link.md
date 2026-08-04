# Change note — Sibling link on sibling discounts

**Date:** 2026-08-04
**Branch:** `claude/sibling-discount-sibling-field-5jgzmw`

## What this adds

A sibling discount can now record **which student it pairs with**, and the
student detail page shows who that sibling is **and whether they're currently
enrolled** — the condition a sibling discount depends on.

- New nullable column `discounts.sibling_student_id` → `students.id`
  (`ON DELETE SET NULL`). Populated only for sibling discounts; NULL for every
  other discount.
- References the **Student**, not their Enrollment, so the link is stable
  across years and "enrolled this year?" is resolved live at read time.

## ⚠️ Action items for you (don't miss these)

1. **Run the migration.** The schema change is generated but **not applied to
   any database yet**:
   ```bash
   pnpm db:migrate
   ```
   New file: `drizzle/0004_real_stark_industries.sql` (adds the column, its
   FK, and an index). Requires `DIRECT_URL` in `.env.local` as usual.
   (If you prefer applying via Supabase directly, the SQL in that file is
   plain `ALTER TABLE` — safe to run as-is.)

2. **No data backfill needed.** Every existing discount row gets
   `sibling_student_id = NULL` automatically. Nothing breaks; sibling info is
   simply blank until someone links it.

3. **No type regeneration needed.** The app uses Drizzle's inferred types
   (`typeof discounts.$inferSelect`), so `Discount`/`NewDiscount` pick up the
   new field automatically once the schema is saved. Nothing to run.

## How it behaves (worth knowing)

- The sibling picker appears on a discount row **only when the reason reads as
  a sibling discount** — matched by name (`/sibling/i`), since there's no
  discount-type enum in v1. Rename a row away from "sibling" and the picker
  hides; the link is also stripped on save so no stray pointer is kept.
- A discount **can't link a student to themselves** — enforced server-side in
  both write paths.
- Read view shows `Sibling: <name>` with a green **Enrolled this year** or
  amber **Not enrolled this year** badge (active enrollment in the current
  academic year).
- Sibling links are **not imported from esmlh** — they're set manually in the
  New Contract form or the tuition editor. (`scraping_esmlh.md` already lists
  "Discount data" as manually supplied.)

## Files added

| File | Purpose |
|---|---|
| `drizzle/0004_real_stark_industries.sql` | Migration: add column + FK + index |
| `drizzle/meta/0004_snapshot.json` | Drizzle snapshot (auto-generated) |
| `docs/changes/2026-08-04-sibling-discount-link.md` | This note |

## Files modified

| File | Change |
|---|---|
| `db/schema.ts` | `siblingStudentId` column + index on `discounts` |
| `db/relations.ts` | self-referential `sibling` / `siblingDiscounts` relations |
| `features/enrollments/schemas.ts` | `siblingStudentId` on `discountInputSchema` |
| `features/enrollments/api.ts` | persist link in `createEnrollment` (drops self-links) |
| `features/enrollments/components/EnrollmentForm.tsx` | sibling picker on sibling rows |
| `features/enrollments/strings.ts` | picker labels |
| `features/enrollments/schemas.test.ts` | 2 new cases |
| `features/students/schemas.ts` | `siblingStudentId` on tuition discount schema |
| `features/students/api.ts` | persist link in `updateTuition` (drops self-links) |
| `features/students/detail.ts` | resolve sibling name + enrolled status; expose `siblingCandidates`; `DiscountLine`/`SiblingOption` types |
| `features/students/index.ts` | export `SiblingOption` |
| `features/students/components/detail/TuitionBreakdownCard.tsx` | picker (edit) + name/badge (read) |
| `features/students/components/detail/StudentDetailView.tsx` | pass `siblingCandidates` through |
| `features/students/strings.ts` | display + picker labels |
| `docs/domain_model.md` | Discount entity + Family/siblings out-of-scope note |
| `docs/schema.md` | `discounts` table + ON DELETE note |
| `docs/README.md` | Family/siblings "Not in v1" line clarified |

## Verification done

- `pnpm exec tsc --noEmit` — clean
- `pnpm test` — 141 passed (incl. 2 new)
- `pnpm lint` — 0 errors (14 pre-existing warnings, all in untouched files)

## Pre-existing behavior left unchanged (not a regression)

- `updateTuition` still does not persist a discount's free-text `notes` when it
  rewrites the discount rows — it was already that way and the tuition editor
  doesn't capture `notes`. Left as-is to keep this change scoped.
