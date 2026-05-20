"""Shared validation primitives + per-type row-validity rules.

Generic primitives (null/dup checks, digit stripping) work on any DataFrame.
Per-type rules in `RULES` describe what makes a row valid for a given data
type (e.g. 'tuition', 'students'). New types are added by appending to
`RULES`; tools dispatch on filename stem or an explicit --type flag.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable

import pandas as pd


# --- generic primitives ---


def null_counts(df: pd.DataFrame, column: str) -> tuple[int, pd.DataFrame]:
    null_rows = df[df[column].isnull()]
    return len(null_rows), null_rows


def dup_counts(df: pd.DataFrame, column: str) -> tuple[int, pd.DataFrame]:
    dupe_rows = df[df.duplicated(subset=[column], keep=False) & df[column].notnull()]
    count = int(df.duplicated(subset=[column]).sum())
    return count, dupe_rows


def strip_digits_from_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """Strip digits and collapse whitespace in given columns. Returns a copy."""
    result = df.copy()
    result[columns] = result[columns].map(
        lambda x: " ".join(re.sub(r"\d", "", str(x).strip()).split())
        if pd.notnull(x) else x
    )
    return result


# --- per-type validity rules ---


@dataclass
class TypeRule:
    name: str
    is_valid: Callable[[pd.Series], bool]
    key_columns: list[str] = field(default_factory=list)


def _tuition_valid(row: pd.Series) -> bool:
    return pd.notna(row.get("name")) and (
        pd.notna(row.get("tuition")) or pd.notna(row.get("total_payment"))
    )


def _students_valid(row: pd.Series) -> bool:
    return (
        pd.notna(row.get("student_id"))
        and pd.notna(row.get("first_name"))
        and pd.notna(row.get("last_name"))
    )


def _teachers_valid(row: pd.Series) -> bool:
    return pd.notna(row.get("teacher_name")) and pd.notna(row.get("grade_name"))


RULES: dict[str, TypeRule] = {
    "tuition": TypeRule("tuition", _tuition_valid, key_columns=["code"]),
    "students": TypeRule("students", _students_valid, key_columns=["student_id"]),
    "teachers": TypeRule("teachers", _teachers_valid, key_columns=["grade_name"]),
}


def infer_type(filename_stem: str) -> str | None:
    """Pick a rule by filename stem prefix. Returns None if no match."""
    stem_lower = filename_stem.lower()
    for type_name in RULES:
        if stem_lower.startswith(type_name):
            return type_name
    return None
