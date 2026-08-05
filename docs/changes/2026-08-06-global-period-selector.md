# Global period selector (year + term)

**Status:** plan / awaiting decisions
**Date:** 2026-08-06

A single app-wide control in the top-right corner that picks an academic
**year** and **term**. Every page then reads its data for that period instead of
for whatever row happens to carry `is_current = true`. The academic calendar
page is deliberately exempt — it is the page that *manages* years and terms, so
it always shows all of them.

---

## 1. The problem this creates work for

Today "which period am I looking at?" is not a user choice. Nine service
functions independently run the same query:

```ts
.from(academicYears).where(eq(academicYears.isCurrent, true))
```

Call sites that hardcode the current period:

| File | What it scopes |
|---|---|
| `features/students/api.ts:91` (`listStudents`) | year for enrollments, term for charges |
| `features/students/api.ts:274` (`listFilterOptions`) | year |
| `features/students/api.ts:397` (`createCharge`) | year, and validates the term belongs to it |
| `features/students/api.ts:525` (`updateTuition`) | year |
| `features/students/detail.ts:163` (`getStudentDetail`) | year, then every term of that year |
| `features/classes/api.ts:53` (`listClasses`) | year — **already overridable** via `?year=` |
| `features/enrollments/api.ts` (`getEnrollmentFormContext`) | year |
| `features/fees/api.ts:127` (`listFeeRates`) | none — returns *all* terms' club rates |
| `features/imports/matching/load-context.ts` | year/term for the matching index |

There is also **no header bar** — `app/(app)/layout.tsx` says so explicitly, and
each page owns its own `<PageHeader>`. So "top right of every page" needs a new
shell slot, not an edit to nine page files.

---

## 2. Shape of the state

### Source of truth: a cookie, not the URL

`esm_period` = `"<yearId>:<termId>"`, or `"<yearId>:year"` for the whole-year
scope. Lax, 1 year, not http-only (the client widget reads it for first paint).

Why a cookie and not `?year=&term=`:

- The client views (`StudentsView`, `TransactionsView`, `HistoryView`, …) fetch
  their own pages from `/api/*` with `credentials: "include"`. A cookie rides
  along automatically; a URL param would have to be threaded into every fetch
  and every `<Link>` in the sidebar.
- It survives navigation between pages, which is the whole point of a *global*
  selector.
- Server components already read cookies (auth), so nothing gets less cacheable.

Trade-off worth naming: a pasted URL no longer reproduces exactly what the
sender saw. Given 5 internal users this is acceptable; if it stops being so, a
`?period=` override that *seeds* the cookie is an additive change.

### Resolution

New pure + data module `features/calendar/period.ts`:

```ts
export type Period = {
  yearId: number;
  yearName: string;
  /** null = whole-year scope (no term narrowing). */
  termId: number | null;
  termName: string | null;
  startDate: string;          // YYYY-MM-DD, for date-ranged pages
  endDate: string;
  /** False when the user is browsing away from the school's current period. */
  isCurrent: boolean;
};

/** Cookie → validated Period, falling back to is_current. One query. */
export async function resolvePeriod(): Promise<Period>;

/** Years + terms for the picker. Light: two selects, no usage counts. */
export async function listPeriodOptions(): Promise<PeriodOptions>;
```

`resolvePeriod()` validates the cookie against the DB every time — a deleted or
renamed year must not wedge the app — and silently falls back to
`is_current` when the cookie names something that no longer exists.

**Do not reuse `listAcademicCalendar()`** for the picker: it is 8 grouped
queries computing per-row usage counts for the delete guards. The picker needs
two `SELECT id, name`s.

### Threading it through

Every service function listed in §1 grows an explicit `period: Period` (or
`yearId`/`termId`) parameter. **No service function reads the cookie itself** —
that keeps `features/*/api.ts` testable and honest about its inputs, matching
the existing "route handlers orchestrate, services compute" rule in
`tech_stack.md` §3. Route handlers and server pages call `resolvePeriod()` and
pass the result down.

### Re-rendering after a change

The widget writes the cookie, then `router.refresh()`. Server components
re-render — but client views seed `useState` from `initialData` and would keep
showing stale rows. Fix at the page level, one line each:

```tsx
<StudentsView key={periodKey} initialData={…} … />
```

Remounting is correct here: the period change invalidates filters, page number,
and rows together.

---

## 3. Per-page behaviour

Three tiers. **Tier assignment for the middle group is an open decision —
see §6.**

### Scoped by academic year/term (unambiguous)

| Page | Change |
|---|---|
| **Students** | `listStudents` takes the period. Whole-year scope drops the term filter on charges, so the table shows the year's full picture. |
| **Student detail** | Resolve for the selected year; term columns are that year's terms; the selected term gets the highlight `isCurrent` gives today. |
| **Classes** | Delete the in-page year `<Select>` and the `?year=` param — the global toggle replaces it. Straight simplification. |
| **New contract** | Form context resolves against the selected year. See the write-safety decision in §6. |

### Scoped by date range (bank data has no year/term FK)

`bank_transactions` carries only `transaction_at`; `operations` only
`created_at`. They can be scoped by the period's `start_date … end_date`, which
is meaningful but is a *different kind* of scoping — a payment received in
Term 2 may settle a Term 1 charge.

| Page | Proposed |
|---|---|
| **Transactions** | Filter `transaction_at` into the period window. |
| **History** | Filter `created_at` into the period window; the existing from/to filters narrow further within it. |
| **Imports** | **Exempt.** Unmatched proposals are always "right now" work; scoping them to a past term empties the page and hides the queue. |

### Not period-scoped at all

