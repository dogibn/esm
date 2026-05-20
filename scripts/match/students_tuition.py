"""Match students.cleaned.json (left) against the current tuition data
(right) on (grade, last_name, first_name).

The right-hand source is `tuition_25-26.matched.json` when it exists
(i.e. after at least one reconciliation pass via
`match.students_tuition_apply`), else `tuition_25-26.cleaned.json` for
the initial run.

Outputs to scripts/processed/:
  - `students_tuition.matched.json` — [{student_id, code}, ...] for
    each pair whose key is unique on both sides. Feeds the
    `enrollments.student_code` backfill.
  - `students_tuition.unmatched_students.json` (when non-empty) —
    slimmed left rows with no match on the right.
  - `students_tuition.unmatched_tuition.json` (when non-empty) —
    slimmed right rows with no match on the left.

Also appends a timestamped entry to scripts/reports/report.md.

Usage (from scripts/):
    python -m match.students_tuition
"""

from pathlib import Path

import pandas as pd

from lib.grades import sort_by_grade
from lib.io import load_dataframe, write_json
from lib.matchers import MatchKey, MatchPreset, MatchResult, match
from lib.paths import PROCESSED_DIR
from lib.reports import ReportEntry, ReportTable, write_entry


_LEFT_PATH = PROCESSED_DIR / "students.cleaned.json"
_TUITION_CLEANED = PROCESSED_DIR / "tuition_25-26.cleaned.json"
_TUITION_MATCHED = PROCESSED_DIR / "tuition_25-26.matched.json"


def _tuition_source() -> Path:
    return _TUITION_MATCHED if _TUITION_MATCHED.exists() else _TUITION_CLEANED


def build_preset() -> MatchPreset:
    return MatchPreset(
        name="students_tuition",
        left_path=_LEFT_PATH,
        right_path=_tuition_source(),
        left_label="students",
        right_label="tuition",
        keys=[
            MatchKey("grade", left="grade_name", right="grade"),
            MatchKey("last_name", left="last_name", right="surname"),
            MatchKey("first_name", left="first_name", right="name"),
        ],
        identity_left=["student_id", "grade_name", "last_name", "first_name"],
        identity_right=["code", "grade", "surname", "name"],
    )


def _build_matched_pairs(
    left_df: pd.DataFrame, right_df: pd.DataFrame, preset: MatchPreset
) -> list[dict]:
    """Inner-join left × right on normalized key columns; emit
    [{student_id, code}, ...] for each pair whose key is unique on
    both sides. Ambiguous duplicates are skipped — they're already
    surfaced in the unmatched/dupes report tables and would violate
    the partial UNIQUE (academic_year_id, student_code) constraint.
    """
    left_cols = [k.left for k in preset.keys]
    right_cols = [k.right for k in preset.keys]

    def _key_series(df: pd.DataFrame, cols: list[str]) -> pd.Series:
        norm = df[cols].astype(str).apply(lambda s: s.str.strip())
        if not preset.case_sensitive:
            norm = norm.apply(lambda s: s.str.casefold())
        return pd.Series(
            list(map(tuple, norm.itertuples(index=False, name=None))),
            index=df.index,
        )

    left_keys = _key_series(left_df, left_cols)
    right_keys = _key_series(right_df, right_cols)

    left = left_df.assign(_key=left_keys)
    right = right_df.assign(_key=right_keys)

    left_unique = left[~left["_key"].duplicated(keep=False)][["_key", "student_id"]]
    right_unique = right[~right["_key"].duplicated(keep=False)][["_key", "code"]]

    joined = left_unique.merge(right_unique, on="_key", how="inner")
    return joined[["student_id", "code"]].to_dict(orient="records")


