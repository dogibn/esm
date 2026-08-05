"""Resolves every 2026-2027 tuition row to a student and a 2026-2027 grade.

Inputs
    parsed/tuition_26-27.json               the workbook (see parse_tuition_2627)
    scraped/students_26-27.json             esmlh directory, 2026-2027 classes
    scraped/students_25-26.json             esmlh directory, previous year
    processed/students_tuition.matched.json  code → esmlh student_id, from the
                                             2025-2026 load

Identity. The workbook's `Code` is the stable per-student key (it encodes the
cohort year, never changes, and is unique within the file). Resolution is:

    1. code → students_tuition.matched.json → esmlh student_id       (existing)
    2. no code, or a code the 2025-2026 load never saw → exact match on
       (surname, name) against the directory, tried both orderings because the
       workbook and esmlh disagree about which column is the family name
    3. nothing matched → a new student, to be inserted with a placeholder id

Grade. Per the year-start decision, esmlh is authoritative and already carries
2026-2027 classes, so no promotion arithmetic is needed for anyone it lists.
The fallbacks, in order:

    web       the student's 2026-2027 class from the directory
    promoted  one level up from their 2025-2026 grade level, for students the
              new directory has not listed yet
    grade     the workbook's own `Grade` cell — see below
    intake    the `Grade` cell inherited from a new-intake sub-header
    section   the modal 2026-2027 level of the row's own section-mates

The `Grade` cell holds two different things depending on the row. A bare level
("3+", "6", "11") is the 2026-2027 level. A class name with a stream suffix
("8A", "5+B", "1ML", "10B") is the student's *2025-2026* class and has to be
promoted. Cross-checking both readings against the modal price for the level
settles it: promoting the suffixed form agrees with the money on all ten rows
where the two readings differ, and reading it literally disagrees on four.

The section *label* is deliberately never parsed: those headers are free text
and inconsistent about which year they name — the 5+ blocks label the
2026-2027 class while everything below them labels the 2025-2026 one. What the
last fallback uses instead is where the section's already-resolved members
actually ended up, which needs no assumption about the label at all.

Every level that did not come from esmlh is then checked against the modal
gross tuition for its level, and anything that disagrees is reported.

Usage (from the scripts/ directory):
    python -m match.tuition_2627_resolve
"""

from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict
from fractions import Fraction

from lib.grades import grade_sort_key
from lib.io import load_json, write_json
from lib.paths import PARSED_DIR, PROCESSED_DIR, REPORTS_DIR, SCRAPED_DIR

TUITION_FILE = PARSED_DIR / "tuition_26-27.json"
WEB_CURRENT_FILE = SCRAPED_DIR / "students_26-27.json"
WEB_PREVIOUS_FILE = SCRAPED_DIR / "students_25-26.json"
CODE_PAIRS_FILE = PROCESSED_DIR / "students_tuition.matched.json"

RESOLVED_FILE = PROCESSED_DIR / "tuition_26-27.resolved.json"
LEAVERS_FILE = PROCESSED_DIR / "tuition_26-27.leavers.json"
FEE_STRUCTURE_FILE = PROCESSED_DIR / "tuition_26-27.fee_structure.json"
REPORT_FILE = REPORTS_DIR / "tuition_26-27.resolution.md"

# Canonical grade-level ladder. Promotion is one step along it; grade 12 has no
# successor (those students graduate and are absent from the workbook).
LADDER = ["3+", "4+", "5+"] + [str(i) for i in range(1, 13)]
NEXT_LEVEL = dict(zip(LADDER, LADDER[1:]))

# Class names are a level followed by an optional stream suffix: 3+, 4+A, 1JA,
# 10B. esmlh also carries placeholder classes ("1temp") for students it has not
# streamed yet; the level still parses out of those, which is all we need.
CLASS_RE = re.compile(r"^(\d+\+|\d+)")
BARE_LEVEL_RE = re.compile(r"^(\d+\+|\d+)$")


def level_of(class_name: str | None) -> str | None:
    if not class_name:
        return None
    match = CLASS_RE.match(class_name)
    return match.group(1) if match else None


def level_from_grade_cell(cell: str | None) -> str | None:
    """Read the workbook's `Grade` cell as a 2026-2027 level.

    Bare levels are already the new year's. Anything carrying a stream suffix
    is last year's class and gets promoted.
    """
    if not cell:
        return None
    cell = cell.strip()
    if BARE_LEVEL_RE.match(cell):
        return cell if cell in LADDER else None
    level = level_of(cell)
    return NEXT_LEVEL.get(level) if level else None


