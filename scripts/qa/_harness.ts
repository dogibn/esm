/**
 * Shared plumbing for the matching QA scripts.
 *
 * `dry_run_matching.ts` (aggregate report over a bank file) and
 * `score_matching.ts` (precision against hand-labelled cases) both need to read
 * a bank workbook, build the matching context, and describe a MatchResult in
 * reviewer terms. That lives here so the two scripts can never disagree about
 * what "confident" means.
 *
 * Reviewer terms = `features/imports/triage.ts`. The dry run reports the tier
 * the accountant actually sees in the UI, not just the raw MatchResult kind —
 * otherwise "matched" reads as success while the row still needs a human.
 */
import { readFileSync } from "node:fs";

import * as XLSX from "xlsx";

import { extractSignals } from "@/features/imports/matching/extract-signals";
import { matchResultToWire } from "@/features/imports/types";
import { attentionReason, classifyProposal } from "@/features/imports/triage";
import type {
  BankTransactionInput,
  MatchResult,
  MatchingContext,
} from "@/features/imports/matching";

// --------------------------- bank file ---------------------------

export function readBankFile(path: string): BankTransactionInput[] {
  const buf = readFileSync(path);
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: null,
  });
  if (rows.length === 0) return [];

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

  const result: BankTransactionInput[] = [];
  for (const row of rows) {
    const memo = strVal(memoCol ? row[memoCol] : null);
    const amtIn = numVal(amountInCol ? row[amountInCol] : null);
    const amtOut = numVal(amountOutCol ? row[amountOutCol] : null);
    const senderAccount = strVal(senderAccCol ? row[senderAccCol] : null);
    const senderName = strVal(senderNameCol ? row[senderNameCol] : null);
    const isOutgoing = amtOut !== null && amtOut > 0;
    result.push({
      memo: memo ?? "",
      amount: BigInt(Math.round(amtIn ?? amtOut ?? 0)),
      senderAccount,
      senderAccountName: senderName,
      isOutgoing,
    });
  }
  return result;
}

export function strVal(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export function numVal(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function fmtMNT(n: bigint): string {
  return n.toLocaleString("en-US") + " MNT";
}

// --------------------------- per-row analysis ---------------------------

/** Which pipeline stages produced usable evidence for one transaction. */
export type StageHits = {
  class: boolean;
  level: boolean;
  wildcard: boolean;
  name: boolean;
  fee: boolean;
};

export type RowAnalysis = {
  tx: BankTransactionInput;
  result: MatchResult;
  /** Reviewer-facing tier, or null for rows filtered before matching. */
  tier: "confident" | "attention" | null;
  reason: string;
  stages: StageHits;
  topStudentId: number | null;
  allocationCount: number;
};

export function analyzeRow(
  tx: BankTransactionInput,
  result: MatchResult,
  context: MatchingContext,
): RowAnalysis {
  const signals = extractSignals(tx.memo ?? "", tx.amount, context);
  const stages: StageHits = {
    class: signals.gradeTokens.class.length > 0,
    level: signals.gradeTokens.level.length > 0,
    wildcard: signals.gradeTokens.wildcard.length > 0,
    name: signals.nameTokens.length > 0,
    fee: signals.feeHints.explicit.length > 0 || signals.feeHints.fromAmount !== null,
  };

  const filtered = result.kind === "unmatched" && result.reason === "filtered";
  const wire = matchResultToWire(result);
  const amount = Number(tx.amount);
  const tier = filtered ? null : classifyProposal(wire, amount);
  const reason =
    tier === "confident" ? "confident" : filtered ? "filtered" : attentionReason(wire, amount);

  const proposals =
    result.kind === "matched" || result.kind === "low_confidence"
      ? result.proposals
      : result.kind === "matched_multi"
        ? result.proposal.proposals
        : [];
  const top = proposals[0] ?? null;

  return {
    tx,
    result,
    tier,
    reason,
    stages,
    topStudentId: top?.studentId ?? null,
    allocationCount: top?.allocations.length ?? 0,
  };
}

export function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}
