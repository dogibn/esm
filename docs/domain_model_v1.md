# Domain model — v1

This document defines the core entities of the ESM Payment Tracker, their
relationships, and the lifecycle of a payment from bank transaction to
recorded fee payment. It is the shared vocabulary for the codebase: schema,
API, and UI should all use these names.

The app is a payment tracker layered on top of data that originates
elsewhere (esmlh.edu.mn). It is **not** a system of record for student
enrollment or club registration — that data is imported at the start of
each year (enrollment) and each term (club enrollment, charges).

---

## Cadence of change

Different things in this domain change at different rates. The data model
reflects that explicitly rather than scoping everything to the smallest
unit.

| Thing                                | Changes per       |
|--------------------------------------|-------------------|
| Student exists / is active           | year              |
| Grade level (the level itself)       | rarely            |
| Class (`Grade`) + assigned teacher   | year              |
| Enrollment in a class                | year              |
| Tuition fee rate, bus fee rate       | rarely (year-ish) |
| Registration fee rate                | rarely            |
| Club enrollment                      | term              |
| Club fees (incl. teacher etc.)       | term              |
| Charges — tuition, registration      | year              |
| Charges — bus, clubs                 | term              |
| Payments                             | continuously      |

ESM runs on **academic years**, each with **four terms**. Year-cadence
data is scoped to `AcademicYear`. Term-cadence data is scoped to
`AcademicTerm`. Stable fees are not term-scoped at all — they live across
years using validity ranges.

---

## Entities

### Student
A person enrolled at ESM. Identified by a school-assigned student ID.
Stable across years.

Fields the app cares about:
- `student_id` (school-assigned, unique)
- `first_name`
- `last_name`
- `parent_phone`

A Student is not directly tied to a Grade or AcademicYear. Those live on
`Enrollment`.

### GradeLevel
The numeric grade level (e.g. `"1"`, `"5+"`). Stable across years.
Identifies the level used to look up tuition in
`FeeStructure.data.by_grade`. The level itself rarely changes; what
changes year to year is the *classes* at that level (sub-sections like
`"1JB"`, `"5+A"`).

Fields:
- `code` (string — e.g. `"1"`, `"5+"`. Used as the key into tuition
  `by_grade`. Treated as opaque; not necessarily numeric.)
- `display_name` (e.g. `"Grade 1"`, `"Kindergarten 5+"`)
- `sort_order` (integer — for UI ordering; e.g. `5+` sorts before `1`)

### Grade
A specific class section in a specific academic year (e.g. `"5+A"`,
`"1JB"`). Per-year — class names, the assigned teacher, and which
students belong all change year to year.

Fields:
- `name` (e.g. `"1JB"` — unique within an academic year)
- `grade_level_id` (FK to `GradeLevel`)
- `academic_year_id` (FK)
- `teacher_name` (string — denormalized. We don't model Teacher as an
  entity in v1; the school's source of truth for teacher data lives
  elsewhere.)
- `teacher_email` (string, nullable)

> **Why split Grade from GradeLevel.** Tuition is keyed by *level*, not
> by class section. Storing `level` on every Grade row would duplicate
> data and risk drift across the many classes at the same level. The
> split makes the cadence (level = stable, class = yearly) explicit.

### AcademicYear
The year-level scope (e.g. "2025–2026").

Fields:
- `name`
- `start_date`, `end_date`
- `is_current` (boolean — exactly one row true)

### AcademicTerm
Belongs to an `AcademicYear`. ESM has 4 per year (Term 1–4).

Fields:
- `academic_year_id` (FK)
- `name` ("Term 2")
- `start_date`, `end_date`
- `is_current` (boolean — exactly one row true)

### Enrollment
Links a `Student` to an `AcademicYear` and a `Grade`. One row per student
per year they attend. Also the natural home for year-scoped agreements
between the school and the student: tuition contract reference, tuition
discounts.

Fields:
- `student_id` (FK)
- `academic_year_id` (FK)
- `grade_id` (FK — must point to a Grade in the same academic year;
  invariant enforced in code, not the DB)
