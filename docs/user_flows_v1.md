# User flows — v1

Four flows define what v1 must support end-to-end. Each flow describes
what is accomplished, not how the UI looks.

The first three are accountant-facing workflows in the app. The fourth is
a script run by the admin and is documented here because the rest of the
system depends on it having happened.

---

## 1. Tracking view

**Purpose**
The accountant comes here to answer questions about who has paid what.
Examples this view must answer quickly:

- How much does each student owe, and for what?
- Which students haven't paid the bus fee?
- In each class, who has paid tuition and who hasn't?
- Which students owe the most?

**Flow**
1. Accountant signs in with email and password.
2. The system shows all students with their current balances and payment status
   across fee types. The list is paginated.
3. The accountant searches by student name, ID, or contact info, and/or filters
   by grade level, class, and payment status, until the question they came with
   is answered.

**Notes**
- The view is read-only. No data is created or modified here.
- The bank-transaction side of things lives in the **Transaction history**
  view (flow 3), kept deliberately separate from this Payment-side view.

---

## 2. Bank transaction import

**Purpose**
The accountant has just downloaded an Excel/CSV file of bank transactions and
needs to record those transactions as payments against student fees.

**Flow**
1. Accountant clicks "import" from the main page.
2. Accountant uploads the bank file (drag-and-drop or file picker).
3. The system parses each transaction. Rows whose `transaction_id` matches
   an already-imported `BankTransaction` are filtered out (safe re-upload).
   For each remaining row, it displays: transaction id, sender name, sender
   account number, memo, amount, and timestamp.
4. The system attempts to match each transaction to a student and a fee:
   - The memo is parsed for grade, name, and payment type.
   - The sender's account number can also be used to identify the student.
   - The amount can help identify the specific fee.
   - One transaction may map to more than one fee (e.g., a parent paying
     tuition and bus fee in a single transfer).
   - Match confidence is shown as which fields contributed (memo grade, memo
     name, account number, amount), not as a numeric score.
5. For transactions where parsing fails or is ambiguous, match fields are left
   empty for the accountant to fill in manually.
6. The accountant reviews each row and either:
   - **Confirms** (with edits if needed) → payments are recorded.
   - **Deletes** the row (it is not a student payment — bank fee, refund,
     unrelated transfer). Deleted rows are not persisted.
   - **Skips** the row → it stays in the unmatched queue and can be matched
     later from the Transaction history view.
7. Confirmed rows become `BankTransaction` records with one or more `Payment`
   allocations against `Charge`s.

---

## 3. Transaction history

**Purpose**
After a bank import, the accountant needs a way to verify the import
worked, find rows that were skipped during review, and look up specific
historical transactions. This view is the operational counterpart to the
Tracking view: Tracking is the **payment side** (what students owe and
have paid), Transaction history is the **bank side** (what came in from
the bank, matched or not).

**Flow**
1. Accountant clicks "transactions" from the main navigation.
2. The view shows two sections, top to bottom:
   - **Unmatched queue** — `BankTransaction` rows with
     `status = 'unmatched'`. The primary operational use case: rows that
     need an accountant to come back and match them. Each row can be
     opened to match against a student/charge.
   - **History** — all `BankTransaction` rows, sorted by `transaction_at`
     descending, with their status and (for matched rows) which Charges
     they paid against. Searchable by sender name, memo, transaction id,
     or amount. Filterable by status and date range.
3. Clicking an unmatched row opens the same review UI used during the
   initial import (flow 2, step 6) — accountant matches and confirms,
   marks as not a student payment (deletes the row), or leaves it for
   later.

**Notes**
- This view doesn't introduce any data the import flow doesn't already
  create. It's a different read + match surface over existing
  `BankTransaction` rows.
- It exists in v1 specifically so the import flow has observability:
  without it, a row skipped during review only resurfaces if someone
  remembers it exists.

---

## 4. Year-start and term-start data import (admin script, not UI)

**Purpose**
The app does not source-of-truth student enrollment, club enrollment, or
fee structures. That data lives on esmlh.edu.mn and must be loaded into
the app at the start of each year (enrollment) and each term (clubs,
charges).

**Flow (year start)**
1. Admin runs the year-start import script.
2. The script pulls the student roster, class assignments, and class
   teacher assignments from esmlh.edu.mn for the new year.
3. New `AcademicYear` row is inserted; `is_current` flipped.
4. `GradeLevel` rows are ensured (mostly a no-op after year one).
5. `Grade` rows are inserted for each class section offered this year,
   linked to its level and academic year, with the assigned teacher's
   name and email.
6. New `Student` records are created; existing students get a new
   `Enrollment` row for the year (with grade, status, new/old category,
   and tuition contract id where known).
7. Year-cadence `Charge`s are generated:
   - **Registration** for every new student.
   - **Tuition** for every active enrollment, scoped to the academic
     year, with amount resolved from the current `FeeStructure` row for
     `"tuition"` keyed by the student's grade level code.

**Flow (term start)**
1. Admin runs the term-start import script.
2. The script pulls club enrollments and club fee data from esmlh.edu.mn.
3. New `AcademicTerm` row is inserted; `is_current` flipped.
4. New `FeeStructure` rows are created for the term's clubs.
5. `ClubEnrollment` rows link students to the clubs they signed up for.
6. Term-cadence `Charge`s are generated: bus for opted-in students, club
   fees per `ClubEnrollment`. (Tuition is **not** generated here — it's
   year-cadence, generated once at year-start.)

**Notes**
- This flow has no UI in v1. It exists as scripts the admin runs.
- It is documented in this user-flows doc because the accountant flows
  above assume it has happened.

---

## Open questions

Items that don't block v1 but should be answered before they bite.

- **Auth detail.** How are accountant accounts created (admin invites?
  manual seeding?), and how is password reset handled in practice if
  it's admin-mediated?
- **Bus opt-in source.** Where does the term-start import learn which
  students are taking the bus this term?
- **Tuition contract id source.** Where does the year-start import learn
  the contract id per student? esmlh.edu.mn or manual?
- **esmlh.edu.mn access.** API or scraping/downloaded files? Affects
  how the import scripts are written.
- **Mid-term changes.** What happens if a student joins or drops a
  club mid-term, or withdraws from school mid-year? v1 assumes these
  don't happen; revisit if they do.