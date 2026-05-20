"""Shared cleaning primitives + per-type cleaning rules.

Cleaning is a separate stage from validation: it transforms (coerce ints,
strip digits from names, drop unused columns) but never decides validity.
The post-clean DataFrame is what `tools.validate` then checks.

New types are added by appending to `CLEAN_RULES`; tools dispatch on
filename stem or an explicit --type flag (see `lib.validators.infer_type`).
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

import pandas as pd

from lib.validators import strip_digits_from_columns


# --- per-type cleaning rules ---


@dataclass
class EnumSpec:
    """Column whose values are stripped + lowercased then validated
    against an allowed set. Null cells pass through unchanged."""

    column: str
    allowed: frozenset[str]


@dataclass
class CleanRule:
    name: str
    int_columns: list[str] = field(default_factory=list)
    name_columns: list[str] = field(default_factory=list)
    drop_columns: list[str] = field(default_factory=list)
    name_context_columns: list[str] = field(default_factory=list)
    # Columns to scan for Cyrillic letters that have Latin lookalikes
    # (e.g. Cyrillic 'С' U+0421 typed where Latin 'C' U+0043 was meant).
    latinize_columns: list[str] = field(default_factory=list)
    enum_columns: list[EnumSpec] = field(default_factory=list)


CLEAN_RULES: dict[str, CleanRule] = {
    "tuition": CleanRule(
        "tuition",
        int_columns=[
            "tuition",
            "total_payment",
            "check",
            "staff",
            "corporate",
            "barter",
            "early_bird_discount",
            "deal_discount",
            "sibling_discount",
            "scholarship",
        ],
        name_columns=["surname", "name"],
        drop_columns=["reg", "idx", "ot"],
        name_context_columns=["code", "grade"],
        latinize_columns=["grade"],
        enum_columns=[EnumSpec("new_old", frozenset({"new", "old"}))],
    ),
    "students": CleanRule(
        "students",
        name_columns=["first_name", "last_name"],
        name_context_columns=["student_id"],
    ),
    "teachers": CleanRule(
        "teachers",
        name_columns=["teacher_name"],
        name_context_columns=["grade_name"],
    ),
}


# --- primitives ---


_INT_NOISE_RE = re.compile(r"[,\s ]")  # commas, whitespace, nbsp


def coerce_int(value) -> int | None:
    """Coerce a value to int. Returns None for null/empty/unparseable input.

    Handles: None, NaN, "", "400.0", "1,200,000", "  300 ", "-50", 0, 3.7.
    """
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if math.isnan(value):
            return None
        return int(value)
    s = str(value).strip()
    if not s:
        return None
    s = _INT_NOISE_RE.sub("", s)
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None


def coerce_int_columns(
    df: pd.DataFrame, columns: list[str]
) -> tuple[pd.DataFrame, dict[str, list[tuple[int, object]]]]:
    """Coerce given columns to int. Returns (cleaned_df, failures_by_col).

    Failures are rows where the source had a non-null value that couldn't
    parse — those land as None in the cleaned frame.
    """
    result = df.copy()
    failures: dict[str, list[tuple[int, object]]] = {}
    for col in columns:
        if col not in result.columns:
            continue
        col_failures: list[tuple[int, object]] = []
        new_values: list[int | None] = []
        for idx, raw in result[col].items():
            had_value = raw is not None and not (
                isinstance(raw, float) and math.isnan(raw)
            ) and str(raw).strip() != ""
            coerced = coerce_int(raw)
            if had_value and coerced is None:
                col_failures.append((int(idx), raw))
            new_values.append(coerced)
        result[col] = pd.Series(new_values, index=result.index, dtype="Int64")
        if col_failures:
            failures[col] = col_failures
    return result, failures


def clean_names(
    df: pd.DataFrame,
    name_columns: list[str],
    context_columns: list[str],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Strip digits and normalize whitespace in name columns.

    Returns (cleaned_df, changes_df) where changes_df has one row per
    modified cell with: row_index, column, original, cleaned, plus
    whichever context columns are present.
    """
    present = [c for c in name_columns if c in df.columns]
    if not present:
        return df, pd.DataFrame(columns=["row_index", "column", "original", "cleaned"])

    cleaned = strip_digits_from_columns(df, present)
    present_context = [c for c in context_columns if c in df.columns]

    rows: list[dict] = []
    for col in present:
        orig_col = df[col]
        new_col = cleaned[col]
        changed_mask = orig_col.fillna("") != new_col.fillna("")
        for idx in df.index[changed_mask]:
            entry = {
                "row_index": int(idx),
                "column": col,
                "original": orig_col.at[idx],
                "cleaned": new_col.at[idx],
            }
            for ctx in present_context:
                entry[ctx] = df.at[idx, ctx]
            rows.append(entry)

    changes_df = pd.DataFrame(rows)
    return cleaned, changes_df


def drop_columns(df: pd.DataFrame, columns: list[str]) -> tuple[pd.DataFrame, list[str]]:
    """Drop named columns. Silently ignores missing columns. Returns
    (cleaned_df, columns_actually_dropped)."""
    present = [c for c in columns if c in df.columns]
    if not present:
        return df, []
    return df.drop(columns=present), present


