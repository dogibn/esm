# ESM Payment Tracker

## What this is
A web application for tracking student payments at English School of Mongolia (~1000 students). It replaces the current Excel-based workflow with a faster bank-transaction import process and a more convenient way to view and search payment status across the school.

## Who uses it
Five accountants at ESM. One of them is an admin who manages fee structures and payment types; the other four record and review payments. This is an internal tool — not public, no parent or student access.

## v1 scope
v1 covers the two workflows accountants do regularly:

- **Tracking view.** An accountant can see all students with their current outstanding balance, filterable by grade and payment status, with global search.
- **Bank transaction import.** An accountant can upload a bank transaction Excel file, review the system's proposed matches to students, correct mismatches, and confirm before payments are recorded.

Initial data (students, enrollments, fee structures, discounts, and historical payments as needed) will be loaded directly into the database as a one-time setup task — no UI in v1. Subsequent year-start and term-start imports from esmlh.edu.mn are run as scripts by the admin.

## Not in v1
- Adding/editing fee structures through the UI (handled via import scripts until v2)
- Adding new students through the UI
- Per-student detail page
- Printing or sending invoices
- Year-end roll-over UI (new years and terms are added by script)
- Discount *rules* — v1 records the discount amounts applied, not the formulas behind them
- Family / siblings modeling

## Non-goals
- This is not a general-purpose accounting system. It tracks student payments only — not salaries, vendor payments, or school expenses.
- It does not process payments. It records payments that happened elsewhere (at the bank). Funds never move through this app.
- It is not a parent or student portal. Only accountants use it.
- It is single-tenant for ESM. It is not designed to be reused by other schools.

## Possibly someday
- Automatic retrieval of bank transaction files (instead of manual download + upload)
- Direct integration with esmlh.edu.mn for year/term-start data import (currently scripted)
- Discount rule engine (kind, percentage, order of application)
- Family/siblings modeling

## Stack
_To be decided._

## Running locally
_To be filled in once the project runs._