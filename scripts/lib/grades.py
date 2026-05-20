"""Grade ordering for ESM (English School of Mongolia).

Canonical order: 3+ → 4+ → 5+ → 1 → 2 → ... → 12. Suffix letters
within a prefix (e.g. 4+A vs 4+B, 1BO vs 1JA, 10A vs 10B) sort
alphabetically. Unknown prefixes sort last.
"""

from __future__ import annotations

import re

import pandas as pd


_PREFIX_ORDER = ["3+", "4+", "5+"] + [str(i) for i in range(1, 13)]
_PREFIX_INDEX = {p: i for i, p in enumerate(_PREFIX_ORDER)}
_PREFIX_RE = re.compile(r"^(\d+\+?)(.*)$")
_UNKNOWN = len(_PREFIX_ORDER)


def grade_sort_key(grade) -> tuple[int, str]:
    """Sort key for an ESM grade. Unknown prefixes sort last."""
    if grade is None or (isinstance(grade, float) and pd.isna(grade)):
        return (_UNKNOWN, "")
    s = str(grade).strip()
    m = _PREFIX_RE.match(s)
    if not m:
        return (_UNKNOWN, s)
    prefix, rest = m.group(1), m.group(2)
    return (_PREFIX_INDEX.get(prefix, _UNKNOWN), rest)


def sort_by_grade(
    df: pd.DataFrame, grade_col: str, *also: str
) -> pd.DataFrame:
    """Return df sorted by grade (ESM order) then by additional columns.

    Preserves the original DataFrame index so callers can still trace
    rows back to their source row number.
    """
    if df.empty or grade_col not in df.columns:
        return df
    keys = df[grade_col].map(grade_sort_key)
    helper = df.assign(
        __pos=keys.map(lambda t: t[0]),
        __rest=keys.map(lambda t: t[1]),
    )
    secondary = [c for c in also if c in df.columns]
    sorted_df = helper.sort_values(
        by=["__pos", "__rest", *secondary], kind="mergesort"
    )
    return sorted_df.drop(columns=["__pos", "__rest"])
