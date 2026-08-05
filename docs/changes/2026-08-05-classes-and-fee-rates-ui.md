# Change note — Classes & levels, and Fee rates

**Date:** 2026-08-05
**Branch:** `claude/student-tracker-ui-redesign-ued84c`

Two more admin-config screens, following the Academic calendar: **Classes**
(`/classes`) and **Fees** (`/fees`). Both readable by every accountant, both
write-gated to admins by `requireAdmin` on the routes regardless of what the UI
shows. **No migration. No `db/schema.ts` change.**

---

## Classes & levels

Grade levels (school-wide) and the classes of one academic year, picked from a
dropdown that defaults to the current year.

What's editable, and what deliberately isn't:

| Field | Editable? | Why |
|---|---|---|
| Level `code` | **No, ever** | Tuition is priced per level code inside `fee_structures.data.by_grade` — a JSONB key, not an FK. Renaming it detaches every class at that level from its rate, silently. Set at creation only. |
| Level display order | Yes | It's what makes `2` sort before `10`. |
| Class teacher name / email / phone | Yes, always | Denormalized display data (`domain_model.md` § Grade), and the likeliest thing to be wrong — `notes.md` flags 5 classes with no teacher at all. |
| Class name | Yes, with a warning | Renaming is a legitimate correction, but the year-start import matches classes **by name** and may create a second one. The dialog says so. |
| Class grade level | Only while nobody is enrolled | The level decides which tuition rate a student is charged. Moving it recomputes nothing, so a populated class would end up claiming a level that disagrees with what its students were charged. |
| Class academic year | **No** | Enrolments are scoped by (student, year); the year is fixed at creation. |

Deletes are guarded and never cascade: a class with students is refused, and so
is a level that has classes **or** whose code tuition still prices. That second
check exists because it is a JSONB reference no foreign key protects.

> I recommended "class name and level editable only while no enrolments point at
> it". I split that in the build: the **level** keeps the strict rule because it
> has money consequences, the **name** relaxes to a warning because it has none
> and correcting a typo is a real need. Say the word if you want the name locked
> too.

## Fee rates

Each school-wide fee shows the rate in force, the date it applies from, and its
earlier rates behind a toggle. Club fees follow, grouped by term, **read-only**
— they're loaded from esmlh.edu.mn every term, so an edit here would be
overwritten by the next import.

The single write is **publish a new rate**: mark the current row superseded,
insert a new one, in one transaction. There is no PUT and no DELETE on this
feature, by design — the validity chain *is* the record of what the school
charged and when (`domain_model.md` § FeeStructure).

Guards:

- **A new rate changes no existing charge.** A Charge stores its resolved gross
  amount at creation, so a new rate only reaches charges created after it. The
  dialog says this before you publish.
- **A published rate applies immediately** — the app reads "the rate in force"
  as `superseded_at IS NULL` and never consults `effective_from`. A future date
  would therefore apply today while claiming otherwise, so **future dates are
  refused**: publish a rate on the day it starts. One day of slack keeps a
  Ulaanbaatar "today" (UTC+8) from being rejected. *This is the one place I
  narrowed the feature past what you asked for — it means you cannot enter next
  year's tuition in advance. The alternative was letting a future-dated rate
  silently reprice today's contracts. Worth revisiting if scheduling ahead
  matters more than that.*
- A replacement can't start before the rate it replaces, and two rates can't
  share a start date.
- **A fee keeps its shape**: tuition stays per-grade, a flat fee stays flat.
- **A per-grade rate must price every grade level and nothing else** — a
  missing level silently yields no tuition on a new contract; a stray code is a
  typo nothing will look up.
- **New fee names aren't invented here.** Rates are published for fees the
  school already has; new fees arrive with the import.

## Where things live

- `features/classes/` — `api.ts` (guards + read model), `schemas.ts` (the
  update schemas simply omit the locked fields), `components/`.
- `features/fees/shape.ts` — the `fee_structures.data` JSONB shapes, read and
  written in one pure place. It reproduces the bare-map tolerance the
  charge-creating path already has (`features/enrollments/api.ts`), so the view
  shows what the app actually charges from rather than "unknown".
- `features/fees/api.ts` — `listFeeRates` and the supersede-and-insert
  transaction.
- `components/ui/confirm-dialog.tsx` — promoted out of the calendar feature,
  now shared by all three config pages.
- Routes: `app/api/classes/…` (4 admin-only handlers), `app/api/fees/rates`
  (one POST — no PUT, no DELETE).

## Testing

- 34 unit tests over the schemas and the JSONB shape helpers.
- **38 integration checks against a real Postgres** (migrations applied,
  throwaway database): every guard in both tables above, the supersede
  transaction, and both read models. All passed.
- Both pages rendered and driven in a browser against a production build, with
  the **real seeded database** behind them — including the class-edit dialog
  showing its level picker disabled with the lock reason, and the tuition
  publish dialog pre-filled from the rate in force.
- Not exercised end-to-end through the HTTP routes: they need a Supabase
  session this environment can't mint. The handlers are thin wrappers in the
  same shape as the existing discount-type routes.

## Still outstanding

Same gap as the calendar: **none of this is logged to `operations`**, so config
changes don't appear in History and can't be undone. Publishing a tuition rate
and locking a class's level are exactly the sort of thing an audit trail should
carry. It needs a CHECK-constraint migration for the new `operations.kind`
values — still the natural next piece of work, now covering three screens
rather than one.

The nav is also at seven items. If it gets crowded, the three admin-config
pages (Calendar, Classes, Fees) are the natural candidates to fold into one
"Setup" menu.
