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
