# History & reversibility

Design and build plan for user-action history and time-boxed undo in the ESM
Payment Tracker. This is a **v2 direction**: several v1 decisions in
`domain_model.md` deliberately said the opposite (no audit trail, no batch
entity, hard deletes). Those are revised here on purpose — see
§ Documentation to revise.

For entity meaning see `domain_model.md`; for table shapes see `schema.md`.
When this doc and those disagree, update them together — one owner per fact.

---

## Status

| Phase | State |
|---|---|
| 1 — Reversible confirm | **Done.** |
| 2 — Soft-discard | **Done.** |
| 3 — Activity log + History view | **Done.** `GET /api/history` (role-scoped read) + a `/history` page with per-row Undo. Nav link between Transactions and the sign-out button. |
| 4.2 — Reversible enrollment creation | **Done.** The New Contract flow records a `create_enrollment` operation; undo deletes the enrollment, its charges and discounts, and a student it created, guarded by a live-payment check. |
| 4.1 — Reversible discount add | **Deferred.** See note below. |
| 5 — Retention & purge | **Not started** (explicitly optional/later). |

**Why 4.1 is deferred.** The doc's model assumes a discrete "add one discount"
action. In the shipped app discounts are edited as a *bulk replace* inside
`updateTuition` (`features/students/api.ts`): it deletes the enrollment's
discount rows and re-inserts the new set. There is no single-discount add to
attach a reversible `add_discount` operation to. Making tuition-discount edits
reversible therefore means recording the before/after set on an `edit_discounts`
operation and restoring it on undo — a small reshape of `updateTuition`, not the
`voided_at`-on-discounts approach sketched below. Left for a follow-up so it can
be designed against the real flow rather than the assumed one.

Note that undo of a `create_enrollment` (4.2) follows the same **delete, don't
void** precedent already set by confirm-undo, which hard-deletes charges it
created (§ Phase 4 of `import_matching_plan.md`): the contract is brand-new, the
operations log preserves the audit trail, and a live-payment guard blocks undo
once real money has attached. So 4.2 needed **no** new `voided_at` columns on
enrollments/charges/students.

---

## Why now

Most start-of-year transfers are single, tuition-only, exact-amount payments —
i.e. high-confidence matches. The import UI only pays off if those can be
**bulk-confirmed after a glance** instead of confirmed one form at a time. Bulk
confirm is only safe if a wrong confirm is **one click to undo**. So
reversibility is the substrate the faster import UI is built on, and it must
land first. (Later in the year, payments get partial and ambiguous, mistakes
rise, and undo matters even more.)

---

## Core decisions

1. **History and undo are two things.** History = "who changed what, when"
   (accountability, append-only). Undo = "put it back" (a write that voids or
   restores). We build undo first because it de-risks bulk confirm.

2. **Void, never hard-delete.** Reversible actions leave the data in place and
   flip a state (a payment gains `voided_at`; a bank transaction moves to
   `discarded`). Nothing that represents money or a decision is physically
   removed. This is what lets us "hold certain deleted information in some
   form."

3. **Undo is time-boxed.** Every undoable action carries an `undoable_until`
   timestamp. Past it, the Undo action is refused. The window is configurable
   (§ The undo window); default **1 month (30 days)**, switchable to
   **1 semester (120 days)**.

4. **Undo window ≠ retention.** The window governs *whether Undo is offered*.
   Voided/discarded rows are **retained beyond the window** for audit. Physical
   purge is a separate, optional, later job (Phase 5) with a retention floor no
   shorter than the window.

5. **An `operation` is the unit of both audit and undo.** Every user-initiated
   mutation writes one `operations` row (actor, kind, timestamp). Undoable
   operations also record `undoable_until` and, once reversed, `undone_at`.
   A bulk confirm of 188 transactions is still auditable per transaction but is
   grouped so it can be undone as a unit.

6. **Undo is itself an operation.** Reversing action X writes a new `undo`
   operation pointing at X. Undo is auditable but not itself undoable (no redo
   in v2).

