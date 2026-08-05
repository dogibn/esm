/**
 * Audit the matching pipeline's *output* for likely errors.
 *
 * `dry_run_matching.ts` says which bucket each row landed in; `score_matching.ts`
 * says whether the student was right — but only for the 29 hand-labelled cases.
 * This script covers all 334 incoming rows without labels, by re-deriving what
 * the memo itself claims (surname initial, class, fee) and checking the
 * proposal against it, plus checking the allocation against the student's
 * ledger.
 *
 * Every finding is a *suspicion*, not a verdict: the memo is the only ground
 * truth available and it is often wrong itself (parents mistype their own
 * child's class). Findings are graded so a reviewer can start where the memo
 * and the proposal contradict each other outright.
 *
 * No DB writes. Read-only.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/qa/audit_matching.ts [bank.xlsx] [outDir]
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildMatchingContext, match } from "@/features/imports/matching";
import { feeTagMatches, findCombosSummingTo } from "@/features/imports/matching/allocate-charges";
import { extractSignals } from "@/features/imports/matching/extract-signals";
import { levenshtein } from "@/features/imports/matching/fuzzy";
import { loadMatchingContextInput } from "@/features/imports/matching/load-context";
import { normalize, visualVariants } from "@/features/imports/matching/normalize";
import { detectMultiStudent, resolveStudent } from "@/features/imports/matching/resolve-student";
import type {
  ChargeWithBalance,
  MatchProposal,
  MatchResult,
  MatchingContext,
  StudentCandidate,
} from "@/features/imports/matching";

import { analyzeRow, csvEscape, fmtMNT, readBankFile } from "./_harness";

const DEFAULT_BANK_PATH = "features/imports/data/bank_transactions_sample.xlsx";
const DEFAULT_OUT_DIR = "features/imports/data";

const bankPathArg = process.argv[2] ?? DEFAULT_BANK_PATH;
const outDir = process.argv[3] ?? DEFAULT_OUT_DIR;
const bankAbsPath = resolve(process.cwd(), bankPathArg);
if (!existsSync(bankAbsPath)) {
  console.error(`ERROR: bank file not found at ${bankAbsPath}.`);
  process.exit(1);
}

// --------------------------------------------------------------------------
// Finding taxonomy
// --------------------------------------------------------------------------

type Severity = "high" | "medium" | "low";

type FindingCode =
  // wrong student
  | "surname_initial_mismatch"
  | "memo_name_not_student_name"
  | "class_mismatch"
  | "level_mismatch"
  | "fuzzy_only_match"
  | "coin_flip_candidates"
  | "matched_without_name_evidence"
  | "multi_student_fallback"
  | "multi_student_separator"
  // wrong charge
  | "fee_hint_ignored"
  | "second_charge_missed"
  | "combo_available_not_taken"
  | "ambiguous_split"
  | "no_allocation_with_open_charges"
  | "under_allocated"
  | "over_allocated"
  // recall
  | "unmatched_despite_name";

const SEVERITY: Record<FindingCode, Severity> = {
  surname_initial_mismatch: "high",
  memo_name_not_student_name: "high",
  class_mismatch: "high",
  level_mismatch: "medium",
  fuzzy_only_match: "medium",
  coin_flip_candidates: "high",
  matched_without_name_evidence: "medium",
  multi_student_fallback: "high",
  multi_student_separator: "medium",
  fee_hint_ignored: "high",
  second_charge_missed: "high",
  combo_available_not_taken: "medium",
  ambiguous_split: "medium",
  no_allocation_with_open_charges: "medium",
  under_allocated: "low",
  over_allocated: "low",
  unmatched_despite_name: "medium",
};

const TITLE: Record<FindingCode, string> = {
  surname_initial_mismatch:
    "Memo's surname initial doesn't match the proposed student's surname",
  memo_name_not_student_name:
    "The name written in the memo is not the proposed student's name",
  class_mismatch: "Memo names a class the proposed student is not in",
  level_mismatch: "Memo names a grade level the proposed student is not in",
  fuzzy_only_match: "Student reached only through a fuzzy (misspelled) name",
  coin_flip_candidates: "Top two candidates are effectively tied",
  matched_without_name_evidence: "Student proposed with no name evidence in the memo",
  multi_student_fallback:
    "Memo names several students; the split failed and one student got the whole transfer",
  multi_student_separator:
    "Memo lists several students with an explicit separator, but only one was proposed",
  fee_hint_ignored: "Memo names a fee; the money was allocated to a different fee",
  second_charge_missed: "Remainder exactly equals another open charge (split missed)",
  combo_available_not_taken: "A combination of charges sums to the amount but wasn't used",
  ambiguous_split: "Several charge combinations fit; the matcher guessed",
  no_allocation_with_open_charges: "Student has open charges but nothing was allocated",
  under_allocated: "Allocation is short of the transfer amount",
  over_allocated: "Allocation exceeds the transfer amount",
  unmatched_despite_name: "Memo contains a name but no student was proposed",
};

type Finding = { code: FindingCode; detail: string };

/**
 * Authored, not derived: the recurring causes behind the findings below, read
 * off the sample file by hand. Kept in the report because the per-row lists do
 * not say which of them are the same bug seen four times.
 */