def name_key(last: str | None, first: str | None) -> tuple[str, str]:
    """Comparison key for a person. Case, spacing and punctuation drift freely
    between the workbook and esmlh, so all three are normalised away."""

    def norm(value: str | None) -> str:
        if not value:
            return ""
        return re.sub(r"[^a-z]", "", value.lower())

    return (norm(last), norm(first))


def load_inputs():
    for path in (TUITION_FILE, WEB_CURRENT_FILE, WEB_PREVIOUS_FILE, CODE_PAIRS_FILE):
        if not path.exists():
            print(f"ERROR: missing {path}.", file=sys.stderr)
            sys.exit(1)
    return (
        load_json(TUITION_FILE),
        load_json(WEB_CURRENT_FILE),
        load_json(WEB_PREVIOUS_FILE),
        load_json(CODE_PAIRS_FILE),
    )


def resolve() -> None:
    rows, web_now, web_prev, code_pairs = load_inputs()

    student_id_by_code = {p["code"]: str(p["student_id"]) for p in code_pairs}
    code_by_student_id = {v: k for k, v in student_id_by_code.items()}
    web_now_by_id = {w["student_id"]: w for w in web_now}
    prev_level_by_id = {
        w["student_id"]: level_of(w["grade_name"]) for w in web_prev
    }

    # Name index over the current directory, both column orderings.
    by_name: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for w in web_now:
        by_name[name_key(w["last_name"], w["first_name"])].append(w)
        by_name[name_key(w["first_name"], w["last_name"])].append(w)

    resolved: list[dict] = []
    identity_counts: Counter[str] = Counter()
    grade_counts: Counter[str] = Counter()

    for row in rows:
        code = row["code"]
        student_id: str | None = None
        identity: str

        if code and code in student_id_by_code:
            student_id = student_id_by_code[code]
            identity = "code"
        else:
            key = name_key(row["surname"], row["name"])
            candidates = {c["student_id"]: c for c in by_name.get(key, [])}
            if len(candidates) == 1:
                student_id = next(iter(candidates))
                identity = "name" if not code else "name (unknown code)"
            elif len(candidates) > 1:
                identity = "ambiguous name"
            else:
                identity = "new"

        web = web_now_by_id.get(student_id) if student_id else None
        if web:
            grade_class, level, grade_source = (
                web["grade_name"],
                level_of(web["grade_name"]),
                "web",
            )
        elif student_id and prev_level_by_id.get(student_id):
            grade_class, level, grade_source = (
                None,
                NEXT_LEVEL.get(prev_level_by_id[student_id]),
                "promoted",
            )
        elif (from_cell := level_from_grade_cell(row["grade_file"])) :
            grade_class, level, grade_source = None, from_cell, "grade"
        elif row["intake_grade"] in LADDER:
            grade_class, level, grade_source = None, row["intake_grade"], "intake"
        else:
            grade_class, level, grade_source = None, None, "unresolved"

        identity_counts[identity] += 1

        resolved.append(
            {
                **row,
                "student_id": student_id,
                "identity_source": identity,
                "prior_code": code_by_student_id.get(student_id) if student_id else None,
                "web_class": grade_class,
                "grade_level": level,
                "grade_source": grade_source if level else "unresolved",
                "web_first_name": web["first_name"] if web else None,
                "web_last_name": web["last_name"] if web else None,
                "parent_phone": web["parent_phone"] if web else None,
                "parent_email": web["parent_email"] if web else None,
            }
        )

    # Last resort, once every directory-backed row is placed: adopt the modal
    # level of the section's other members.
    section_level = modal_level_by_section(resolved)
    for row in resolved:
        if row["grade_level"] is None and section_level.get(row["section"]):
            row["grade_level"] = section_level[row["section"]]
            row["grade_source"] = "section"
    for row in resolved:
        grade_counts[row["grade_source"] if row["grade_level"] else "unresolved"] += 1

    modal_tuition = modal_tuition_by_level(resolved)
    for row in resolved:
        expected = modal_tuition.get(row["grade_level"])
        row["expected_tuition"] = expected
        row["tuition_agrees"] = (
            None
            if expected is None or row["tuition"] is None
            else row["tuition"] == expected
        )

    for row in resolved:
        assign_base_tuition(row, modal_tuition)
        row["discount_lines"] = build_discount_lines(row)

    leavers = build_leavers(resolved, code_pairs, web_now_by_id, web_prev)

    write_json(RESOLVED_FILE, resolved, indent=1)
    write_json(LEAVERS_FILE, leavers, indent=1)
    # The per-level rate table, ordered along the ladder so the file reads like
    # a price list. This is what becomes the `tuition` fee_structures row.
    write_json(
        FEE_STRUCTURE_FILE,
        {level: modal_tuition[level] for level in LADDER if level in modal_tuition},
        indent=1,
    )
    write_report(resolved, leavers, identity_counts, grade_counts)

    print(f"Resolved {len(resolved)} rows.", file=sys.stderr)
    print(f"  identity: {dict(identity_counts)}", file=sys.stderr)
    print(f"  grade:    {dict(grade_counts)}", file=sys.stderr)
    print(f"  leavers:  {len(leavers)}", file=sys.stderr)
    print(f"Wrote {RESOLVED_FILE}, {LEAVERS_FILE}, {REPORT_FILE}", file=sys.stderr)


