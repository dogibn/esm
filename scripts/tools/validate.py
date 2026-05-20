"""Validate a JSON or CSV data file and split rows into valid/invalid against
the per-type rule.

Appends a timestamped entry to scripts/reports/report.md. JSON outputs
(`<stem>.valid.json`, `<stem>.invalid.json`) are only written to
scripts/processed/ when at least one invalid row was found. Big detail
tables (>20 rows) get spun out to their own report file.

Pipeline position: parse → clean → **validate** → load. Inputs should
already be cleaned (see tools.clean), so types are int rather than string.

Usage (from scripts/):
    python -m tools.validate --input processed/tuition_25-26.cleaned.json
    python -m tools.validate --input processed/students.cleaned.json --type students
"""

import argparse
from pathlib import Path

import pandas as pd

from lib.io import load_dataframe, write_json
from lib.paths import PROCESSED_DIR
from lib.reports import ReportEntry, ReportTable, write_entry
from lib.validators import RULES, dup_counts, infer_type, null_counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate a data file.")
    parser.add_argument("--input", required=True, help="Path to JSON or CSV file.")
    parser.add_argument(
        "--type",
        help="Type rule to apply (e.g. 'tuition', 'students'). "
             "If omitted, inferred from filename stem.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    df = load_dataframe(input_path)

    type_name = args.type or infer_type(input_path.stem)
    rule = RULES.get(type_name) if type_name else None

    entry = ReportEntry(kind="Validation", source=input_path)
    entry.summary_lines.append(f"Type: `{type_name or 'unknown'}`")
    entry.summary_lines.append(f"Rows: {len(df)}")

    # Per key-column null/dup summary (always small — inlines)
    columns_to_check = (
        rule.key_columns if rule and rule.key_columns else []
    )
    summary_rows = []
    null_detail: list[pd.DataFrame] = []
    dup_detail: list[pd.DataFrame] = []
    for col in columns_to_check:
        if col not in df.columns:
            summary_rows.append({"column": col, "present": False, "nulls": "-", "duplicates": "-"})
            continue
        n_count, n_rows = null_counts(df, col)
        d_count, d_rows = dup_counts(df, col)
        summary_rows.append(
            {"column": col, "present": True, "nulls": n_count, "duplicates": d_count}
        )
        if n_count:
            null_detail.append(n_rows.assign(_column=col))
        if d_count:
            dup_detail.append(d_rows.assign(_column=col))

    if summary_rows:
        entry.tables.append(
            ReportTable(
                title="Key-column checks",
                slug="key-checks",
                rows=pd.DataFrame(summary_rows),
            )
        )

    if null_detail:
        entry.tables.append(
            ReportTable(
                title="Null entries",
                slug="nulls",
                rows=pd.concat(null_detail, ignore_index=True),
            )
        )

    if dup_detail:
        entry.tables.append(
            ReportTable(
                title="Duplicate entries",
                slug="duplicates",
                rows=pd.concat(dup_detail, ignore_index=True),
            )
        )

    if rule is None:
        entry.note = "No per-type rule matched; row-level validity skipped."
        write_entry(entry)
        print(f"No type rule for {input_path.stem!r}. Wrote report only.")
        return

    mask = df.apply(rule.is_valid, axis=1)
    valid_df = df[mask]
    invalid_df = df[~mask]

    entry.summary_lines.append(f"Valid: {len(valid_df)}")
    entry.summary_lines.append(f"Invalid: {len(invalid_df)}")

    if invalid_df.empty:
        entry.note = "All rows valid — no JSON saved."
        report_path = write_entry(entry)
        print(
            f"Validated {len(df)} rows: all valid. Skipped JSON output.\n"
            f"  → {report_path} (appended)"
        )
        return

    valid_path = PROCESSED_DIR / f"{input_path.stem}.valid.json"
    invalid_path = PROCESSED_DIR / f"{input_path.stem}.invalid.json"
    write_json(valid_path, valid_df.to_dict(orient="records"))
    write_json(invalid_path, invalid_df.to_dict(orient="records"))
    entry.output_files.extend([valid_path, invalid_path])

    entry.tables.append(
        ReportTable(
            title="Invalid rows",
            slug="invalid-rows",
            rows=invalid_df,
        )
    )

    report_path = write_entry(entry)
    print(
        f"Validated {len(df)} rows: {len(valid_df)} valid, {len(invalid_df)} invalid.\n"
        f"  → {valid_path}\n"
        f"  → {invalid_path}\n"
        f"  → {report_path} (appended)"
    )


if __name__ == "__main__":
    main()
