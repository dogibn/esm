# User flows

UI workflows the accountant performs in the app. The fourth lifecycle (year/term-start data import) is a script run by the admin, not a UI flow — see `domain_model.md` §Lifecycle.

---

## 1. Tracking view

**Purpose**

The accountant comes here to answer questions about who has paid what:

- How much does each student owe, and for what?
- Which students haven't paid the bus fee?
- In each class, who has paid tuition and who hasn't?
- Which students owe the most?

**Flow**

1. Accountant signs in with email and password.
2. The view is **scoped to one fee at a time** — a tab row across the top: *All fees | Tuition | Bus | Registration | Clubs*, defaulting to Tuition. The scope lives in the URL (`?fee=bus`), so a view is linkable and survives a refresh.
3. The system shows one row per student — ID, student, class, due, paid, status, last payment — ordered by class, then surname, so a class-filtered view reads like the accountant's spreadsheet. The list is paginated.
4. The accountant searches by student name, ID, or contact info, and/or filters by grade level, class, and payment status, until the question is answered.
5. Clicking a row opens that student's detail page, where the per-fee breakdown lives.

**Notes**
- Read-only view. No data is created or modified here.
- **Fee-scoped, not a matrix.** In a per-fee scope the result set is only the students who hold a charge for that fee — bus, registration, and clubs apply to a minority, so those students are absent rather than shown as blank cells. *All fees* is a rollup (one total per student), not a per-fee column set; the breakdown belongs on the detail page.
- **Due** is the gross charge net of applicable discounts (tuition only — `schema.md` § Computing balance). **Status** (paid / partial / unpaid) is derived, never stored. **Last payment** is dated by `bank_transactions.transaction_at` — when the money moved — not by when an accountant keyed it in.
- Clubs is the one fee where a student may hold several charges in a term; those are summed into the student's single row.
- The *All fees* total adds year-scoped tuition/registration to term-scoped bus/club charges. Different scopes, so the column names both ("year + current term") and must not be read as a single amount owed right now.
- The summary cards (outstanding balance, collected + collection rate) recompute for the selected fee scope, not the whole school.
- The bank-transaction side of things lives in **Transaction history** (flow 3), kept deliberately separate.

---

## 2. Bank transaction import

**Purpose**

The accountant has just downloaded a bank Excel/CSV file and needs to record those transactions as payments against student fees.

**Flow**

1. Accountant clicks "import" from the main page.
2. Accountant uploads the bank file (drag-and-drop or file picker).
3. The system parses each transaction. Rows whose `transaction_id` matches an existing `BankTransaction` are filtered out (safe re-upload). For each remaining row it shows: transaction id, sender name, sender account, memo, amount, timestamp.
4. The system attempts to match each transaction to a student and a fee:
   - Memo parsed for grade, name, payment type.
   - Sender's account number can identify the student.
   - Amount can help identify the specific fee.
   - One transaction may map to more than one fee (e.g. a parent paying tuition and bus fee in a single transfer).
   - Match confidence is shown as which fields contributed (memo grade, memo name, account number, amount), not as a numeric score.
5. For transactions where parsing fails or is ambiguous, match fields are left empty for the accountant to fill in manually.
6. The review screen triages rows into two tiers so the common case is fast. Every row is a compact, **directly editable** one line: memo on the left; **class → student → charge** inputs on the right, where the student list is limited to the chosen class and the charge list to that student's open charges. A single charge takes the full transfer amount; a **Split** control lets one transfer pay several of that student's charges. The chevron toggle reveals read-only detail only — full transaction fields and why it matched (which signals contributed, warnings, alternative candidates).
   - **Confident** — a single, balanced, flag-free auto-match to one charge (e.g. a start-of-year tuition-only transfer for the exact amount). Pre-selected; the accountant glances, unchecks any that look wrong, and clicks **Confirm N selected** to record them in one action.
   - **Needs attention** — everything else (no match, low confidence, split, multiple candidates, flagged, or unbalanced), sorted to the top, each carrying a reason chip.
   For any row the accountant can **Confirm** (after editing the inline inputs), **Discard** it (not a student payment — soft-deleted, reversible; see `history_and_reversibility.md`), or **Skip** it (stays unmatched, resurfaces in Transaction history).
7. Confirmed rows become `BankTransaction` records with one or more `Payment` allocations against `Charge`s. Each confirm is a reversible operation (undo within the window).

---

## 3. Transaction history

**Purpose**

After a bank import, the accountant needs a way to verify the import worked, find rows that were skipped during review, and look up specific historical transactions. The operational counterpart to the Tracking view: Tracking is the **payment side** (what students owe and have paid); Transaction history is the **bank side** (what came in from the bank).

**Flow**

1. Accountant clicks "transactions" in the main navigation.
2. The view shows two sections, top to bottom:
   - **Unmatched queue** — `BankTransaction` rows with `status = 'unmatched'`. The primary operational use case: rows that need an accountant to come back and match them. Each row can be opened to match against a student/charge.
   - **History** — all `BankTransaction` rows, sorted by `transaction_at` descending, with their status and (for matched rows) which Charges they paid. Searchable by sender name, memo, transaction id, or amount. Filterable by status and date range.
3. Clicking an unmatched row opens the same review UI used during the initial import (flow 2, step 6) — accountant matches and confirms, marks as not a student payment (deletes), or leaves it for later.

**Notes**
- This view doesn't introduce any data the import flow doesn't already create. It's a different read + match surface over existing `BankTransaction` rows.
- It exists in v1 specifically so the import flow has observability: without it, a row skipped during review only resurfaces if someone remembers it.

---

## 4. Discount catalog & applying discounts

**Purpose**

Standardize tuition discounts so accountants pick from a shared list instead of typing free-text names and amounts, and make the applied result (compounded, in order) transparent.

**Flow — managing the catalog (admin only)**

1. Any accountant opens "Discounts" in the main navigation and sees the catalog. Only admins see the add/edit controls (the API enforces this too).
2. An admin adds a discount type: a name, a unit (**flat MNT** or **percent**), and either a fixed value or "custom" (left blank — the amount is entered when the discount is applied). Types can be retired (`is_active = false`) so they stop being offered without deleting history.

**Flow — applying discounts to a student**

1. In the New Contract form or a student's Tuition breakdown, the accountant adds a discount row and picks a type from the catalog. For "custom" types they enter the amount/percent.
2. Rows are ordered (move up/down); discounts **compound top to bottom** — each applies to the running total left by the ones above it. A live preview shows each row's resolved reduction and the net tuition.
3. For a sibling-type discount, a sibling student can be linked (see flow notes); the student detail view then shows the sibling and whether they're enrolled this year.

**Notes**
- The net tuition is derived by `computeTuition` (`features/discounts/calc.ts`) and each line's resolved MNT reduction is snapshotted, so the balance stays a simple sum. See `domain_model.md` § Discount.
- Discounts loaded before the catalog existed show as "legacy" rows: preserved and counted, but not tied to a catalog entry.