def assign_base_tuition(row: dict, modal_tuition: dict[str, int]) -> None:
    """Work out what the school is actually billing this student before discounts.

    Usually that is the level's rate. Where it is not, the workbook says so in
    arithmetic rather than in words: `Total payment` is the net the family owes,
    so `net + the itemised discounts` is the gross the accountants worked from.
    On 22 rows that gross is not the level rate — most of them exactly 50% (a
    half-year enrolment) or exactly 95%, and a few billed at a neighbouring
    level's rate. Treating those as a different *base* rather than as a missing
    discount keeps the row self-consistent: base − discounts == net exactly, on
    every row in the file.

    Falls back to the level rate only when the workbook gives neither a net nor
    a gross.
    """
    level_rate = modal_tuition.get(row["grade_level"])
    net, discounts = row["total_payment"], row["discount_total"] or 0
    implied = net + discounts if net is not None else row["tuition"]

    if implied is None:
        row["base_tuition"] = level_rate
        row["base_source"] = "level" if level_rate else "unknown"
        row["base_note"] = None
        return

    row["base_tuition"] = implied
    if level_rate is None or implied == level_rate:
        row["base_source"] = "level"
        row["base_note"] = None
        return

    share = implied / level_rate
    row["base_source"] = "workbook"
    row["base_note"] = (
        f"Workbook bills {implied:,} MNT for grade level {row['grade_level']} "
        f"(level rate {level_rate:,} MNT, {share:.1%})."
    )


# Compounding order. Percentage discounts are read against the running total,
# so the order the school applies them in has to be reproduced: sibling is
# demonstrably 5% (or 50%) of what is left *after* early-bird, never of gross.
DISCOUNT_ORDER = [
    ("staff", "Staff"),
    ("corporate", "Corporate"),
    ("barter", "Barter"),
    ("early_bird", "Early-bird"),
    ("sibling", "Siblings"),
    ("scholarship", "Scholarship"),
]
# Columns the school reasons about as a percentage of the running total. The
# rest are negotiated cash amounts with no rule behind them.
PERCENT_DISCOUNTS = {"staff", "sibling"}
# discounts.value is numeric(12,4).
VALUE_SCALE = 10_000


def build_discount_lines(row: dict) -> list[dict]:
    """One line per discount the workbook itemises, in application order.

    `amount` is always the MNT figure from the workbook — that is what the
    balance formula sums, so the loaded rows reconcile with the sheet by
    construction. `unit`/`value` additionally record *how* the figure was
    arrived at, where that can be established exactly: a percentage is only
    claimed when it round-trips to the recorded amount to the last MNT.
    """
    lines: list[dict] = []
    running = row["base_tuition"]
    position = 0

    for column, name in DISCOUNT_ORDER:
        amount = row.get(column)
        if not amount:
            continue

        unit, value = "mnt", amount
        if column in PERCENT_DISCOUNTS and running:
            percent = Fraction(amount, running) * 100
            exact = Fraction(round(percent * VALUE_SCALE), VALUE_SCALE)
            if exact == percent and round(running * percent / 100) == amount:
                unit, value = "percent", float(percent)

        lines.append(
            {
                "column": column,
                "name": name,
                "unit": unit,
                "value": value,
                "amount": amount,
                "position": position,
            }
        )
        position += 1
        if running is not None:
            running -= amount

    return lines


