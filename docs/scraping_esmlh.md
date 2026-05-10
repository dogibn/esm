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

## Gaps the directory doesn't cover

The student directory page does **not** contain these fields the year-start import needs. They must come from elsewhere or be supplied manually at load time. Open questions about source live in `notes.md`.

- `enrollments.student_category` (`new` / `old`)
- `enrollments.tuition_contract_id`
- `grades.teacher_name`, `grades.teacher_email`
- Discount data
- Bus opt-in (term-start)
- Club enrollments (term-start)

The year-start load script combines the student-directory scrape with whatever it can get for these gaps, and **fails loudly** when a required-but-missing field would force a placeholder.

---

## Operational notes

- **Run frequency.** Year-start (full re-scrape, drives Enrollment creation), then ad-hoc when the admin notices a roster change.
- **Idempotency.** Loader uses `students.student_id` as the natural key — re-running is `INSERT ... ON CONFLICT DO UPDATE` on student rows, not an error. Enrollments use `UNIQUE (student_id, academic_year_id)`; same pattern.
- **Politeness.** Single page (pagination at full enrollment is an open question — see `notes.md`). One full pass per run is fine; if pagination appears, add 0.5–1 s sleep between pages.
- **Photos.** Skipped in v1. URL pattern is `https://esmlh.edu.mn/uploads/school/student_image/<student_id>.jpg`.
- **Logging.** Scraper writes a count of rows scraped and any parse failures to stderr. Loader logs counts of inserts vs updates.
- **No live re-scrape from app code.** The Next.js app never talks to esmlh.edu.mn. Everything goes through the scripted pipeline.