const ROOT_CAUSES = [
  "## Patterns behind these findings",
  "",
  "Written by hand from these runs, not computed — the row lists below are the evidence.",
  "",
  "**Fixed** (see `docs/import_matching_plan.md`, Phase 8):",
  "",
  "- Cyrillic `Е` transliterated to `ye` while the directory romanized the same letter",
  "  both ways (`Yesui` / `Esukhei` / `Esutei`), so a Cyrillic memo could only reach",
  "  half a family and sibling splits collapsed. `phoneticFold` now folds `ye`→`e`.",
  "- A fee read off the amount out-voted the fee the parent wrote: `TAEKWONDO 400,000`",
  "  settled a 400,000 *registration* charge. An explicit hint now retires the inferred",
  "  one and stands down the amount-only searches.",
  "- `detectMultiStudent` read the trailing `(BANK PAYER NAME)` block and could take a",
  "  parent's surname for a second child. `match.ts` now strips it first.",
  "",
  "**Open:**",
  "",
  "1. **Near-ties dominate the remaining risk.** The largest finding below is two",
  "   candidates within 10% of each other — a memo carrying one bare first name and no",
  "   class. Nothing in the memo separates them; only a confirmed account link or an",
  "   asked question can.",
  "2. **Fuzzy-only identifications** are the next largest. Each is a real student",
  "   reached through a misspelling, with no class in the memo to corroborate it.",
  "3. **Multi-term fees dead-end.** Several no-allocation rows are exact multiples of",
  "   the 375,000 bus rate (750,000 = two terms). `proposableFor` requires the amount to",
  "   equal the rate exactly — deliberately, since two terms is two charges — so these",
  "   need a proposal that can create several charges at once.",
  "4. **Prepayments for next year** ('26-27', '2026.09САРД') have nothing to match",
  "   against in a current-term-only charge context, and surface as under-allocated.",
  "",
];

// --------------------------------------------------------------------------
// Name / class comparison helpers
// --------------------------------------------------------------------------

/** normalize() + drop the separators, so "Munkh-Erdene" == "Munkh Erdene". */
function nameKey(s: string): string {
  return normalize(s).replace(/[\s.\-]/g, "");
}

/**
 * Initial letters that a memo and the directory can legitimately disagree on.
 * normalize() already folds kh→h and o→u; what remains is the Cyrillic
 * multi-letter transliterations (Е→ye, Ц→ts, Ч→ch, Ш→sh, Ю→yu, Я→ya, Ё→yo) and
 * the visual confusables a Cyrillic keyboard produces.
 */
function initialsCompatible(memoInitial: string, studentSurname: string): boolean {
  const surname = normalize(studentSurname);
  if (surname.length === 0 || memoInitial.length === 0) return false;
  if (surname.startsWith(memoInitial)) return true;
  if (memoInitial.startsWith(surname[0]!)) return true;
  // "Ye"/"E", "Yu"/"U", "Ya"/"A": the memo carried the glide, the directory
  // spelled it out (or the other way round).
  if (memoInitial.length > 1 && memoInitial[0] === "y" && surname.startsWith(memoInitial[1]!)) {
    return true;
  }
  if (surname[0] === "y" && surname.length > 1 && surname[1] === memoInitial[0]) return true;
  // k/h — "Khulan" folds to "hulan", but a memo may still write a bare K.
  const kh = new Set(["k", "h"]);
  if (kh.has(memoInitial[0]!) && kh.has(surname[0]!)) return true;
  // Cyrillic-lookalike letters (В/B, С/C, Н/H, Р/P, Х/X, У/Y).
  if (visualVariants(memoInitial[0]!).some((v) => surname.startsWith(v))) return true;
  if (visualVariants(surname[0]!).some((v) => memoInitial.startsWith(v))) return true;
  return false;
}

