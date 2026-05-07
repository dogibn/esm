# Database schema — v1

This document is the authoritative reference for table names, column names,
types, and constraints in the ESM Payment Tracker database. It exists as
context for AI-assisted code generation — migrations, queries, and service
code in any session should match this schema exactly.

This is the *physical* model. The *conceptual* model — entity meanings,
lifecycle, business rules — lives in `domain_model_v1.md`. Read that first
to understand *why* the schema looks like this.

The implementation lives in `db/schema.ts` (Drizzle). When this doc and
`db/schema.ts` disagree, the code is wrong; fix the code, not this doc.

---

## Conventions

- **Naming.** Tables and columns are `snake_case`. Table names are plural
  (`students`, not `student`). Booleans are positively framed (`is_current`,
  not `is_archived`).
- **Primary keys.** `users.id` is `uuid` (mirrors `auth.users.id` from
  Supabase Auth). Every other table uses `serial` (auto-incrementing
  integer).
- **Foreign keys.** All FKs are `NOT NULL` unless explicitly nullable in
  the table spec. `ON DELETE` defaults to `RESTRICT` (no cascading
  deletes — they hide data loss bugs).
- **Money.** All monetary amounts are `bigint`, storing integer MNT
  (Mongolian Tögrög, no decimal places). E.g. `2,000,000` MNT is stored
  as `2000000`.
- **Timestamps.** `timestamptz` (UTC), never `timestamp`. Every table has
  `created_at timestamptz NOT NULL DEFAULT now()`. Tables that get edited
  in normal use also have `updated_at` (called out per-table).
- **Dates vs timestamps.** Use `date` where the business cares about a
  calendar day (academic year start, fee `effective_from`). Use
  `timestamptz` where time-of-day matters (`transaction_at`, all `*_at`
  audit columns).
- **Enums.** Implemented as `text` columns with a `CHECK` constraint, not
  Postgres `ENUM` types. Easier to evolve.
- **JSONB.** Used only for `fee_structures.data`, where the shape varies
  by fee kind. Documented separately (see `fee_structures` below).

---

## Tables

### `users`

Application-side user record. One row per row in `auth.users` (manually
created — there's no signup flow in v1; the admin invites accountants
out-of-band).

