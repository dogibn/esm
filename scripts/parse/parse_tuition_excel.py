"""
Parses the tuition Excel workbook from data/ and writes valid/invalid JSON
splits to parsed/. See docs/scraping_esmlh.md for context on the pipeline.

Usage (from the scripts/ directory):
    python -m parse.parse_tuition_excel
"""

import pandas as pd

from lib.config import year_suffix
from lib.io import write_json
from lib.paths import DATA_DIR, PARSED_DIR

_SUFFIX = year_suffix()
INPUT_FILE = DATA_DIR / f"tuition_{_SUFFIX}.xlsx"
PARSED_FILE_VALID = PARSED_DIR / f"tuition_{_SUFFIX}.json"
PARSED_FILE_INVALID = PARSED_DIR / f"tuition_{_SUFFIX}_invalid.json"


def parse_spreadsheet():
    if not INPUT_FILE.exists():
        print(f"Error: Could not find file at {INPUT_FILE}")
        return

    COLUMNS = [
        "reg",                  # A — drop
        "contract",             # B - anchor column
        "idx",                  # C — drop (unnamed index column)
        "new_old",              # D
        "grade",                # E
        "surname",              # F
        "name",                 # G
        "code",                 # H
        "tuition",              # I (2025-2026)
        "total_payment",        # J
        "ot",                   # K — drop
        "check",                # L
        "staff",                # M
        "corporate",            # N
        "barter",               # O
        "early_bird_discount",  # P
        "deal_discount",        # Q
        "sibling_discount",     # R
        "scholarship",          # S
    ]
    df = pd.read_excel(INPUT_FILE, usecols="A:S", header=0, names=COLUMNS)

    valid_data = []
    invalid_data = []

    for _, row in df.iterrows():
        # assumed constraint: student name and tuition shouldn't be empty
        valid_row = pd.notna(row["name"]) and (
            pd.notna(row["tuition"]) or pd.notna(row["total_payment"])
        )

        if valid_row:
            valid_data.append(
                {k: (None if pd.isna(v) else str(v).strip()) for k, v in row.items()}
            )
        else:
            invalid_data.append({k: v for k, v in row.items() if pd.notna(v)})

    write_json(PARSED_FILE_VALID, valid_data)
    write_json(PARSED_FILE_INVALID, invalid_data)

    print(f"✅ Saved {len(valid_data)} valid + {len(invalid_data)} invalid rows.")


if __name__ == "__main__":
    parse_spreadsheet()
