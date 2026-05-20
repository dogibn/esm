"""Clean a JSON or CSV data file: coerce numeric columns to int, strip
digits from name columns, drop unused columns.

Writes the cleaned data to scripts/processed/ ONLY if anything changed,
and appends a timestamped entry to the unified scripts/reports/report.md
(big detail tables get spun out to their own report file).

Pipeline position: parse → **clean** → validate → load.

Usage (from scripts/):
    python -m tools.clean --input parsed/tuition_25-26.json
    python -m tools.clean --input scraped/students.json --type students
"""

import argparse
from pathlib import Path

import pandas as pd

from lib.cleaners import CLEAN_RULES, CleanResult, apply_clean_rule
from lib.io import load_dataframe, write_json
from lib.paths import PROCESSED_DIR
from lib.reports import ReportEntry, ReportTable, write_entry
from lib.validators import infer_type


def _build_entry(
    input_path: Path,
    type_name: str,
    result: CleanResult,
    output_path: Path | None,
    invalid_enum_path: Path | None,
) -> ReportEntry:
    entry = ReportEntry(kind="Cleaning", source=input_path)

    entry.summary_lines.append(f"Type: `{type_name}`")
    entry.summary_lines.append(f"Rows: {len(result.df)}")

    if result.dropped_columns:
        entry.summary_lines.append(
            "Dropped columns: " + ", ".join(f"`{c}`" for c in result.dropped_columns)
        )

    if result.int_success_counts:
        coerced = sum(result.int_success_counts.values())
        failed = sum(len(v) for v in result.int_failures.values())
        entry.summary_lines.append(
            f"Integer coercion: {coerced} coerced, {failed} failed"
        )

    n_name_changes = len(result.name_changes)
    if n_name_changes:
        entry.summary_lines.append(f"Name changes: {n_name_changes}")

    n_latinized = len(result.latinized)
    if n_latinized:
        entry.summary_lines.append(f"Cyrillic→Latin: {n_latinized} cells")

    n_enum_changes = len(result.enum_changes)
    if n_enum_changes:
        entry.summary_lines.append(f"Enum normalizations: {n_enum_changes} cells")

    n_enum_invalid = len(result.enum_invalid)
    if n_enum_invalid:
        entry.summary_lines.append(
            f"Enum invalid rows (after strip/lower): {n_enum_invalid}"
        )

    if output_path:
        entry.output_files.append(output_path)
    if invalid_enum_path:
        entry.output_files.append(invalid_enum_path)

    # Per-column int summary table (always small — inlines)
    if result.int_success_counts or result.int_failures:
        cols = list(
            {**{c: 0 for c in result.int_success_counts}, **result.int_failures}
        )
        rows = []
        for col in cols:
            rows.append(
                {
                    "column": col,
                    "coerced": result.int_success_counts.get(col, 0),
                    "failed": len(result.int_failures.get(col, [])),
                }
            )
        entry.tables.append(
            ReportTable(
                title="Integer coercion",
                slug="int-coercion",
                rows=pd.DataFrame(rows),
            )
        )

    # Int failure detail (one row per failure, with raw value)
    if result.int_failures:
        fail_rows = []
        for col, fails in result.int_failures.items():
            for row_idx, raw in fails:
                fail_rows.append(
                    {"column": col, "row_index": row_idx, "raw_value": repr(raw)}
                )
        entry.tables.append(
            ReportTable(
                title="Integer coercion failures",
                slug="int-failures",
                rows=pd.DataFrame(fail_rows),
            )
        )

    # Name changes: one table per column so each is split-evaluated independently
    if not result.name_changes.empty:
        for col, group in result.name_changes.groupby("column", sort=False):
            display = group.drop(columns=["column"])
            entry.tables.append(
                ReportTable(
                    title=f"Name changes — `{col}`",
                    slug=f"{col}-changes",
                    rows=display,
                )
            )

    # Cyrillic→Latin changes: one table per column
    if not result.latinized.empty:
        for col, group in result.latinized.groupby("column", sort=False):
            display = group.drop(columns=["column"])
            entry.tables.append(
                ReportTable(
                    title=f"Cyrillic→Latin — `{col}`",
                    slug=f"{col}-latinized",
                    rows=display,
                )
            )

    # Enum normalizations (strip/lower): one table per column
    if not result.enum_changes.empty:
        for col, group in result.enum_changes.groupby("column", sort=False):
            display = group.drop(columns=["column"])
            entry.tables.append(
                ReportTable(
                    title=f"Enum normalized — `{col}`",
                    slug=f"{col}-enum-normalized",
                    rows=display,
                )
            )

    # Enum invalid rows (after normalization). Surfaces values that
    # don't fit the allowed set — needs human review.
    if not result.enum_invalid.empty:
        entry.tables.append(
            ReportTable(
                title="Enum invalid (after strip/lower)",
                slug="enum-invalid",
                rows=result.enum_invalid,
            )
        )

    return entry


