# User flows

UI workflows the accountant performs in the app. The fourth lifecycle (year/term-start data import) is a script run by the admin, not a UI flow — see `domain_model.md` §Lifecycle.

---

## 0. Navigation

Every flow below starts from a **left sidebar**, in two groups.

- **The daily loop, unlabelled at the top:** Students, Imports, Transactions, **History**. History sits here on purpose — it drives reversals and is used constantly, so filing it with configuration would lend a daily tool the weight of "settings I shouldn't be poking at".
- **Setup:** Academic calendar, Classes, Fee rates, Discounts, **Users and access**. Everything here is configuration — touched a few times a year, read far more often than written. One group rather than two: once History moves up, splitting the rest into "school" and "money" only invites the argument about which one Classes is. Users and access sits last, and is the one row an accountant never sees at all (§8).

The sidebar also carries the brand and, at its foot, the **identity block** — name, role, and sign-out. That is the one place for "things about me", which is why there is no account menu in a header. There is no header bar at all: each page's own `PageHeader` owns the title and that page's primary action (New contract on Students, Add year on Academic calendar).

**Collapse.** The sidebar collapses to an icon rail, remembered per browser in the `esm-sidebar` cookie — read on the server, so a reload paints at the right width instead of snapping. Expanded is the real state: icon-only navigation is exactly where a twice-a-year item like Academic calendar becomes unfindable, so collapse is a temporary "I need the width for this table" gesture. In the rail each item grows a tooltip, and keeps an `aria-label` — the tooltip is a hover affordance, not an accessible name. Below the `md` breakpoint there is no room for labels, so the rail is the only layout and the toggle is hidden.

Pages that don't exist yet (Clubs) have no nav row: a link to a page that isn't there costs more than the row saves.

**Role filtering.** Rows marked `adminOnly` in `features/shell/nav.ts` are dropped for accountants — today only Users and access. The filter is cosmetic: it spares an accountant a row they'd only get a 404 from, and the page and its API routes check the role themselves regardless.

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
4. On the Tuition scope the accountant can turn **Group by class** on. Each class then gets a short row above its students — class name, teacher, student count, and the class's own due / paid / outstanding — with a chevron that collapses it. Off is the flat list. The setting lives in the URL (`?groupBy=class`) alongside the fee scope.
5. The accountant searches by student name, ID, or contact info, and/or filters by grade level, class, and payment status, until the question is answered.
6. Clicking a row opens that student's detail page, where the per-fee breakdown lives.

**Notes**
- Read-only view. No data is created or modified here.
- **Fee-scoped, not a matrix.** In a per-fee scope the result set is only the students who hold a charge for that fee — bus, registration, and clubs apply to a minority, so those students are absent rather than shown as blank cells. *All fees* is a rollup (one total per student), not a per-fee column set; the breakdown belongs on the detail page.
- **Due** is the gross charge net of applicable discounts (tuition only — `schema.md` § Computing balance). **Status** (paid / partial / unpaid) is derived, never stored. **Last payment** is dated by `bank_transactions.transaction_at` — when the money moved — not by when an accountant keyed it in.
- Clubs is the one fee where a student may hold several charges in a term; those are summed into the student's single row.
- The *All fees* total adds year-scoped tuition/registration to term-scoped bus/club charges. Different scopes, so the column names both ("year + current term") and must not be read as a single amount owed right now.
- The summary cards (outstanding balance, collected + collection rate) recompute for the selected fee scope, not the whole school.
- **Grouping paginates by class, not by student.** A class row's totals are the whole class's, so the class must be whole on the page it lands on — paginating by student would split a class across two pages and show its row twice, each with a partial count. `page`/`pageSize` therefore count classes while grouping (ten per page, since each carries its students), and the footer says so.
- **Grouping is offered on Tuition only.** It's the fee every enrolled student carries, so a class row there sums the whole class. In a scope that drops students holding no such charge — bus, registration, clubs — the row would sum a subset while naming the class. Switching scope turns grouping off.
- Grouping narrows nothing: the summary cards, the record count, and the rows themselves are identical either way.
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
6. The review screen triages rows into two tiers so the common case is fast. Every row is a compact, **directly editable** one line: memo on the left; **class → student → charge → amount** inputs on the right, where the student list is limited to the chosen class and the charge list to that student's open charges. The chevron toggle reveals read-only detail only — full transaction fields and why it matched (which signals contributed, warnings, and every candidate student the matcher weighed, the one currently in the row included, so trying another candidate is reversible).
   A single charge takes the full transfer amount. **Split** adds another charge row directly beneath, in the same columns and with its own class, student, charge and amount — so one transfer can pay several of one child's fees (the new row repeats the student above it) or be shared between siblings (change the student on the row). A sibling split the matcher found arrives already filled in this way, one row per child; the running **Allocated X of Y** must reach the transfer amount before the row can be confirmed. Confirming creates one payment per row, and any fee not yet on a child's ledger is created in the same operation.
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

