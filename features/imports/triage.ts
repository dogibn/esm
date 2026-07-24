import type { AllocationFormValues } from "./schemas";
import type { MatchProposalWire, MatchResultWire } from "./types";

// Two-tier triage over match results. The confident tier is deliberately
// conservative: a single unambiguous, balanced, flag-free auto-match. Everything
// else needs a human, so it lands in the attention tier. See the import-UI redo
// notes in docs/user_flows.md.

export type ProposalTier = "confident" | "attention";

export type AttentionReason =
  | "unmatched"
  | "low_confidence"
  | "multi_student"
  | "multiple_candidates"
  | "flagged"
  | "unbalanced";

export function sumAllocations(p: MatchProposalWire): number {
  return p.allocations.reduce((sum, a) => sum + a.amount, 0);
}

/**
 * The single confident proposal for a result, or null if it isn't confident.
 * Confident = exactly one candidate, at least one allocation, allocations sum
 * to the transaction amount, and no flags.
 */
export function confidentProposal(
  result: MatchResultWire,
  txAmount: number,
): MatchProposalWire | null {
  if (result.kind !== "matched") return null;
  if (result.proposals.length !== 1) return null;
  const p = result.proposals[0];
  if (!p) return null;
  if (p.flags.length > 0) return null;
  if (p.allocations.length === 0) return null;
  if (sumAllocations(p) !== txAmount) return null;
  return p;
}

export function classifyProposal(
  result: MatchResultWire,
  txAmount: number,
): ProposalTier {
  return confidentProposal(result, txAmount) ? "confident" : "attention";
}

/** Why an attention row needs a human — drives the compact reason chip. */
export function attentionReason(
  result: MatchResultWire,
  txAmount: number,
): AttentionReason {
  switch (result.kind) {
    case "unmatched":
      return "unmatched";
    case "low_confidence":
      return "low_confidence";
    case "matched_multi":
      return "multi_student";
    case "matched": {
      if (result.proposals.length > 1) return "multiple_candidates";
      const p = result.proposals[0];
      if (p && p.flags.length > 0) return "flagged";
      if (!p || p.allocations.length === 0 || sumAllocations(p) !== txAmount) {
        return "unbalanced";
      }
      // Unreachable in practice (this shape classifies as confident).
      return "flagged";
    }
  }
}

/**
 * Turn a proposal into a confirm payload. Mirrors the AllocationForm's
 * pre-fill so bulk confirm and the manual editor agree on line construction.
 */
export function proposalToLines(
  bankTransactionId: number,
  p: MatchProposalWire,
): AllocationFormValues {
  if (p.allocations.length === 0) {
    return {
      bankTransactionId,
      lines: [{ studentId: p.studentId, chargeId: 0, amount: 0 }],
    };
  }
  return {
    bankTransactionId,
    lines: p.allocations.map((a) => ({
      studentId: p.studentId,
      chargeId: a.chargeId,
      amount: a.amount,
    })),
  };
}
