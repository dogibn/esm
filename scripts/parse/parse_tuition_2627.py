"""Parses the 2026-2027 tuition workbook into parsed/tuition_26-27.json.

The 2026-2027 sheet is laid out differently from tuition_25-26.xlsx, so it gets
its own parser rather than another branch inside parse_tuition_excel.py:

  A:R   the per-student columns (contract, new/old, grade, names, code, the
        gross tuition, the net "Total payment", the Check formula column, and
        seven MNT discount columns)
  S:DD  ninety dated payment columns — one column per day the school banked
        money, one cell per student who paid that day
  DF    "Total Paid"    — the sum of that student's dated cells
  DH    "Left Payment"  — spreadsheet-side outstanding balance
  DK    the previous year's ("2025-2026") tuition

Two kinds of non-student marker row are interleaved with the data:

  * **Section headers** carry `*` in Code. They label a block of returning
    students by their *2025-2026* class and/or form tutor, in free text
    ("6D | Timothy Hicks", "Grade 7 | 6B"). Unreliable as a grade source.
  * **New-intake sub-headers** carry only a Surname ("New grade 8", "new 11")
    with no name, code, tuition or payments. The rows beneath them are that
    year's new joiners, and — unlike the section headers — their `Grade`
    column does hold the *2026-2027* level.

Both are captured so downstream resolution can fall back on them, but neither
is trusted over the esmlh directory.

Names are emitted twice: verbatim as `surname_raw`/`name_raw`, and with digits
stripped as `surname`/`name`. The accountants tag duplicate surnames with a
trailing counter ("Batbold 2"), which is bookkeeping, not part of the name.

Usage (from the scripts/ directory):
    python -m parse.parse_tuition_2627
"""

from __future__ import annotations

import datetime as dt
import re
import sys

import pandas as pd

from lib.io import write_json
from lib.paths import DATA_DIR, PARSED_DIR

INPUT_FILE = DATA_DIR / "tuition_2026-2027.xlsx"
OUTPUT_FILE = PARSED_DIR / "tuition_26-27.json"
MARKERS_FILE = PARSED_DIR / "tuition_26-27.markers.json"

# Fixed positions. The sheet has no usable header row past column R (the
# payment columns are dates and the rest are unnamed), so columns are taken by
# index and asserted against the header text below.
CORE_COLUMNS = [
    "reg",             # A  registration fee, not loaded here
    "contract",        # B  tuition contract id
    "idx",             # C  unnamed running index
    "new_old",         # D  new / old
    "grade",           # E  free-text grade, unreliable except on new joiners
    "surname",         # F
    "name",            # G
    "code",            # H  stable per-student key, '*' on section headers
    "tuition",         # I  gross tuition for 2026-2027
    "total_payment",   # J  net tuition after discounts
    "check",           # K  = tuition - discounts - total_payment
    "staff",           # L  ┐
    "corporate",       # M  │
    "barter",          # N  │
    "early_bird",      # O  ├ discount amounts, MNT
    "deal",            # P  │
    "sibling",         # Q  │
    "scholarship",     # R  ┘
]
PAYMENT_FIRST_COL = 18
PAYMENT_LAST_COL = 107  # inclusive
TOTAL_PAID_COL = 109
LEFT_PAYMENT_COL = 111
PREV_YEAR_COL = 114
COMMENT_COL = 117

MONEY_COLUMNS = [
    "reg",
    "tuition",
    "total_payment",
    "check",
    "staff",
    "corporate",
    "barter",
    "early_bird",
    "deal",
    "sibling",
    "scholarship",
]
DISCOUNT_COLUMNS = [
    "staff",
    "corporate",
    "barter",
    "early_bird",
    "deal",
    "sibling",
    "scholarship",
]

EXPECTED_HEADERS = {
    1: "Contract",
    7: "Code",
    8: "2026-2027",
    TOTAL_PAID_COL: "Total Paid",
    PREV_YEAR_COL: "2025-2026",
}


def _text(value) -> str | None:
    """Cell → trimmed string, or None when blank."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    return s or None


def _strip_digits(value: str | None) -> str | None:
    """Drop digits and collapse whitespace — mirrors lib.validators."""
    if value is None:
        return None
    return " ".join(re.sub(r"\d", "", value).split()) or None


def _money(value) -> int | None:
    """Cell → whole MNT, or None when blank. Fractions are rounded: one row
    carries a rounding artefact (20,499,982.36) and MNT has no subunit here."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str):
        cleaned = re.sub(r"[,\s ]", "", value.strip())
        if not cleaned or cleaned == "-":
            return None
        try:
            return round(float(cleaned))
        except ValueError:
            return None
    try:
        return round(float(value))
    except (TypeError, ValueError):
        return None


