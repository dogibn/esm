# Notes — ESM Payment Tracker

Private working file. Not part of AI context. When a decision is made, it migrates into the relevant authoritative doc; this file indexes what's open, what's decided, and what reversing each decision would touch.

---

## Open questions

- **`tuition_contract_id` source** — esmlh? manual at year-start? Affects scraping_esmlh + year-start lifecycle in domain_model.
- **`student_category` source (new vs old)** — diff vs prior year roster? esmlh flag? Same scope.
- **Bus opt-in source (term-start)** — esmlh? manual list? carried from previous term? Affects scraping_esmlh + term-start lifecycle.
- **Class → teacher mapping page on esmlh.edu.mn** — until known, `grades.teacher_name` is filled manually. Affects scraping_esmlh.
- **`student_directory` pagination at ~1000 students** — confirm whether it server-paginates. Affects scraper.
- **Parent phone shape** — multiple space-separated values; keep raw or split into array? Affects schema.students + scraping rule.
- **Mid-year withdrawal** — what happens to a withdrawn student's unpaid charges? Cancelled, owed, frozen? Affects domain_model Enrollment + Charge.
- **Mid-term club drop** — refund, cancel charge, or still owed? Affects domain_model ClubEnrollment + Charge.
- **Tuition rate change mid-year** — existing charges keep old amount unless adjusted; confirm acceptable. Affects domain_model Charge resolution.
- **Existing discounts on day-1 load** — confirm exact list before initial seed runs.
- **Password reset flow** — admin-mediated; what's the actual process? Affects auth ops in tech_stack.

---

## Decisions made

### Domain (full rationale in domain_model.md)
- **Year/term split with mixed-cadence Charges** — Charge has nullable `academic_year_id` and `academic_term_id`; exactly one is set. Reversal: rework Charge scope columns + every charge-generating script.
- **GradeLevel separated from Grade** — level identifies tuition rate (stable), Grade is per-year section + teacher (changes yearly). Reversal: collapse, add level to every Grade row, change tuition lookup.
- **Tuition is annual** — one Charge per Enrollment per year. Reversal: per-term tuition charges; reconsider Discount → Enrollment.
- **No FeeType table; JSONB on FeeStructure** — heterogeneous fees (flat / by_grade / club) live in one table. Reversal: split into per-shape tables; add FeeType.
- **Charge stores resolved gross amount; discounts and balance computed at read time** — preserves audit trail. Reversal: balance formula + discount table layout.
- **Discount → Enrollment (not → Charge)** — tuition is the only discountable fee in v1; tuition is 1:1 with Enrollment. Reversal: re-link to Charge with constraint on `fee_name`.
- **Teacher denormalized on Grade** — name + email only, no Teacher entity in v1. Reversal: extract Teacher entity, FK from Grade.
- **BankTransaction.transaction_id is the dedup key** — no ImportBatch in v1; original files not stored. Reversal: add ImportBatch + Supabase Storage bucket.
- **Match confidence shown as which fields matched, not a numeric score** — accountants need *why*, not *how confident*. Reversal: add confidence column + UI rework.
- **Auth: admin invites accountants out-of-band** — no signup flow, no in-app password reset in v1. Reversal: signup + reset flows.

### Tech (full rationale in tech_stack.md)
- **Next.js App Router, plain API routes** — no RSC mutations, no Server Actions. Reversal: rewrite route handlers.
- **Drizzle + postgres-js, pooled connection with `prepare: false`** — required for pgBouncer transaction mode. Reversal: connection setup.
- **Supabase Auth, email/password only** — no SSO, MFA, OAuth in v1. Reversal: provider integrations.
- **SheetJS server-side parsing** — Excel parsed on server, never in browser. Reversal: parsing pipeline + upload protocol.
- **shadcn/ui + Radix + CVA + Tailwind tokens** — primitives in `components/ui/`, theme via CSS vars. Reversal: rebuild primitives layer.
- **react-hook-form + Zod, single schema per feature** — same schema validates client and server. Reversal: validation layer.
- **TanStack Table headless** — for tracking view. Reversal: rebuild tracking view.
- **English only, strings extracted to per-feature constants** — no i18n machinery in v1, but extraction makes adding Mongolian mechanical. Reversal: swap constants for i18n lookup (no JSX changes).
- **No edge runtime, no RLS** — single tenant, 5 trusted users; auth at API layer. Reversal: deployment + auth layer changes.

---

## Pure decision-tracking (no doc impact)

These are *not* in any authoritative doc because the AI wouldn't add them on its own. They're notes-to-self.

- No Storybook
- No Sentry / error monitoring (revisit if needed)
- No analytics
- No CI beyond Vercel preview deploys
- No marketing site or public pages
