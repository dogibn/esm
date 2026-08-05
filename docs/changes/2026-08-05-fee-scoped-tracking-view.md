# Change note — Fee-scoped tracking view

**Date:** 2026-08-05
**Branch:** `claude/student-tracker-ui-redesign-ued84c`

## What this changes

The tracking view (`/students`) stops being a fee-as-columns matrix and becomes
a **fee-scoped table**: pick a fee, see the students who owe it.

- New tab row above the filter bar: *All fees | Tuition | Bus | Registration |
  Clubs*. Default **Tuition**. The selection lives in the URL (`?fee=bus`), so
  a view is linkable and survives a refresh.
- **Per-fee scopes** return only students who hold a charge for that fee. Bus,
  registration, and club charges apply to a minority of students, so those
  students now drop out of the result set instead of filling the table with em
  dashes.
- Columns are `ID | Student | Class | Due | Paid | Status | Last payment`.
  *Due* is gross minus applicable discounts (tuition only). *Paid* carries a
  hairline bar showing paid/due — success at 100%, warning part-way, bare track
  at zero. *Status* is derived (paid/partial/unpaid), never stored. *Last
  payment* is dated by `bank_transactions.transaction_at` — when the money
  moved — not `payments.recorded_at`.
- **All fees** is a rollup with the same columns
  (`Total due (year + current term)` / `Total paid`), not a matrix. The per-fee breakdown belongs on the student
  detail page, which a row click opens.
- Clubs folds a student's several club charges into one row. One row per
  student, always.
- Default sort is class, then surname — accountants work class by class.
- The two summary cards recompute for the selected fee scope.

Presentation only. **No migration, no `db/schema.ts` change, no new columns.**

## Action items for you

None. Nothing to run, nothing to backfill. `pnpm test` and `next build` pass as
they stand.

## Where things live now

- `features/students/schemas.ts` — `FEE_SCOPE_VALUES`, `feeScopeSchema`, and
  `fee` on `studentListParamsSchema`. One validated param, shared by the route
  handler and the UI.
- `features/students/balance.ts` — all the money and classification logic:
  `classifyFeeScope` / `chargeMatchesScope` (which tab a charge belongs to),
  `foldChargeTotals` (the clubs sum), `deriveFeeStatus` (the one status
  mapping, now shared with the detail page), `loadLastPaymentDates`.
- `features/students/api.ts` — `listStudents` assembles the DTO; it does no
  money math of its own.
- `components/ui/progress.tsx` — new primitive (Base UI `Progress`, CVA
  `size` / `tone`). It clamps `value` into `[min, max]`, because Base UI
  converts value to a width percentage without clamping and an overpaid charge
  would otherwise render past the track.
- `features/students/components/FeeScopeTabs.tsx` — the tab row.

## Worth knowing

- **The Progress primitive was hand-written, not pulled with the shadcn CLI.**
  `ui.shadcn.com` is blocked by the dev environment's network policy, so
  `shadcn add progress` cannot reach the registry. The file follows the same
  shape as the CLI's other output in this repo (`tabs.tsx`): Base UI behavior,
  CVA variants, `cn()`, `data-slot` attributes. If the registry becomes
  reachable, re-adding it via the CLI should be a near-no-op diff.
- **Sort is by grade level `sort_order`, then class name, then surname** —
  a plain alphabetical sort on class name would order `10A` before `2A`.
  Surname-unknown markers (`-`, `.`) still sort to the end of each class.
- **The all-fees total column names its scopes.** The advised label was
  "(year to date)", but the rollup adds year-scoped tuition/registration to the
  **current term's** bus/club charges — earlier terms' club charges are not in
  it — so the header reads "Total due (year + current term)". Same intent: the
  label must not imply one amount owed right now.
- **Card 1 is now labelled "Outstanding balance"** (it was "Total amount due").
  The value is unchanged — Σ balance — but the table now has a *Due* column
  meaning gross-minus-discounts, and two different things could not both be
  called "due". The collection rate is collected ÷ due within the scope.
- **The *All fees* rollup still lists students with no charges at all**, with
  an em-dash status. The roster stays complete in the one view that is about
  the student rather than about a fee.
- Query count per page load is fixed (year, term, roster, charges, payment
  sums, discount sums, last-payment dates) — no per-row lookups. Filtering and
  pagination stay in memory because both the fee scope and the status filter
  are derived from the balance formula rather than stored.
