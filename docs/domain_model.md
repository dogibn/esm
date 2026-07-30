# Domain model

The entities, relationships, and lifecycle that the ESM Payment Tracker operates on. Schema (`schema.md`), code conventions (`tech_stack.md`), and import scripts (`scraping_esmlh.md`) all reference these names.

The app is a payment tracker layered on top of data that originates elsewhere (esmlh.edu.mn). It is **not** a system of record for student enrollment or club registration — that data is imported at the start of each year and term.

---

## Cadence of change

Different things change at different rates. The data model reflects that.

| Thing                                | Changes per       |
|--------------------------------------|-------------------|
| Student exists / is active           | year              |
| Grade level                          | rarely            |
| Class (`Grade`) + assigned teacher   | year              |
| Enrollment in a class                | year              |
| Tuition / bus / registration rates   | rarely            |
| Club enrollment + club fees          | term              |
| Charges — tuition, registration      | year              |
| Charges — bus, clubs                 | term              |
| Payments                             | continuously      |

ESM runs on **academic years**, each with **four terms**. Year-cadence data is scoped to `AcademicYear`. Term-cadence data is scoped to `AcademicTerm`. Stable fees live across years using validity ranges.

---

## Entities

### Student
A person enrolled at ESM. Identified by school-assigned `student_id`. Stable across years. Not directly tied to a Grade or AcademicYear — those live on Enrollment.

### GradeLevel
The numeric grade level (`"1"`, `"5+"`). Stable across years. Identifies the level used to look up tuition in `FeeStructure.data.by_grade`. The *level* rarely changes; what changes year to year is the *classes* at that level.

### Grade
A class section in a specific academic year (`"5+A"`, `"1JB"`). Per-year — class names, assigned teacher, and which students belong all change yearly. Belongs to one GradeLevel and one AcademicYear.

Carries denormalized teacher info (`teacher_name`, `teacher_email`). No Teacher entity in v1 — the school's source of truth for teacher data lives elsewhere; we only need name and email for display.

> **Why GradeLevel and Grade are separate.** Tuition is keyed by *level*, not class section. Storing level on every Grade row would duplicate data and risk drift across the many classes at the same level. The split makes the cadence (level = stable, class = yearly) explicit.

### AcademicYear
Year-level scope (e.g. "2025–2026"). Exactly one row has `is_current = true`.

### AcademicTerm
Belongs to an AcademicYear. ESM has 4 per year. Exactly one row has `is_current = true`.

### Enrollment
Links a Student to an AcademicYear and a Grade. One row per student per year attended. The natural home for year-scoped agreements between school and student: tuition contract reference, tuition discounts.

`student_category = 'new'` triggers a registration-fee Charge for that year.

`status` is one of `active`, `inactive`, `withdrawn`.

`tuition_contract_id` is an external reference to the school's paper contract; nullable because the year-start import may run before all contracts are signed.

The Enrollment's Grade must belong to the same AcademicYear as the Enrollment itself (invariant, enforced in code).

### ClubEnrollment
Records that a student signed up for a specific club fee in a specific term. Generated at term start from the esmlh.edu.mn import. Exists so the app can answer "who is in robotics this term" and so charge generation has a clean source.

### FeeStructure
A fee that applies somewhere in time. Heterogeneous fee shapes (flat, per-grade, club with metadata) live in one table using a JSONB `data` column.

`fee_name` is the natural key (`"tuition"`, `"bus_fee"`, `"registration"`, `"Cheerleading GR3"`). Not unique on its own — each fee can have multiple rows across terms and validity ranges.

`academic_term_id`:
- `NULL` = stable, school-wide fee (tuition, bus, registration)
- non-null = fee specific to that term (clubs)

`effective_from` + `superseded_at` model validity. To change a stable fee's value: set `superseded_at` on the old row, insert a new row with new `effective_from`. The current row is the one with `superseded_at IS NULL`.

#### JSONB `data` shape catalog

The `data` column uses one of these shapes. Adding a new shape is a domain decision and must be added here before code uses it.

```
Flat fee (bus, registration):
  { "amount": 450000 }

Per-grade-level fee (tuition):
  { "by_grade": { "1": 2000000, "2": 2200000, "5+": 1800000, ... } }

Club fee:
  { "amount": 300000, "teacher": "...", "schedule": "..." }
```

> **Future split.** If club metadata grows (rosters, attendance, capacity, room assignments), the club bits should move to a dedicated `Club` entity that FeeStructure references. JSONB is fine for v1.