def modal_level_by_section(resolved) -> dict[str, str]:
    """Modal 2026-2027 level per workbook section, from esmlh-backed rows only.

    Sections are contiguous blocks that move up together, so where a row's own
    evidence runs out its section-mates are the best remaining witness.
    """
    votes: dict[str, Counter[str]] = defaultdict(Counter)
    for row in resolved:
        if row["grade_source"] == "web" and row["section"]:
            votes[row["section"]][row["grade_level"]] += 1
    return {
        section: counter.most_common(1)[0][0] for section, counter in votes.items()
    }


def modal_tuition_by_level(resolved) -> dict[str, int]:
    """Modal gross tuition per level, computed from esmlh-backed rows only.

    Restricting the vote to rows whose level came from the directory keeps the
    price table independent of the fallbacks, so it can be used to check them
    without the reasoning going in a circle.
    """
    votes: dict[str, Counter[int]] = defaultdict(Counter)
    for row in resolved:
        if row["grade_source"] == "web" and row["tuition"]:
            votes[row["grade_level"]][row["tuition"]] += 1
    return {
        level: counter.most_common(1)[0][0] for level, counter in votes.items()
    }


def build_leavers(resolved, code_pairs, web_now_by_id, web_prev) -> list[dict]:
    """Students carried in the 2025-2026 load but absent from the workbook.

    Bucketed rather than listed flat, because the three causes need different
    handling: graduates leave normally, students esmlh still lists for
    2026-2027 are almost certainly workbook omissions, and only the remainder
    are candidate deletions.
    """
    present = {r["student_id"] for r in resolved if r["student_id"]}
    prev_by_id = {w["student_id"]: w for w in web_prev}

    leavers = []
    for pair in code_pairs:
        student_id = str(pair["student_id"])
        if student_id in present:
            continue
        prev = prev_by_id.get(student_id, {})
        prev_level = level_of(prev.get("grade_name"))
        still_listed = student_id in web_now_by_id
        if prev_level == "12":
            bucket = "graduated"
        elif still_listed:
            bucket = "still enrolled on esmlh"
        else:
            bucket = "candidate delete"
        leavers.append(
            {
                "student_id": student_id,
                "code": pair["code"],
                "last_name": prev.get("last_name"),
                "first_name": prev.get("first_name"),
                "prev_class": prev.get("grade_name"),
                "prev_level": prev_level,
                "current_class": (
                    web_now_by_id[student_id]["grade_name"] if still_listed else None
                ),
                "bucket": bucket,
            }
        )
    return leavers