def _build_entry(result: MatchResult, output_files: list[Path]) -> ReportEntry:
    preset = result.preset
    entry = ReportEntry(
        kind=f"Matching — {preset.name}",
        source=preset.left_path,
        stem=preset.name,
    )

    key_desc = ", ".join(
        f"`{k.name}` ({preset.left_label}.{k.left} ↔ {preset.right_label}.{k.right})"
        for k in preset.keys
    )
    entry.summary_lines.append(
        f"Left ({preset.left_label}): `{preset.left_path.name}` — {result.left_total} rows"
    )
    entry.summary_lines.append(
        f"Right ({preset.right_label}): `{preset.right_path.name}` — {result.right_total} rows"
    )
    entry.summary_lines.append(f"Keys: {key_desc}")
    entry.summary_lines.append(
        f"Matched: {result.matched_key_count} unique keys "
        f"({result.left_matched_rows} {preset.left_label} rows / "
        f"{result.right_matched_rows} {preset.right_label} rows)"
    )
    entry.summary_lines.append(
        f"Unmatched {preset.left_label}: {len(result.unmatched_left)}"
    )
    entry.summary_lines.append(
        f"Unmatched {preset.right_label}: {len(result.unmatched_right)}"
    )
    if len(result.left_dupes):
        entry.summary_lines.append(
            f"Duplicate keys within {preset.left_label}: {len(result.left_dupes)} rows"
        )
    if len(result.right_dupes):
        entry.summary_lines.append(
            f"Duplicate keys within {preset.right_label}: {len(result.right_dupes)} rows"
        )

    entry.output_files.extend(output_files)

    if not result.unmatched_left.empty:
        entry.tables.append(
            ReportTable(
                title=f"Unmatched `{preset.left_label}`",
                slug=f"unmatched-{preset.left_label}",
                rows=result.unmatched_left,
            )
        )
    if not result.unmatched_right.empty:
        entry.tables.append(
            ReportTable(
                title=f"Unmatched `{preset.right_label}`",
                slug=f"unmatched-{preset.right_label}",
                rows=result.unmatched_right,
            )
        )
    if not result.left_dupes.empty:
        entry.tables.append(
            ReportTable(
                title=f"Duplicate keys in `{preset.left_label}`",
                slug=f"dupes-{preset.left_label}",
                rows=result.left_dupes,
            )
        )
    if not result.right_dupes.empty:
        entry.tables.append(
            ReportTable(
                title=f"Duplicate keys in `{preset.right_label}`",
                slug=f"dupes-{preset.right_label}",
                rows=result.right_dupes,
            )
        )

    if result.unmatched_left.empty and result.unmatched_right.empty:
        entry.note = "All rows matched on both sides."

    return entry


def run(preset: MatchPreset | None = None) -> None:
    if preset is None:
        preset = build_preset()

    left_df = load_dataframe(preset.left_path)
    right_df = load_dataframe(preset.right_path)
    result = match(left_df, right_df, preset)

    result.unmatched_left = sort_by_grade(
        result.unmatched_left, "grade_name", "first_name"
    )
    result.unmatched_right = sort_by_grade(
        result.unmatched_right, "grade", "name"
    )
    result.left_dupes = sort_by_grade(result.left_dupes, "grade_name", "first_name")
    result.right_dupes = sort_by_grade(result.right_dupes, "grade", "name")

    output_files: list[Path] = []
    matched_pairs = _build_matched_pairs(left_df, right_df, preset)
    matched_path = PROCESSED_DIR / f"{preset.name}.matched.json"
    write_json(matched_path, matched_pairs)
    output_files.append(matched_path)
    if not result.unmatched_left.empty:
        path = PROCESSED_DIR / f"{preset.name}.unmatched_{preset.left_label}.json"
        write_json(path, result.unmatched_left.to_dict(orient="records"))
        output_files.append(path)
    if not result.unmatched_right.empty:
        path = PROCESSED_DIR / f"{preset.name}.unmatched_{preset.right_label}.json"
        write_json(path, result.unmatched_right.to_dict(orient="records"))
        output_files.append(path)

    entry = _build_entry(result, output_files)
    report_path = write_entry(entry)

    print(
        f"Matched {result.matched_key_count} unique keys.\n"
        f"  {preset.left_label}: {result.left_matched_rows} matched / "
        f"{len(result.unmatched_left)} unmatched (of {result.left_total})\n"
        f"  {preset.right_label}: {result.right_matched_rows} matched / "
        f"{len(result.unmatched_right)} unmatched (of {result.right_total})"
    )
    print(f"  (right source: {preset.right_path.name})")
    for p in output_files:
        print(f"  → {p}")
    print(f"  → {report_path} (appended)")


def main() -> None:
    run()


if __name__ == "__main__":
    main()
