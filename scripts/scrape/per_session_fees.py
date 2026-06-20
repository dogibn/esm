"""
Scoped refresh of "Per Session" club fees (e.g. homework club).

Unlike scrape.student_clubs — a full ~1,400-student pass run ONCE per term to
discover enrolments — this re-polls ONLY the students already known to be in a
Per Session club and captures their current Total Fee, the attendance-accrued
obligation that should become the club charge amount. Run it on a schedule
(weekly/daily); a pass over ~50 students takes well under a minute.

Targets are derived from existing scrape artefacts (no DB access from Python):
  - scripts/scraped/after_clubs.json   → which club names are "Per Session"
  - scripts/scraped/student_clubs.json → which students are enrolled in them

Output: scripts/scraped/per_session_fees.json
  [ { "student_id": "58", "name": "HW GR1 Term 4", "total_fee": 240000 } ]

Loader: pnpm refresh:per-session-charges

Usage (from the scripts/ directory):
    python -m scrape.per_session_fees

Requires env vars: ESMLH_LOGIN_EMAIL, ESMLH_LOGIN_PASSWORD
"""

import sys
import time

import requests

from lib.io import load_json, write_json
from lib.paths import SCRAPED_DIR
from scrape.student_clubs import (
    PROGRESS_EVERY,
    REQUEST_DELAY_S,
    SUMMARY_URL,
    authenticate,
    parse_active_clubs,
)

AFTER_CLUBS_PATH = SCRAPED_DIR / "after_clubs.json"
STUDENT_CLUBS_PATH = SCRAPED_DIR / "student_clubs.json"
OUTPUT_PATH = SCRAPED_DIR / "per_session_fees.json"


def per_session_club_names() -> set[str]:
    """Per Session club fee-names, from the after-clubs catalog."""
    clubs = load_json(AFTER_CLUBS_PATH)
    return {c["name"] for c in clubs if c.get("payment_model") == "Per Session"}


def target_student_ids(per_session_names: set[str]) -> list[str]:
    """Distinct student_ids with at least one Per Session enrolment, in
    first-seen order. Matches by club name, so it works even on a
    student_clubs.json produced before payment_model was captured."""
    enrolments = load_json(STUDENT_CLUBS_PATH)
    ids: list[str] = []
    seen: set[str] = set()
    for e in enrolments:
        sid = e["student_id"]
        if e.get("name") in per_session_names and sid not in seen:
            seen.add(sid)
            ids.append(sid)
    return ids


def scrape(
    session: requests.Session,
    student_ids: list[str],
    per_session_names: set[str],
) -> list[dict]:
    records: list[dict] = []
    total = len(student_ids)
    for i, sid in enumerate(student_ids, start=1):
        resp = session.get(SUMMARY_URL, params={"student_id": sid})
        resp.raise_for_status()

        club_records, was_enrolled, _orphans = parse_active_clubs(resp.text, sid)
        if was_enrolled:
            for rec in club_records:
                if rec["name"] in per_session_names:
                    records.append(
                        {
                            "student_id": sid,
                            "name": rec["name"],
                            "total_fee": rec["total_fee"],
                        }
                    )

        if i % PROGRESS_EVERY == 0 or i == total:
            print(f"  [{i}/{total}] per-session rows={len(records)}", file=sys.stderr)

        time.sleep(REQUEST_DELAY_S)
    return records


def main() -> None:
    per_session_names = per_session_club_names()
    if not per_session_names:
        print(
            "No 'Per Session' clubs in after_clubs.json — nothing to refresh.",
            file=sys.stderr,
        )
        write_json(OUTPUT_PATH, [], indent=2)
        return
    print(f"Per Session clubs: {sorted(per_session_names)}", file=sys.stderr)

    student_ids = target_student_ids(per_session_names)
    print(
        f"Re-polling {len(student_ids)} student(s) enrolled in Per Session clubs…",
        file=sys.stderr,
    )

    session = authenticate()
    records = scrape(session, student_ids, per_session_names)

    write_json(OUTPUT_PATH, records, indent=2)
    print(
        f"Wrote {len(records)} per-session fee record(s) to {OUTPUT_PATH}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
