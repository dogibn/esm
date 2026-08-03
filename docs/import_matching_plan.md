# Import Matching — Improvement Plan

Working record for the `features/imports/matching` pipeline: what was wrong,
what was done about it, and what is still open. Durable facts have moved into
`domain_model.md` (a confirm may create the Charge it pays) and `notes.md` (bus
opt-in); this file keeps the reasoning and the measurements.

Measure with `pnpm qa:matching` — a dry run over a bank file plus a precision
score against hand-labelled cases. Numbers below are that command against year
2025-2026 / Term 4 (1386 students, 1372 enrollments, 1905 open charges) over
`features/imports/data/bank_transactions_sample.xlsx`.

---

## 1. Result

565 rows in the sample file; 231 are filtered before matching (outgoing rows,
bank fees, own-account transfers) and never reach a reviewer in production.
**334 rows are real incoming money.**

| | Before | After |
|---|---:|---:|
| Confident — bulk-confirmable, no decision | 48 (14%) | **117 (35%)** |
| Missing fee — bulk "Add fee + confirm" | 0 | **65 (19%)** |
| Not a student payment — bulk discard | 0 | **16 (5%)** |
| Genuinely needs a person | 286 (86%) | **136 (41%)** |
| `unmatched / no_candidates` | 90 (27%) | **15 (4%)** |
| `matched_multi` (siblings) | 0 | 6 |

On the labelled set (`scripts/qa/fixtures/matching_cases.json`, 29 cases):
**precision 50% → 93%, recall 33% → 93%.**

Three bulk passes now clear ~59% of a file's rows, against 14% before.

---

## 2. What was wrong

Row counts are out of the 334 incoming rows. Each defect has a regression test
named after it.

### Class stage

1. **Bare `angi` / `анги` was not a level keyword** — `levelRegex` demanded the
   `r` of `-r angi`, so "5B ANGI", "1 ANGI", "4 НАС АНГИ" produced no level.
2. **`grade` before the digit** ("GRADE 12 E.TEMUULEN") was unsupported.
3. **Cyrillic homoglyph class letters.** `normalize()` transliterates
   phonetically: `В`→`v`. But a parent typing `8В` on a Cyrillic keyboard means
   the Latin-looking `8B`, which is what the DB stores. 14 rows.
4. **Classes split by a space or punctuation** — "5 В", "3 LM", "4 BE.", "3CL."
   — missed, because matching was contiguous. 16 rows.
5. **A bare digit next to a name was discarded**, so "Б. ЭЛБЭРЭЛ 3" lost its
   only grade signal.

### Name stage

6. **The initial form was thrown away.** The index holds `u.erhembayar`, and 77
   of 334 memos are written that way, but a hit on it was one token → labelled
   `memo_name_partial` → tier 5 → dropped. "O.ERHEMBAYAR" resolved to exactly
   one student in 1386 and was discarded. 30 of the 90 unmatched rows.
7. **Tiering counted tokens, not selectivity.** One token matching one student
   scored the same as one matching forty.
8. **Hyphenated names weren't split on either side** — "БОЛД НОМИН ЭРДЭНЭ" hit
   three students once each instead of `Nomin-Erdene Bold` twice.
9. **Bank prefixes glued onto names** — `-` is a word character, so "EB-ANIR"
   was one dead token. 8 rows.
10. **Fuzzy was gated off** unless no exact name matched anywhere in the memo,
    and fuzzy-without-a-grade was tier 5.
11. **Multi-student never fired** — 0 hits in 565 rows — because sibling memos
    use the initial form that defect 6 already capped at tier 5.
12. **The account index was always empty**: `confirmedAccountLinks: []` was
    hardcoded, so the one *certain* signal could never fire.

### Charge stage

13. **Bus: 52 rows (16%).** A bus fee structure exists at 375,000/term, but no
    bus Charge rows exist at all (bus opt-in is not imported), so every bus
    payment identified its student and then died in `manual_review`.
14. **Club charges are per-session, so paid ≠ balance** — volleyball 255,000 /
    paid 270,000; HW GR1 555,000 / paid 690,000. Allocation only handled
    *under*-payment of a named fee and bailed on the rest. ~35 rows.
15. **Allocation never fed back into ranking.** "E.MISHEEL 1JA HOMEWORK" gave
    two Misheels; the one *holding a homework charge* ranked second.
16. **`partial_payment` was treated as a defect** though installments are how
    the school is paid. 90 rows.
17. **Triage's confident bar was stricter than the matcher** — one candidate,
    exactly one allocation, zero flags — so a balanced two-charge split was
    still pushed to a human.

---

## 3. What was done

### Phase 0 — measurement harness

`scripts/qa/_harness.ts` (shared), `dry_run_matching.ts` (rewritten to report
the reviewer-facing tier, a stage-coverage breakdown, and a CSV),
`score_matching.ts` (precision/recall against labels), `pnpm qa:matching`.

Fixtures are hand-labelled and **verified against the directory** — the scorer
refuses to run if a label names a student who doesn't exist, because a
mislabelled case is worse than no case. Only rows whose correct answer is
determinable from the memo plus the directory are labelled; the two genuinely
ambiguous ones are marked `ambiguous` and excluded from scoring.