### Charge
An obligation: "Student S owes amount A for fee F."

Stored as the **resolved gross amount** at creation time. Discounts and payments are subtracted at read time, not baked in. This preserves the audit trail (gross + discount + paid are all recoverable) and tolerates late-discovered discounts without rewriting historical Charges.

> **Exception — "Per Session" club charges (homework club).** These accrue with attendance: the obligation is `per-session rate × sessions attended`, which esmlh recomputes continuously. Their gross `amount` is therefore **mutable** — re-synced from esmlh's Total Fee by `refresh:per-session-charges` (see `scraping_esmlh.md` § Per Session refresh), not fixed at creation. esmlh's Total Fee is the source of truth, including when it is blank: a student enrolled but with no sessions accrued has the charge set to **0** (not left at the seed rate). Payments are unaffected; `balance = amount − paid` recomputes. Every other charge (tuition, registration, bus, Per Term clubs) keeps the immutable-gross rule above. This is the *amount* that mutates, not the audit trail of payments.

Scope is exclusive: exactly one of `academic_year_id` / `academic_term_id` is set, never both.

| `fee_name`     | Scope |
|----------------|-------|
| `tuition`      | year  |
| `registration` | year  |
| `bus_fee`      | term  |
| club fees      | term  |

A tuition Charge is implicitly linked to an Enrollment via the `(student_id, academic_year_id)` pair — no FK column on Charge.

**Status (unpaid / partial / paid) is derived**, not stored. See "Computing balance" in `schema.md`.

### Discount
A reduction applied to an Enrollment's tuition. **Tuition only in v1.**

Modeled as `Discount → Enrollment` (rather than `Discount → Charge`) because (a) every tuition Charge maps 1:1 to an Enrollment for that year, and (b) attaching the discount to the Enrollment makes the "tuition only" rule structural — there is no Charge column to mis-target.

A *recorded outcome*, not a computed rule: v1 stores the amount that was applied without committing to *how* it was calculated. Multiple Discounts can attach to one Enrollment (e.g. sibling + scholarship).

> **v2 evolution.** When discount rules become clear, add columns like `kind` (flat / percentage / override) and `rate`, plus a `DiscountType` reference table to constrain `name`. Existing rows remain valid with those new columns NULL. If non-tuition discounts emerge, re-link to Charge with a constraint that the linked Charge's `fee_name` is in the discountable set.

### BankTransaction
One row from an uploaded bank file. Non-student rows (bank fees, refunds, unrelated transfers) are filtered at upload; those the accountant identifies during review are **soft-discarded**, not removed (see below).

`transaction_id` is the bank's ID and is **UNIQUE** — re-uploads of the same file are safe (a re-uploaded row that is already present, including a discarded one, is not re-inserted).

`status` is `matched`, `unmatched`, or `discarded`. A discarded row is a reversible soft delete — kept with `discarded_at` / `discarded_by_user_id` so the discard can be undone within the window (`history_and_reversibility.md`). This supersedes the v1 rule that non-student rows are never persisted and that there is no `ignored`-style status.

### Payment
A recorded allocation of money from a BankTransaction to a Charge. A single BankTransaction can produce multiple Payments (split across Charges). A single Charge can receive multiple Payments (installments).

### MatchProposal
The system's *guess* at how to turn a BankTransaction into Payment(s), shown to the accountant during review. **Ephemeral — not persisted, not a DB table.** Lives in memory during the import flow.

Carries the proposed student, proposed allocation (list of `(charge_id, amount)`), and **match signals** — which fields contributed (memo grade, memo name, account number, amount). Surfaced in the UI so the accountant can judge the proposal. Not shown as a numeric confidence score.

### User
Someone who signs in to the app. Five total in v1: one admin, four regular accountants. Mirrors a row in Supabase Auth. `role` is `accountant` or `admin`.

Permission model is minimal: regular accountants do everything except manage `FeeStructure` (admin only — and even that is via year/term-start import, not a UI).

---

## Key relationships

- Student has many Enrollments (one per year attended).
- Enrollment links one Student × one AcademicYear × one Grade.
- Enrollment has many Discounts (zero or more, applied to tuition).
- GradeLevel has many Grades (one per academic year × class section).
- Grade belongs to one GradeLevel and one AcademicYear.
- Student has many ClubEnrollments (one per club per term).
- ClubEnrollment links one Student × one FeeStructure (the club fee row) × one AcademicTerm.
- FeeStructure rows are scoped by (`fee_name`, `academic_term_id`, `effective_from`). Stable fees have `academic_term_id = NULL`.
- Charge belongs to one Student and one of (AcademicYear, AcademicTerm) — never both.
- A tuition Charge is implicitly linked to an Enrollment via `(student_id, academic_year_id)` — no FK.
- BankTransaction has many Payments (or zero, briefly, during review).
- Payment belongs to one BankTransaction and one Charge.
- MatchProposal is transient — not stored.