# Cyrillic letters whose glyphs are visually identical to a Latin letter.
# Mapping rescues mojibake where a Russian/Mongolian keyboard layout
# produced the Cyrillic codepoint instead of the intended Latin one
# (e.g. typing С U+0421 when Latin C U+0043 was meant). Cyrillic letters
# without a Latin lookalike (Б, Г, Д, Ж, З, И, Й, Л, П, Ф, Ц, Ч, Ш, etc.)
# are intentionally left alone — they represent real text.
_CYRILLIC_TO_LATIN = {
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H",
    "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X",
    "а": "a", "в": "b", "е": "e", "к": "k", "м": "m", "н": "h",
    "о": "o", "р": "p", "с": "c", "т": "t", "х": "x",
}


def latinize_cyrillic(value):
    """Replace Cyrillic letters that share a glyph with Latin letters.

    Pure value-level helper; null/non-string inputs pass through.
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return value
    s = str(value)
    return "".join(_CYRILLIC_TO_LATIN.get(ch, ch) for ch in s)


def latinize_columns(
    df: pd.DataFrame, columns: list[str]
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Apply latinize_cyrillic to the given columns.

    Returns (new_df, changes_df) where changes_df has one row per cell
    that was actually modified, with columns: row_index, column,
    original, cleaned.
    """
    present = [c for c in columns if c in df.columns]
    if not present:
        return df, pd.DataFrame(columns=["row_index", "column", "original", "cleaned"])

    result = df.copy()
    rows: list[dict] = []
    for col in present:
        new_series = result[col].map(latinize_cyrillic)
        # Compare via string repr to handle NaN safely
        orig = result[col]
        changed_mask = orig.astype(object) != new_series.astype(object)
        # Exclude both-null cells from the mask
        both_null = orig.isna() & new_series.isna()
        changed_mask = changed_mask & ~both_null
        for idx in result.index[changed_mask]:
            rows.append(
                {
                    "row_index": int(idx),
                    "column": col,
                    "original": orig.at[idx],
                    "cleaned": new_series.at[idx],
                }
            )
        result[col] = new_series

    return result, pd.DataFrame(rows)


def normalize_enum_columns(
    df: pd.DataFrame, specs: list[EnumSpec]
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """For each spec, strip + lowercase the column. Returns
    (cleaned_df, changes_df, invalid_df).

    `changes_df`: one row per cell whose value was modified by strip/lower.
    Columns: row_index, column, original, cleaned.

    `invalid_df`: original rows (full) whose normalized value isn't in
    `allowed` AND isn't null/empty. Adds two columns: `_invalid_column`,
    `_invalid_value` (the normalized but rejected value).
    """
    result = df.copy()
    change_rows: list[dict] = []
    invalid_frames: list[pd.DataFrame] = []

    for spec in specs:
        if spec.column not in result.columns:
            continue
        original = result[spec.column]
        normalized = original.map(
            lambda v: (
                None
                if v is None or (isinstance(v, float) and pd.isna(v))
                else str(v).strip().lower()
            )
        )
        # Track per-cell changes (excluding both-null cells)
        for idx in result.index:
            orig = original.at[idx]
            new = normalized.at[idx]
            orig_null = orig is None or (isinstance(orig, float) and pd.isna(orig))
            new_null = new is None or new == ""
            if orig_null and new_null:
                continue
            if str(orig) != str(new):
                change_rows.append(
                    {
                        "row_index": int(idx),
                        "column": spec.column,
                        "original": orig,
                        "cleaned": new,
                    }
                )
        result[spec.column] = normalized

        # Invalid: normalized value is non-null AND not in allowed set
        invalid_mask = normalized.map(
            lambda v: v is not None and v != "" and v not in spec.allowed
        )
        if invalid_mask.any():
            bad = df[invalid_mask].copy()
            bad["_invalid_column"] = spec.column
            bad["_invalid_value"] = normalized[invalid_mask].astype(object)
            invalid_frames.append(bad)

    changes_df = pd.DataFrame(change_rows)
    invalid_df = (
        pd.concat(invalid_frames, ignore_index=False)
        if invalid_frames
        else pd.DataFrame()
    )
    return result, changes_df, invalid_df


# --- orchestrator ---


@dataclass
class CleanResult:
    df: pd.DataFrame
    dropped_columns: list[str]
    int_failures: dict[str, list[tuple[int, object]]]
    name_changes: pd.DataFrame
    int_success_counts: dict[str, int]
    latinized: pd.DataFrame = field(default_factory=pd.DataFrame)
    enum_changes: pd.DataFrame = field(default_factory=pd.DataFrame)
    enum_invalid: pd.DataFrame = field(default_factory=pd.DataFrame)


def apply_clean_rule(df: pd.DataFrame, rule: CleanRule) -> CleanResult:
    """Apply a CleanRule end-to-end: drop → latinize → coerce ints →
    normalize enums → clean names."""
    df, dropped = drop_columns(df, rule.drop_columns)
    df, latinized = latinize_columns(df, rule.latinize_columns)
    df, int_failures = coerce_int_columns(df, rule.int_columns)

    int_success_counts: dict[str, int] = {}
    for col in rule.int_columns:
        if col in df.columns:
            int_success_counts[col] = int(df[col].notna().sum())

    df, enum_changes, enum_invalid = normalize_enum_columns(df, rule.enum_columns)
    df, name_changes = clean_names(df, rule.name_columns, rule.name_context_columns)

    return CleanResult(
        df=df,
        dropped_columns=dropped,
        int_failures=int_failures,
        name_changes=name_changes,
        int_success_counts=int_success_counts,
        latinized=latinized,
        enum_changes=enum_changes,
        enum_invalid=enum_invalid,
    )