- `status` (`active` / `inactive` / `withdrawn`)
- `student_category` (`new` / `old`) — determines registration fee
- `tuition_contract_id` (string, nullable) — external contract reference
  from the school's records. Populated at year-start when contracts are
  signed; nullable because the year-start import may run before all
  contracts are in.

`student_category = new` triggers a registration-fee `Charge` for that
year.

### ClubEnrollment
Records that a student signed up for a specific club fee in a specific
term. Generated at term start from the esmlh.edu.mn import.

Fields:
- `student_id` (FK)
- `fee_structure_id` (FK — points at the club fee row in FeeStructure)
- `academic_term_id` (FK)

This entity exists so the app can answer "who is in robotics this term"
and so charge generation has a clean source.

### FeeStructure
A fee that applies somewhere in time. Heterogeneous fees (flat, per-grade,
club with metadata) are stored in one table using a JSONB `data` column.

Fields:
- `fee_name` (string — e.g. `"tuition"`, `"bus_fee"`, `"registration"`,
  `"Cheerleading GR3"`)
- `data` (jsonb — shape depends on fee; see catalog below)
- `academic_term_id` (nullable FK)
  - `NULL` = stable, school-wide fee (tuition, bus, registration)
  - non-null = fee specific to that term (clubs)
- `effective_from` (date — when this version of the fee starts applying)
- `superseded_at` (nullable timestamp — when this version was replaced;
  `NULL` means currently effective)

**Constraint:** `UNIQUE (fee_name, academic_term_id, effective_from)`.

**Validity model.** A stable fee (e.g. tuition) is one row that stays
current until its value changes. To change it: set `superseded_at` on the
old row and insert a new row with new `effective_from`. Term-specific
fees (clubs) are scoped to a single term; their lifetime is the term.

#### JSONB shape catalog

The `data` column uses one of these shapes. Adding a new shape is a
domain decision and must be added to this catalog before code uses it.

```
Flat fee (bus, registration):
  { "amount": 450000 }

Per-grade-level fee (tuition):
  { "by_grade": { "1": 2000000, "2": 2200000, "5+": 1800000, ... } }

Club fee:
  {
    "amount": 300000,
    "teacher": "...",
    "schedule": "..."
  }
```

> **Future split.** If club metadata grows (rosters, attendance,
> capacity, room assignments), the club bits should move out into a
> dedicated `Club` entity that `FeeStructure` references. JSONB is fine
> for v1.

### Charge
An obligation: "Student S owes amount A for fee F."

Fields:
- `student_id` (FK)
- `academic_year_id` (nullable FK) — set for year-cadence fees
- `academic_term_id` (nullable FK) — set for term-cadence fees
- `fee_name` (string — matches some `FeeStructure.fee_name`)
- `amount` (the resolved **gross** amount, in MNT — discounts are *not*
  subtracted here)
- `notes` (free text — used when an accountant manually adjusts)
- `created_at`

**Scope is exclusive.** Exactly one of `academic_year_id` /
`academic_term_id` must be set. Enforced as a DB CHECK constraint.

**Cadence by fee_name:**
- `tuition` → year (uses `academic_year_id`)
- `registration` → year
- `bus_fee` → term
- club fees → term

**Resolved gross amount, not net.** When a Charge is created, the gross
amount is resolved from FeeStructure and *stored*. Discounts are stored
separately on `Enrollment` and subtracted at read time. This preserves an
audit trail (gross + discount + net are all recoverable) and lets
discounts be added/edited later without recomputing historical Charges.

**Status is derived.** Unpaid / partially paid / paid in full is computed
as:

```
For Charge C:
  if C.fee_name = 'tuition':
    E = the Enrollment with E.student_id = C.student_id
                       AND E.academic_year_id = C.academic_year_id
    discount_total = SUM(D.amount for D in Discounts of E)
  else:
    discount_total = 0

  effective_amount = C.amount − discount_total
  balance          = effective_amount − SUM(Payment.amount for C)
```

For non-tuition charges, `discount_total = 0` (no discounts apply in v1).

### Discount
A reduction applied to an Enrollment's tuition.

**Tuition only in v1.** Modeled as `Discount → Enrollment` (rather than
`Discount → Charge`) because (a) every tuition charge maps 1:1 to an
Enrollment for that year, and (b) attaching the discount to the
Enrollment makes the "tuition only" rule structural — there's no
discountable Charge to mistakenly link to. If non-tuition discounts are
ever needed in v2, this will need to change.