---

## 5. Academic calendar

**Purpose**

The school's years and terms are the scope every other view is read through. An admin needs to add next year before the year-start import runs, correct a term's dates when the school calendar shifts, and — once a term or year actually begins — move the app onto it.

**Flow**

1. Any accountant opens "Calendar" in the main navigation and sees each academic year as a card: its dates, whether it is current, what already references it, and its terms. Only admins see the controls (the API enforces `requireAdmin` regardless).
2. An admin adds a year (name + start/end), then adds its terms. A new year is never created as the current one — that is a separate, deliberate act.
3. **"Set as current"** asks for confirmation before switching, spelling out what changes. Setting a *year* current also moves the current term to one of its terms, and the dialog names which one beforehand.
4. Editing a year or term corrects its name and dates in place.
5. Deleting is offered only for a row nothing references; otherwise the control is disabled and the row shows what is holding it.

**Notes**
- **The current year and the current term always belong together.** They are separate `is_current` flags read independently across the app (the tracker resolves both, then loads year-scoped and term-scoped charges), so a current term from a different year would silently mix two years' money. Switching the year therefore carries a term with it, and only a term of the current year can be made current.
- **Invariants enforced server-side:** a year's dates can't overlap another year's; a term must fall inside its year and can't overlap a sibling term; a year's dates can't be narrowed so that one of its terms falls outside; names are unique (year names globally, term names within their year).
- **A term can't be moved to another year.** Its charges and club enrolments are scoped to it, so re-parenting would silently re-scope them. The year is fixed at creation.
- **Deletes are guarded, not cascading.** Every FK is `ON DELETE RESTRICT`; the service counts references first so the refusal can say what is in the way instead of surfacing a constraint error.
- **This is a config surface, not a data one.** Nothing here creates or edits students, enrolments, or charges — the year/term-start imports still do that (`domain_model.md` § Lifecycle).
- **Not yet in the activity log.** Calendar changes do not write `operations` rows, so they don't appear in History and can't be undone — the same as the discount catalog today. Adding them needs new `operations.kind` values (a migration).

---

## 6. Classes & levels

**Purpose**

The year-start import creates grade levels and classes from esmlh.edu.mn, and it gets things wrong or leaves them blank — classes with no teacher, a section filed under the wrong level. An admin needs to correct those without a script, and to set up a class the import didn't create.

**Flow**

1. Any accountant opens "Classes" in the main navigation and lands on one of two tabs — **Classes** and **Grade levels**. Only admins see the controls (the API enforces `requireAdmin` regardless). The tab lives in the URL (`?tab=`), so a section is linkable and survives the year picker's navigation.
2. **Classes** (the default tab) are shown for one academic year, picked from a dropdown that defaults to the current year. Each row carries its level, teacher, teacher contact, and student count.
3. **Grade levels** (school-wide, stable across years) list their code, display order, whether tuition prices them, and what uses them.
4. Adding or editing a class sets its name, level, and teacher details. Deleting is offered only for a class nobody is enrolled in.

**Notes**
- **A grade level's `code` can never be renamed.** Tuition is priced per level code inside `fee_structures.data.by_grade` (`domain_model.md` § FeeStructure) — a JSONB key, not an FK — so renaming it would silently detach every class at that level from its rate. The code is set at creation; only the display order stays editable.
- **Display order is what makes 2 sort before 10.** It's `grade_levels.sort_order`, used by the tracker and every class list.
- **A class's grade level is fixed once anyone is enrolled.** The level decides which tuition rate a student is charged, and moving it here recomputes nothing — what was charged would simply disagree with what the class claims. Teacher details and the class name stay editable at all times, since those are display data.
- **A class can't be moved to another year.** Enrolments are scoped by (student, year); the year is fixed at creation.
- **Renaming a class can confuse the next import**, which matches classes by name and may create a second one. The dialog says so.
- **Deletes are guarded, not cascading.** A level with classes, or whose code tuition still prices, is refused — the second is a JSONB reference no FK protects, so the service checks it explicitly.

---

## 7. Fee rates

**Purpose**