type InitialForm = { initial: string; name: string; raw: string };

/**
 * Is the name written in the memo the same name as the student's, allowing for
 * the spelling drift that survives normalize()? A memo writes "OYU-VJIN" for
 * "Oyu-Ujin" and "MunhkErdene" for "Munkh-Erdene"; those are the same name and
 * must not be reported as the wrong student. Uses the same proportional
 * threshold as the matcher's own fuzzy stage.
 */
function sameWrittenName(memoName: string, directoryName: string): boolean {
  const b = nameKey(directoryName);
  if (b.length === 0) return false;
  // Try the whole written name and each of its tokens: memos glue prefixes on
  // ("EB-INDRA"), and the glue is not a misspelling of anything.
  const parts = [memoName, ...memoName.split(/[\s\-]+/)].map((p) => p.replace(/[\s.\-]/g, ""));
  for (const a of parts) {
    if (a.length === 0) continue;
    if (a === b) return true;
    const threshold = Math.max(a.length, b.length) >= 8 ? 2 : 1;
    if (levenshtein(a, b) <= threshold) return true;
  }
  return false;
}

/**
 * Initial-form names in the raw memo: "B.Baatar", "Б. БААТАР", "Erdembileg.B".
 * Read off the raw text rather than the normalized memo because normalize()
 * only preserves the dot in the leading form.
 */
