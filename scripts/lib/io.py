"""Shared I/O helpers for scripts/.

JSON helpers for pipeline scripts (scrape/parse/load) and a DataFrame loader
that dispatches on file extension for QA tools.
"""

import json
from pathlib import Path
from typing import Any


def load_json(path: Path | str) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path: Path | str, data: Any, *, indent: int = 4) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(
        json.dumps(data, ensure_ascii=False, indent=indent),
        encoding="utf-8",
    )


def load_dataframe(path: Path | str):
    """Load JSON or CSV into a pandas DataFrame. Imported lazily so the
    pipeline scripts (scrape/parse/load) don't pay pandas import cost."""
    import pandas as pd

    p = Path(path)
    if p.suffix.lower() == ".json":
        return pd.read_json(p)
    if p.suffix.lower() == ".csv":
        return pd.read_csv(p)
    raise ValueError(f"Unsupported file format: {p.suffix}")