def _verify_headers(df: pd.DataFrame) -> None:
    columns = list(df.columns)
    for index, expected in EXPECTED_HEADERS.items():
        actual = str(columns[index]).strip()
        if actual != expected:
            print(
                f"ERROR: column {index} is {actual!r}, expected {expected!r} — "
                "the workbook layout changed; fix the column map before loading.",
                file=sys.stderr,
            )
            sys.exit(1)


def _payment_dates(df: pd.DataFrame) -> list[tuple[int, str]]:
    """(column index, ISO date) for every dated payment column."""
    dates: list[tuple[int, str]] = []
    for index in range(PAYMENT_FIRST_COL, PAYMENT_LAST_COL + 1):
        header = df.columns[index]
        if isinstance(header, (dt.datetime, dt.date, pd.Timestamp)):
            dates.append((index, pd.Timestamp(header).date().isoformat()))
        else:
            print(
                f"ERROR: column {index} header {header!r} is not a date — "
                "the payment block moved.",
                file=sys.stderr,
            )
            sys.exit(1)
    return dates


def parse() -> None:
    if not INPUT_FILE.exists():
        print(f"ERROR: cannot find {INPUT_FILE}.", file=sys.stderr)
        sys.exit(1)

    raw = pd.read_excel(INPUT_FILE, header=0)
    _verify_headers(raw)
    payment_columns = _payment_dates(raw)

    core = raw.iloc[:, : len(CORE_COLUMNS)].copy()
    core.columns = CORE_COLUMNS

    students: list[dict] = []
    markers: list[dict] = []
    section: str | None = None      # nearest `*` header (2025-2026 class/tutor)
    intake_grade: str | None = None  # nearest new-intake sub-header's grade

    for position, row in core.iterrows():
        excel_row = position + 2  # +1 for the header row, +1 for 1-based rows
        code = _text(row["code"])
        surname_raw = _text(row["surname"])
        name_raw = _text(row["name"])
        tuition = _money(row["tuition"])
        total_paid = _money(raw.iat[position, TOTAL_PAID_COL])
        payments = [
            {"date": date, "amount": amount}
            for column, date in payment_columns
            if (amount := _money(raw.iat[position, column])) not in (None, 0)
        ]

        if code == "*":
            section = " | ".join(p for p in (surname_raw, name_raw) if p) or None
            intake_grade = None  # a new section closes any open intake block
            markers.append(
                {"row": excel_row, "kind": "section", "label": section}
            )
            continue

        # A new-intake sub-header: a lone label in the Surname cell with no
        # student data anywhere on the row.
        is_sub_header = (
            surname_raw is not None
            and name_raw is None
            and code is None
            and tuition is None
            and not total_paid
            and not payments
        )
        if is_sub_header:
            intake_grade = _text(row["grade"])
            markers.append(
                {
                    "row": excel_row,
                    "kind": "intake",
                    "label": surname_raw,
                    "grade": intake_grade,
                }
            )
            continue

        if surname_raw is None and name_raw is None:
            continue  # spacer row

        discounts = {column: _money(row[column]) for column in DISCOUNT_COLUMNS}
        students.append(
            {
                "row": excel_row,
                "section": section,
                "intake_grade": intake_grade,
                "code": code,
                "contract": _text(row["contract"]),
                "new_old": (_text(row["new_old"]) or "").lower() or None,
                "grade_file": _text(row["grade"]),
                "surname_raw": surname_raw,
                "name_raw": name_raw,
                "surname": _strip_digits(surname_raw),
                "name": _strip_digits(name_raw),
                "tuition": tuition,
                "total_payment": _money(row["total_payment"]),
                "check": _money(row["check"]),
                **discounts,
                "discount_total": sum(v for v in discounts.values() if v),
                "total_paid": total_paid,
                "left_payment": _money(raw.iat[position, LEFT_PAYMENT_COL]),
                "prev_year_tuition": _money(raw.iat[position, PREV_YEAR_COL]),
                "comment": _text(raw.iat[position, COMMENT_COL]),
                "payments": payments,
            }
        )

    write_json(OUTPUT_FILE, students, indent=1)
    write_json(MARKERS_FILE, markers, indent=1)

    renamed = sum(
        1
        for s in students
        if s["surname"] != s["surname_raw"] or s["name"] != s["name_raw"]
    )
    payment_cells = sum(len(s["payments"]) for s in students)
    print(
        f"Parsed {len(students)} student rows "
        f"({sum(1 for s in students if s['code'])} with a code), "
        f"{len(markers)} marker rows, {payment_cells} payment cells.",
        file=sys.stderr,
    )
    print(f"Digit-stripping changed a name on {renamed} rows.", file=sys.stderr)
    print(f"Wrote {OUTPUT_FILE} and {MARKERS_FILE}", file=sys.stderr)


if __name__ == "__main__":
    parse()
