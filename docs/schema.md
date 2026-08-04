-0# Database schema

Authoritative reference for table names, column names, types, and constraints. The implementation lives in `db/schema.ts` (Drizzle); when this doc and the code disagree, fix the code.

For *what* the entities mean and *why* the schema looks like this, see `domain_model.md`.

---

## Conventions

- **Naming.** Tables and columns are `snake_case`. Table names are plural. Booleans are positively framed (`is_current`).
- **Primary keys.** `users.id` is `uuid` (mirrors `auth.users.id`). Every other table uses `serial`.
- **Foreign keys.** All FKs are `NOT NULL` unless explicitly nullable. `ON DELETE` defaults to `RESTRICT`.
- **Money.** `bigint`, integer MNT (no decimals). E.g. `2,000,000` MNT → `2000000`.
- **Timestamps.** `timestamptz` (UTC), never `timestamp`. Every table has `created_at timestamptz NOT NULL DEFAULT now()`. Tables that get edited in normal use also have `updated_at`.
- **Dates vs timestamps.** `date` for calendar-day-only (academic year start, fee `effective_from`). `timestamptz` for time-of-day (`transaction_at`, audit columns).
- **Enums.** `text` columns with a `CHECK` constraint, not Postgres `ENUM` types.
- **JSONB.** Used only for `fee_structures.data`. Shapes documented in `domain_model.md` (FeeStructure entity).

---

## Tables

### `users`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK; equals `auth.users.id` |
| `email` | `text` | NOT NULL, UNIQUE |
| `role` | `text` | NOT NULL, CHECK in (`'accountant'`, `'admin'`) |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

### `grade_levels`

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `code` | `text` | NOT NULL, UNIQUE — e.g. `"1"`, `"5+"`. Used as JSONB key for tuition |
| `sort_order` | `integer` | NOT NULL — UI ordering |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

### `grades`

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `name` | `text` | NOT NULL — e.g. `"1JB"` |
| `grade_level_id` | `integer` | NOT NULL, FK → `grade_levels.id` |
| `academic_year_id` | `integer` | NOT NULL, FK → `academic_years.id` |
| `teacher_name` | `text` | NOT NULL |
| `teacher_email` | `text` | nullable |
| `teacher_phone` | `text` | nullable |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- `UNIQUE (academic_year_id, name)`
- INDEX `(academic_year_id, grade_level_id)`

### `academic_years`

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `name` | `text` | NOT NULL, UNIQUE — e.g. `"2025-2026"` |
| `start_date` | `date` | NOT NULL |
| `end_date` | `date` | NOT NULL |
| `is_current` | `boolean` | NOT NULL DEFAULT `false` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- Partial UNIQUE `(is_current) WHERE is_current = true`

### `academic_terms`

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `academic_year_id` | `integer` | NOT NULL, FK → `academic_years.id` |
| `name` | `text` | NOT NULL — e.g. `"Term 2"` |
| `start_date` | `date` | NOT NULL |
| `end_date` | `date` | NOT NULL |
| `is_current` | `boolean` | NOT NULL DEFAULT `false` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- Partial UNIQUE `(is_current) WHERE is_current = true`
- INDEX `(academic_year_id)`

### `students`

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `student_id` | `text` | NOT NULL, UNIQUE — school-assigned, from esmlh.edu.mn |
| `first_name` | `text` | NOT NULL |
| `last_name` | `text` | NOT NULL |
| `parent_email` | `text` | nullable |
| `parent_phone` | `text` | nullable |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- INDEX `(last_name, first_name)`

### `enrollments`

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `student_id` | `integer` | NOT NULL, FK → `students.id` |
| `academic_year_id` | `integer` | NOT NULL, FK → `academic_years.id` |
| `grade_id` | `integer` | NOT NULL, FK → `grades.id` |
| `status` | `text` | NOT NULL, CHECK in (`'active'`, `'inactive'`, `'withdrawn'`) |
| `student_category` | `text` | NOT NULL, CHECK in (`'new'`, `'old'`) |
| `tuition_contract_id` | `text` | nullable — external reference |
| `student_code` | `text` | nullable — `code` from tuition document; join key to other financial documents |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- `UNIQUE (student_id, academic_year_id)`
- Partial UNIQUE `(academic_year_id, student_code) WHERE student_code IS NOT NULL`
- INDEX `(academic_year_id, grade_id)`

### `fee_structures`

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `fee_name` | `text` | NOT NULL — e.g. `"tuition"` |
| `data` | `jsonb` | NOT NULL — shape per `domain_model.md` JSONB catalog |
| `academic_term_id` | `integer` | nullable, FK → `academic_terms.id` (NULL = stable school-wide) |
| `effective_from` | `date` | NOT NULL |
| `superseded_at` | `timestamptz` | nullable (NULL = currently effective) |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- `UNIQUE (fee_name, academic_term_id, effective_from)`
- Partial INDEX `(fee_name) WHERE superseded_at IS NULL`

### `club_enrollments`

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `student_id` | `integer` | NOT NULL, FK → `students.id` |
| `fee_structure_id` | `integer` | NOT NULL, FK → `fee_structures.id` |
| `academic_term_id` | `integer` | NOT NULL, FK → `academic_terms.id` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- `UNIQUE (student_id, fee_structure_id)`

