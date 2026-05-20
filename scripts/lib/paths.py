"""Shared filesystem paths for scripts/.

Every script under scripts/ that needs a path to scraped/, parsed/, data/,
or reports/ should import from here rather than re-deriving with
Path(__file__).parents[N]. Keeps the layout knowable from one place.
"""

from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = SCRIPTS_DIR.parent

DATA_DIR = SCRIPTS_DIR / "data"
SCRAPED_DIR = SCRIPTS_DIR / "scraped"
PARSED_DIR = SCRIPTS_DIR / "parsed"
PROCESSED_DIR = SCRIPTS_DIR / "processed"
REPORTS_DIR = SCRIPTS_DIR / "reports"