---

## Lifecycle

The app has three lifecycles. Each is described as **assumptions and their downstream effects** rather than step-by-step procedure — if you revisit an assumption, the table tells you what else changes.

### Year-start data import

Run as a script by the admin before each academic year begins.

| Assumption | What changes if it's wrong |
|---|---|
| Runs as a script, not in-app UI | No year-roll-over UI; `academic_years.is_current` is flipped by the script, not user action |
| Source data comes from esmlh.edu.mn | If source changes, `scraping_esmlh.md` and the load script change; domain unchanged |
| Tuition is annual: one Charge per Enrollment per year | `Charge.academic_year_id` is set for tuition (not term); Discount → Enrollment 1:1 makes sense |
| `student_category = 'new'` triggers a registration Charge | `Enrollment.student_category` is a real column, not derived; registration is year-scoped |
| Tuition amount resolved at Charge creation time, from the current FeeStructure row, keyed by `Grade.grade_level.code` | Mid-year rate changes don't propagate to existing Charges (open: see `notes.md`) |
| Initial discounts loaded with the import where known | `Discount.created_at` can predate any Payment; year-start script must accept Discount data |

The import produces, for each enrolled student: a Student row (insert or update), an Enrollment row, optional Discount rows, a tuition Charge, and (if `student_category = 'new'`) a registration Charge. AcademicYear + Grade + GradeLevel rows are ensured beforehand.

### Term-start data import

Run as a script by the admin before each term begins.

| Assumption | What changes if it's wrong |
|---|---|
| Runs as a script, not UI | No term-roll-over UI |
| Club enrollments are term-scoped | `ClubEnrollment.academic_term_id` is required; club Charges are term-cadence |
| Bus opt-in source is known per term (open: see `notes.md`) | Bus Charge generation depends on resolution |
| Tuition is *not* regenerated at term start | Only bus + club Charges are term-cadence |

The import produces, per active enrollment: a bus Charge if opted in, plus one Charge per ClubEnrollment for the term.

### Bank transaction → Payment

Run continuously by accountants in-app.

| Assumption | What changes if it's wrong |
|---|---|
| Memo + sender account + amount drive matching | MatchProposal scope and the fields shown in the review UI |
| MatchProposals are ephemeral | The unmatched queue is just `BankTransaction WHERE status = 'unmatched'`; no MatchProposal table |
| `transaction_id` deduplicates re-uploads | No ImportBatch entity in v1; original files not stored |
| Non-student rows are soft-discarded at review (reversible), not removed | `status = 'discarded'` + `discarded_at`/`discarded_by_user_id`; the discard is logged in `operations` and undoable (`history_and_reversibility.md`) |
| One BankTransaction can fund multiple Charges; one Charge can receive multiple Payments | Payment is a separate table from BankTransaction |
| Match confidence shown as which fields matched, not numeric | No confidence column; UI shows signal badges |

The flow: parse upload → dedupe by `transaction_id` → construct MatchProposals → accountant reviews each row → confirm (creates Payments, sets `BankTransaction.status = 'matched'`), delete (discard), or skip (persist with `status = 'unmatched'`).

---

## Out of scope for v1

These won't be modeled in v1. Each is listed because the AI would otherwise re-derive it.

- **Year/term-end roll-over UI.** New years and terms are added by script.
- **CRUD UI for FeeStructure / Student / Enrollment / Grade.**
- **Per-student detail page.**
- **Discount rules.** v1 stores recorded amounts only, not the formulas behind them.
- **Discounts on non-tuition fees.** Would require restructuring Discount back to → Charge.
- **Family / siblings entity.** Sibling discounts are recorded as flat per-Enrollment Discount rows.
- **Teacher entity.** Teacher info is denormalized on Grade.
- **ImportBatch entity and original-file storage.** `BankTransaction.transaction_id` UNIQUE is the dedup mechanism.
- **Refunds.** Money flowing the other direction.
- **Splitting Club into its own entity.** Club metadata lives in `FeeStructure.data` JSONB.
- **Mid-term club enrollment changes.** Assumed not supported; revisit if ESM needs it.
