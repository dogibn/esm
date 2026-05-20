"""Apply manual edits in `processed/students_tuition.unmatched_tuition.json`
back onto the tuition data, producing `processed/tuition_25-26.matched.json`,
report the per-row changes, then re-run the students↔tuition match so
the unmatched files reflect the new state.

Base file selection:
- If `tuition_25-26.matched.json` exists, use it as base (iterative
  reconciliation on top of prior fixes).
- Else use `tuition_25-26.cleaned.json` (first iteration).

Only `grade`, `surname`, `name` are mutable. All other columns
(`contract`, `tuition`, `total_payment`, etc.) are preserved from base.

Usage (from scripts/):
    python -m match.students_tuition_apply
"""

from pathlib import Path

import pandas as pd

from lib.cleaners import CLEAN_RULES, latinize_columns
from lib.grades import sort_by_grade
from lib.io import load_dataframe, write_json
from lib.paths import PROCESSED_DIR
from lib.reconcilers import ApplyResult, apply_fixes
from lib.reports import ReportEntry, ReportTable, write_entry
from match.students_tuition import build_preset, run as run_match


CLEANED_PATH = PROCESSED_DIR / "tuition_25-26.cleaned.json"
MATCHED_PATH = PROCESSED_DIR / "tuition_25-26.matched.json"
FIXES_PATH = PROCESSED_DIR / "students_tuition.unmatched_tuition.json"

KEY = "code"
MUTABLE_COLUMNS = ["grade", "surname", "name"]
CONTEXT_COLUMNS = ["contract", "tuition", "total_payment"]
# Latinize base before applying user fixes so a stale matched.json
# (built before tuition's latinize_columns rule existed) gets caught up.
# Idempotent for already-Latin data.
LATINIZE_COLUMNS = CLEAN_RULES["tuition"].latinize_columns


def _format_change(orig, new) -> str:
    """Render '<old> → <new>' for changed cells, '<value>' for unchanged."""
    def _show(v):
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return "∅"
        return str(v)

    if _show(orig) == _show(new):
        return _show(new)
    return f"{_show(orig)} → {_show(new)}"


def _build_report_table(
    result: ApplyResult, base_df: pd.DataFrame
) -> pd.DataFrame:
    """Wide-format table: contract, code, grade, surname, name, tuition, total_payment.

    grade/surname/name cells show 'old → new' when changed.
    """
    if result.changes.empty:
        return pd.DataFrame()

    base_by_key = base_df.set_index(KEY)
    rows: list[dict] = []
    for _, ch in result.changes.iterrows():
        code = ch[KEY]
        ctx = base_by_key.loc[code]
        if isinstance(ctx, pd.DataFrame):
            ctx = ctx.iloc[0]
        rows.append(
            {
                "contract": ctx.get("contract"),
                "code": code,
                "grade": _format_change(ch.get("grade_orig"), ch.get("grade_new")),
                "surname": _format_change(ch.get("surname_orig"), ch.get("surname_new")),
                "name": _format_change(ch.get("name_orig"), ch.get("name_new")),
                "tuition": ctx.get("tuition"),
                "total_payment": ctx.get("total_payment"),
            }
        )
    return pd.DataFrame(rows)


def main() -> None:
    base_path = MATCHED_PATH if MATCHED_PATH.exists() else CLEANED_PATH
    if not FIXES_PATH.exists():
        raise SystemExit(
            f"Fixes file not found: {FIXES_PATH}. Run match first, then edit it."
        )

    base_df = load_dataframe(base_path)
    fixes_df = load_dataframe(FIXES_PATH)

    base_df, latinized = latinize_columns(base_df, LATINIZE_COLUMNS)
    # Also latinize fixes so the user's edits compare cleanly against
    # the (now-Latin) base. This is a no-op when fixes are already Latin.
    fixes_df, _ = latinize_columns(fixes_df, LATINIZE_COLUMNS)

    result = apply_fixes(base_df, fixes_df, key=KEY, mutable_columns=MUTABLE_COLUMNS)

    records = result.df.astype(object).where(result.df.notna(), None).to_dict(
        orient="records"
    )
    write_json(MATCHED_PATH, records)

    entry = ReportEntry(
        kind="Tuition reconciliation",
        source=FIXES_PATH,
        stem="students_tuition_apply",
    )
    entry.summary_lines.append(f"Base: `{base_path.name}` — {len(base_df)} rows")
    entry.summary_lines.append(f"Fixes: `{FIXES_PATH.name}` — {len(fixes_df)} edited rows")
    if not latinized.empty:
        entry.summary_lines.append(
            f"Latinized {len(latinized)} cells in base (Cyrillic→Latin)"
        )
    entry.summary_lines.append(f"Applied user fix changes to {len(result.changes)} rows")
    if result.missing_keys:
        entry.summary_lines.append(
            f"Fixes with unknown `{KEY}` (skipped): {len(result.missing_keys)}"
        )
    entry.output_files.append(MATCHED_PATH)

    if not latinized.empty:
        entry.tables.append(
            ReportTable(
                title="Cyrillic→Latin normalizations in base",
                slug="latinized",
                rows=latinized,
            )
        )

    if result.changes.empty:
        if latinized.empty:
            entry.note = "No effective changes (edits matched current values)."
    else:
        changes_table = _build_report_table(result, base_df)
        changes_table = sort_by_grade(changes_table, "grade", "name")
        entry.tables.append(
            ReportTable(
                title="Applied user fixes",
                slug="changes",
                rows=changes_table,
            )
        )

    report_path = write_entry(entry)

    print(
        f"Reconciled tuition data: "
        f"{len(latinized)} cells latinized, "
        f"{len(result.changes)} rows user-fixed.\n"
        f"  base: {base_path.name}\n"
        f"  fixes: {FIXES_PATH.name} ({len(fixes_df)} edited rows)\n"
        f"  → {MATCHED_PATH}\n"
        f"  → {report_path} (appended)"
    )
    if result.missing_keys:
        print(f"  ⚠ {len(result.missing_keys)} fix(es) had unknown {KEY} — skipped.")

    print("\nRe-running match against the new matched data…")
    run_match(build_preset())


if __name__ == "__main__":
    main()