def write_report(resolved, leavers, identity_counts, grade_counts) -> None:
    out: list[str] = ["# 2026-2027 tuition resolution", ""]
    out.append(f"{len(resolved)} student rows in the workbook.")
    out.append("")

    out.append("## Identity")
    out.append("")
    out.append("| source | rows |")
    out.append("| --- | ---: |")
    for source, count in identity_counts.most_common():
        out.append(f"| {source} | {count} |")
    out.append("")

    out.append("## Grade level")
    out.append("")
    out.append("| source | rows |")
    out.append("| --- | ---: |")
    for source, count in grade_counts.most_common():
        out.append(f"| {source} | {count} |")
    out.append("")

    out.append("## Gross tuition by grade level")
    out.append("")
    out.append("| level | rows | modal amount | share | other amounts |")
    out.append("| --- | ---: | ---: | ---: | --- |")
    by_level: dict[str, list[dict]] = defaultdict(list)
    for row in resolved:
        if row["grade_level"]:
            by_level[row["grade_level"]].append(row)
    for level in sorted(by_level, key=grade_sort_key):
        amounts = Counter(r["tuition"] for r in by_level[level] if r["tuition"])
        if not amounts:
            continue
        modal, hits = amounts.most_common(1)[0]
        others = ", ".join(
            f"{amount:,} ×{count}" for amount, count in amounts.most_common()[1:]
        )
        out.append(
            f"| {level} | {len(by_level[level])} | {modal:,} | "
            f"{hits}/{sum(amounts.values())} | {others or '—'} |"
        )
    out.append("")

    _section(
        out,
        "Gross tuition disagrees with the level's modal amount",
        [r for r in resolved if r["tuition_agrees"] is False],
        [
            "row",
            "code",
            "surname",
            "name",
            "grade_level",
            "grade_source",
            "tuition",
            "expected_tuition",
        ],
    )
    _section(
        out,
        "Rows needing a fallback grade",
        [r for r in resolved if r["grade_source"] not in ("web", "unresolved")],
        [
            "row",
            "code",
            "surname",
            "name",
            "section",
            "grade_file",
            "grade_source",
            "grade_level",
            "tuition",
            "tuition_agrees",
        ],
    )
    _section(
        out,
        "Rows with no grade at all",
        [r for r in resolved if not r["grade_level"]],
        ["row", "code", "surname", "name", "section", "grade_file", "tuition"],
    )
    _section(
        out,
        "New students (no esmlh record)",
        [r for r in resolved if r["identity_source"] == "new"],
        ["row", "surname", "name", "grade_level", "grade_source", "new_old", "contract"],
    )
    _section(
        out,
        "Ambiguous name matches",
        [r for r in resolved if r["identity_source"] == "ambiguous name"],
        ["row", "code", "surname", "name", "tuition"],
    )
    _section(
        out,
        "Name changes vs esmlh",
        [
            r
            for r in resolved
            if r["web_last_name"]
            and name_key(r["surname"], r["name"])
            != name_key(r["web_last_name"], r["web_first_name"])
        ],
        ["row", "code", "web_last_name", "web_first_name", "surname", "name"],
    )

    off_rate = [r for r in resolved if r["base_source"] == "workbook"]
    out.append(f"## Base tuition below the level rate ({len(off_rate)})")
    out.append("")
    out.append(
        "The workbook bills these students something other than their level's "
        "rate. The base is taken from the sheet's own arithmetic "
        "(`Total payment` + itemised discounts), so `base − discounts == net` "
        "still holds exactly. **These need attributing** — the reason for the "
        "reduction is not recorded anywhere in the file."
    )
    out.append("")
    if not off_rate:
        out.append("None.")
        out.append("")
    else:
        out.append(
            "| row | code | surname | name | level | level rate | base billed "
            "| share | discounts | net |"
        )
        out.append("| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |")
        for r in sorted(off_rate, key=lambda x: x["row"]):
            rate = r["expected_tuition"] or 0
            share = f"{r['base_tuition'] / rate:.1%}" if rate else "—"
            net = f"{r['total_payment']:,}" if r["total_payment"] is not None else "—"
            out.append(
                f"| {r['row']} | {r['code'] or '—'} | {r['surname']} | {r['name']} "
                f"| {r['grade_level']} | {rate:,} | {r['base_tuition']:,} | {share} "
                f"| {r['discount_total']:,} | {net} |"
            )
        out.append("")

    out.append("## Discounts")
    out.append("")
    out.append("| discount | rows | unit as loaded | total MNT |")
    out.append("| --- | ---: | --- | ---: |")
    per_column: dict[str, list[dict]] = defaultdict(list)
    for row in resolved:
        for line in row["discount_lines"]:
            per_column[line["name"]].append(line)
    for name, lines in sorted(per_column.items(), key=lambda kv: -len(kv[1])):
        units = Counter(line["unit"] for line in lines)
        unit_text = ", ".join(f"{unit} ×{count}" for unit, count in units.most_common())
        out.append(
            f"| {name} | {len(lines)} | {unit_text} | "
            f"{sum(line['amount'] for line in lines):,} |"
        )
    out.append("")

    out.append("## Students in the 2025-2026 load but not in the workbook")
    out.append("")
    for bucket in ("graduated", "still enrolled on esmlh", "candidate delete"):
        rows = [leaver for leaver in leavers if leaver["bucket"] == bucket]
        out.append(f"### {bucket} ({len(rows)})")
        out.append("")
        if bucket == "graduated":
            out.append("Left at the end of grade 12. No action.")
            out.append("")
            continue
        if not rows:
            out.append("None.")
            out.append("")
            continue
        out.append("| code | last name | first name | 2025-26 class | 2026-27 class |")
        out.append("| --- | --- | --- | --- | --- |")
        for leaver in rows:
            out.append(
                f"| {leaver['code']} | {leaver['last_name']} | {leaver['first_name']} "
                f"| {leaver['prev_class']} | {leaver['current_class'] or '—'} |"
            )
        out.append("")

    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text("\n".join(out), encoding="utf-8")


def _section(out: list[str], title: str, rows: list[dict], columns: list[str]) -> None:
    out.append(f"## {title} ({len(rows)})")
    out.append("")
    if not rows:
        out.append("None.")
        out.append("")
        return
    out.append("| " + " | ".join(columns) + " |")
    out.append("| " + " | ".join("---" for _ in columns) + " |")
    for row in rows:
        out.append(
            "| " + " | ".join(str(row.get(c) if row.get(c) is not None else "—") for c in columns) + " |"
        )
    out.append("")


if __name__ == "__main__":
    resolve()