7. **Scope of visibility and undo is role-based.** An **admin** can see and
   revert **any** user's operations. An **accountant** can see and revert
   **only their own**. Enforced server-side on both the history read and the
   undo endpoint (§ Who can see and undo what) — never UI-only.

---

## The undo window

A single tunable, editable without a schema change:

```ts
// lib/config.ts
export const UNDO_WINDOW_DAYS = 30; // 1 month. Set to 120 for 1 semester.
```

- `undoable_until` is computed **at write time** as
  `operation.created_at + UNDO_WINDOW_DAYS` and stored on the row.
- Changing the config affects **future** operations only; already-recorded
  windows are stable and predictable.
- The "is this still undoable?" check is a pure function
  (`now < undoable_until && undone_at IS NULL`) — unit-testable without a DB.

Graduation path (not v2): move the constant to an env var, then to a
per-institution DB setting, if it ever needs to differ by deployment.

---

## Schema changes

Grouped by the phase that introduces them. Full column specs land in
`schema.md` as each phase ships.

**New table `operations`** (Phase 1)

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `actor_user_id` | uuid FK users | who did it |
| `kind` | text CHECK | `confirm_match`, `discard_transaction`, `restore_transaction`, `create_enrollment`, `add_discount`, `undo` |
| `bank_transaction_id` | int NULL FK bank_transactions | the row this operation concerns (all Phase 1-2 kinds); nullable for later entity kinds |
| `created_at` | timestamptz | |
| `undoable_until` | timestamptz NULL | NULL = not undoable (e.g. `undo` itself) |
| `undone_at` | timestamptz NULL | set when reversed |
| `undone_by_user_id` | uuid NULL FK users | |
| `undo_operation_id` | int NULL FK operations | the `undo` op that reversed this |
| `summary` | text | human-readable line for the History view |
| `details` | jsonb NULL | structured before/after where useful |

**`payments`** (Phase 1) — add:
- `operation_id` int FK operations — the confirm that created this payment.
- `voided_at` timestamptz NULL, `voided_by_user_id` uuid NULL — void marker.
- A payment is live iff `voided_at IS NULL`.

**`bank_transactions`** (Phase 2) — change:
- `status` CHECK gains `'discarded'`: `('matched','unmatched','discarded')`.
- add `discarded_at` timestamptz NULL, `discarded_by_user_id` uuid NULL.

**`discounts`** (Phase 4.1) — would add `operation_id`, `voided_at`,
`voided_by_user_id` (mirrors payments). **Not added:** 4.1 is deferred (see
§ Status), and 4.2's enrollment undo deletes brand-new discount rows rather than
voiding them, so it needs no discount columns.

---

## Documentation to revise

These v1 statements are superseded and must be edited when the relevant phase
ships (not silently contradicted in code):

- `domain_model.md` BankTransaction: *"Non-student rows … never persisted.
  There is no `ignored` status."* → replaced by soft `discarded` state
  (Phase 2).
- `domain_model.md` § Bank transaction → Payment: *"Non-student rows are
  deleted at review, not persisted; no audit trail of deletions."* → replaced
  by discard + operations log (Phases 2–3).
- `domain_model.md` § Out of scope: *"ImportBatch entity"* stays out, but the
  `operations` grouping provides batch-level undo (Phase 1).
- `schema.md` § Computing balance: `paid_total` must sum **live** payments only
  (`WHERE p.voided_at IS NULL`) (Phase 1).
- Unchanged: **MatchProposals stay ephemeral.** Only *confirmed* actions are
  logged.

---

## Cross-cutting rules

- Every user-initiated mutation writes exactly one `operations` row, through a
  single `recordOperation()` helper, inside the same DB transaction as the
  mutation. No mutation path bypasses it.
- Balance and any "paid" total exclude voided payments, everywhere. The one
  owner is `features/students/balance.ts`.
- Re-upload dedup already keys on `transaction_id` UNIQUE; because discard is
  now soft, a re-uploaded discarded transaction is recognized and **not**
  resurrected as a fresh unmatched row.
