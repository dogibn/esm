"""Ad-hoc data utility CLI: check nulls, check duplicates, clean name columns
on any JSON or CSV file under scripts/scraped/ or scripts/parsed/.

Appends a timestamped entry to scripts/reports/report.md (the same unified
report used by tools.clean and tools.validate). Big detail tables get
spun out automatically.

Note: `tools.clean` is the structured per-type cleaner. The `clean`
subcommand here is the older ad-hoc version that only knows about
surname/name columns — kept for quick poking. Prefer `tools.clean` for
pipeline work.

Usage (from scripts/):
    python -m tools.data_utils nulls scraped/students.json student_id
    python -m tools.data_utils dupes parsed/tuition_25-26.json code
    python -m tools.data_utils clean parsed/tuition_25-26.json processed/tuition_25-26.adhoc.json
"""

import argparse
from pathlib import Path

import pandas as pd

from lib.io import load_dataframe
from lib.reports import ReportEntry, ReportTable, write_entry
from lib.validators import dup_counts, null_counts, strip_digits_from_columns

pd.set_option("display.float_format", lambda x: "%.0f" % x)


def check_nulls(args: argparse.Namespace) -> None:
    df = load_dataframe(args.file)
    count, rows = null_counts(df, args.col)
    status = "no nulls" if count == 0 else f"{count} null(s)"
    print(f"Result for {args.file} [{args.col}]: {status}")

    entry = ReportEntry(kind=f"Null check — `{args.col}`", source=Path(args.file))
    entry.summary_lines.append(f"Rows: {len(df)}")
    entry.summary_lines.append(f"Nulls in `{args.col}`: {count}")
    if count == 0:
        entry.note = "No nulls found."
    else:
        entry.tables.append(
            ReportTable(
                title=f"Null rows in `{args.col}`",
                slug=f"{args.col}-nulls",
                rows=rows,
            )
        )
    write_entry(entry)


def check_dupes(args: argparse.Namespace) -> None:
    df = load_dataframe(args.file)
    count, rows = dup_counts(df, args.col)
    status = "no duplicates" if count == 0 else f"{count} duplicate(s)"
    print(f"Result for {args.file} [{args.col}]: {status}")

    entry = ReportEntry(kind=f"Duplicate check — `{args.col}`", source=Path(args.file))
    entry.summary_lines.append(f"Rows: {len(df)}")
    entry.summary_lines.append(f"Duplicates in `{args.col}`: {count}")
    if count == 0:
        entry.note = "No duplicates found."
    else:
        entry.tables.append(
            ReportTable(
                title=f"Duplicate rows in `{args.col}`",
                slug=f"{args.col}-duplicates",
                rows=rows,
            )
        )
    write_entry(entry)


def clean_names(args: argparse.Namespace) -> None:
    df = load_dataframe(args.file)
    target_cols = ["surname", "name"]
    missing = [c for c in target_cols if c not in df.columns]
    if missing:
        raise SystemExit(f"Input lacks expected name columns: {missing}")

    original = df[target_cols].copy()
    cleaned = strip_digits_from_columns(df, target_cols)
    mask = (original.fillna("") != cleaned[target_cols].fillna("")).any(axis=1)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_json(output_path, orient="records", indent=4, double_precision=15)

    entry = ReportEntry(kind="Ad-hoc name cleaning", source=Path(args.file))
    entry.summary_lines.append(f"Rows: {len(df)}")
    entry.summary_lines.append(f"Changed rows: {int(mask.sum())}")
    entry.output_files.append(output_path)

    if mask.any():
        changes = pd.DataFrame(
            {
                "row_index": df.index[mask].astype(int),
                "original_surname": original.loc[mask, "surname"].values,
                "cleaned_surname": cleaned.loc[mask, "surname"].values,
                "original_name": original.loc[mask, "name"].values,
                "cleaned_name": cleaned.loc[mask, "name"].values,
            }
        )
        for context_col in ("code", "grade"):
            if context_col in cleaned.columns:
                changes[context_col] = cleaned.loc[mask, context_col].values
        entry.tables.append(
            ReportTable(
                title="Name changes (surname + name)",
                slug="adhoc-name-changes",
                rows=changes,
            )
        )
    else:
        entry.note = "No name changes."

    print(f"Cleaned {int(mask.sum())} rows. Saved to {output_path}")
    write_entry(entry)


def main() -> None:
    parser = argparse.ArgumentParser(description="Data utility toolkit.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    null_p = subparsers.add_parser("nulls", help="Check for null values")
    null_p.add_argument("file")
    null_p.add_argument("col")
    null_p.set_defaults(func=check_nulls)

    dup_p = subparsers.add_parser("dupes", help="Check for duplicates")
    dup_p.add_argument("file")
    dup_p.add_argument("col")
    dup_p.set_defaults(func=check_dupes)

    clean_p = subparsers.add_parser("clean", help="Strip digits from surname/name columns")
    clean_p.add_argument("file")
    clean_p.add_argument("output", help="Path to write cleaned JSON")
    clean_p.set_defaults(func=clean_names)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