def _has_changes(original_df: pd.DataFrame, result: CleanResult) -> bool:
    if result.dropped_columns:
        return True
    if not result.name_changes.empty:
        return True
    if not result.latinized.empty:
        return True
    if not result.enum_changes.empty:
        return True
    if result.int_failures:
        return True
    for col, count in result.int_success_counts.items():
        if count > 0 and col in original_df.columns:
            if not pd.api.types.is_integer_dtype(original_df[col]):
                return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean a data file.")
    parser.add_argument("--input", required=True, help="Path to JSON or CSV file.")
    parser.add_argument(
        "--type",
        help="Type rule to apply (e.g. 'tuition', 'students'). "
             "If omitted, inferred from filename stem.",
    )
    parser.add_argument(
        "--output",
        help="Cleaned JSON path. Defaults to processed/<input-stem>.cleaned.json.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    df = load_dataframe(input_path)

    type_name = args.type or infer_type(input_path.stem)
    rule = CLEAN_RULES.get(type_name) if type_name else None
    if rule is None:
        raise SystemExit(
            f"No cleaning rule for type {type_name!r}. "
            f"Known types: {list(CLEAN_RULES)}"
        )

    result = apply_clean_rule(df, rule)
    changed = _has_changes(df, result)

    output_path: Path | None = None
    if changed:
        output_path = (
            Path(args.output) if args.output
            else PROCESSED_DIR / f"{input_path.stem}.cleaned.json"
        )
        records = result.df.astype(object).where(result.df.notna(), None).to_dict(
            orient="records"
        )
        write_json(output_path, records)

    invalid_enum_path: Path | None = None
    if not result.enum_invalid.empty:
        invalid_enum_path = PROCESSED_DIR / f"{input_path.stem}.invalid_enum.json"
        invalid_records = (
            result.enum_invalid.astype(object)
            .where(result.enum_invalid.notna(), None)
            .to_dict(orient="records")
        )
        write_json(invalid_enum_path, invalid_records)

    entry = _build_entry(input_path, type_name, result, output_path, invalid_enum_path)
    if not changed:
        entry.note = "No changes — nothing to save."
    report_path = write_entry(entry)

    if changed:
        print(
            f"Cleaned {len(result.df)} rows "
            f"(dropped {len(result.dropped_columns)} cols, "
            f"{sum(result.int_success_counts.values())} ints coerced, "
            f"{len(result.name_changes)} name changes, "
            f"{len(result.latinized)} latinized cells, "
            f"{sum(len(v) for v in result.int_failures.values())} int failures)\n"
            f"  → {output_path}\n"
            f"  → {report_path} (appended)"
        )
    else:
        print(
            f"No changes for {len(result.df)} rows. "
            f"Skipped JSON output.\n"
            f"  → {report_path} (appended)"
        )


if __name__ == "__main__":
    main()