function extractInitialForms(memo: string): InitialForm[] {
  const out: InitialForm[] = [];
  const leading = /(?:^|[\s,;(])(\p{L})\s*\.\s*(\p{L}[\p{L}-]{2,})/gu;
  const trailing = /(?:^|[\s,;(])(\p{L}[\p{L}-]{2,})\s*\.\s*(\p{L})(?![\p{L}])/gu;
  let m: RegExpExecArray | null;
  while ((m = leading.exec(memo)) !== null) {
    out.push({ initial: normalize(m[1]!), name: normalize(m[2]!), raw: m[0]!.trim() });
  }
  while ((m = trailing.exec(memo)) !== null) {
    out.push({ initial: normalize(m[2]!), name: normalize(m[1]!), raw: m[0]!.trim() });
  }
  return out.filter((f) => f.initial.length > 0 && f.name.length > 0);
}

function classesCompatible(memoClass: string, studentClass: string): boolean {
  const a = normalize(memoClass);
  const b = normalize(studentClass);
  if (a === b) return true;
  return visualVariants(a).includes(b) || visualVariants(b).includes(a);
}

// --------------------------------------------------------------------------
// Audit
// --------------------------------------------------------------------------

type Student = { id: number; firstName: string; lastName: string };

type Row = {
  index: number;
  memo: string;
  amount: bigint;
  senderAccount: string | null;
  tier: "confident" | "attention";
  reason: string;
  kind: MatchResult["kind"];
  studentLabel: string;
  findings: Finding[];
};

function proposalsOf(result: MatchResult): MatchProposal[] {
  switch (result.kind) {
    case "matched":
    case "low_confidence":
      return result.proposals;
    case "matched_multi":
      return result.proposal.proposals;
    case "unmatched":
      return [];
  }
}

function sumAlloc(p: MatchProposal): bigint {
  return p.allocations.reduce((s, a) => s + a.amount, BigInt("0"));
}

/**
 * Students named by each name group in the memo, via exact directory hits only.
 * Used to spot a memo that names two different children where one proposal came
 * back — the sibling case the fixture score already fails on.
 */
function studentsPerNameGroup(
  groups: string[][],
  context: MatchingContext,
): Array<Set<number>> {
  return groups.map((group) => {
    const hits = new Set<number>();
    for (const token of group) {
      for (const sid of context.nameIndex.get(token) ?? []) hits.add(sid);
    }
    return hits;
  });
}

function auditRow(
  memo: string,
  amount: bigint,
  senderAccount: string | null,
  result: MatchResult,
  context: MatchingContext,
  students: Map<number, Student>,
  classOf: Map<number, { gradeName: string; levelCode: string }>,
  chargesById: Map<number, ChargeWithBalance>,
): Finding[] {
  const findings: Finding[] = [];
  const signals = extractSignals(memo, amount, context);
  const proposals = proposalsOf(result);
  const top = proposals[0];

  // ---- recall: nothing proposed, but the memo does contain a name ----
  if (!top) {
    if (result.kind === "unmatched" && result.reason === "no_candidates") {
      // Only worth a reviewer's time when a memo token is *close* to a real
      // student name — an unknown word is usually bank noise, not a miss.
      let best: { token: string; hit: string; distance: number } | null = null;
      for (const group of signals.nameGroups) {
        for (const token of group) {
          if (token.length < 5) continue;
          for (const dirToken of context.nameTokenList) {
            if (Math.abs(dirToken.length - token.length) > 2) continue;
            const d = levenshtein(token, dirToken);
            if (d > 0 && d <= 2 && (!best || d < best.distance)) {
              best = { token, hit: dirToken, distance: d };
            }
          }
        }
      }
      if (best) {
        findings.push({
          code: "unmatched_despite_name",
          detail: `memo token "${best.token}" is ${best.distance} edit(s) from directory name "${best.hit}" but no student was proposed`,
        });
      }
    }
    return findings;
  }

  const candidates: StudentCandidate[] = resolveStudent(signals, senderAccount, context);
  const candById = new Map(candidates.map((c) => [c.studentId, c]));

  // ---------------- who ----------------
  const student = students.get(top.studentId);
  const cls = classOf.get(top.studentId);

  if (student) {
    // 1. Initial form: "B.Baatar" says the surname starts with B.
    for (const form of extractInitialForms(memo)) {
      const isFirst = sameWrittenName(form.name, student.firstName);
      const isLast = !isFirst && sameWrittenName(form.name, student.lastName);
      if (!isFirst && !isLast) {
        // The written name isn't this student's at all — only worth reporting
        // when the proposal actually leaned on a name signal.
        if (
          [...top.signals].some((s) => s.startsWith("memo_name")) &&
          signals.nameGroups.length === 1
        ) {
          findings.push({
            code: "memo_name_not_student_name",
            detail: `memo "${form.raw}" vs proposed ${student.firstName} ${student.lastName}`,
          });
        }
        continue;
      }
      const counterpart = isFirst ? student.lastName : student.firstName;
      if (!initialsCompatible(form.initial, counterpart)) {
        findings.push({
          code: "surname_initial_mismatch",
          detail: `memo "${form.raw}" names ${
            isFirst ? student.firstName : student.lastName
          }, so the initial should be the ${
            isFirst ? "surname" : "first name"
          } — proposed student's is "${counterpart}"`,
        });
      }
    }

    // 2. Class / level stated in the memo vs the student's enrollment.
    if (cls && signals.gradeTokens.class.length > 0) {
      const ok = signals.gradeTokens.class.some((t) => classesCompatible(t, cls.gradeName));
      if (!ok) {
        findings.push({
          code: "class_mismatch",
          detail: `memo class ${signals.gradeTokens.class
            .map((t) => t.toUpperCase())
            .join("/")} vs student in ${cls.gradeName}`,
        });
      }
    } else if (
      cls &&
      signals.gradeTokens.level.length > 0 &&
      // Kindergarten "+" levels are not in levelIndex, so a bare level token in
      // the memo was never evidence for or against them.
      !cls.levelCode.includes("+") &&
      // A wildcard ("5~") that does land on the student's class outranks a bare
      // level token elsewhere in the memo ("... (for 1st class)").
      !signals.gradeTokens.wildcard.some((t) => classesCompatible(t, cls.gradeName))
    ) {
      const lvl = normalize(cls.levelCode);
      const ok = signals.gradeTokens.level.some((t) => normalize(t) === lvl);
      if (!ok) {
        findings.push({
          code: "level_mismatch",
          detail: `memo level ${signals.gradeTokens.level.join("/")} vs student in ${cls.gradeName}`,
        });
      }
    }
  }

  // 3. Fuzzy-only identification.
  const cand = candById.get(top.studentId);
  const nameSignals = [...top.signals].filter((s) => s.startsWith("memo_name"));
  if (
    cand &&
    top.signals.has("memo_name_fuzzy") &&
    !nameSignals.some((s) => s !== "memo_name_fuzzy") &&
    !top.signals.has("sender_account")
  ) {
    findings.push({
      code: "fuzzy_only_match",
      detail: `edit distance ${cand.fuzzyDistance ?? "?"}${
        top.signals.has("memo_grade_class") ? ", class corroborates" : ", no class in memo"
      }`,
    });
  }

  // 4. No name evidence at all.
  if (nameSignals.length === 0) {
    findings.push({
      code: "matched_without_name_evidence",
      detail: top.signals.has("sender_account")
        ? "identified by sender account only"
        : `signals: ${[...top.signals].join(", ") || "(none)"}`,
    });
  }

  // 5. Two candidates that score the same.
  const runnerUp = proposals[1];
  if (result.kind !== "matched_multi" && runnerUp && top.score > 0) {
    const ratio = runnerUp.score / top.score;
    if (ratio >= 0.9) {
      const a = students.get(top.studentId);
      const b = students.get(runnerUp.studentId);
      findings.push({
        code: "coin_flip_candidates",
        detail: `${a?.firstName} ${a?.lastName} (${top.score.toFixed(2)}) vs ${b?.firstName} ${
          b?.lastName
        } (${runnerUp.score.toFixed(2)})`,
      });
    }
  }

  // 6. Memo names several students; only one proposal came back.
  if (result.kind !== "matched_multi") {
    const label = (id: number) => {
      const s = students.get(id);
      return s ? `${s.firstName} ${s.lastName}` : `#${id}`;
    };
    // The trailing "(BANK PARENT NAME)" block names the payer, not a second
    // child, and a parent surname routinely coincides with some student's. The
    // pipeline passes the raw memo here; for auditing purposes drop that block
    // so a payer never counts as a missed sibling.
    const memoWithoutSender = memo.replace(/\(([^)]*)\)\s*$/, "").trim();
    const multi = detectMultiStudent(
      candidates,
      signals,
      memoWithoutSender,
      context,
    );
    if (multi && multi.studentIds.length >= 2) {
      // The matcher itself read several students here, then fell back because
      // no split of the money worked — the whole transfer is now sitting on one
      // of them.
      findings.push({
        code: "multi_student_fallback",
        detail: `memo reads as ${multi.studentIds.map(label).join(" + ")}; allocation fell back to ${label(
          top.studentId,
        )} alone for the full ${fmtMNT(amount)}`,
      });
    } else {
      // Not even detected: an explicit separator lists names that resolve to
      // different students.
      const segments = memoWithoutSender
        .split(/\s*(?:,| and | & |;)\s*/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (segments.length >= 2) {
        // Same reading detectMultiStudent does, minus its two gates: it needs
        // every segment at tier <= 3 and no ties. Both are exactly the cases
        // where it gives up and the whole transfer lands on one child — a
        // sibling whose name only reaches tier 4 (Cyrillic spelling, fuzzy hit)
        // is still a sibling.
        const perSegment: number[] = [];
        for (const seg of segments) {
          const segSignals = extractSignals(seg, BigInt("0"), context);
          const segTop = resolveStudent(segSignals, null, context).filter((c) => c.tier <= 4)[0];
          if (segTop) perSegment.push(segTop.studentId);
        }
        const distinct = [...new Set(perSegment)];
        if (distinct.length >= 2) {
          findings.push({
            code: "multi_student_separator",
            detail: `separated segments name ${distinct
              .map(label)
              .join(" | ")}; proposed only ${label(top.studentId)} for the full ${fmtMNT(amount)}`,
          });
        }
      }
    }
  }

  // ---------------- what it paid ----------------
  const openCharges = context.openChargesByStudent.get(top.studentId) ?? [];
  // A sibling split spends the transfer across several proposals; the whole
  // set is what has to add up.
  const allocated =
    result.kind === "matched_multi"
      ? proposals.reduce((s, p) => s + sumAlloc(p), BigInt("0"))
      : sumAlloc(top);
  const allocatedFees = top.allocations
    .map((a) => chargesById.get(a.chargeId)?.feeName)
    .filter((f): f is string => f !== undefined);

  // 7. Memo named a fee; the money went somewhere else.
  const hints = signals.feeHints.explicit;
  if (hints.length > 0 && top.allocations.length > 0 && !top.proposedCharge) {
    const anyHinted = allocatedFees.some((f) => feeTagMatches(f, hints));
    if (!anyHinted && allocatedFees.length > 0) {
      findings.push({
        code: "fee_hint_ignored",
        detail: `memo hints ${hints
          .map((h) => (typeof h === "string" ? h : h.kind === "club" ? h.feeName : h.category))
          .join("/")}, allocated to ${allocatedFees.join(", ")}`,
      });
    }
  }

  // 8. Allocation arithmetic.
  if (top.allocations.length === 0 && !top.proposedCharge) {
    if (openCharges.length > 0) {
      const combos = findCombosSummingTo(openCharges, amount);
      findings.push({
        code: "no_allocation_with_open_charges",
        detail: `${openCharges.length} open charge(s) totalling ${fmtMNT(
          openCharges.reduce((s, c) => s + c.outstandingBalance, BigInt("0")),
        )}; flags: ${[...top.flags].join(", ") || "(none)"}`,
      });
      if (combos.length > 0) {
        findings.push({
          code: "combo_available_not_taken",
          detail: `${combos.length} combination(s) sum to the amount, e.g. ${combos[0]!
            .map((c) => `#${c.id} ${c.feeName} ${fmtMNT(c.outstandingBalance)}`)
            .join(" + ")}`,
        });
      }
    }
  } else if (allocated !== amount) {
    const remainder = amount - allocated;
    if (remainder > BigInt("0")) {
      const usedIds = new Set(top.allocations.map((a) => a.chargeId));
      const unused = openCharges.filter((c) => !usedIds.has(c.id));
      const exact = unused.filter((c) => c.outstandingBalance === remainder);
      const combos = exact.length > 0 ? [] : findCombosSummingTo(unused, remainder);
      if (exact.length > 0 || combos.length > 0) {
        const target =
          exact.length > 0
            ? exact.map((c) => `#${c.id} "${c.feeName}"`).join(" / ")
            : combos[0]!.map((c) => `#${c.id} "${c.feeName}"`).join(" + ");
        findings.push({
          code: "second_charge_missed",
          detail: `allocated ${fmtMNT(allocated)} of ${fmtMNT(amount)}; remainder ${fmtMNT(
            remainder,
          )} equals unpaid charge ${target} — the transfer covered more than one charge`,
        });
      } else {
        findings.push({
          code: "under_allocated",
          detail: `allocated ${fmtMNT(allocated)} of ${fmtMNT(amount)}; ${fmtMNT(
            remainder,
          )} unexplained; flags: ${[...top.flags].join(", ") || "(none)"}`,
        });
      }
    } else {
      findings.push({
        code: "over_allocated",
        detail: `allocated ${fmtMNT(allocated)} against a ${fmtMNT(amount)} transfer`,
      });
    }
  }

  if (top.flags.has("multiple_valid_combos")) {
    findings.push({
      code: "ambiguous_split",
      detail: `paid ${top.allocations
        .map((a) => `#${a.chargeId} ${chargeName(chargesById, a.chargeId)}`)
        .join(" + ")} — other combinations fit equally well`,
    });
  }

  return findings;
}

function chargeName(map: Map<number, ChargeWithBalance>, id: number): string {
  return map.get(id)?.feeName ?? "?";
}

// --------------------------------------------------------------------------

async function main(): Promise<void> {
  const txs = readBankFile(bankAbsPath);
  const { period, input } = await loadMatchingContextInput();
  const context = buildMatchingContext(input);

  const students = new Map<number, Student>();
  for (const s of input.students) students.set(s.id, s);
  const classOf = new Map<number, { gradeName: string; levelCode: string }>();
  for (const e of input.enrollments) {
    classOf.set(e.studentId, { gradeName: e.gradeName, levelCode: e.gradeLevelCode });
  }
  const chargesById = new Map<number, ChargeWithBalance>();
  for (const c of input.openCharges) chargesById.set(c.id, c);

  const rows: Row[] = [];
  txs.forEach((tx, i) => {
    const result = match(tx, context);
    const a = analyzeRow(tx, result, context);
    if (a.tier === null) return; // filtered before matching — not the matcher's work
    const findings = auditRow(
      tx.memo ?? "",
      tx.amount,
      tx.senderAccount,
      result,
      context,
      students,
      classOf,
      chargesById,
    );
    if (findings.length === 0) return;
    const top = proposalsOf(result)[0];
    const s = top ? students.get(top.studentId) : undefined;
    const cls = top ? classOf.get(top.studentId) : undefined;
    rows.push({
      index: i + 1,
      memo: tx.memo ?? "",
      amount: tx.amount,
      senderAccount: tx.senderAccount,
      tier: a.tier,
      reason: a.reason,
      kind: result.kind,
      studentLabel: s
        ? `${s.firstName} ${s.lastName}${cls ? ` (${cls.gradeName})` : ""}`
        : "(no proposal)",
      findings,
    });
  });

  const incoming = txs.filter((tx) => {
    const r = match(tx, context);
    return analyzeRow(tx, r, context).tier !== null;
  }).length;

  // ---- aggregate ----
  const byCode = new Map<FindingCode, Row[]>();
  for (const r of rows) {
    for (const f of r.findings) {
      const list = byCode.get(f.code);
      if (list) list.push(r);
      else byCode.set(f.code, [r]);
    }
  }
  const codesRanked = [...byCode.keys()].sort((a, b) => {
    const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
    return (
      order[SEVERITY[a]] - order[SEVERITY[b]] ||
      (byCode.get(b)?.length ?? 0) - (byCode.get(a)?.length ?? 0)
    );
  });

  const confidentWithFindings = rows.filter((r) => r.tier === "confident");

  const md: string[] = [
    "# Matching Error Audit",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Source: \`${bankPathArg}\``,
    `- Context: ${period.yearName}, ${period.termName} — ${input.students.length} students, ${input.openCharges.length} open charges`,
    `- Incoming rows audited: ${incoming} (filtered rows excluded)`,
    `- Rows with at least one finding: ${rows.length}`,
    `- **Rows the matcher called \`confident\` that still have a finding: ${confidentWithFindings.length}**`,
    "",
    "Findings are heuristics: the memo is the only available ground truth and",
    "parents mistype it. `high` = the memo and the proposal contradict each other,",
    "`medium` = the proposal rests on weak evidence, `low` = arithmetic that a",
    "reviewer will see anyway.",
    "",
    "## Findings by type",
    "",
    "| severity | finding | rows | of which `confident` |",
    "|:---|:---|---:|---:|",
    ...codesRanked.map((c) => {
      const list = byCode.get(c)!;
      const conf = list.filter((r) => r.tier === "confident").length;
      return `| ${SEVERITY[c]} | \`${c}\` — ${TITLE[c]} | ${list.length} | ${conf} |`;
    }),
    "",
    ...ROOT_CAUSES,
  ];

  for (const code of codesRanked) {
    const list = byCode.get(code)!;
    md.push(`## \`${code}\` (${SEVERITY[code]}) — ${list.length} rows`, "", TITLE[code], "");
    for (const r of list) {
      const detail = r.findings.filter((f) => f.code === code).map((f) => f.detail);
      md.push(
        `- **Row ${r.index}** · ${fmtMNT(r.amount)} · tier=${r.tier} (${r.reason})`,
        `  - memo: \`${r.memo}\``,
        `  - proposed: ${r.studentLabel}`,
        ...detail.map((d) => `  - ${d}`),
      );
      const others = r.findings.filter((f) => f.code !== code).map((f) => f.code);
      if (others.length > 0) md.push(`  - also: ${others.join(", ")}`);
    }
    md.push("");
  }

  const mdPath = resolve(process.cwd(), outDir, "bank_transactions_sample.matching_errors.md");
  writeFileSync(mdPath, md.join("\n"), "utf-8");

  const csv: string[] = ["row,amount,memo,tier,reason,kind,proposed_student,severity,finding,detail"];
  for (const r of rows) {
    for (const f of r.findings) {
      csv.push(
        [
          String(r.index),
          String(r.amount),
          csvEscape(r.memo),
          r.tier,
          r.reason,
          r.kind,
          csvEscape(r.studentLabel),
          SEVERITY[f.code],
          f.code,
          csvEscape(f.detail),
        ].join(","),
      );
    }
  }
  const csvPath = resolve(process.cwd(), outDir, "bank_transactions_sample.matching_errors.csv");
  writeFileSync(csvPath, csv.join("\n"), "utf-8");

  console.log(`Audited ${incoming} incoming rows; ${rows.length} have findings.`);
  for (const c of codesRanked) {
    console.log(`  ${SEVERITY[c].padEnd(6)} ${c.padEnd(32)} ${byCode.get(c)!.length}`);
  }
  console.log(`Report: ${mdPath}`);
  console.log(`CSV:    ${csvPath}`);
  // The postgres pool keeps the event loop alive; the work is done.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
