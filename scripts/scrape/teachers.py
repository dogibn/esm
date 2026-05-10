"""
Scrapes https://esmlh.edu.mn/teacher/staff_directory and writes
scripts/scraped/teachers.json. See docs/scraping_esmlh.md for the full spec.

Keeps only rows whose position contains "Form Tutor". Each such row maps to
one grades row (identified by grade_name) for the current academic year.

Usage:
    python scripts/scrape/teachers.py

Requires env vars:
    ESMLH_LOGIN_EMAIL
    ESMLH_LOGIN_PASSWORD
"""

import json
import os
import sys
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv(Path(__file__).parents[2] / ".env.local")

LOGIN_URL = "https://esmlh.edu.mn/login/validate_login"
DIRECTORY_URL = "https://esmlh.edu.mn/teacher/staff_directory"
OUTPUT_PATH = Path(__file__).parents[2] / "scripts" / "scraped" / "teachers.json"
ACADEMIC_YEAR = "2025-2026"


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


def parse_row(row, row_num: int) -> dict | None:
    def field(name: str) -> str:
        td = row.find("td", {"data-field": name})
        return td.get_text(strip=True) if td else ""

    supp, pos = field("supplementary"), field("position")

    position = supp if "Form Tutor" in supp else (pos if "Form Tutor" in pos else None)

    if position is None:
        return None

    name = field("name")
    email = field("email")
    phone = field("phone")

    if not name:
        raise ValueError(f"row {row_num}: missing name")

    # grade_name: strip "Form Tutor" from position text and trim.
    grade_name = m.group(0) if (m := re.search(r"(?<=Form Tutor\s)\d\S*", position, re.IGNORECASE)) else None
    grade_level = m.group(0) if (m := re.search(r"^\d+\+?", grade_name)) else None
    if not grade_name:
        raise ValueError(f"row {row_num}: position '{position}' has no grade after 'Form Tutor'")
    if not grade_level:
        raise ValueError(f"row {row_num}: grade_name '{grade_name}' has no valid grade_level")

    return {
        "grade_name": grade_name,
        "grade_level" : grade_level,
        "academic_year" : ACADEMIC_YEAR,
        "teacher_name": name,
        "teacher_email": email or None,
        "teacher_phone": phone or None,
    }


def scrape(session: requests.Session) -> list[dict]:
    resp = session.get(DIRECTORY_URL)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    tbody = soup.find("tbody")
    if tbody is None:
        print("ERROR: <tbody> not found — page layout may have changed.", file=sys.stderr)
        sys.exit(1)

    rows = tbody.find_all("tr")
    records: list[dict] = []
    failures = 0

    for i, row in enumerate(rows, start=1):
        try:
            record = parse_row(row, i)
            if record is not None:
                records.append(record)
        except ValueError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            failures += 1

    print(f"Scraped {len(records)} Form Tutor rows. Parse failures: {failures}.", file=sys.stderr)

    if failures > 0:
        print("ERROR: halting — fix parse failures before writing output.", file=sys.stderr)
        sys.exit(1)

    return records


def main() -> None:
    session = authenticate()
    records = scrape(session)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(records, ensure_ascii=False, indent=2))
    print(f"Wrote {len(records)} records to {OUTPUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
