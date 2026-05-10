import pandas as pd
import json
from pathlib import Path

# 1. Get the location of 'parse_excel.py'
# This is: project/scripts/parse/
SCRIPT_DIR = Path(__file__).resolve().parent

# 2. Go up one level to 'scripts/' and then into 'data/'
# Path: project/scripts/data/tuition_25-26.xlsx
INPUT_FILE = SCRIPT_DIR.parent / "data" / "tuition_25-26.xlsx" 

# 3. Go up one level to 'scripts/' and then into 'load/'
# Path: project/scripts/load/
OUTPUT_DIR = SCRIPT_DIR.parent / "load"

# Using a variable to handle the year
year_suffix = "25-26"
METADATA_FILE = OUTPUT_DIR / f"grades_info_{year_suffix}.json"
RECORDS_FILE = OUTPUT_DIR / f"tuition_records_{year_suffix}.json"

def parse_spreadsheet():
    # Check if the file actually exists before starting
    if not INPUT_FILE.exists():
        print(f"Error: Could not find file at {INPUT_FILE}")
        return

    # 2. Load the data
    COLUMNS = [
        "reg",                  # A — drop
        "contract",             # B
        "idx",                  # C — drop (unnamed index column)
        "new_old",              # D
        "grade",                # E
        "surname",              # F
        "name",                 # G
        "code",                 # H
        "tuition",              # I (2025-2026)
        "total_payment",        # J
        "ot",                   # K — drop
        "check",                # L
        "staff",                # M
        "corporate",            # N
        "barter",               # O
        "early_bird_discount",  # P
        "deal_discount",        # Q
        "sibling_discount",     # R
        "scholarship",          # S
    ]
    df = pd.read_excel(INPUT_FILE, usecols="A:S", header=None, names=COLUMNS)
    df = df.drop(columns=["reg", "idx", "ot"], errors="ignore")
    
    final_data = []
    class_metadata = []

    for _, row in df.iterrows():
        # Drop empty values to count actual entries in the row
        clean_row = row.dropna().tolist()
        
        # Check for the "Special Rows" (3 or fewer entries)
        if 0 < len(clean_row) <= 3:
            metadata_entry = {}
            for item in clean_row:
                # Check if entry contains a digit (Grade Name)
                if any(char.isdigit() for char in str(item)):
                    metadata_entry["gradeName"] = item
                # Check if entry is strictly letters/spaces (Teacher Name)
                else:
                    metadata_entry["teacherName"] = item
            class_metadata.append(metadata_entry)
            
        # Handle standard data rows (The main table)
        elif len(clean_row) > 3:
            final_data.append({k: (None if pd.isna(v) else v) for k, v in row.items()})

    # 3. Save to the specific output path
    # 1. Save the Metadata (Grade Names and Teachers)
    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(class_metadata, f, indent=4, ensure_ascii=False)
    
    # 2. Save the Main Records (The rows up to column S)
    with open(RECORDS_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=4, ensure_ascii=False)
    
    print(f"✅ Success!")
    print(f"   - Metadata saved to: {METADATA_FILE.name}")
    print(f"   - Records saved to: {RECORDS_FILE.name}")

if __name__ == "__main__":
    parse_spreadsheet()

