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
6. The accountant reviews each row and either:
   - **Confirms** (with edits if needed) → payments are recorded.
   - **Deletes** the row (it is not a student payment — bank fee, refund, unrelated transfer). Deleted rows are not persisted.
   - **Skips** the row → it stays in the unmatched queue and can be matched later from the Transaction history view.
7. Confirmed rows become `BankTransaction` records with one or more `Payment` allocations against `Charge`s.

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
