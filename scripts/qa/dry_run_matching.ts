/**
 * Dry-run the matching pipeline against a bank Excel file.
 *
 * Reads the bank file (default: features/imports/data/bank_transactions_sample.xlsx),
 * pulls the matching context via the shared loader, runs match() on each
 * transaction, and writes a markdown report to scripts/reports/matching_dry_run.md
 * plus a machine-readable CSV at scripts/reports/matching_dry_run.csv.
 *
 * No DB writes. No payments persisted.
 *
 * The headline number is the **reviewer-facing tier** (confident / attention),
 * not the raw MatchResult kind: a "matched" row that still needs a human is not
 * a win, and only the triage classification knows the difference.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/qa/dry_run_matching.ts [bank.xlsx]
 *
 * Required env vars: DATABASE_URL (and the rest validated by @/lib/env).
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildMatchingContext, match } from "@/features/imports/matching";
import { loadMatchingContextInput } from "@/features/imports/matching/load-context";
import type { ChargeWithBalance, MatchResult } from "@/features/imports/matching";

import {
  analyzeRow,
  csvEscape,
  fmtMNT,
  readBankFile,
  type RowAnalysis,
} from "./_harness";

const DEFAULT_BANK_PATH = "features/imports/data/bank_transactions_sample.xlsx";
const REPORT_PATH = "scripts/reports/matching_dry_run.md";
const CSV_PATH = "scripts/reports/matching_dry_run.csv";

const bankPathArg = process.argv[2] ?? DEFAULT_BANK_PATH;
const bankAbsPath = resolve(process.cwd(), bankPathArg);
if (!existsSync(bankAbsPath)) {
  console.error(`ERROR: bank file not found at ${bankAbsPath}.`);
  console.error(`Place the file at the default path or pass it as the first argument.`);
  process.exit(1);
}

function describeResult(
  a: RowAnalysis,
  index: number,
  studentNamesById: Map<number, string>,
  chargesById: Map<number, ChargeWithBalance & { studentId: number }>,
): string {
  const { tx, result } = a;
  const lines: string[] = [
    `### Row ${index + 1} — ${fmtMNT(tx.amount)}`,
    `- Memo: \`${tx.memo ?? ""}\``,
    `- Sender: ${tx.senderAccount ?? "(none)"} ${
      tx.senderAccountName ? `(${tx.senderAccountName})` : ""
    }`.trimEnd(),
    `- Tier: **${a.tier ?? "filtered"}** (${a.reason})`,
  ];

  if (result.kind === "unmatched") {
    lines.push(`- Status: **unmatched** (${result.reason})`);
    return lines.join("\n");
  }

  if (result.kind === "matched_multi") {
    lines.push(
      `- Status: **matched_multi** (total ${fmtMNT(result.proposal.totalAmount)})`,
    );
    for (const p of result.proposal.proposals) {
      const name = studentNamesById.get(p.studentId) ?? `student #${p.studentId}`;
      lines.push(`  - → ${name}`);
      for (const al of p.allocations) {
        const ch = chargesById.get(al.chargeId);
        lines.push(
          `    - alloc charge #${al.chargeId} "${ch?.feeName ?? "?"}" ${fmtMNT(al.amount)}`,
        );
      }
    }
    return lines.join("\n");
  }

  const label = result.kind === "matched" ? "matched" : "low_confidence";
  lines.push(`- Status: **${label}** (${result.proposals.length} proposal(s))`);
  for (const p of result.proposals) {
    const name = studentNamesById.get(p.studentId) ?? `student #${p.studentId}`;
    const sigs = [...p.signals].join(", ");
    const flags = [...p.flags].join(", ");
    lines.push(
      `  - → ${name} | signals: ${sigs || "(none)"}${flags ? ` | flags: ${flags}` : ""}`,
    );
    for (const al of p.allocations) {
      const ch = chargesById.get(al.chargeId);
      lines.push(
        `    - alloc charge #${al.chargeId} "${ch?.feeName ?? "?"}" ${fmtMNT(al.amount)}`,
      );
    }
    if (p.proposedCharge) {
      lines.push(
        `    - proposes NEW charge "${p.proposedCharge.feeName}" ${fmtMNT(
          p.proposedCharge.amount,
        )} (${p.proposedCharge.reason})`,
      );
    }
    if (p.allocations.length === 0 && !p.proposedCharge) {
      lines.push(`    - (no allocation)`);
    }
  }
  return lines.join("\n");
}

function countBy<T>(items: T[], key: (t: T) => string): Array<[string, number]> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

async function main(): Promise<void> {
  console.log(`Reading bank file: ${bankAbsPath}`);
  const txs = readBankFile(bankAbsPath);
  console.log(`Parsed ${txs.length} transaction rows.`);

  console.log(`Loading matching context...`);
  const { period, input } = await loadMatchingContextInput();
  console.log(
    `  year=${period.yearName} (id=${period.yearId}), term=${period.termName} (id=${period.termId})`,
  );
  console.log(
    `  students=${input.students.length} enrollments=${input.enrollments.length} open_charges=${input.openCharges.length}`,
  );

  const context = buildMatchingContext(input);

  const studentNamesById = new Map<number, string>();
  for (const s of input.students) {
    studentNamesById.set(s.id, `${s.firstName} ${s.lastName}`.trim());
  }
  const chargesById = new Map<number, ChargeWithBalance & { studentId: number }>();
  for (const c of input.openCharges) chargesById.set(c.id, c);

  console.log(`Matching ${txs.length} rows...`);
  const analyses: RowAnalysis[] = txs.map((tx) => {
    const result: MatchResult = match(tx, context);
    return analyzeRow(tx, result, context);
  });

  // Rows that never reach matching (outgoing, bank fees, own-account transfers)
  // are excluded from every rate below — in production the parser drops them at
  // upload, so counting them would flatter the numbers.
  const incoming = analyses.filter((a) => a.tier !== null);
  const filtered = analyses.length - incoming.length;
  const confident = incoming.filter((a) => a.tier === "confident");
  const attention = incoming.filter((a) => a.tier === "attention");

  const kindCounts = countBy(incoming, (a) => a.result.kind);
  const reasonCounts = countBy(attention, (a) => a.reason);
  const unmatchedReasons = countBy(
    incoming.filter((a) => a.result.kind === "unmatched"),
    (a) => (a.result.kind === "unmatched" ? a.result.reason : ""),
  );
  const stageCounts = countBy(incoming, (a) => {
    const parts: string[] = [];
    if (a.stages.class) parts.push("class");
    else if (a.stages.wildcard) parts.push("wildcard");
    else if (a.stages.level) parts.push("level");
    if (a.stages.name) parts.push("name");
    if (a.stages.fee) parts.push("fee");
    return parts.length > 0 ? parts.join("+") : "(no signal)";
  });

  const pct = (n: number) =>
    incoming.length === 0 ? "0%" : `${Math.round((n / incoming.length) * 100)}%`;

  const header: string[] = [
    "# Bank Transaction Matching — Dry Run",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Source: \`${bankPathArg}\``,
    `- Academic year: ${period.yearName} (id=${period.yearId}), term: ${period.termName} (id=${period.termId})`,
    `- Students=${input.students.length}, enrollments=${input.enrollments.length}, open charges=${input.openCharges.length}`,
    `- Rows: ${txs.length} (${filtered} filtered before matching, ${incoming.length} incoming)`,
    "",
    "## Summary — what the reviewer sees",
    "",
    `- confident (bulk-confirmable): ${confident.length} / ${incoming.length} (${pct(confident.length)})`,
    `- attention (needs a human): ${attention.length} / ${incoming.length} (${pct(attention.length)})`,
    "",
    "Attention reasons:",
    ...reasonCounts.map(([r, n]) => `- ${r}: ${n}`),
    "",
    "Raw MatchResult kinds (incoming only):",
    ...kindCounts.map(([k, n]) => `- ${k}: ${n}`),
  ];
  if (unmatchedReasons.length > 0) {
    header.push("", "Unmatched reasons:");
    for (const [r, n] of unmatchedReasons) header.push(`- ${r}: ${n}`);
  }
  header.push(
    "",
    "## Stage coverage",
    "",
    "Which stages produced evidence, per incoming row (grade stage collapses to its",
    "strongest hit: class > wildcard > level).",
    "",
    ...stageCounts.map(([s, n]) => `- ${s}: ${n}`),
    "",
    "## Rows",
    "",
  );

  const sections = analyses.map((a, i) =>
    describeResult(a, i, studentNamesById, chargesById),
  );
  writeFileSync(
    resolve(process.cwd(), REPORT_PATH),
    [...header, sections.join("\n\n")].join("\n"),
    "utf-8",
  );

  const csv: string[] = [
    "row,amount,memo,sender_account,tier,reason,result_kind,stage_class,stage_wildcard,stage_level,stage_name,stage_fee,top_student,allocations",
  ];
  analyses.forEach((a, i) => {
    csv.push(
      [
        String(i + 1),
        String(a.tx.amount),
        csvEscape(a.tx.memo ?? ""),
        csvEscape(a.tx.senderAccount ?? ""),
        a.tier ?? "filtered",
        a.reason,
        a.result.kind,
        String(a.stages.class),
        String(a.stages.wildcard),
        String(a.stages.level),
        String(a.stages.name),
        String(a.stages.fee),
        csvEscape(
          a.topStudentId === null
            ? ""
            : (studentNamesById.get(a.topStudentId) ?? String(a.topStudentId)),
        ),
        String(a.allocationCount),
      ].join(","),
    );
  });
  writeFileSync(resolve(process.cwd(), CSV_PATH), csv.join("\n"), "utf-8");

  console.log(`Report written to ${REPORT_PATH}`);
  console.log(`CSV written to ${CSV_PATH}`);
  console.log(
    JSON.stringify(
      {
        incoming: incoming.length,
        confident: confident.length,
        attention: attention.length,
        filtered,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
