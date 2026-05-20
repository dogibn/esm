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

## Fields not sourced from any scrape yet

These fields the year-start / term-start load needs are not covered by either scrape source above. They must be supplied manually at load time, or another esmlh page found. Open questions about source live in `notes.md`.

- `enrollments.student_category` (`new` / `old`)
- `enrollments.tuition_contract_id`
- Discount data
- Bus opt-in (term-start)
- Club enrollments (term-start)

The load scripts combine the available scrapes with whatever is supplied for these gaps, and **fail loudly** when a required-but-missing field would force a placeholder.

---

## Operational notes

- **Run frequency.** Year-start (full re-scrape, drives Enrollment creation), then ad-hoc when the admin notices a roster change.
- **Idempotency.** Loader uses `students.student_id` as the natural key — re-running is `INSERT ... ON CONFLICT DO UPDATE` on student rows, not an error. Enrollments use `UNIQUE (student_id, academic_year_id)`; same pattern.
- **Politeness.** Single page (pagination at full enrollment is an open question — see `notes.md`). One full pass per run is fine; if pagination appears, add 0.5–1 s sleep between pages.
- **Photos.** Skipped in v1. URL pattern is `https://esmlh.edu.mn/uploads/school/student_image/<student_id>.jpg`.
- **Logging.** Scraper writes a count of rows scraped and any parse failures to stderr. Loader logs counts of inserts vs updates.
- **No live re-scrape from app code.** The Next.js app never talks to esmlh.edu.mn. Everything goes through the scripted pipeline.