What the school charges — tuition per grade level, registration, bus — lived only in the seed scripts. An admin needs to see the rate in force, see what it replaced, and publish a new one when the school changes its prices.

**Flow**

1. Any accountant opens "Fees" in the main navigation and picks one of three tabs, kept in the URL (`?tab=`):
   - **Tuition** (the default) — the rate in force, per grade level, the date it applies from, and its earlier rates behind a toggle.
   - **Clubs** — club fees grouped by term, read-only.
   - **Others** — every remaining school-wide fee (registration, bus, anything else the import loads) as one table of fee name and amount, plus the date each applies from. A row expands to what a cell can't hold: a per-grade breakdown, and the rates it replaced.
2. An admin publishes a new rate for a fee from either the Tuition or the Others tab: a date it applies from, plus one amount (flat fees) or an amount per grade level (tuition), pre-filled from the rate in force.
3. Publishing marks the old rate replaced and inserts the new one, in one transaction.

**Notes**
- **Rates are never edited or deleted — only superseded.** `superseded_at` on the old row plus a new row with its own `effective_from` (`domain_model.md` § FeeStructure) is the model, so the validity chain stays the record of what the school charged and when. There is no PUT and no DELETE on this feature.
- **A new rate changes no existing charge.** A Charge stores the resolved gross amount at creation (`domain_model.md` § Charge), so a new rate reaches only charges created after it. The dialog says this before publishing.
- **A published rate applies immediately**, because the app reads "the rate in force" as the row with `superseded_at IS NULL` and never consults `effective_from`. A future-dated rate would therefore apply today while claiming otherwise, so future dates are refused: publish a rate on the day it starts applying. *(Revisit if scheduling rates ahead becomes worth teaching the readers about `effective_from`.)*
- **A fee keeps its shape.** Tuition stays per-grade, a flat fee stays flat — every reader expects one or the other.
- **A per-grade rate must price every grade level, and nothing else.** A level with no amount silently yields no tuition when a contract is created; a stray code is a typo nothing will ever look up.
- **New fee names aren't invented here.** Rates are published for fees the school already has; a new fee arrives with the year/term-start import.
- **Club fees are read-only.** They're per-term and loaded from esmlh.edu.mn each term, so an edit here would be overwritten by the next import.

---

## 8. Users and access

**Purpose**

Who can sign in to the portal, and what they can change. Until now the allowlist was seeded only by `pnpm provision:users` — adding a colleague or removing someone who left meant editing a JSON file and running a script. This is the same job in the app, for the one person who should be doing it.

**Flow**

1. An **admin** opens "Users and access", the last item under Setup. Accountants have no nav row and get a 404 on the URL: the allowlist is the access-control surface itself, so it isn't a read-only view either.
2. The table lists every allowlist row — active first, then alphabetical — with the role, whether access is active or revoked, how many actions the person has logged in History, and when they were added. The admin's own row is marked "You".
3. **Add user** takes an email and a role. The row *is* the grant: `lib/auth.ts` authorizes by matching the signed-in email against this table, so the person can sign in with Google immediately. Nothing is created on the Supabase side.
4. A row menu offers **change role**, **revoke access**, and **restore access**. Each pauses on a confirm dialog first — one click either hands someone the ability to manage users or stops them working.

**Notes**
- **Revoking never deletes the row.** `operations.actor_user_id` FKs to `users`, so a delete would orphan the audit trail. Revoking clears `is_active`, which keeps their history readable and makes restoring access a one-click reversal (`schema.md` § `users`).
- **Revocation takes effect on the next request**, in both the shell and the API — `lib/auth.ts` rejects a deactivated row exactly as it rejects a missing one, rather than waiting for the Supabase session to expire.
- **Emails are normalised to lowercase** on the way in, because authorization lowercases the session email before the lookup. A row stored with capitals would never match anyone.
- **The email is not editable.** It's the identity the allowlist matches on; changing it would silently transfer one person's audit trail to another. Revoke the old address and add the new one.
- **Two lockouts are refused server-side:** an admin revoking or demoting themselves, and removing the last active admin. Either one leaves nobody able to reach this screen. The row menu also disables those actions, but the API is what enforces it.
- **Re-adding a revoked address reactivates the existing row** rather than failing, so the person keeps their history.
- **Password sign-in still needs a Supabase Auth user**, which `pnpm provision:users` creates; this screen grants portal access, not a password. The add dialog says so.
- **Every change writes a `user_access` operation** and shows up in History (`history_and_reversibility.md`). Those operations are not undoable — restoring access is a one-click action here, which is clearer than an undo that silently re-grants it.
