# Scraping esmlh.edu.mn

How data from esmlh.edu.mn (ESM's school information system) gets pulled into the database. Scraper scripts, intermediate file shapes, and loader scripts all follow the conventions here.

For *what* the data means once loaded, see `domain_model.md`. For DB table shapes, see `schema.md`.

---

## Why scraping, not API

esmlh.edu.mn does not expose a public API. Scraping is the only mechanism in v1. It's fragile by nature — the school can change its HTML at any time and break our scripts — but acceptable because:

- Imports run only at year-start and term-start. Breakage is obvious and rare.
- The admin runs scripts manually. No production hot path depends on continuous availability.
- Rebuilding a scraper for a new layout is a few hours of work.

If esmlh.edu.mn ever ships an API, replace the scraper layer; the loader layer (intermediate file → DB) doesn't need to change.

---

## Two-stage pipeline

```
esmlh.edu.mn  →  scrape script  →  scraped/students.json  →  load script  →  Postgres
                  (Python)                                    (TypeScript, Drizzle)
```

Why two stages:

- **Failure isolation.** If the scraper breaks, the loader doesn't run on bad data. If the loader breaks, the scrape doesn't have to be redone.
- **Inspectability.** The intermediate file is plain JSON. Diffable across runs, verifiable before any DB writes.
- **Language fit.** Python has the better HTML-parsing ecosystem (`requests` + `BeautifulSoup`); TypeScript owns DB writes via the Drizzle client.

**Locations:**
- Scrape scripts: `scripts/scrape/<source>.py`
- Intermediate files: `scripts/scraped/<source>.json` (gitignored)
- Load scripts: `scripts/load/<source>.ts`

---

## Local setup

All Python scripts (scrape, parse, load helpers, and the QA tools under `scripts/tools/`) share one virtualenv and one `scripts/requirements.txt`. From project root:

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r scripts/requirements.txt
```

Run scripts as modules from the `scripts/` directory so that `lib.*` imports resolve:

```bash
cd scripts
python -m scrape.students
python -m scrape.teachers
python -m scrape.after_clubs
python -m scrape.student_clubs
python -m parse.parse_tuition_excel
python -m tools.cleaning --input parsed/tuition_25-26.json
python -m tools.data_utils nulls scraped/students.json code
```

Override the academic year via env var when needed:

```bash
ACADEMIC_YEAR=2026-2027 python -m scrape.teachers
```

---

## Authentication

Login is form-based, session-cookie-based.

```
Login URL:    https://esmlh.edu.mn/login
Form action:  https://esmlh.edu.mn/login/validate_login
Payload:      { email: <...>, password: <...> }
```

Reference Python pattern:

```python
import os
import requests

session = requests.Session()
session.post(
    "https://esmlh.edu.mn/login/validate_login",
    data={
        "email":    os.environ["ESMLH_LOGIN_EMAIL"],
        "password": os.environ["ESMLH_LOGIN_PASSWORD"],
    },
)
# session now carries the auth cookie for subsequent requests.
```

Credentials live in environment variables only, never hardcoded. Keep them in a gitignored `.env` for local runs. They are **not** part of the Next.js app's `lib/env.ts` — the running app never logs into esmlh.edu.mn. They belong only to scrape scripts.

Required vars:
- `ESMLH_LOGIN_EMAIL`
- `ESMLH_LOGIN_PASSWORD`

---

## Source: Student directory

URL: `https://esmlh.edu.mn/teacher/student_directory`

Single page that drives both the `students` table and the year's `enrollments` rows.

### HTML structure

A `<table id="example23">` with these columns:

| HTML column | Use? | Maps to |
|---|---|---|
| Photo | ignore | — |
| First Name | use | `students.first_name` |
| Last Name | use | `students.last_name` |
| Class | use | `enrollments.grade_id` (via lookup) + sanity-check year |
| School Email | ignore | — |
| Parent Phone | use | `students.parent_phone` |
| Parent Email | use | `students.parent_email` |
| Student ID | use | `students.student_id` |
| Actions | ignore | — |

### Sample row

```html
<tr>
  <td><img src="https://esmlh.edu.mn/uploads/school/student_image/53.jpg" ...></td>
  <td><a href=".../student_profile/53">Adiya</a></td>
  <td><a href=".../student_profile/53">Baatar</a></td>
  <td>6E (2025-2026)</td>
  <td>adiya.ba.2032@esmlh.edu.mn</td>
  <td>88556888 80288881</td>
  <td>badralburte@yahoo.com</td>
  <td>53</td>
  <td></td>
</tr>
```

### Parsing rules

- **Class** — `"6E (2025-2026)"` encodes two pieces:
  - `grade_name = "6E"` — looked up against `grades.name` for the current academic year.
  - `academic_year_name = "2025-2026"` — must equal the `is_current = true` row in `academic_years`. If not, halt with a clear error rather than guess.
  - Regex: `^(?P<grade>[^ ]+) \((?P<year>\d{4}-\d{4})\)$`
- **First/Last Name** — text inside the `<a>`, stripped.
- **Student ID** — text inside the `<td>`, stored as a string. Schema is `text` even when values look numeric.
- **Parent Phone** — values like `"88556888 80288881"` contain multiple space-separated numbers. **v1 stores the raw string verbatim.** Open: see `notes.md`.
- **Parent Email** — kept verbatim. Empty string → store `NULL`.
- **Photo, School Email, Actions** — dropped, never persisted.

### Intermediate file shape (`scripts/scraped/students.json`)

```json
[
  {
    "student_id": "53",
    "first_name": "Adiya",
    "last_name": "Baatar",
    "grade_name": "6E",
    "academic_year_name": "2025-2026",
    "parent_phone": "88556888 80288881",
    "parent_email": "badralburte@yahoo.com"
  }
]
```

The loader reads this JSON, looks up `grade_id` from `(grade_name, academic_year_name)`, and inserts into `students` and `enrollments`.

---
## Source: Staff directory

URL: `https://esmlh.edu.mn/teacher/staff_directory`

Source for the class → teacher mapping. One row per staff member; we keep only rows whose position contains `"Form Tutor"` — those carry the assignment that populates `grades.teacher_name` and `grades.teacher_email` for the current academic year.

### HTML structure

Cells use `data-field` attributes. The scraper filters to rows where `<td data-field="position">` text contains `"Form Tutor"`, then extracts:

| HTML cell | Maps to |
|---|---|
| `<td data-field="name">` | `grades.teacher_name` |
| `<td data-field="email">` | `grades.teacher_email` |
| `<td data-field="phone">` | (no current schema destination — kept in JSON for future use; see `notes.md`) |
| `<td data-field="position">` | `grade_name`, after stripping `"Form Tutor"` and trimming whitespace |

### Parsing rules

- **Filter** — keep only rows where `position` text contains `"Form Tutor"`. Other staff (admin, non-tutor teachers) are dropped.
- **`grade_name`** — the `position` cell text with `"Form Tutor"` removed and surrounding whitespace stripped. Used by the loader to look up which `grades` row to update for the current academic year.
- **Other cells** — text content, stripped.

### Intermediate file shape (`scripts/scraped/teachers.json`)

```json
[
  {
    "grade_name": "6E",
    "teacher_name": "...",
    "teacher_email": "...",
    "teacher_phone": "..."
  }
]
```
`grades` table is not populated yet. When it's populated:

The loader reads this JSON, finds each `grades` row by `(grade_name, current academic year)`, and updates `teacher_name` and `teacher_email`. `teacher_phone` is not currently loaded — there's no column for it in `grades`.

---

## Source: After-school clubs

URL: `https://esmlh.edu.mn/admin/after_clubs`

Catalog of clubs offered by the school. Feeds the club rows of `fee_structures` (one per club per term). Separate from `club_enrollments`, which is the per-student membership data and is not produced by this scrape.

Only rows whose status is `"Active"` are kept; inactive/archived clubs are silently dropped.

### HTML structure

A `<table id="example23">` (same DataTables widget the student directory uses). Columns:

| HTML column | Use? | Maps to |
|---|---|---|
| # (row counter) | ignore | — |
| Club Name | use | `name` |
| Teacher | use | `teacher` |
| Schedule | use | `schedule` |
| Fee | use | `fee` (parsed to int from `₮405,000`) |
| Status | filter | `status` (only `"Active"` kept) |
| Payment Model | use | `payment_model` (e.g. `"Per Term"`) |
| Teacher Access | ignore | — |
| options | partial | `club_id` extracted from edit link only |

### Sample row

```html
<tr role="row" class="odd">
  <td>9</td>
  <td>Chearleading GR3</td>
  <td>Narantuya Toibgoo</td>
  <td>Friday</td>
  <td>₮405,000</td>
  <td class="sorting_1"><span class="label label-success">Active</span></td>
  <td><span class="label label-primary">Per Term</span></td>
  <td><span class="label label-default">Standard</span></td>
  <td>
    <a onclick="showAjaxModal('https://esmlh.edu.mn/modal/popup/edit_after_club/15')" ...>...</a>
    <a href="https://esmlh.edu.mn/admin/after_clubs/delete/15" ...>...</a>
    <a onclick="loadStudentAssignment(15)" ...>...</a>
    ...
  </td>
</tr>
```

### Parsing rules

- **Status filter** — text of the inner `<span>` in the Status cell. Rows where the value is not exactly `"Active"` are skipped before any other parsing.
- **Club Name / Teacher / Schedule** — stripped text of the cell.
- **Fee** — text like `"₮405,000"`. Strip non-digits and parse to `int` (here, `405000`). Halt on rows where no digits are present.
- **Payment Model** — text of the inner `<span>` in the cell.
- **`club_id`** — extracted via regex `/edit_after_club/(\d+)` against the HTML of the options cell. This is the esmlh-side id needed later to hit the "Manage Students" endpoint. Stored as a string (same convention as `students.student_id`).
- **Teacher Access** and the rest of the action buttons in the options cell — dropped.

### Intermediate file shape (`scripts/scraped/after_clubs.json`)

```json
[
  {
    "club_id": "15",
    "name": "Chearleading GR3",
    "teacher": "Narantuya Toibgoo",
    "schedule": "Friday",
    "fee": 405000,
    "status": "Active",
    "payment_model": "Per Term"
  }
]
```

Loader: `scripts/load/after_clubs.ts` (`pnpm load:after-clubs`). Upserts one `fee_structures` row per club into the current term, with `fee_name = name`, `effective_from = current term start_date`, `superseded_at = null`, and `data = { fee, club_id, payment_model, teacher, schedule }`. The `club_id` field is retained for the student-clubs scraper below (and for any future per-club roster scrape via `https://esmlh.edu.mn/admin/manage_after_club_attendance?after_club_id=<id>`).

---

## Source: Student club enrolments

URL: `https://esmlh.edu.mn/admin/student_clubs_summary?student_id=<id>` — one HTTP request **per student**.

Produces the per-student club-membership pairs that feed `club_enrollments`. The scraper iterates over every student in `scripts/scraped/students.json`, requests their summary page, and keeps only rows whose `Club Status == "Active"`.

Students with no enrolments render the page body as `"This student is not enrolled in any after school clubs."` (no table). Those are silently counted and skipped.

### HTML structure

A single `<table>` per page (no DataTables id needed). Columns:

| HTML column | Use? | Maps to |
|---|---|---|
| # (row counter) | ignore | — |
| Club Name | use | `name` (the club's `fee_structures.fee_name`) |
| Club Status | filter | only `"Active"` kept |
| Enrolment Status | ignore | — |
| Payment Model | use | `payment_model` (e.g. `"Per Session"`, `"Per Term"`) |
| Total Fee | use | `total_fee` (esmlh's accrued obligation; int from `₮240,000`) |
| Total Paid | ignore | — |
| Remaining | ignore | — |

> **Why `total_fee` is captured.** For `"Per Session"` clubs (homework club), the after-clubs catalog fee is only the *per-session rate* (e.g. ₮15,000), so a flat charge built from it is wrong — the real obligation is rate × attendance, which esmlh already computes and shows in the **Total Fee** column. Capturing it lets the club-charge loader use the accrued total for Per Session clubs instead of the catalog rate. For `"Per Term"` clubs the catalog fee is already correct; `total_fee` is captured anyway for reconciliation and to keep the scraper a pure extractor (the Per Session vs Per Term decision lives in the loader, not the scrape).

The page uses an "empty" sentinel when there are no enrolments — no table at all. The parser checks for the substring `"This student is not enrolled in any after school clubs."` and short-circuits.

### Sample row

```html
<tr>
  <td>1</td>
  <td><strong>HW GR 1</strong></td>
  <td><span class="label label-default">Inactive</span></td>
  <td><span class="label label-default">Paid</span></td>
  <td><span class="label label-info">Per Session</span></td>
  <td class="text-right">₮240,000</td>
  <td class="text-right text-success">₮525,000</td>
  <td class="text-right text-success">+₮285,000 ...</td>
</tr>
```

### Parsing rules

- **Status filter** — text of the inner `<span>` in the Club Status cell. Rows where the value is not exactly `"Active"` are skipped.
- **Club Name** — stripped text of the cell (the `<strong>` wrapper is collapsed away by `get_text(strip=True)`).
- **Empty-name Active rows** — source-side artefact: some students have a ghost `Active` row with no club name and `—` fee (seen on student 58, row 4). These are not parse failures and not real enrolments; they are counted and skipped with a tally printed at the end. Halting on them would crash a full pass for ~3% of students.
- **Payment Model** — text of the inner `<span>` in the cell (col 4); `None` if absent.
- **Total Fee** — strip `₮` and commas from the cell text (col 5) and parse to `int`. Unlike the after-clubs Fee, an absent/`—` value does **not** halt — it parses to `None` (a Per Session club with no attendance yet legitimately has no accrued fee), letting the loader tell "unknown" apart from a real `0`. Both columns are read defensively (only when present) so a layout shift in the trailing fee columns can't break enrolment capture.

### Politeness

`scripts/scrape/student_clubs.py` sleeps `0.3 s` between requests and prints a progress line every 50 students. A full pass over ~1,400 students takes roughly 8–10 minutes.

### Intermediate file shape (`scripts/scraped/student_clubs.json`)

Flat list of `(student, club)` records — one record per active enrolment, not one record per student:

```json
[
  { "student_id": "55", "name": "Volleyball 11 am to 1pm Term 4", "payment_model": "Per Term", "total_fee": 405000 },
  { "student_id": "58", "name": "HW GR 1", "payment_model": "Per Session", "total_fee": 240000 }
]
```

Loader: `scripts/load/club_enrollments.ts` (`pnpm load:club-enrollments`). Looks up `students.id` by the natural-key `student_id` text and `fee_structures.id` by `(fee_name, current term, superseded_at IS NULL)`. Inserts one `club_enrollments` row per pair. Idempotent via the existing `(student_id, fee_structure_id)` unique index — re-running is a no-op. (`payment_model` / `total_fee` are not consumed by this loader.)

A second loader, `scripts/load/charges_clubs.ts` (`pnpm load:charges-clubs`), joins `club_enrollments` × `fee_structures` for the current term and inserts a term-scoped `charges` row per enrolment, pulling `amount` from `data.fee`. It de-dups against existing rows by `(student_id, fee_name, academic_term_id)` since `charges` has no unique constraint.

### Per Session refresh (homework club)

`charges_clubs.ts` above generates charges only for **Per Term** clubs (it skips any `fee_structures` row whose `data.payment_model = "Per Session"`). Per Session clubs are owned by a separate, higher-cadence pipeline because their obligation accrues with attendance and changes between term-start and term-end:

```
scrape.per_session_fees  →  scraped/per_session_fees.json  →  refresh:per-session-charges
   (scoped re-poll)                                              (update charge amounts)
```

- **`scripts/scrape/per_session_fees.py`** — a *scoped* scraper. It reads `after_clubs.json` (which club names are Per Session) and `student_clubs.json` (who is enrolled in them), then re-polls **only those ~50 students** for their current Total Fee. A full pass is well under a minute, vs. ~8–10 min for the full `student_clubs` scrape — so it can run weekly/daily. Output: `[{ student_id, name, total_fee }]`.
- **`scripts/load/refresh_per_session_charges.ts`** (`pnpm refresh:per-session-charges`, `--dry-run` to preview) — resolves each `student_id`, then **updates** the current-term club charge's gross `amount` to `total_fee` (inserting it if missing). Idempotent. A null `total_fee` — esmlh shows a blank cell, i.e. no sessions accrued yet — is treated as **0**, since esmlh's Total Fee is the source of truth for the obligation; the charge is set to 0 rather than left at a stale seed amount. The run prints `zeroed_no_fee=N` for visibility. (Trade-off: a transient blank read on a charge that already received payments would briefly show an overpayment until the next good read; acceptable because esmlh owns the Per Session figure.)

This makes Per Session club charges' gross amount **mutable** — a deliberate exception to the "resolved gross at creation, never propagate" rule (see `domain_model.md` § Charge). Existing `payments` are untouched; `balance = amount − paid` recomputes.

---

## Year rollover: the 2026-2027 intake

The tuition workbook, not esmlh, is the roster of record for a new year — it lists students who have signed a contract but whom esmlh has not registered yet. Rollover therefore joins three sources rather than loading one:

```
data/tuition_<year>.xlsx  ─┐
scraped/students_<yy-yy>.json (current + previous) ─┼─→ processed/tuition_<yy-yy>.resolved.json ─→ load scripts
processed/students_tuition.matched.json ─┘
```

- **`scripts/parse/parse_tuition_2627.py`** → `parsed/tuition_26-27.json` + `.markers.json`. The 2026-2027 sheet has its own layout (90 dated payment columns, seven MNT discount columns, and two kinds of interleaved marker row), so it gets its own parser rather than a branch in `parse_tuition_excel.py`. Strips the accountants' duplicate-surname counters (`"Batbold 2"` → `"Batbold"`), keeping the verbatim value alongside.
- **`scripts/match/tuition_2627_resolve.py`** → `processed/tuition_26-27.resolved.json`, `.leavers.json`, and `reports/tuition_26-27.resolution.md`. Ties each workbook row to an esmlh student and a 2026-2027 grade level. See the module docstring for the identity and grade fallback chains and why the workbook's section headers are never parsed.
- **Load scripts**, in order — `grades_2627.ts`, `students_2627.ts`, `enrollments_2627.ts`, `fee_structure_2627.ts`, `charges_tuition_2627.ts`, `discounts_2627.ts`, `payments_2627.ts` (`pnpm load:<name>-2627`). All but the first take `--dry-run`.
- **`scripts/qa/verify_tuition_2627.ts`** (`pnpm qa:tuition-2627`) — reconciles the loaded charges and discounts back against the workbook, re-deriving every percentage. Exits non-zero on any mismatch.

Two conventions this introduced:

- **Per-year scrape archives.** `scrape.students` now writes `scraped/students_<yy-yy>.json` alongside `scraped/students.json`, deriving the suffix from the scraped rows. The directory only ever shows the year the school has made current, so without the archive a re-scrape at rollover destroys the previous year's snapshot — which the resolver still needs to place students the new directory has not listed yet.
- **`<level>temp` holding classes.** `enrollments.grade_id` points at a class, not a level, so students placed only to a level need somewhere to sit. esmlh already uses this convention (`1temp`, `4temp`, `5temp`); the loader reuses those names and creates the rest. A student in one of these is correctly graded and correctly billed — only their stream is unknown. They merge with esmlh's own `temp` classes by design.

`grades.teacher_name` is NOT NULL and the staff directory still lists the *previous* year's form tutors at rollover, so 2026-2027 classes are created with `"TBD"`. Re-run the teachers scrape and loader once the school publishes them.

### Which rate is in force

Next year's rates are published months before the year begins, so a `tuition` row for 2026-2027 exists long before it applies. Supersession cannot express that — both rows are legitimately live — so **the current academic year decides**: the reader takes the non-superseded, term-scopeless row with the latest `effective_from` that is not after the current year's `end_date` (`features/enrollments/api.ts` § `activeFeeData`; `features/fees/api.ts` applies the same bound so the Fees screen cannot advertise a rate the app is not billing). Rolling `academic_years.is_current` forward is what switches prices over. `superseded_at` keeps its original meaning: retiring a rate that was *wrong*, not one that has merely aged out.

One rough edge: a not-yet-effective rate is currently filed under the Fees screen's "Earlier rates" rather than an "Upcoming" section. It resolves itself when the year rolls over.

### Base tuition is per student

`charges.amount` for `fee_name = 'tuition'` is the student's gross before discounts — the same field the New Contract form's editable "Base tuition" writes to. It is normally the level's rate, but on 22 rows the workbook bills something else (mostly exactly 50% for a half-year enrolment, or 95%). The resolver recovers those from the sheet's own arithmetic — `Total payment` + the itemised discounts — and the loader records the departure in `charges.notes`. The reason for the reduction is nowhere in the workbook; the rows are listed in the resolution report for the accountants to attribute.

### Payments arrive without a bank transaction

The workbook records a payment as a bare (date, amount) cell — the accountants keyed it from a statement they reconciled offline, so there is no sender, memo or reference. `payments.bank_transaction_id` is NOT NULL, so each cell becomes a synthetic `bank_transactions` row: `transaction_id = XLS-2627-<student>-<date>` (deterministic, so re-running is a no-op), sender and account NULL, status `matched`, timestamp at Ulaanbaatar local midnight (`+08:00`, no DST — same convention as the bank-file parser). The `XLS-` prefix is what tells these apart from genuinely imported statements.

Fifteen cells are negative — refunds and corrections — and load as negative payments, which keeps loaded totals equal to the sheet's.

**The dated cells are the primary record, not the "Total Paid" column.** That column is a summary formula over them and has gone stale on two rows; the QA script checks the database against the cells and reports the disagreement rather than treating the summary as authoritative.

### Discounts carry their rule, not just their amount

`discounts.amount` is always the MNT figure from the workbook, so balances reconcile with the sheet whatever else is stored. `unit`/`value` additionally record *how* the figure arose, and a percentage is only claimed when it round-trips to that amount to the last MNT. Recovered from the 2026-2027 numbers: Early-bird is a flat ₮5,000,000; **Siblings is 5% (or 50%) of what remains *after* early-bird**, not of gross — which is why `position` matters and why the loader writes lines in compounding order rather than sheet-column order; Staff is a per-family percentage of gross (40–90%); Scholarship, Corporate and Barter are negotiated cash amounts.

---

## Fields not sourced from any scrape yet

These fields the year-start / term-start load needs are not covered by any scrape source above. They must be supplied manually at load time, or another esmlh page found. Open questions about source live in `notes.md`.

- `enrollments.student_category` (`new` / `old`)
- `enrollments.tuition_contract_id`
- Discount data
- Bus opt-in (term-start)

The load scripts combine the available scrapes with whatever is supplied for these gaps, and **fail loudly** when a required-but-missing field would force a placeholder.

---

## Operational notes

- **Run frequency.** Year-start (full re-scrape, drives Enrollment creation), then ad-hoc when the admin notices a roster change.
- **Idempotency.** Loader uses `students.student_id` as the natural key — re-running is `INSERT ... ON CONFLICT DO UPDATE` on student rows, not an error. Enrollments use `UNIQUE (student_id, academic_year_id)`; same pattern.
- **Politeness.** Single page (pagination at full enrollment is an open question — see `notes.md`). One full pass per run is fine; if pagination appears, add 0.5–1 s sleep between pages.
- **Photos.** Skipped in v1. URL pattern is `https://esmlh.edu.mn/uploads/school/student_image/<student_id>.jpg`.
- **Logging.** Scraper writes a count of rows scraped and any parse failures to stderr. Loader logs counts of inserts vs updates.
- **No live re-scrape from app code.** The Next.js app never talks to esmlh.edu.mn. Everything goes through the scripted pipeline.
