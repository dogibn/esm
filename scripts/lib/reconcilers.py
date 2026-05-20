"""Apply a fixes file back onto a base data file.

Used after a human-in-the-loop step where someone edits a slim
"unmatched" JSON to align it with another source (e.g. correcting
typos in surnames so a record matches). The primitive takes the
edited rows as `fixes`, looks each up in `base` by a key column, and
overwrites a fixed set of mutable columns. Columns outside that set
are untouched, even if present in the fixes file.

The returned `changes` DataFrame is wide-format: one row per base
record that had at least one mutable column actually change, with
`<column>_orig` and `<column>_new` pairs for each mutable column.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class ApplyResult:
    df: pd.DataFrame              # base with fixes applied
    changes: pd.DataFrame         # wide: key + <col>_orig / <col>_new pairs
    missing_keys: list            # fixes keys not present in base


def _eq(a, b) -> bool:
    """NaN-safe equality between two scalar values."""
    a_null = a is None or (isinstance(a, float) and pd.isna(a))
    b_null = b is None or (isinstance(b, float) and pd.isna(b))
    if a_null and b_null:
        return True
    if a_null or b_null:
        return False
    return str(a) == str(b)


def apply_fixes(
    base_df: pd.DataFrame,
    fixes_df: pd.DataFrame,
    key: str,
    mutable_columns: list[str],
) -> ApplyResult:
    """Apply `fixes_df` onto `base_df`, matching on `key`.

    Only `mutable_columns` (intersected with what fixes_df actually
    has) are written back to base.
    """
    if key not in base_df.columns:
        raise ValueError(f"Base is missing key column {key!r}.")
    if key not in fixes_df.columns:
        raise ValueError(f"Fixes is missing key column {key!r}.")

    base = base_df.copy()
    base_by_key = base.set_index(key, drop=False)
    cols = [c for c in mutable_columns if c in fixes_df.columns]

    change_rows: list[dict] = []
    missing_keys: list = []

    for _, fix in fixes_df.iterrows():
        k = fix[key]
        if k not in base_by_key.index:
            missing_keys.append(k)
            continue
        orig = base_by_key.loc[k]
        # Defensive: if duplicate keys exist in base, loc returns a DataFrame.
        if isinstance(orig, pd.DataFrame):
            raise ValueError(
                f"Duplicate key {k!r} in base ({len(orig)} rows). "
                f"apply_fixes requires unique keys."
            )

        row_change: dict = {key: k}
        changed_any = False
        for col in cols:
            old_val = orig.get(col)
            new_val = fix.get(col)
            if _eq(old_val, new_val):
                continue
            base.loc[base[key] == k, col] = new_val
            row_change[f"{col}_orig"] = old_val
            row_change[f"{col}_new"] = new_val
            changed_any = True

        if changed_any:
            # Ensure every mutable col appears in row_change so the wide
            # frame has uniform columns. For unchanged cells, both pair
            # entries hold the current value.
            for col in cols:
                row_change.setdefault(f"{col}_orig", orig.get(col))
                row_change.setdefault(f"{col}_new", orig.get(col))
            change_rows.append(row_change)

    changes_df = pd.DataFrame(change_rows)
    return ApplyResult(df=base, changes=changes_df, missing_keys=missing_keys)
