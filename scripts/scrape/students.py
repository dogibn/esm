"""
Scrapes https://esmlh.edu.mn/teacher/student_directory and writes
scripts/scraped/students.json. See docs/scraping_esmlh.md for the full spec.

Usage (from the scripts/ directory):
    python -m scrape.students

Requires env vars:
    ESMLH_LOGIN_EMAIL
    ESMLH_LOGIN_PASSWORD
"""

import os
import re
import sys

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

from lib.io import write_json
from lib.paths import PROJECT_ROOT, SCRAPED_DIR

load_dotenv(PROJECT_ROOT / ".env.local")

LOGIN_URL = "https://esmlh.edu.mn/login/validate_login"
DIRECTORY_URL = "https://esmlh.edu.mn/teacher/student_directory"
OUTPUT_PATH = SCRAPED_DIR / "students.json"

CLASS_RE = re.compile(r"^(?P<grade>[^ ]+) \((?P<year>\d{4}-\d{4})\)$")


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


def parse_row(tds: list, row_num: int) -> dict:
    # col 1: First Name — text inside <a>
    first_name = tds[1].find("a")
    if first_name is None:
        raise ValueError(f"row {row_num}: no <a> in First Name cell")
    first_name = first_name.get_text(strip=True)

    # col 2: Last Name — text inside <a>
    last_name = tds[2].find("a")
    if last_name is None:
        raise ValueError(f"row {row_num}: no <a> in Last Name cell")
    last_name = last_name.get_text(strip=True)

    # col 3: Class — "6E (2025-2026)"
    class_text = tds[3].get_text(strip=True)
    m = CLASS_RE.match(class_text)
    if not m:
        raise ValueError(f"row {row_num}: cannot parse class '{class_text}'")
    grade_name = m.group("grade")
    academic_year_name = m.group("year")

    # col 5: Parent Phone — raw string verbatim
    parent_phone = tds[5].get_text(strip=True) or None

    # col 6: Parent Email — empty string → None
    parent_email = tds[6].get_text(strip=True) or None

    # col 7: Student ID — text, stored as string
    student_id = tds[7].get_text(strip=True)
    if not student_id:
        raise ValueError(f"row {row_num}: missing student_id")

    return {
        "student_id": student_id,
        "first_name": first_name,
        "last_name": last_name,
        "grade_name": grade_name,
        "academic_year_name": academic_year_name,
        "parent_phone": parent_phone,
        "parent_email": parent_email,
    }


def scrape(session: requests.Session) -> list[dict]:
    resp = session.get(DIRECTORY_URL)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", id="example23")
    if table is None:
        print("ERROR: <table id='example23'> not found — page layout may have changed.", file=sys.stderr)
        sys.exit(1)

    tbody = table.find("tbody")
    rows = tbody.find_all("tr") if tbody else table.find_all("tr")[1:]

    records: list[dict] = []
    failures = 0

    for i, row in enumerate(rows, start=1):
        tds = row.find_all("td")
        if len(tds) < 8:
            print(f"WARNING row {i}: expected ≥8 columns, got {len(tds)} — skipping.", file=sys.stderr)
            failures += 1
            continue
        try:
            records.append(parse_row(tds, i))
        except ValueError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            failures += 1

    print(f"Scraped {len(records)} rows. Parse failures: {failures}.", file=sys.stderr)

    if failures > 0:
        print("ERROR: halting — fix parse failures before writing output.", file=sys.stderr)
        sys.exit(1)

    return records


def main() -> None:
    session = authenticate()
    records = scrape(session)

    write_json(OUTPUT_PATH, records, indent=2)
    print(f"Wrote {len(records)} records to {OUTPUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
