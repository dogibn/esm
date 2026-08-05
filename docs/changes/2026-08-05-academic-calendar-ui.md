# Change note — Academic calendar UI

**Date:** 2026-08-05
**Branch:** `claude/student-tracker-ui-redesign-ued84c`

## What this adds

A **Calendar** page (`/calendar`, new nav entry) for managing academic years and
terms in the app instead of by script. The first of the admin-config UIs.

- Every year is a card: dates, a **Current** badge, what already references it,
  and its terms in a table.
- An admin can **add and edit** years and terms, **set the current** year or
  term, and **delete** a row nothing references.
- Readable by every accountant; the controls are admin-only, and the routes
  enforce `requireAdmin` regardless of what the UI shows.

**No migration. No `db/schema.ts` change.** The tables already existed — only
the scripts could reach them.

## Action items for you

None to run. Two things to know:

1. **Calendar changes are not in the activity log.** They write no `operations`
   rows, so they don't appear in History and can't be undone — the same as the
   discount catalog today. Adding them means new `operations.kind` values, which
   is a CHECK-constraint migration; it was left out deliberately so this feature
   doesn't arrive coupled to a migration you must run before it works. It is the
   natural follow-up (see below).
2. **The invariants are enforced now, on real data.** If the seeded calendar
   already violates one (a term outside its year's dates, say), editing *that*
   row will be refused until the dates agree. Nothing else breaks — reads are
   unaffected.

## The rule worth knowing

**The current year and the current term always belong together.**
`academic_years.is_current` and `academic_terms.is_current` are read
independently all over the app — the tracker resolves both, then loads
year-scoped and term-scoped charges — so a current term belonging to a
*different* year would quietly mix two years' money.

So: setting a year current **also moves the current term** to one of that
year's terms (an already-current term inside it keeps the flag, otherwise its
earliest term takes over), and only a term of the current year can be made
current. The confirm dialog names the term that will follow, before the user
commits. That choice lives in one pure function, `features/calendar/current.ts`
§ `pickCurrentTerm`, shared by the server and the dialog so they cannot drift
apart — with unit tests, because a dialog that promises one term while the app
switches to another is the failure mode that matters.

## Other guards

| Rule | Why |
|---|---|
| Years can't overlap; terms can't overlap a sibling | A date belongs to exactly one year, and one term within it |
| A term must fall inside its year | Otherwise term-scoped charges sit outside the year that owns them |
| A year can't be narrowed so a term falls outside it | Same invariant, from the other direction |
| A term can't move to another year | Its charges and club enrolments are scoped to it; re-parenting would silently re-scope them — the update schema has no field for the year |
| A new year/term is never created as "current" | Making something current is a deliberate act, not a side effect of creating it |
| The current year/term can't be deleted | It would leave the app with no scope to read |
| A referenced year/term can't be deleted | Every FK is `ON DELETE RESTRICT`; the service counts references first so the refusal names what is in the way, and the UI disables the control up front |

## Where things live

- `features/calendar/api.ts` — service functions, all guards, the transaction
  that moves the `is_current` flags.
- `features/calendar/current.ts` — the pure "which term follows the year" rule.
- `features/calendar/schemas.ts` — Zod input schemas (dates stay `YYYY-MM-DD`
  strings end to end: Postgres `date`, `<Input type="date">`, and string
  comparison all agree).
- `features/calendar/components/` — `CalendarView`, `CalendarEntryDialog`
  (years and terms share one form), `ConfirmDialog`.
- `app/api/calendar/{years,terms}/…` — six thin admin-only routes, including a
  separate `…/current` endpoint per kind: making something current is its own
  action, not a field on an edit form.

## Testing

- 17 unit tests over the schemas and `pickCurrentTerm`.
- The service layer was exercised against a **real Postgres** (migrations
  applied, throwaway database): every guard above, the flag-moving transaction,
  the partial unique indexes, and the read model's usage counts. All passed.
- The page and its dialogs were rendered and driven in a browser against a
  production build.
- Not exercised end-to-end through the HTTP routes — those need a Supabase
  session, which this environment has no way to mint. The routes are thin
  wrappers in the same shape as the existing discount-type routes.

## Suggested follow-up

Log calendar writes to `operations` (kinds like `set_current_academic_year`,
`create_academic_year`, …). That needs a migration extending the
`operations_kind_check` constraint plus entries in the History view. Changing
which year is current is the most consequential switch in the app; it deserves
to be in the audit trail even if it stays non-undoable.