### Phase 1 — extraction

`normalize.ts` gained `visualVariants` (Cyrillic-lookalike letters);
`build-index.ts` gained class aliases (dropped on collision), keyword-first and
bare-`angi` level patterns, and `nameTokenForms` (hyphen splits both ways);
`extract-signals.ts` re-joins classes split across a separator, reads a bare
1–12 as a level when the memo also carries a name, and groups each written name
with its alternate spellings. Vocabulary picked up the bank noise (`eb`, `mm`,
`acd`, `angi`, `uliral`, `term`, `club`, …) that was polluting name tokens —
which also stops "CLUB1" peeling a bogus grade level 1.

### Phase 2 — scoring

`resolve-student.ts` replaces the boolean tier ladder with an additive evidence
score. Every name hit is weighted by **how many students share the matched
token** (1 → 0.85, ≤3 → 0.6, ≤10 → 0.4, else 0.25); grades contribute a
narrowing weight; an account contributes 1.0. `memo_name_initial` is its own
signal. Fuzzy always runs for groups with no exact hit, at 0.45/0.25 of the
exact weight, and never fires below 5 characters — short foreign names in the
directory ("Shin", "Kang", "Ma") made short-token fuzzy actively harmful.

A grade with no name and no account is capped at tier 5: a class is a
constraint, not an identification, and proposing one would surface 25 students.

`match.ts` shortlists the top 5 candidates above 45% of the best score. Triage
adds a **dominance rule** — a top candidate 1.5× the runner-up isn't contested —
so alternatives can be shown without dragging every common first name into
manual review.

### Phase 3 — charge stage

`allocate-charges.ts`: a named fee with exactly one matching charge now takes
the payment whether it is short *or* over (flagged accordingly); several
matching charges get their own subset search. `match.ts` folds allocation
quality into ranking as a bonus on the evidence score, so the ledger can break a
name tie without letting a weakly-named student leapfrog a strongly-named one.
Triage treats `partial_payment` as benign, and `fee_inferred_from_amount` as
benign only when the student's score is ≥ 1.2.

### Phase 4 — a payment may create the charge it pays

`MatchProposal.proposedCharge` is emitted when the memo names a school-wide fee,
the student has no charge for it, and the amount is **exactly** the school's
rate. Non-club fees only, exact amounts only: a multiple of the bus rate is two
terms or two siblings — a decision, not a deduction — and a club is a per-student
enrolment we would be guessing at.

`confirmAllocation` takes `createCharges` and does creation, payment and status
flip in one DB transaction with one `confirm_match` operations row carrying
`details.createdChargeIds`; undo voids the payments *and* deletes those charges
(unless another live payment has since attached to one). No migration —
`operations.kind` is unchanged. Charge creation goes through `insertCharge`,
extracted from `features/students/api.ts`, so the import and the student page
enforce identical rules.

In the UI the charge dropdown gains `+ Add bus · 375,000`, the button reads
"Add fee + confirm", and a **Missing fee** tab groups these rows with their own
bulk action — a term of bus payments is one pass. They stay out of the confident
tier on purpose: confirming writes a charge to the ledger, so it is opt-in.

### Phases 5–7

- **Account learning** — `confirmedAccountLinks` is now reconstructed from
  `payments → charges → students` joined to the transaction's sender account,
  live payments only. Worth ~9 rows within one file, compounding across imports.
- **Siblings** — `allocateMulti` tries tuition balances first, then an exact
  equal share per student, each share resolved by the ordinary charge stage (so
  "BUS FEE, BAT-ERDENE 8B, ANAR 6E" proposes a bus charge for each). Segments
  that name nobody ("BUS FEE") no longer abort the split; ambiguous ones still do.
- **Non-student income** — `looksNonStudent` recognises tournament invoices from
  other schools, utility bills, refunds, and the cash register. They get their
  own unmatched reason, their own tab, and a bulk discard (soft, undoable).

---

## 4. Still open

- **Two sibling memos** (`Х.ЕСҮЙ, Х.ЕСҮХЭЙ ТӨЛБӨР` 15M, `BUS12 Х. ЕСҮХЭЙ, ЕСҮЙ,
  ЕСҮТЭЙ`) identify the right children but come back as single matches: the
  first because no even split of the total is allocatable, the second because
  "ЕСҮЙ" alone is ambiguous across five students named Yesui. Resolving them
  needs the shared-surname inference the segments imply.
- **`unbalanced` (34 rows)** — an identified student whose amount fits nothing
  they owe. Often a prepayment for next year ("BATBOLD SETSEN 26-27",
  "2026.09САРД"), which the current-term-only charge context cannot represent.
- **`multiple_candidates` (35 rows)** — genuinely two plausible students.
- **Registration for students not yet enrolled** — "Бүртгэлийн хураамж" for a
  child with no enrollment row has nothing to match against.
- The bus workaround makes the *paid* bus population visible, not the enrolled
  one; `user_flows.md`'s "who hasn't paid the bus fee?" still needs the real
  opt-in source (`notes.md`).
