"""Write a multi-sheet Excel workbook from a {sheet_name: DataFrame} dict.

Thin wrapper over pandas' ExcelWriter (openpyxl backend). Adds two
ergonomic touches: column widths auto-sized to content, and a frozen
header row so tables stay navigable when scrolled.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd


_MAX_COL_WIDTH = 60      # cap to keep readability
_MIN_COL_WIDTH = 8


def _auto_width(values: list[str]) -> int:
    width = max((len(v) for v in values), default=_MIN_COL_WIDTH)
    return min(max(width + 2, _MIN_COL_WIDTH), _MAX_COL_WIDTH)


def write_workbook(path: Path, sheets: dict[str, pd.DataFrame]) -> Path:
    """Write `sheets` to an .xlsx at `path`. Returns the path."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        for sheet_name, df in sheets.items():
            # Excel sheet names: max 31 chars, no [ ] : * ? / \
            safe_name = sheet_name[:31]
            df.to_excel(writer, sheet_name=safe_name, index=False)
            ws = writer.sheets[safe_name]

            ws.freeze_panes = "A2"

            for col_idx, col_name in enumerate(df.columns, start=1):
                values = [str(col_name)] + [
                    "" if pd.isna(v) else str(v) for v in df[col_name].tolist()
                ]
                ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = (
                    _auto_width(values)
                )

    return path
