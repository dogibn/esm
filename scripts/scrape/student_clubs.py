"""
Scrapes https://esmlh.edu.mn/admin/student_clubs_summary?student_id=<id> for
every student in scripts/scraped/students.json. For each student, keeps only
club rows whose "Club Status" == "Active" and emits
{student_id, name, payment_model, total_fee} records.

`total_fee` is esmlh's accrued obligation for the club, parsed from the
"Total Fee" column. For "Per Session" clubs (e.g. homework club) this is
attendance × per-session rate — the number that should become the club charge
amount, since the after-clubs catalog fee is only the per-session rate. None
when the cell has no digits.

Students with no enrolment ("This student is not enrolled in any after school
clubs.") are silently counted and skipped.

See docs/scraping_esmlh.md for the full spec.

Usage (from the scripts/ directory):
    python -m scrape.student_clubs

Requires env vars:
    ESMLH_LOGIN_EMAIL
    ESMLH_LOGIN_PASSWORD
"""

import os
import re
import sys
import time

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

from lib.io import load_json, write_json
from lib.paths import PROJECT_ROOT, SCRAPED_DIR

load_dotenv(PROJECT_ROOT / ".env.local")

LOGIN_URL = "https://esmlh.edu.mn/login/validate_login"
SUMMARY_URL = "https://esmlh.edu.mn/admin/student_clubs_summary"
INPUT_PATH = SCRAPED_DIR / "students.json"
OUTPUT_PATH = SCRAPED_DIR / "student_clubs.json"

NOT_ENROLLED_MARKER = "This student is not enrolled in any after school clubs."
REQUEST_DELAY_S = 0.3
PROGRESS_EVERY = 50

AMOUNT_RE = re.compile(r"\d+")


def _span_text(td) -> str:
    """Text of an inner <span> (status/payment-model labels), else the cell."""
    span = td.find("span")
    return span.get_text(strip=True) if span else td.get_text(strip=True)


def _parse_amount(raw: str) -> int | None:
    """Parse '₮240,000' → 240000. Returns None when no digits are present
    (e.g. an em-dash placeholder), so the loader can tell 'unknown' apart from
    a real 0."""
    digits = "".join(AMOUNT_RE.findall(raw))
    return int(digits) if digits else None


def authenticate() -> requests.Session:
    email = os.environ.get("ESMLH_LOGIN_EMAIL")
    password = os.environ.get("ESMLH_LOGIN_PASSWORD")
    if not email or not password:
        print("ERROR: ESMLH_LOGIN_EMAIL and ESMLH_LOGIN_PASSWORD must be set.", file=sys.stderr)
        sys.exit(1)

    session = requests.Session()
    resp = session.post(LOGIN_URL, data={"email": email, "password": password})
    resp.raise_for_status()
    return session


def parse_active_clubs(html: str, student_id: str) -> tuple[list[dict], bool, int]:
    """Return (active_club_records, was_enrolled, orphan_count).

    Each record is {name, payment_model, total_fee}. was_enrolled is False if
    the page has the 'not enrolled' marker. orphan_count is the number of
    Active rows with empty club names (source-side artefacts — skipped).

    Columns: # | Club Name | Club Status | Enrolment Status | Payment Model |
    Total Fee | Total Paid | Remaining. Payment Model (col 4) and Total Fee
    (col 5) are read defensively — a layout shift in the trailing columns must
    not break enrolment capture, which only needs the name."""
    if NOT_ENROLLED_MARKER in html:
        return [], False, 0

    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if table is None:
        raise ValueError(f"student_id={student_id}: no <table> and no 'not enrolled' marker")

    tbody = table.find("tbody")
    rows = tbody.find_all("tr") if tbody else table.find_all("tr")[1:]

    records: list[dict] = []
    orphans = 0
    for i, row in enumerate(rows, start=1):
        tds = row.find_all("td")
        if len(tds) < 3:
            raise ValueError(
                f"student_id={student_id} row {i}: expected ≥3 columns, got {len(tds)}"
            )

        status_span = tds[2].find("span")
        status = (status_span.get_text(strip=True) if status_span else tds[2].get_text(strip=True))
        if status != "Active":
            continue

        name = tds[1].get_text(strip=True)
        if not name:
            # Source-side orphan: Active row with no club name (seen e.g. on
            # student 58). Skip silently-with-count rather than halt the run.
            orphans += 1
            continue

        payment_model = (_span_text(tds[4]) or None) if len(tds) > 4 else None
        total_fee = _parse_amount(tds[5].get_text(strip=True)) if len(tds) > 5 else None

        records.append(
            {"name": name, "payment_model": payment_model, "total_fee": total_fee}
        )

    return records, True, orphans


def scrape(session: requests.Session, student_ids: list[str]) -> list[dict]:
    records: list[dict] = []
    enrolled_count = 0
    not_enrolled_count = 0
    orphan_total = 0

    total = len(student_ids)
    for i, sid in enumerate(student_ids, start=1):
        resp = session.get(SUMMARY_URL, params={"student_id": sid})
        resp.raise_for_status()

        club_records, was_enrolled, orphans = parse_active_clubs(resp.text, sid)
        orphan_total += orphans
        if was_enrolled:
            enrolled_count += 1
            for rec in club_records:
                records.append({"student_id": sid, **rec})
        else:
            not_enrolled_count += 1

        if i % PROGRESS_EVERY == 0 or i == total:
            print(
                f"  [{i}/{total}] enrolled={enrolled_count} not_enrolled={not_enrolled_count} pairs={len(records)} orphans={orphan_total}",
                file=sys.stderr,
            )

        time.sleep(REQUEST_DELAY_S)

    print(
        f"Done. {len(records)} (student, active club) pairs across {enrolled_count} enrolled students "
        f"({not_enrolled_count} not enrolled). Skipped {orphan_total} Active rows with empty club names.",
        file=sys.stderr,
    )
    return records


def main() -> None:
    students = load_json(INPUT_PATH)
    student_ids = [s["student_id"] for s in students]
    print(f"Scraping club summaries for {len(student_ids)} students…", file=sys.stderr)

    session = authenticate()
    records = scrape(session, student_ids)

    write_json(OUTPUT_PATH, records, indent=2)
    print(f"Wrote {len(records)} records to {OUTPUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
