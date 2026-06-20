/**
 * Dry-run the matching pipeline against a bank Excel file.
 *
 * Reads the bank file (default: features/imports/data/bank_transaction.xlsx),
 * pulls the matching context via the shared loader, runs match() on each
 * transaction, and writes a markdown report to scripts/reports/matching_dry_run.md.
 *
 * No DB writes. No payments persisted.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/qa/dry_run_matching.ts [bank.xlsx]
 *
 * Required env vars: DATABASE_URL (and the rest validated by @/lib/env).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import * as XLSX from "xlsx";

import { buildMatchingContext, match } from "@/features/imports/matching";
import { loadMatchingContextInput } from "@/features/imports/matching/load-context";
import type {
  BankTransactionInput,
  ChargeWithBalance,
  MatchResult,
} from "@/features/imports/matching";

const DEFAULT_BANK_PATH = "features/imports/data/bank_transaction.xlsx";
const REPORT_PATH = "scripts/reports/matching_dry_run.md";

// --------------------------- CLI / env ---------------------------
const bankPathArg = process.argv[2] ?? DEFAULT_BANK_PATH;
const bankAbsPath = resolve(process.cwd(), bankPathArg);
if (!existsSync(bankAbsPath)) {
  console.error(`ERROR: bank file not found at ${bankAbsPath}.`);
  console.error(`Place the file at the default path or pass it as the first argument.`);
  process.exit(1);
}

// --------------------------- bank file ---------------------------
function readBankFile(path: string): BankTransactionInput[] {
  const buf = readFileSync(path);
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: null,
  });
  if (rows.length === 0) return [];

  // Detect column names by inspecting the first row.
  const sampleKeys = Object.keys(rows[0]!);
  const find = (...candidates: RegExp[]): string | null => {
    for (const re of candidates) {
      const hit = sampleKeys.find((k) => re.test(k));
      if (hit) return hit;
    }
    return null;
  };

  const memoCol = find(
    /memo/i,
    /^утга$/i,
    /гүйлгээний\s*утга/i,
    /utga/i,
    /description/i,
    /narration/i,
  );
  const amountInCol = find(/орлого/i, /credit/i, /income/i, /^amount$/i, /amount.*in/i);
  const amountOutCol = find(/зарлага/i, /debit/i, /expense/i, /amount.*out/i);
  const senderAccCol = find(
    /харьцсан\s*данс/i,
    /sender.*account/i,
    /from.*account/i,
    /дансны\s*дугаар/i,
    /данс.*дугаар/i,
    /account.*no/i,
  );
  const senderNameCol = find(/sender.*name/i, /from.*name/i, /дансны\s*нэр/i, /данс.*нэр/i);
  const txIdCol = find(/transaction.*id/i, /журнал/i, /гүйлгээний\s*дугаар/i, /reference/i, /tx.*id/i);

  console.log(
    `Column map: memo=${memoCol} in=${amountInCol} out=${amountOutCol} senderAcc=${senderAccCol} senderName=${senderNameCol} txId=${txIdCol}`,
  );

  const result: BankTransactionInput[] = [];
  for (const row of rows) {
    const memo = strVal(memoCol ? row[memoCol] : null);
    const amtIn = numVal(amountInCol ? row[amountInCol] : null);
    const amtOut = numVal(amountOutCol ? row[amountOutCol] : null);
    const senderAccount = strVal(senderAccCol ? row[senderAccCol] : null);
    const senderName = strVal(senderNameCol ? row[senderNameCol] : null);
    const isOutgoing = amtOut !== null && amtOut > 0;
    const amount = BigInt(Math.round(amtIn ?? amtOut ?? 0));
    void txIdCol;
    result.push({
      memo: memo ?? "",
      amount,
      senderAccount,
      senderAccountName: senderName,
      isOutgoing,
    });
  }
  return result;
}

function strVal(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}
function numVal(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// --------------------------- report ---------------------------
function fmtMNT(n: bigint): string {
  return n.toLocaleString("en-US") + " MNT";
}

function describeResult(
  tx: BankTransactionInput,
  result: MatchResult,
  index: number,
  studentNamesById: Map<number, string>,
  chargesById: Map<number, ChargeWithBalance & { studentId: number }>,
): string {
  const header = `### Row ${index + 1} — ${fmtMNT(tx.amount)}`;
  const memoLine = `- Memo: \`${tx.memo ?? ""}\``;
  const senderLine = `- Sender: ${tx.senderAccount ?? "(none)"} ${
    tx.senderAccountName ? `(${tx.senderAccountName})` : ""
  }`.trimEnd();

  const lines: string[] = [header, memoLine, senderLine];

  if (result.kind === "unmatched") {
    lines.push(`- Status: **unmatched** (${result.reason})`);
    return lines.join("\n");
  }

  if (result.kind === "matched_multi") {
    lines.push(`- Status: **matched_multi** (total ${fmtMNT(result.proposal.totalAmount)})`);
    for (const p of result.proposal.proposals) {
      const name = studentNamesById.get(p.studentId) ?? `student #${p.studentId}`;
      lines.push(`  - → ${name}`);
      for (const a of p.allocations) {
        const ch = chargesById.get(a.chargeId);
        lines.push(
          `    - alloc charge #${a.chargeId} "${ch?.feeName ?? "?"}" ${fmtMNT(a.amount)}`,
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
    lines.push(`  - → ${name} | signals: ${sigs || "(none)"}${flags ? ` | flags: ${flags}` : ""}`);
    for (const a of p.allocations) {
      const ch = chargesById.get(a.chargeId);
      lines.push(
        `    - alloc charge #${a.chargeId} "${ch?.feeName ?? "?"}" ${fmtMNT(a.amount)}`,
      );
    }
    if (p.allocations.length === 0) {
      lines.push(`    - (no allocation)`);
    }
  }
  return lines.join("\n");
}

// --------------------------- main ---------------------------
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
  const summary = { matched: 0, matched_multi: 0, low_confidence: 0, unmatched: 0 };
  const reasonCounts = new Map<string, number>();
  const reportSections: string[] = [];
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i]!;
    const result = match(tx, context);
    switch (result.kind) {
      case "matched":
        summary.matched++;
        break;
      case "matched_multi":
        summary.matched_multi++;
        break;
      case "low_confidence":
        summary.low_confidence++;
        break;
      case "unmatched":
        summary.unmatched++;
        reasonCounts.set(result.reason, (reasonCounts.get(result.reason) ?? 0) + 1);
        break;
    }
    reportSections.push(describeResult(tx, result, i, studentNamesById, chargesById));
  }

  const reportHeader: string[] = [
    "# Bank Transaction Matching — Dry Run",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Source: \`${bankPathArg}\``,
    `- Academic year: ${period.yearName} (id=${period.yearId}), term: ${period.termName} (id=${period.termId})`,
    `- Students=${input.students.length}, enrollments=${input.enrollments.length}, open charges=${input.openCharges.length}`,
    `- Rows: ${txs.length}`,
    "",
    "## Summary",
    "",
    `- matched: ${summary.matched}`,
    `- matched_multi: ${summary.matched_multi}`,
    `- low_confidence: ${summary.low_confidence}`,
    `- unmatched: ${summary.unmatched}`,
  ];
  if (reasonCounts.size > 0) {
    reportHeader.push("");
    reportHeader.push("Unmatched reasons:");
    for (const [r, n] of reasonCounts) reportHeader.push(`- ${r}: ${n}`);
  }
  reportHeader.push("", "## Rows", "");

  const reportText = [...reportHeader, reportSections.join("\n\n")].join("\n");
  const reportAbs = resolve(process.cwd(), REPORT_PATH);
  writeFileSync(reportAbs, reportText, "utf-8");
  console.log(`Report written to ${reportAbs}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