### `bank_transactions`

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `transaction_id` | `text` | NOT NULL, UNIQUE — bank's ID; dedup key |
| `sender_name` | `text` | nullable |
| `sender_account` | `text` | nullable |
| `memo` | `text` | nullable |
| `amount` | `bigint` | NOT NULL — MNT |
| `transaction_at` | `timestamptz` | NOT NULL |
| `status` | `text` | NOT NULL, CHECK in (`'matched'`, `'unmatched'`) |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- Partial INDEX `(status) WHERE status = 'unmatched'`
- INDEX `(transaction_at DESC)`

### `charges`

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `student_id` | `integer` | NOT NULL, FK → `students.id` |
| `academic_year_id` | `integer` | nullable, FK → `academic_years.id` |
| `academic_term_id` | `integer` | nullable, FK → `academic_terms.id` |
| `fee_name` | `text` | NOT NULL — no FK; see "Not enforced at DB" |
| `amount` | `bigint` | NOT NULL — gross, in MNT |
| `notes` | `text` | nullable |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- `CHECK ((academic_year_id IS NOT NULL AND academic_term_id IS NULL) OR (academic_year_id IS NULL AND academic_term_id IS NOT NULL))`
- INDEX `(student_id, academic_year_id)`
- INDEX `(student_id, academic_term_id)`
- INDEX `(fee_name)`

### `discount_types`

The reusable discount catalog (`domain_model.md` § DiscountType). Admin-curated.

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `name` | `text` | NOT NULL, UNIQUE — e.g. `"Early-bird"` |
| `unit` | `text` | NOT NULL, CHECK in (`'percent'`, `'mnt'`) |
| `value` | `numeric(12,4)` | nullable — fixed percent/amount, or NULL = "custom" (entered on apply) |
| `note` | `text` | nullable |
| `is_active` | `boolean` | NOT NULL DEFAULT `true` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `created_by` | `uuid` | NOT NULL, FK → `users.id` |

- CHECK `value IS NULL OR (value >= 0 AND (unit <> 'percent' OR value <= 100))`

### `discounts`

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `enrollment_id` | `integer` | NOT NULL, FK → `enrollments.id` |
| `discount_type_id` | `integer` | nullable, FK → `discount_types.id` — the catalog entry; NULL for legacy/pre-catalog rows |
| `name` | `text` | NOT NULL — snapshot of the type's name at apply time |
| `unit` | `text` | NOT NULL, CHECK in (`'percent'`, `'mnt'`) — snapshot |
| `value` | `numeric(12,4)` | NOT NULL — the percent/amount applied (snapshot) |
| `position` | `integer` | NOT NULL — 0-based application order; discounts compound in this order |
| `amount` | `bigint` | NOT NULL — resolved MNT reduction this line contributed, in sequence |
| `notes` | `text` | nullable |
| `sibling_student_id` | `integer` | nullable, FK → `students.id`, ON DELETE SET NULL — sibling discounts only; see `domain_model.md` § Discount |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `created_by` | `uuid` | NOT NULL, FK → `users.id` |

- INDEX `(enrollment_id)`
- INDEX `(sibling_student_id)`
- INDEX `(discount_type_id)`
- UNIQUE `(enrollment_id, position)`
- `sibling_student_id` is the one FK with `ON DELETE SET NULL` (the convention's default is RESTRICT). It's an optional cross-reference: deleting a student clears the pointer rather than blocking the delete, and the discount stays valid.
- `amount` is the **resolved** reduction after compounding, so the balance formula stays a `SUM`. `unit`/`value`/`position` record the rule that produced it.

### `payments`

| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `bank_transaction_id` | `integer` | NOT NULL, FK → `bank_transactions.id` |
| `charge_id` | `integer` | NOT NULL, FK → `charges.id` |
| `amount` | `bigint` | NOT NULL — MNT |
| `recorded_by` | `uuid` | NOT NULL, FK → `users.id` |
| `recorded_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

- INDEX `(charge_id)`
- INDEX `(bank_transaction_id)`

---

## Computing balance

Belongs in a service-layer helper (`features/students/balance.ts`), not duplicated across queries.

For Charge `C`:

`d.amount` is each discount's **resolved** MNT reduction (compounding order already
baked in by `computeTuition` at write time — see `domain_model.md` § Discount), so
the total is a plain `SUM`, not a re-computed fold.

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

---

## Migration order

Drizzle's `drizzle-kit generate` handles ordering automatically. This list is for human review of generated SQL.

1. `users`
2. `grade_levels`
3. `academic_years`
4. `academic_terms`
5. `grades`
6. `students`
7. `enrollments`
8. `fee_structures`
9. `club_enrollments`
10. `bank_transactions`
11. `charges`
12. `discount_types`
13. `discounts` (FK → `discount_types`)
14. `payments`

---

## Not enforced at DB

Constraints enforced in code, not by the database. Each is a deliberate trade-off (rationale in `domain_model.md`).

- **`charges.fee_name` → `fee_structures.fee_name`** has no FK because `fee_name` is not unique in `fee_structures` (same name across terms and validity ranges). A code-level helper exposes valid `fee_name` values.
- **`Enrollment.grade_id` and `Enrollment.academic_year_id` consistency.** An enrollment's grade must belong to the same year.
- **At most one Charge per (student, scope, fee).** Not a unique constraint; the year/term-start import is responsible for not creating duplicates.
