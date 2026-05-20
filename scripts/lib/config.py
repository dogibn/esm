"""Shared configuration for scripts/.

Single source of truth for the academic year. Override via ACADEMIC_YEAR
environment variable when running scripts for a non-default year.
"""

import os

ACADEMIC_YEAR = os.environ.get("ACADEMIC_YEAR", "2025-2026")


def year_suffix(academic_year: str = ACADEMIC_YEAR) -> str:
    """Convert '2025-2026' to '25-26' for filename use."""
    start, end = academic_year.split("-")
    return f"{start[-2:]}-{end[-2:]}"
