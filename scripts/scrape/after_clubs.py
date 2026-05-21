"""
Scrapes https://esmlh.edu.mn/admin/after_clubs and writes
scripts/scraped/after_clubs.json. Only rows whose status is "Active" are kept.
See docs/scraping_esmlh.md for the full spec.

Usage (from the scripts/ directory):
    python -m scrape.after_clubs

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
CLUBS_URL = "https://esmlh.edu.mn/admin/after_clubs"
OUTPUT_PATH = SCRAPED_DIR / "after_clubs.json"

CLUB_ID_RE = re.compile(r"/edit_after_club/(\d+)")
FEE_RE = re.compile(r"[\d]+")


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


def _span_text(td) -> str:
    span = td.find("span")
    return (span.get_text(strip=True) if span else td.get_text(strip=True))


def parse_row(tds: list, row_num: int) -> dict | None:
    # col 5: Status — keep only "Active"
    status = _span_text(tds[5])
    if status != "Active":
        return None

    # col 1: Club Name
    name = tds[1].get_text(strip=True)
    if not name:
        raise ValueError(f"row {row_num}: missing club name")

    # col 2: Teacher
    teacher = tds[2].get_text(strip=True) or None

    # col 3: Schedule
    schedule = tds[3].get_text(strip=True) or None

    # col 4: Fee — strip ₮ and commas, parse to int
    fee_raw = tds[4].get_text(strip=True)
    digits = "".join(FEE_RE.findall(fee_raw))
    if not digits:
        raise ValueError(f"row {row_num}: cannot parse fee '{fee_raw}'")
    fee = int(digits)

    # col 6: Payment Model
    payment_model = _span_text(tds[6]) or None

    # col 8: options — extract club_id from the edit link only
    m = CLUB_ID_RE.search(str(tds[8]))
    if not m:
        raise ValueError(f"row {row_num}: cannot find club_id in options cell")
    club_id = m.group(1)

    return {
        "club_id": club_id,
        "name": name,
        "teacher": teacher,
        "schedule": schedule,
        "fee": fee,
        "status": status,
        "payment_model": payment_model,
    }


def scrape(session: requests.Session) -> list[dict]:
    resp = session.get(CLUBS_URL)
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
        if len(tds) < 9:
            print(f"WARNING row {i}: expected ≥9 columns, got {len(tds)} — skipping.", file=sys.stderr)
            failures += 1
            continue
        try:
            record = parse_row(tds, i)
            if record is not None:
                records.append(record)
        except ValueError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            failures += 1

    print(f"Scraped {len(records)} active club rows. Parse failures: {failures}.", file=sys.stderr)

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