- Undo of a confirm voids **only that operation's** payments, never other
  payments the same charge later received.

---

## Who can see and undo what

Role-based, enforced server-side:

| Role | See in History | Undo |
|---|---|---|
| `admin` | every user's operations | any operation (within its window) |
| `accountant` | only their own operations | only their own (within its window) |

- The **undo endpoint** authorizes with: `op.actor_user_id == user.id ||
  user.role == 'admin'`. A cross-user undo by an accountant is a `403`,
  independent of the window check.
- The **history read** scopes non-admins to `actor_user_id = user.id`; admins
  see all. The UI never decides this — it only reflects what the API returns.
- Rationale: 4 accountants + 1 admin. Own-actions-only keeps each accountant
  accountable for their own corrections and avoids two people silently
  reverting each other during a shared import; the admin is the single escape
  hatch for cross-user cleanup. This is a starting policy to test in practice,
  cheap to widen later (it lives in one authorization check).

---

## Implementation steps

Each step is one commit (or a tight series), independently shippable, with the
stated test. Tests follow the project's guidance in `tech_stack.md` §10: pure
helpers get unit tests; DB-bound flows get one Playwright e2e; schema is
verified by migration review + a smoke check.

### Phase 1 — Reversible confirm (the substrate)

| Step | Change | How it's tested |
|---|---|---|
| 1.1 | Add `lib/config.ts` with `UNDO_WINDOW_DAYS`. Add a pure `isUndoable(op, now)` helper in `features/imports/undo.ts`. | Unit: within window → true; past window → false; already-undone → false. |
| 1.2 | Migration: create `operations`; add `operation_id`, `voided_at`, `voided_by_user_id` to `payments`. Re-export Drizzle types. Update `schema.md`. | `pnpm db:generate` review; `tsc` compiles; schema round-trip test. |
| 1.3 | `computeChargeBalance` / `loadStudentChargeDetails` exclude voided payments. Update `schema.md` balance formula. | Unit (extend `balance.test.ts`): a voided payment does **not** reduce balance; a live one does. |
| 1.4 | `confirmAllocation` writes a `confirm_match` operation (with `undoable_until`) and stamps `operation_id` on every payment it creates — same transaction. Add `recordOperation()` helper. | Service test on the pure assembly of operation + payment rows; e2e confirm still records payments. |
| 1.5 | Undo endpoint `POST /api/imports/operations/:id/undo` → within window and authorized: void the operation's payments, set the bank transaction back to `unmatched`, mark the operation undone, write an `undo` operation. Reject if past window, already undone, or the actor is neither the owner nor an admin. | e2e: confirm → undo → transaction back in unmatched, balance restored. Unit: past-window undo → 400; double undo → 409; accountant undoing another's op → 403; admin undoing another's op → ok. |
| 1.6 | Minimal UI: an "Undo" affordance on a just-matched transaction in Transaction history (not the full import redo). | e2e happy path; button hidden once `undoable_until` passes. |

### Phase 2 — Soft-discard for review deletes

| Step | Change | How it's tested |
|---|---|---|
| 2.1 | Migration: `bank_transactions.status` CHECK adds `'discarded'`; add `discarded_at`, `discarded_by_user_id`. Update `schema.md`. | Migration review; constraint accepts `discarded`, rejects junk. |
| 2.2 | Replace the hard delete in `DELETE /api/imports/:id` with a soft discard + `discard_transaction` operation. Update `domain_model.md`. | Unit: discard sets status, does not remove the row. e2e: re-upload does not resurrect a discarded row. |
| 2.3 | Restore: `POST /api/imports/operations/:id/undo` for a discard → status back to `unmatched` (within window). Add a "Discarded" filter to Transaction history. | e2e: discard → restore → row unmatched. Unit: past-window restore → 400. |

### Phase 3 — Activity log + History view — **done**