Modeled as a *recorded outcome*, not a *computed rule* — v1 stores the
amount that was applied without committing to how it was calculated.

Fields:
- `enrollment_id` (FK)
- `name` (string — e.g. `"sibling"`, `"scholarship"`, `"early_payment"`)
- `amount` (MNT reduction)
- `notes` (free text)
- `created_at`
- `created_by` (FK to User)

Multiple Discount rows can attach to one Enrollment (e.g. sibling +
scholarship). Edit by editing the row, or by deleting and creating a new
one.

> **v2 evolution.** When discount rules become clear, add columns like
> `kind` (`flat` / `percentage` / `override`) and `rate`, plus a
> `DiscountType` reference table to constrain `name`. Existing rows
> remain valid with those new columns NULL. If non-tuition discounts
> emerge, re-link to `Charge` (with a constraint that the linked Charge's
> fee is in the discountable set).

### BankTransaction
One row from an uploaded bank file that the accountant has confirmed is
a student payment.

Fields:
- `transaction_id` (string — the bank's transaction identifier from the
  uploaded file. **UNIQUE** — prevents duplicate import of the same row
  if a file is re-uploaded.)
- `sender_name`
- `sender_account`
- `memo`
- `amount`
- `transaction_at` (timestamp with timezone — date and time of the
  transaction. Time is included so accountants can disambiguate
  transactions on the same day.)
- `status` (`matched` / `unmatched`)

Non-student rows (bank fees, refunds, unrelated transfers) are filtered
at upload and during review — they are never persisted. There is no
`ignored` status. The DB has no record of bank rows that were deleted at
review time; if recovery is needed, the bank file is re-uploadable
(safely — `transaction_id` deduplicates).

> **Out of scope for v1: import batches.** Tracking which upload
> produced which transaction (via an `ImportBatch` entity that owns the
> original file in storage) is deferred. Accountants can verify
> transactions via `transaction_id` + `transaction_at`. Reconsider if
> audit needs grow.

### Payment
A recorded allocation of money from a `BankTransaction` to a `Charge`.

Fields:
- `bank_transaction_id` (FK)
- `charge_id` (FK)
- `amount`
- `recorded_by` (FK to User)
- `recorded_at`

A single BankTransaction can produce multiple Payments (split across
Charges). A single Charge can receive multiple Payments (installments).

### MatchProposal
The system's *guess* at how to turn a `BankTransaction` into Payment(s),
shown to the accountant during review. **Ephemeral — not persisted.**

Fields (in-memory only):
- bank transaction reference
- proposed grade level / class
- proposed student
- proposed allocation: list of (`charge_id`, `amount`)
- match signals: which fields contributed (memo grade, memo name,
  account number, amount). Surfaced in the UI so the accountant can
  judge the proposal — not shown as a numeric confidence score.

### User (Accountant)
Someone who signs in to the app. Five total in v1: one admin, four
regular accountants. Accounts are created out-of-band by the admin
(no signup flow, no in-app password reset in v1).

Permission model in v1 is minimal: regular accountants do everything
except manage `FeeStructure` (admin only — and even that is done via
year/term-start import, not a UI).

Fields:
- `id` (uuid — mirrors Supabase Auth `auth.users.id`)
- `email`
- `role` (`accountant` / `admin`)
- `created_at`

---

## Key relationships

- `Student` has many `Enrollment`s (one per year attended).
- `Enrollment` links one Student, one AcademicYear, one Grade. The
  Grade's `academic_year_id` must equal the Enrollment's
  `academic_year_id` (invariant, enforced in code).
- `Enrollment` has many `Discount`s (zero or more, applied to tuition).
- `GradeLevel` has many `Grade`s (one per academic year × class section).
- `Grade` belongs to one GradeLevel and one AcademicYear.
- `Student` has many `ClubEnrollment`s (one per club per term).
- `ClubEnrollment` links one Student, one FeeStructure (the club fee
  row), one AcademicTerm.
- `FeeStructure` rows are scoped by `(fee_name, academic_term_id,
  effective_from)`. Stable fees have `academic_term_id = NULL`.
