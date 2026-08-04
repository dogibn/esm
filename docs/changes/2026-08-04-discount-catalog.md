# Change note — Discount catalog + compounding discounts

**Date:** 2026-08-04
**Branch:** `claude/sibling-discount-sibling-field-5jgzmw`
**Commits:** two — (1) data model + calc engine + catalog; (2) form rework + docs.

## What this adds

1. **A discount catalog** (`discount_types`): admins define reusable tuition
   discounts — a name, a unit (**flat MNT** or **percent**), a fixed value or
   **"custom"** (entered when applied), and a note. Viewable by all
   accountants; only admins can add/edit (new `/discounts` page).
2. **Applying discounts** is now "pick from the catalog" instead of free text.
   Multiple discounts **compound in row order** onto the base tuition — a
   percent lower in the list is taken off the already-reduced amount. Order is
   editable (move up/down), with a live preview of each reduction and the net.

## ⚠️ Action items for you (don't miss these)

1. **Run the migration** — generated, not yet applied:
   ```bash
   pnpm db:migrate
   ```
   `drizzle/0005_bouncy_drax.sql` creates `discount_types`, adds
   `discount_type_id / unit / value / position` to `discounts`, and
   **backfills every existing discount** as flat MNT (`unit='mnt'`,
   `value=amount`, id-ordered `position`) before enforcing NOT NULL. Safe to
   run as-is; no manual data prep.

2. **Seed the catalog** — the catalog starts **empty**, and until it has at
   least one active type, the discount pickers in the New Contract form and
   tuition editor have nothing to offer (the "Add discount" button is
   disabled). As an **admin**, open **/discounts → Add discount** and create
   your real discounts, e.g.:
   - `Early-bird` — percent, value `10`
   - `Sibling` — percent or flat, your choice (name must contain "sibling" for
     the sibling-student link to appear)
   - `Scholarship` — flat MNT, value left **blank** (custom, entered per student)

   (No seed script ships for this: `discount_types.created_by` is a real admin
   user FK, so types are best created through the UI once an admin exists.)

3. **You need an admin user.** The catalog edit controls and mutation routes
   require `users.role = 'admin'`. If no admin exists yet, set one in the DB.

4. **No type regeneration needed.** Drizzle infers types from the schema.

## How it behaves (worth knowing)

- **Compounding** is the single source of truth in `features/discounts/calc.ts`
  (`computeTuition`): each discount reduces the running total in `position`
  order; percents round half-up to whole MNT; tuition never goes negative.
- Each discount row **snapshots** its `unit`/`value`/`name` and the **resolved
  MNT reduction** (`amount`). The balance formula stays `SUM(amount)`, so the
  tracking list and balances were untouched.
- **Percents don't silently drift**: base tuition and discounts are always
  edited together, and the snapshot is recomputed on every save.
- **Legacy discounts** (loaded before the catalog) have
  `discount_type_id = NULL`; they show as read-only "legacy" rows in the
  tuition editor and are preserved unchanged on save (a passthrough path). New
  discounts always come from the catalog.
- **Sibling link** still works: it appears when the chosen type's name contains
  "sibling".

## Files added

| File | Purpose |
|---|---|
| `drizzle/0005_bouncy_drax.sql` + `meta/0005_snapshot.json` | Migration + backfill |
| `features/discounts/calc.ts` + `calc.test.ts` | Compounding engine + tests |
| `features/discounts/{api,schemas,strings,index}.ts` | Catalog CRUD, apply-time resolver |
| `features/discounts/components/{DiscountsView,DiscountTypeDialog}.tsx` | Admin UI |
| `app/(app)/discounts/page.tsx` | Catalog page (view all, edit admin-only) |
| `app/api/discount-types/route.ts`, `[id]/route.ts` | List (all) + create/update (admin) |
| `docs/changes/2026-08-04-discount-catalog.md` | This note |

## Files modified (highlights)

| File | Change |
|---|---|
| `db/schema.ts`, `db/relations.ts` | `discount_types` table; new discount columns |
| `features/enrollments/{api,schemas,strings,types}.ts` | Catalog-based apply; compounding; context carries active types |
| `features/enrollments/components/EnrollmentForm.tsx` | Catalog picker, custom value, ordering, live preview |
| `features/students/{api,schemas,detail,strings}.ts` | Resolver + compounding in `updateTuition`; detail exposes unit/value/order + active types |
| `features/students/components/detail/TuitionBreakdownCard.tsx` | Catalog picker, ordering, legacy passthrough, compounding preview |
| `app/(app)/layout.tsx`, `app/strings.ts` | "Discounts" nav entry |
| `docs/{domain_model,schema,user_flows,README}.md` | DiscountType entity, catalog flow, compounding balance note |

## Verification done

- `pnpm exec tsc --noEmit` — clean
- `pnpm test` — 149 passed (7 calc-engine cases + updated enrollment schema cases)
- `pnpm lint` — 0 errors (14 pre-existing warnings, untouched files)
- `pnpm build` — compiled successfully; all routes incl. `/discounts` build; no
  client/server bundling issues (pure calc imported from its module, not the barrel)