| Column       | Type          | Constraints                                         | Notes                                |
|--------------|---------------|-----------------------------------------------------|--------------------------------------|
| `id`         | `uuid`        | PK                                                  | Equals `auth.users.id`               |
| `email`      | `text`        | NOT NULL, UNIQUE                                    | Mirrored from `auth.users.email`     |
| `role`       | `text`        | NOT NULL, CHECK in (`'accountant'`, `'admin'`)      |                                      |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()`                            |                                      |

---

### `grade_levels`

Stable grade levels (e.g. `"1"`, `"5+"`). Drives the tuition lookup. Small
reference table; rarely changes.

| Column          | Type          | Constraints              | Notes                                              |
|-----------------|---------------|--------------------------|----------------------------------------------------|
| `id`            | `serial`      | PK                       |                                                    |
| `code`          | `text`        | NOT NULL, UNIQUE         | E.g. `"1"`, `"5+"`. Used as JSONB key for tuition. |
| `display_name`  | `text`        | NOT NULL                 | E.g. `"Grade 1"`, `"Kindergarten 5+"`              |
| `sort_order`    | `integer`     | NOT NULL                 | UI ordering; e.g. `5+` before `1`                  |
| `created_at`    | `timestamptz` | NOT NULL DEFAULT `now()` |                                                    |

---

### `grades`

Per-year class sections (e.g. `"1JB"`, `"5+A"`). Carries denormalized
teacher info; we don't model `Teacher` as an entity in v1.

| Column              | Type          | Constraints                                          | Notes                                |
|---------------------|---------------|------------------------------------------------------|--------------------------------------|
| `id`                | `serial`      | PK                                                   |                                      |
| `name`              | `text`        | NOT NULL                                             | E.g. `"1JB"`                         |
| `grade_level_id`    | `integer`     | NOT NULL, FK → `grade_levels.id`                     |                                      |
| `academic_year_id`  | `integer`     | NOT NULL, FK → `academic_years.id`                   |                                      |
| `teacher_name`      | `text`        | NOT NULL                                             | Denormalized                         |
| `teacher_email`     | `text`        | nullable                                             |                                      |
| `created_at`        | `timestamptz` | NOT NULL DEFAULT `now()`                             |                                      |
| `updated_at`        | `timestamptz` | NOT NULL DEFAULT `now()`                             | Teacher info may change mid-year     |

**Constraint:** `UNIQUE (academic_year_id, name)` — class names are unique
within a year.
**Index:** `(academic_year_id, grade_level_id)` for the tracking view's
filters.

---

### `academic_years`

| Column        | Type          | Constraints                | Notes                                 |
|---------------|---------------|----------------------------|---------------------------------------|
| `id`          | `serial`      | PK                         |                                       |
| `name`        | `text`        | NOT NULL, UNIQUE           | E.g. `"2025-2026"`                    |
| `start_date`  | `date`        | NOT NULL                   |                                       |
| `end_date`    | `date`        | NOT NULL                   |                                       |
| `is_current`  | `boolean`     | NOT NULL DEFAULT `false`   |                                       |
| `created_at`  | `timestamptz` | NOT NULL DEFAULT `now()`   |                                       |

**Index:** partial unique on `(is_current) WHERE is_current = true`.
Enforces "exactly one row is current" at the DB.

---

### `academic_terms`

| Column              | Type          | Constraints                       | Notes                       |
|---------------------|---------------|-----------------------------------|-----------------------------|
| `id`                | `serial`      | PK                                |                             |
| `academic_year_id`  | `integer`     | NOT NULL, FK → `academic_years.id`|                             |
| `name`              | `text`        | NOT NULL                          | E.g. `"Term 2"`             |
| `start_date`        | `date`        | NOT NULL                          |                             |
| `end_date`          | `date`        | NOT NULL                          |                             |
| `is_current`        | `boolean`     | NOT NULL DEFAULT `false`          |                             |
| `created_at`        | `timestamptz` | NOT NULL DEFAULT `now()`          |                             |

**Index:** partial unique on `(is_current) WHERE is_current = true`.
**Index:** `(academic_year_id)`.

---

### `students`

| Column         | Type          | Constraints                | Notes                                  |
|----------------|---------------|----------------------------|----------------------------------------|
| `id`           | `serial`      | PK                         | Internal app ID                        |
| `student_id`   | `text`        | NOT NULL, UNIQUE           | School-assigned ID from esmlh.edu.mn   |
| `first_name`   | `text`        | NOT NULL                   |                                        |
| `last_name`    | `text`        | NOT NULL                   |                                        |
| `parent_name`  | `text`        | nullable                   | Used to aid bank transaction matching  |
| `parent_phone` | `text`        | nullable                   | Used to aid bank transaction matching  |
| `created_at`   | `timestamptz` | NOT NULL DEFAULT `now()`   |                                        |
| `updated_at`   | `timestamptz` | NOT NULL DEFAULT `now()`   |                                        |

**Index:** `(last_name, first_name)` for the tracking view's name search.

---

### `enrollments`

One row per student per year they attend. Also the home for year-scoped
school-student agreements: tuition contract and tuition discounts.

| Column                  | Type          | Constraints                                                  | Notes                                       |
|-------------------------|---------------|--------------------------------------------------------------|---------------------------------------------|
| `id`                    | `serial`      | PK                                                           |                                             |
| `student_id`            | `integer`     | NOT NULL, FK → `students.id`                                 |                                             |
| `academic_year_id`      | `integer`     | NOT NULL, FK → `academic_years.id`                           |                                             |
| `grade_id`              | `integer`     | NOT NULL, FK → `grades.id`                                   | Must belong to same year (enforced in code) |
| `status`                | `text`        | NOT NULL, CHECK in (`'active'`, `'inactive'`, `'withdrawn'`) |                                             |
| `student_category`      | `text`        | NOT NULL, CHECK in (`'new'`, `'old'`)                        | Triggers registration fee if `'new'`        |
| `tuition_contract_id`   | `text`        | nullable                                                     | External reference, populated when known    |
| `created_at`            | `timestamptz` | NOT NULL DEFAULT `now()`                                     |                                             |
| `updated_at`            | `timestamptz` | NOT NULL DEFAULT `now()`                                     |                                             |

**Constraint:** `UNIQUE (student_id, academic_year_id)` — a student has at
most one enrollment per year.
**Index:** `(academic_year_id, grade_id)` for tracking view's class filter.

---

### `fee_structures`

The "what does this fee cost" table. Heterogeneous shapes via JSONB.

| Column              | Type          | Constraints                              | Notes                                |
|---------------------|---------------|------------------------------------------|--------------------------------------|
| `id`                | `serial`      | PK                                       |                                      |
| `fee_name`          | `text`        | NOT NULL                                 | E.g. `"tuition"`, `"bus_fee"`        |
| `data`              | `jsonb`       | NOT NULL                                 | See JSONB shapes below               |
| `academic_term_id`  | `integer`     | nullable, FK → `academic_terms.id`       | NULL = stable school-wide fee        |
| `effective_from`    | `date`        | NOT NULL                                 | When this version starts applying    |
| `superseded_at`     | `timestamptz` | nullable                                 | NULL = currently effective           |
| `created_at`        | `timestamptz` | NOT NULL DEFAULT `now()`                 |                                      |

**Constraint:** `UNIQUE (fee_name, academic_term_id, effective_from)`.
**Index:** `(fee_name) WHERE superseded_at IS NULL` — fast lookup of currently-effective fees.

**JSONB shapes** (must match domain model catalog exactly):

```
Flat fee:        { "amount": 450000 }
Per-grade fee:   { "by_grade": { "1": 2000000, "2": 2200000, "5+": 1800000, ... } }
Club fee:        { "amount": 300000, "teacher": "...", "schedule": "..." }
```

---

### `club_enrollments`

Records that a student signed up for a specific club fee in a specific term.

| Column               | Type          | Constraints                              | Notes                          |
|----------------------|---------------|------------------------------------------|--------------------------------|
| `id`                 | `serial`      | PK                                       |                                |
| `student_id`         | `integer`     | NOT NULL, FK → `students.id`             |                                |
| `fee_structure_id`   | `integer`     | NOT NULL, FK → `fee_structures.id`       | Points at the club fee row     |
| `academic_term_id`   | `integer`     | NOT NULL, FK → `academic_terms.id`       |                                |
| `created_at`         | `timestamptz` | NOT NULL DEFAULT `now()`                 |                                |

**Constraint:** `UNIQUE (student_id, fee_structure_id)` — can't enroll in
the same club fee twice.

---

### `bank_transactions`

One row from an uploaded bank file that the accountant has confirmed (or
left pending) is a student-related transaction. Rows the accountant
deleted at review time are *not* persisted here.

| Column              | Type          | Constraints                                        | Notes                                      |
|---------------------|---------------|----------------------------------------------------|--------------------------------------------|
| `id`                | `serial`      | PK                                                 |                                            |
| `transaction_id`    | `text`        | NOT NULL, UNIQUE                                   | Bank's transaction id; deduplication key   |
| `sender_name`       | `text`        | nullable                                           |                                            |
| `sender_account`    | `text`        | nullable                                           |                                            |
| `memo`              | `text`        | nullable                                           |                                            |
| `amount`            | `bigint`      | NOT NULL                                           | MNT, integer                               |
| `transaction_at`    | `timestamptz` | NOT NULL                                           | Date and time of the transaction           |
| `status`            | `text`        | NOT NULL, CHECK in (`'matched'`, `'unmatched'`)    |                                            |
| `created_at`        | `timestamptz` | NOT NULL DEFAULT `now()`                           |                                            |

**Index:** `(status) WHERE status = 'unmatched'` — for the unmatched queue.
**Index:** `(transaction_at DESC)` — for the Transaction history view's
default sort.

---

### `charges`

An obligation: "Student S owes amount A for fee F." Stored as the **gross**
amount; discounts and payments are subtracted at read time.

| Column              | Type          | Constraints                                                                | Notes                                                             |
|---------------------|---------------|----------------------------------------------------------------------------|-------------------------------------------------------------------|
| `id`                | `serial`      | PK                                                                         |                                                                   |
| `student_id`        | `integer`     | NOT NULL, FK → `students.id`                                               |                                                                   |
| `academic_year_id`  | `integer`     | nullable, FK → `academic_years.id`                                         | Set for year-cadence fees (tuition, registration)                 |
| `academic_term_id`  | `integer`     | nullable, FK → `academic_terms.id`                                         | Set for term-cadence fees (bus, clubs)                            |
| `fee_name`          | `text`        | NOT NULL                                                                   | **No FK** to `fee_structures.fee_name` — see "Not enforced at DB" |
| `amount`            | `bigint`      | NOT NULL                                                                   | **Gross.** Resolved at creation time, stored verbatim             |
| `notes`             | `text`        | nullable                                                                   | Free text for accountant adjustments                              |
| `created_at`        | `timestamptz` | NOT NULL DEFAULT `now()`                                                   |                                                                   |

**Constraint:** `CHECK ((academic_year_id IS NOT NULL AND academic_term_id IS NULL) OR (academic_year_id IS NULL AND academic_term_id IS NOT NULL))` — exactly one scope is set.
**Index:** `(student_id, academic_year_id)` — tracking view, year-cadence; also the join key for tuition→discounts via Enrollment.
**Index:** `(student_id, academic_term_id)` — tracking view, term-cadence.
**Index:** `(fee_name)` — for "all charges of fee X" queries.

---

### `discounts`

A reduction applied to an `Enrollment`'s tuition. The model is structurally
"tuition-only" — discounts attach to Enrollments, not Charges. To compute
the effective tuition amount, join Charge → Enrollment via
`(student_id, academic_year_id)` and sum discounts on that Enrollment.

| Column          | Type          | Constraints                              | Notes                                  |
|-----------------|---------------|------------------------------------------|----------------------------------------|
| `id`            | `serial`      | PK                                       |                                        |
| `enrollment_id` | `integer`     | NOT NULL, FK → `enrollments.id`          |                                        |
| `name`          | `text`        | NOT NULL                                 | E.g. `"sibling"`, `"scholarship"`      |
| `amount`        | `bigint`      | NOT NULL                                 | MNT reduction                          |
| `notes`         | `text`        | nullable                                 |                                        |
| `created_at`    | `timestamptz` | NOT NULL DEFAULT `now()`                 |                                        |
| `created_by`    | `uuid`        | NOT NULL, FK → `users.id`                |                                        |

**Index:** `(enrollment_id)`.

---

### `payments`

A recorded allocation of money from a `BankTransaction` to a `Charge`.

| Column                  | Type          | Constraints                                  | Notes        |
|-------------------------|---------------|----------------------------------------------|--------------|
| `id`                    | `serial`      | PK                                           |              |
| `bank_transaction_id`   | `integer`     | NOT NULL, FK → `bank_transactions.id`        |              |
| `charge_id`             | `integer`     | NOT NULL, FK → `charges.id`                  |              |
| `amount`                | `bigint`      | NOT NULL                                     | MNT          |
| `recorded_by`           | `uuid`        | NOT NULL, FK → `users.id`                    |              |
| `recorded_at`           | `timestamptz` | NOT NULL DEFAULT `now()`                     |              |

**Index:** `(charge_id)` — for balance computation.
**Index:** `(bank_transaction_id)` — for "what did this transaction pay for" queries.

---

## Computing balance

The canonical balance computation for any Charge `C`:

```
discount_total =
  CASE WHEN C.fee_name = 'tuition' THEN
    (SELECT COALESCE(SUM(d.amount), 0)
       FROM discounts d
       JOIN enrollments e ON e.id = d.enrollment_id
      WHERE e.student_id        = C.student_id
        AND e.academic_year_id  = C.academic_year_id)
  ELSE 0
  END

