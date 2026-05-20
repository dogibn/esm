"""Export a review workbook for the students↔tuition reconciliation.

Three sheets:
  1. `unmatched_tuition` — tuition rows that have no matching student
     (current `processed/students_tuition.unmatched_tuition.json`)
  2. `unmatched_students` — student rows that have no matching tuition
     (current `processed/students_tuition.unmatched_students.json`)
  3. `reconciliation_changes` — cumulative diff between
     `tuition_25-26.matched.json` and `tuition_25-26.cleaned.json` in
     mutable columns. Captures EVERY manual fix applied so far across
     all `apply` iterations, not just the latest one.

Usage (from scripts/):
    python -m match.students_tuition_review
"""

from pathlib import Path

import pandas as pd

from lib.excel import write_workbook
from lib.grades import sort_by_grade
from lib.io import load_dataframe
from lib.paths import PROCESSED_DIR


UNMATCHED_TUITION = PROCESSED_DIR / "students_tuition.unmatched_tuition.json"
UNMATCHED_STUDENTS = PROCESSED_DIR / "students_tuition.unmatched_students.json"
MATCHED = PROCESSED_DIR / "tuition_25-26.matched.json"
CLEANED = PROCESSED_DIR / "tuition_25-26.cleaned.json"
OUTPUT = PROCESSED_DIR / "students_tuition_review.xlsx"

MUTABLE_COLUMNS = ["grade", "surname", "name"]
CONTEXT_COLUMNS = ["contract", "tuition", "total_payment"]


def _format_change(orig, new) -> str:
    def _show(v):
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return "∅"
        return str(v)
    if _show(orig) == _show(new):
        return _show(new)
    return f"{_show(orig)} → {_show(new)}"


def _cumulative_changes() -> pd.DataFrame:
    """Diff matched vs cleaned by row index, mutable columns only."""
    matched_df = load_dataframe(MATCHED)
    cleaned_df = load_dataframe(CLEANED)
    if len(matched_df) != len(cleaned_df):
        raise SystemExit(
            f"matched.json ({len(matched_df)} rows) and cleaned.json "
            f"({len(cleaned_df)} rows) disagree on row count."
        )

    rows: list[dict] = []
    for i in range(len(matched_df)):
        m = matched_df.iloc[i]
        c = cleaned_df.iloc[i]
        diffs = {}
        for col in MUTABLE_COLUMNS:
            m_val = m.get(col)
            c_val = c.get(col)
            m_null = m_val is None or (isinstance(m_val, float) and pd.isna(m_val))
            c_null = c_val is None or (isinstance(c_val, float) and pd.isna(c_val))
            if m_null and c_null:
                continue
            if str(m_val) != str(c_val):
                diffs[col] = (c_val, m_val)
        if not diffs:
            continue
        rows.append({
            "contract": m.get("contract"),
            "code": m.get("code"),
            "grade": _format_change(c.get("grade"), m.get("grade")),
            "surname": _format_change(c.get("surname"), m.get("surname")),
            "name": _format_change(c.get("name"), m.get("name")),
            "tuition": m.get("tuition"),
            "total_payment": m.get("total_payment"),
        })

    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    return sort_by_grade(df, "grade", "name").reset_index(drop=True)


def main() -> None:
    missing = [p for p in (UNMATCHED_TUITION, UNMATCHED_STUDENTS, MATCHED, CLEANED) if not p.exists()]
    if missing:
        raise SystemExit(
            "Missing required input(s): "
            + ", ".join(str(p) for p in missing)
            + "\nRun match.students_tuition (and apply if needed) first."
        )

    unmatched_tuition = load_dataframe(UNMATCHED_TUITION)
    unmatched_students = load_dataframe(UNMATCHED_STUDENTS)
    changes = _cumulative_changes()

    sheets = {
        "unmatched_tuition": unmatched_tuition,
        "unmatched_students": unmatched_students,
        "reconciliation_changes": changes,
    }

    out = write_workbook(OUTPUT, sheets)
    print(
        f"Wrote {out}\n"
        f"  unmatched_tuition: {len(unmatched_tuition)} rows "
        f"(tuition has these but students doesn't)\n"
        f"  unmatched_students: {len(unmatched_students)} rows "
        f"(students has these but tuition doesn't)\n"
        f"  reconciliation_changes: {len(changes)} rows "
        f"(cumulative manual fixes vs cleaned)"
    )


if __name__ == "__main__":
    main()
