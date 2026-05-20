"""Unified report writer for scripts/tools/*.

Every clean/validate run appends a timestamped section to a single main
report file (`scripts/reports/report.md`). Detail tables larger than
`BIG_TABLE_THRESHOLD` rows get spun out to their own file and linked
from the main report.

Entry point: `write_entry(ReportEntry(...))`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import pandas as pd

from lib.paths import REPORTS_DIR, SCRIPTS_DIR


MAIN_REPORT = REPORTS_DIR / "report.md"
BIG_TABLE_THRESHOLD = 20


@dataclass
class ReportTable:
    """A detail table attached to a report entry.

    `slug` is used to name the spun-out file when the table exceeds the
    threshold (e.g. slug='surname-changes' → reports/<stem>.surname-changes.md).
    """

    title: str
    slug: str
    rows: pd.DataFrame


@dataclass
class ReportEntry:
    kind: str                                # "Cleaning", "Validation", etc.
    source: Path                             # input file path
    summary_lines: list[str] = field(default_factory=list)
    output_files: list[Path] = field(default_factory=list)
    tables: list[ReportTable] = field(default_factory=list)
    note: str | None = None                  # short status line ("no changes")
    stem: str | None = None                  # override prefix for split detail
                                             # filenames (defaults to source.stem)


def _format_path(p: Path) -> str:
    p = Path(p)
    try:
        return str(p.relative_to(SCRIPTS_DIR))
    except ValueError:
        return str(p)


def _write_detail_file(
    entry: ReportEntry, table: ReportTable, timestamp: str
) -> Path:
    stem = entry.stem or Path(entry.source).stem
    detail_path = REPORTS_DIR / f"{stem}.{table.slug}.md"
    with detail_path.open("w", encoding="utf-8") as f:
        f.write(f"# {table.title}\n\n")
        f.write(
            f"**Source:** `{_format_path(entry.source)}`  "
            f"**Generated:** {timestamp}  "
            f"**Rows:** {len(table.rows)}\n\n"
        )
        f.write(table.rows.to_markdown(index=False) + "\n")
    return detail_path


def write_entry(entry: ReportEntry) -> Path:
    """Append `entry` to the main report. Splits big tables to detail files.

    Returns the main report path.
    """
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

    inline: list[ReportTable] = []
    linked: list[tuple[ReportTable, Path]] = []
    for table in entry.tables:
        if len(table.rows) > BIG_TABLE_THRESHOLD:
            detail_path = _write_detail_file(entry, table, timestamp)
            linked.append((table, detail_path))
        else:
            inline.append(table)

    with MAIN_REPORT.open("a", encoding="utf-8") as f:
        f.write(f"\n---\n## {entry.kind} — {timestamp}\n")
        f.write(f"**Source:** `{_format_path(entry.source)}`\n\n")

        if entry.note:
            f.write(f"_{entry.note}_\n")

        for line in entry.summary_lines:
            f.write(f"- {line}\n")

        if entry.output_files:
            f.write("\n**Outputs:**\n")
            for p in entry.output_files:
                f.write(f"- `{_format_path(p)}`\n")

        for table, detail_path in linked:
            f.write(
                f"\n### {table.title}\n"
                f"{len(table.rows)} rows — see "
                f"[`{_format_path(detail_path)}`]({detail_path.name})\n"
            )

        for table in inline:
            f.write(f"\n### {table.title}\n\n")
            if table.rows.empty:
                f.write("_None._\n")
            else:
                f.write(table.rows.to_markdown(index=False) + "\n")

    return MAIN_REPORT