paid_total =
  (SELECT COALESCE(SUM(p.amount), 0)
     FROM payments p
    WHERE p.charge_id = C.id)

balance = C.amount − discount_total − paid_total
```

This belongs in a service-layer helper (e.g. `features/students/balance.ts`),
not duplicated across queries.

---

## Migration order

Tables must be created in dependency order:

1. `users`
2. `grade_levels`
3. `academic_years`
4. `academic_terms` *(→ academic_years)*
5. `grades` *(→ grade_levels, academic_years)*
6. `students`
7. `enrollments` *(→ students, academic_years, grades)*
8. `fee_structures` *(→ academic_terms)*
9. `club_enrollments` *(→ students, fee_structures, academic_terms)*
10. `bank_transactions`
11. `charges` *(→ students, academic_years, academic_terms)*
12. `discounts` *(→ enrollments, users)*
13. `payments` *(→ bank_transactions, charges, users)*

Drizzle's `drizzle-kit generate` handles ordering automatically; this list
is for human review of generated SQL.

---

## Not enforced at DB

These constraints are enforced in code, not by the database. Each is a
deliberate choice — the trade-off is documented in `domain_model_v1.md`.

- **`charges.fee_name` → `fee_structures.fee_name`.** No FK, because
  `fee_name` is not unique in `fee_structures` (the same name has many
  rows across terms and validity ranges). A code-level helper exposes the
  set of valid `fee_name` values, and inserts go through a service
  function that checks against it.
- **`Enrollment.grade_id` and `Enrollment.academic_year_id` consistency.**
  An enrollment's grade must belong to the same year as the enrollment
  itself. Enforced in code.
- **"Exactly one charge per (student, scope, fee) at most."** Not enforced
  by a unique constraint — the year/term-start import is responsible for
  not creating duplicates.

> Discount-applies-only-to-tuition is *no longer* in this list — it's
> structural: discounts are attached to Enrollments and computed only
> against tuition Charges. There's no charge_id column to misuse.

---

## Things explicitly out of scope for v1

These are deferred per the domain model and tech stack. Listed here so
future AI sessions don't re-derive them.

- No `import_batches` table. `BankTransaction.transaction_id` UNIQUE is
  the deduplication mechanism; original-file storage is deferred.
- No `teachers` table. Teacher info is denormalized on `grades`.
- No `families` / `siblings` table.
- No `discount_types` reference table — `discounts.name` is free text.
- No `clubs` table separate from `fee_structures` — club metadata in JSONB.
- No discounts on non-tuition fees. (Would require restructuring Discount
  back to → Charge with a constraint.)
- No soft-delete columns. Deletes are hard deletes (and rare — most
  workflows mark status instead).
- No row-level security (RLS) policies. The app is single-tenant with 5
  trusted users; auth is enforced at the API layer via `requireUser()` /
  `requireAdmin()`.