| Page | Why |
|---|---|
| **Academic calendar** | Manages the periods themselves. Exempt by request. |
| **Discounts** | `discount_types` is a global catalogue with no year column. |
| **Fees** | School-wide rates are `academic_term_id IS NULL` + `effective_from`/`superseded_at` — a validity timeline, not a period. Club rates *are* per-term, so the club section can highlight/filter to the selected term while the school-fee section stays a full history. |

Exempt pages still show the toggle (it is global chrome) but visibly do
nothing — so each exempt page gets one muted line saying the period does not
apply here. Silent no-ops are worse than a sentence.

---

## 4. Write safety

Selecting a past term turns the app into a time machine, and every mutation
surface stays live: "Add charge", "New contract", "Confirm match", "Publish
rate". Writing a charge into 2024–2025 Term 1 because the toggle was left there
is a data-corruption path with no undo beyond the 15-minute window.

Proposed: when `period.isCurrent === false`,

1. a persistent amber strip under the toggle — *"Viewing 2024–2025 · Term 1.
   Editing is off while you browse a past period."* with a **Jump to current**
   button;
2. primary actions disabled with that reason as their tooltip;
3. the server enforces it too — mutation services reject a non-current period
   rather than trusting the disabled button.

The alternative (allow writes into any period) is defensible for backfilling old
data, but should be a deliberate choice, not a default. **Decision needed —
§6.**

---

## 5. UI

### Placement

New `features/shell/components/PeriodBar.tsx`, rendered by `app/(app)/layout.tsx`
as a sticky strip at the top of `<main>`:

```
┌──────────┬────────────────────────────────────────────────────────┐
│  ESM     │                              🗓 2025–2026 · Term 2  ▾  │  ← sticky, h-12
│  Portal  ├────────────────────────────────────────────────────────┤
│          │                                                        │
│ Students │  Students                            [+ New contract]  │  ← page's own
│ Imports  │  1,043 enrolled · 2025–2026                            │    PageHeader
│ …        │                                                        │
```

It is a strip, not a header: no title, no other controls, transparent over the
page canvas with a bottom hairline. The layout's "the sidebar carries
navigation, the page carries its title" rule survives intact — the strip carries
exactly one thing.

### The control — Option B (recommended)

One pill; a popover with years on the left, that year's terms on the right.

```
   ┌──────────────────────────┐
   │ 🗓 2025–2026 · Term 2  ▾ │
   └────────────┬─────────────┘
   ┌────────────┴──────────────────────────┐
   │  Year              Term               │
   │ ┌───────────────┐ ┌─────────────────┐ │
   │ │ 2026–2027     │ │ Whole year      │ │
   │ │ 2025–2026  ✓  │ │ Term 1          │ │
   │ │ 2024–2025     │ │ Term 2       ✓  │ │
   │ │ 2023–2024     │ │ Term 3          │ │
   │ └───────────────┘ │ Term 4          │ │
   │                   └─────────────────┘ │
   ├───────────────────────────────────────┤
   │  ↩ Jump to current — 2025–2026 · T2   │
   └───────────────────────────────────────┘
```

- Both columns visible at once, so switching year *and* term is one trip.
- Picking a year pre-selects that year's current term (reusing the existing
  `pickCurrentTerm()` rule from `features/calendar/current.ts` — the same rule
  the calendar admin screen uses, so the two never disagree).
- **Whole year** is a first-class term option: annual tuition and the year
  rollup need it, and without it "the year's total" is unreachable.
- The trigger renders the current period in muted text and a non-current one in
  amber, so a forgotten toggle is visible from across the room.
- Needs one new primitive, `components/ui/popover.tsx` (Radix Popover, same CVA
  pattern as the rest) — `menu.tsx` is a dropdown-menu and does not do
  two-column content well.

### Alternative — Option A (no new primitive)

Two adjacent `<Select>`s using the existing primitive:

```
                                [ 2025–2026 ▾ ] [ Term 2 ▾ ]
```

Cheaper (nothing new in `components/ui/`), but two trips to change both, two
`router.refresh()`es unless debounced, and no room for "Jump to current".

---

## 6. Open decisions

1. **Date-ranged pages** — scope Transactions and History by the period's date
   window, or leave them global? (Imports proposed exempt either way.)
2. **Writes while browsing a past period** — block them (recommended), or allow
   with a warning?
3. **Control form** — Option B pill + popover (recommended), or Option A two
   selects?

---

## 7. Work breakdown

| # | Step | Touches |
|---|---|---|
| 1 | `features/calendar/period.ts` — `Period`, `resolvePeriod`, `listPeriodOptions`, cookie read/write; unit tests for cookie parsing + fallback | new file, `index.ts` |
| 2 | `components/ui/popover.tsx` (Option B only) | new primitive |
| 3 | `PeriodBar` + `PeriodPicker`, strings, mount in the app layout | `features/shell/*`, `app/(app)/layout.tsx` |
| 4 | Thread `Period` through students list, filter options, detail | `features/students/api.ts`, `detail.ts`, both routes, both pages |
| 5 | Classes: accept the global period, delete the in-page year select and `?year=` | `features/classes/*`, `app/(app)/classes/page.tsx` |
| 6 | Fees: highlight/filter club rates by the selected term | `features/fees/*` |
| 7 | Transactions + History date-window scoping *(pending decision 1)* | those features + routes |
| 8 | Non-current guard: banner, disabled actions, server-side rejection *(pending decision 2)* | mutation services, views |
| 9 | Exempt-page notes; docs — `user_flows.md`, `domain_model.md` note that `is_current` is now a *default*, not the only scope | docs |

Steps 1–4 are the spine; 5–9 are independent and can land separately.