- `Charge` belongs to one Student and one of (AcademicYear,
  AcademicTerm) — never both. References a `fee_name` (no FK — see
  "Decisions taken").
- A tuition `Charge` is implicitly linked to an `Enrollment` via the
  `(student_id, academic_year_id)` pair — no FK column on Charge.
- `BankTransaction` has many Payments (or zero, briefly, during review).
- `Payment` belongs to one BankTransaction and one Charge.
- `MatchProposal` is transient — not stored.

---

## Lifecycle: year start (data import)

Pre-v1-UI workflow — run as a script by the admin before each academic
year begins. Documented here because the rest of the model assumes it
has happened.

1. Pull from esmlh.edu.mn: full student roster with class assignments
   for the new year, plus class teacher assignments.
2. Insert `AcademicYear` row, flip `is_current` to it (and false on the
   previous one).
3. Ensure `GradeLevel` rows exist for all levels present this year.
   (Levels rarely change; this is mostly a no-op after year one.)
4. Insert `Grade` rows for each class section offered this year, linked
   to its level and academic year, with the assigned teacher's name and
   email.
5. Insert/update `Student` rows for new students.
6. Insert `Enrollment` rows: one per student × this year, linked to
   their `Grade`, with `status = active`, `student_category` of `new`
   or `old`, and `tuition_contract_id` populated where known.
7. Insert `Discount` rows on Enrollments where the discount is known at
   import time (e.g. carried over from prior years, or supplied with
   the import data).
8. Generate year-cadence Charges (storing **gross** amounts):
   - **Registration**: every student with `student_category = new`
     gets a registration Charge (scoped to the new academic year).
   - **Tuition**: every active enrollment gets a tuition Charge
     (scoped to the new academic year). Amount resolved from the
     current `FeeStructure` row for `"tuition"`, looked up by the
     student's `Grade.grade_level.code` against
     `FeeStructure.data.by_grade`. Discounts are *not* subtracted into
     this amount.

## Lifecycle: term start (data import)

Run as a script before each term begins.

1. Pull from esmlh.edu.mn: club enrollments and club fee data for the
   new term.
2. Insert `AcademicTerm` row, flip `is_current`.
3. Insert/update `FeeStructure` rows for the term:
   - For each club offered this term: a row with
     `academic_term_id = <this term>` and JSONB containing amount,
     teacher, schedule.
4. Insert `ClubEnrollment` rows linking students to the club fee rows.
5. Generate term-cadence Charges for each active enrolled student:
   - **Bus** — students opted in get a bus Charge (scoped to the term).
     Bus opt-in source TBD — see open questions.
   - **Clubs** — every `ClubEnrollment` for this term produces a Charge
     (scoped to the term).

After this completes, the term is "open for payments" and accountants
can start importing bank transactions.

## Lifecycle: bank transaction → recorded payment

1. Accountant uploads a bank file. The system parses rows, deduplicates
   against existing `BankTransaction.transaction_id` values, and shows
   new rows in a review UI alongside `MatchProposal`s.
2. For each row, the system constructs a `MatchProposal` by parsing
   the memo (grade, name, fee keywords), checking the sender account
   number against known student contacts, and reconciling the amount
   against that student's outstanding Charges (using the **effective**
   amount — i.e. gross − discounts − payments-so-far).
3. The accountant reviews each row:
   - **Confirm** (with edits if needed) → creates `Payment` rows,
     persists the `BankTransaction` with `status = matched`.
   - **Delete** → row is discarded; nothing persists.
   - **Skip / leave for later** → row persists with
     `status = unmatched` and stays in the unmatched queue.
4. Unmatched transactions remain visible from the Transaction History
   view and can be matched later.

---

## Decisions taken

- **Year vs term split, with mixed-cadence Charges.** Year-cadence things
  (Student, Enrollment, GradeLevel, stable fees) live at year scope.
  Term-cadence things (ClubEnrollment, club fees) live at term scope.
  `Charge` itself supports both — one nullable FK each, exclusive.
- **GradeLevel vs Grade split.** Level is stable and identifies tuition
  rate; Grade is per-year and identifies a class section + teacher.
  Avoids duplicating level on every per-year row.