| Step | Change | How it's tested |
|---|---|---|
| 3.1 | Route all remaining mutations (confirm, undo, discard, restore) through `recordOperation()`; backfill `summary`/`details`. | Unit: each mutation yields exactly one operation with correct actor + kind. |
| 3.2 | Read API `GET /api/history` with filters (entity, kind, date range) + pagination. Non-admins are scoped server-side to their own operations; admins see all. | Unit: filter/pagination logic on a fixture list; accountant request excludes others' operations; admin request includes them. |
| 3.3 | History page under `(app)/history` — table of operations, filterable, with an Undo action shown only where still in window **and** the viewer is authorized (owner or admin). | e2e: page renders, filter narrows, Undo works from the row; accountant sees no Undo on another user's op. |

**As built (Phase 3):** `features/history/` gained `api.ts` (`listHistory`, the
role-scoped read — accountants are filtered to `actor_user_id = user.id`
server-side, admins see all), `schemas.ts` (`GET /api/history` params: `kind`,
`from`/`to`, pagination), `types.ts`, `strings.ts`, and
`components/HistoryView.tsx`. Route `app/api/history/route.ts`; page
`app/(app)/history/page.tsx`; nav link in `app/(app)/layout.tsx`. Each row
exposes `undoOperationId` only when the viewer may undo it (owner-or-admin **and**
in window) — the same gate the Transactions view already uses — and Undo posts to
the existing `/api/imports/operations/:id/undo`.

### Phase 4 — Extend reversibility

| Step | Change | How it's tested |
|---|---|---|
| 4.1 | Reversible discount add: `add_discount` operation; `voided_at` on discounts; undo voids it. | Unit: voided discount drops out of the tuition discount total. |
| 4.2 | Reversible enrollment creation (the New Contract flow): `create_enrollment` operation; undo voids the enrollment + its charges + any newly created student. **Blocked** if any of those charges already has a live payment. | Unit: undo path assembles the right void set; guard rejects when a payment exists. e2e: create contract → undo → gone. |

**As built (Phase 4.2):** `createEnrollment` records a `create_enrollment`
operation (with `undoable_until`) inside its existing transaction, capturing
`{ studentId, studentCreated, enrollmentId, chargeIds, discountCount }` in
`details`. `undoCreateEnrollment` (in `features/enrollments/api.ts`, dispatched
from `undoOperation`) reads those ids back through the pure, unit-tested
`parseCreateEnrollmentDetails` (`undo-details.ts`), refuses with 409 if any
charge has a live payment, then deletes discounts → charges → enrollment, and the
student **only if** this contract created it and nothing else now references it.
Deletes rather than voids (see § Status); no new columns. The New Contract action
appears in History and is undoable there like any other operation.

### Phase 5 — Retention & purge (optional, later)

| Step | Change | How it's tested |
|---|---|---|
| 5.1 | Documented retention policy; opt-in purge job for voided/discarded rows older than a retention floor (≥ `UNDO_WINDOW_DAYS`). Default: retain indefinitely. | Unit: purge never selects rows inside the window or the floor. |

---

## Decisions (settled)

- **Default window: 30 days (1 month).** `UNDO_WINDOW_DAYS = 30`, switchable to
  120 for a semester. A starting value to test against real usage.
- **Visibility & undo: role-based.** Admin sees and reverts anyone's actions;
  accountants see and revert only their own. Enforced server-side (§ Who can
  see and undo what).
- **Undo of a partially-paid charge: void only the originating operation's
  payments.** Later installments on the same charge are untouched; undo is
  never blocked merely because other payments exist.
  *Reason:* undo must be a **local, predictable inverse of one action**, not a
  recompute of the charge. Payments arrive as installments (increasingly so
  later in the year), each from a different bank transaction and its own
  confirm operation; cascading an undo across them would void money the user
  never touched, and blocking undo whenever a charge has other payments would
  make the common installment case un-undoable. Scoping to the operation's own
  payment set keeps each confirm independently reversible and preserves the
  audit trail (voided payments stay visible, and the undo is itself logged).
