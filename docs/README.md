# ESM Payment Tracker

## What this is
A web application for tracking student payments at English School of Mongolia (~1000 students). Replaces the current Excel-based workflow with bank-transaction import and a faster way to view payment status across the school.

## Who uses it
Five accountants at ESM. One admin manages fee structures; the other four record and review payments. Internal tool — no parent or student access.

## v1 scope
- **Tracking view.** All students with current outstanding balance, filterable by grade and payment status, with global search.
- **Bank transaction import.** Upload a bank Excel file, review proposed matches to students, correct mismatches, confirm.
- **Year/term-start scripts** (admin only, run from CLI). Pull roster, classes, and club enrollments from esmlh.edu.mn.

## Not in v1
- Adding/editing fee structures, students, or enrollments through the UI
- Printing or sending invoices
- Family / siblings modeling — no family graph. (A sibling discount may carry an optional soft pointer to one sibling student; see `domain_model.md` § Discount.)
- Refunds

## Beyond the original v1 sketch (now built)
- Per-student detail page (view + edit tuition, discounts, and ad-hoc fees).
- Discount catalog: admins define reusable discounts (flat or percent, fixed or custom); accountants apply them to a student, where they compound in order. See `domain_model.md` § DiscountType / Discount.

## Non-goals
- Not a general accounting system. Tracks student payments only — no salaries, vendor payments, or expenses.
- Doesn't process payments. Records what happened at the bank; funds never move through this app.
- Not a parent or student portal.
- Single-tenant for ESM.

## Documentation
- `domain_model.md` — entities, lifecycle, decisions
- `schema.md` — DB tables, columns, constraints
- `tech_stack.md` — frameworks, conventions, folder structure
- `scraping_esmlh.md` — esmlh.edu.mn data import
- `user_flows.md` — UI workflows
- `CLAUDE.md` — AI entry point

## Running locally
*(To be filled in once the project runs.)*
