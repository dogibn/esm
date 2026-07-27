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
2. The system shows all students with their current balances and payment status across fee types. The list is paginated.
3. The accountant searches by student name, ID, or contact info, and/or filters by grade level, class, and payment status, until the question is answered.

**Notes**
- Read-only view. No data is created or modified here.
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
