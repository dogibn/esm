"""Match rows across two cleaned data files on a tuple of key columns.

This module owns only the primitive — no presets, no CLI. Domain-specific
match scripts under `scripts/match/` construct a `MatchPreset` and call
`match()`.

The algorithm: normalize each side's key columns into a tuple, intersect
the two key sets, return rows whose key is missing on the other side.
Optional case-fold (default on) to absorb capitalization drift between
sources. If the preset declares `identity_left` / `identity_right`, the
returned unmatched / duplicate DataFrames are slimmed to those columns.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd


@dataclass
class MatchKey:
    """One logical key, mapped to its column name on each side."""

    name: str       # logical key name, used in reports
    left: str       # column on left source
    right: str      # column on right source


@dataclass
class MatchPreset:
    name: str
    left_path: Path
    right_path: Path
    left_label: str
    right_label: str
    keys: list[MatchKey]
    case_sensitive: bool = False
    # Columns kept on output (unmatched + dupes). Empty list = keep all.
    identity_left: list[str] = field(default_factory=list)
    identity_right: list[str] = field(default_factory=list)


@dataclass
class MatchResult:
    preset: MatchPreset
    left_total: int
    right_total: int
    matched_key_count: int
    left_matched_rows: int
    right_matched_rows: int
    unmatched_left: pd.DataFrame
    unmatched_right: pd.DataFrame
    left_dupes: pd.DataFrame
    right_dupes: pd.DataFrame


def _normalize_keys(
    df: pd.DataFrame, columns: list[str], case_sensitive: bool
) -> list[tuple]:
    """Build a list of tuple keys, one per row, with consistent normalization."""
    if not columns:
        return [() for _ in range(len(df))]
    normalized = df[columns].astype(str).apply(lambda s: s.str.strip())
    if not case_sensitive:
        normalized = normalized.apply(lambda s: s.str.casefold())
    return list(map(tuple, normalized.itertuples(index=False, name=None)))


def _slim(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    if not columns:
        return df
    present = [c for c in columns if c in df.columns]
    return df[present].copy()


def match(
    left_df: pd.DataFrame, right_df: pd.DataFrame, preset: MatchPreset
) -> MatchResult:
    left_cols = [k.left for k in preset.keys]
    right_cols = [k.right for k in preset.keys]

    missing_left = [c for c in left_cols if c not in left_df.columns]
    missing_right = [c for c in right_cols if c not in right_df.columns]
    if missing_left or missing_right:
        raise ValueError(
            f"Preset {preset.name!r} expects columns that aren't present. "
            f"Missing on {preset.left_label}: {missing_left}. "
            f"Missing on {preset.right_label}: {missing_right}."
        )

    left_keys = _normalize_keys(left_df, left_cols, preset.case_sensitive)
    right_keys = _normalize_keys(right_df, right_cols, preset.case_sensitive)

    left_key_set = set(left_keys)
    right_key_set = set(right_keys)
    common = left_key_set & right_key_set

    left_match_mask = pd.Series(
        [k in common for k in left_keys], index=left_df.index
    )
    right_match_mask = pd.Series(
        [k in common for k in right_keys], index=right_df.index
    )

    left_counts = Counter(left_keys)
    right_counts = Counter(right_keys)
    left_dupe_set = {k for k, n in left_counts.items() if n > 1}
    right_dupe_set = {k for k, n in right_counts.items() if n > 1}

    left_dupe_mask = pd.Series(
        [k in left_dupe_set for k in left_keys], index=left_df.index
    )
    right_dupe_mask = pd.Series(
        [k in right_dupe_set for k in right_keys], index=right_df.index
    )

    return MatchResult(
        preset=preset,
        left_total=len(left_df),
        right_total=len(right_df),
        matched_key_count=len(common),
        left_matched_rows=int(left_match_mask.sum()),
        right_matched_rows=int(right_match_mask.sum()),
        unmatched_left=_slim(left_df[~left_match_mask], preset.identity_left),
        unmatched_right=_slim(right_df[~right_match_mask], preset.identity_right),
        left_dupes=_slim(left_df[left_dupe_mask], preset.identity_left),
        right_dupes=_slim(right_df[right_dupe_mask], preset.identity_right),
    )