- **Tuition is annual, not per-term.** One tuition Charge per
  Enrollment, generated at year start. Matches how the school contracts
  tuition annually.
- **No `FeeType` table.** `FeeStructure` uses JSONB so heterogeneous
  fee shapes (flat / per-grade / club) live in one table. Trade-off:
  no referential integrity between `Charge.fee_name` and
  `FeeStructure.fee_name`. Mitigated by `UNIQUE` constraint on
  FeeStructure and a code-level helper exposing valid fee_names.
- **Validity ranges on FeeStructure.** Stable fees stay as one row
  across many years; superseded when value changes.
- **Charge stores resolved gross amount.** Discounts and payments are
  separate; the effective amount and balance are computed at read time.
  Preserves audit trail and tolerates late-discovered discounts without
  rewriting historical Charges.
- **Discount belongs to Enrollment, not Charge.** Tuition is the only
  discountable fee in v1, and tuition is 1:1 with Enrollment for a given
  year. Linking discounts to Enrollment makes the "tuition only" rule
  structural — there is no Charge column to mis-target.
- **Teacher is denormalized on Grade, not its own entity.** ESM's
  source of truth for teacher data lives elsewhere; we only need name
  + email for display. No `Teacher` table in v1.
- **Separate BankTransaction and Payment tables.** One transaction can
  fund multiple Charges; one Charge can receive multiple transactions.
  Separation keeps the bank record immutable and queries simple.
- **BankTransaction.transaction_id is the deduplication key.** Re-uploads
  of the same file are safe because of `UNIQUE (transaction_id)`. No
  `ImportBatch` entity in v1; original-file storage is deferred.
- **Non-student bank rows are filtered, not persisted.** Accountants
  delete them at upload/review time. No `ignored` status, no audit
  trail of deletions; bank files are re-uploadable.
- **MatchProposals are ephemeral.** Not persisted. The unmatched queue
  is just BankTransaction rows with `status = unmatched`.
- **Match confidence shown as which fields matched**, not as a numeric
  score. Accountants need to understand *why*, not see a percentage.
- **Auth.** Each accountant has their own account, created by the admin
  out-of-band. Password reset is admin-mediated in v1.
- **No siblings/family modeling in v1.** Sibling discounts are recorded
  as flat per-Enrollment `Discount` rows. Family relationships will be
  modeled in v2 if needed.

---

## Out of scope for v1

- Year/term-end roll-over UI. New years and terms are added by script.
- `FeeStructure` / `Student` / `Enrollment` / `Grade` CRUD UI.
- Per-student detail page.
- Discount *rules* (kind / percentage / order of application). v1 stores
  recorded amounts only.
- Discounts on non-tuition fees.
- `Family` / siblings entity.
- `Teacher` entity. Teacher info is denormalized on Grade.
- `ImportBatch` entity and original-file storage.
- Refunds (money flowing the other direction).
- Splitting `Club` into its own entity.
- Mid-term club enrollment changes (assumed not supported in v1; revisit
  if ESM needs it).

---

## Open questions

Items that don't block v1 but should be resolved before they bite.

- **`tuition_contract_id` source.** Where do contract IDs come from at
  year-start import? esmlh.edu.mn? Manual entry? Affects the import
  script.
- **Bus opt-in source.** Where does the term-start import learn which
  students are taking the bus? esmlh.edu.mn? Manual list? Carried over
  from previous term?
- **esmlh.edu.mn access.** Does it expose an API, or is the import
  scraping / downloaded files? Determines how scriptable the
  year/term-start workflow is.
- **Mid-year withdrawal.** What happens to a student's unpaid Charges
  if they leave mid-year? Cancelled? Still owed? Affects how
  `Enrollment.status = withdrawn` is handled.
- **Mid-term club drop.** If a student drops a club mid-term, is the
  Charge cancelled, refunded, or still owed?
- **Tuition rate change mid-year.** A tuition Charge is created at
  year-start with the resolved gross amount. If the rate changes during
  the year, existing charges keep the old amount unless manually
  adjusted. Confirm this is acceptable.
- **Existing discounts on day one.** Confirm exactly which students
  have which discounts in the data being loaded.