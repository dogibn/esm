import type { AllocationFlag, SignalKind } from "./matching";
import type { AllocationFormValues } from "./schemas";
import type {
  MatchProposalWire,
  MatchResultWire,
  ProposalListItemWire,
} from "./types";

// Two-tier triage over match results. The confident tier is deliberately
// conservative: a single unambiguous, balanced, flag-free auto-match to ONE
// charge (so the inline single-charge editor faithfully represents it).
// Everything else needs a human and lands in the attention tier.

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
 * The single confident proposal for a result, or null. Confident = exactly one
 * candidate, exactly one allocation, that allocation equals the transaction
 * amount, and no flags.
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
  if (p.allocations.length !== 1) return null;
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
      // A single flag-free multi-allocation match reaches here — needs a look.
      return "flagged";
    }
  }
}

// ----------------------------------------------------------------------
// Inline edit state — one student, one or more charges (a split). The row
// controls this; ReviewTable owns the map so bulk confirm reads live edits.
// ----------------------------------------------------------------------

export type ChargeLine = { chargeId: number; amount: number };
export type RowEdit = { studentId: number; lines: ChargeLine[] };

function firstProposal(result: MatchResultWire): MatchProposalWire | null {
  switch (result.kind) {
    case "matched":
    case "low_confidence":
      return result.proposals[0] ?? null;
    case "matched_multi":
      return result.proposal.proposals[0] ?? null;
    case "unmatched":
      return null;
  }
}

/** Seed the inline editor from a proposal's top single-student allocation. */
export function proposalToEdit(item: ProposalListItemWire): RowEdit {
  const p = firstProposal(item.result);
  if (!p) return { studentId: 0, lines: [] };
  return {
    studentId: p.studentId,
    lines: p.allocations.map((a) => ({ chargeId: a.chargeId, amount: a.amount })),
  };
}

export function editSum(edit: RowEdit): number {
  return edit.lines.reduce((s, l) => s + l.amount, 0);
}

export function editToLines(
  bankTransactionId: number,
  edit: RowEdit,
): AllocationFormValues {
  return {
    bankTransactionId,
    lines: edit.lines.map((l) => ({
      studentId: edit.studentId,
      chargeId: l.chargeId,
      amount: l.amount,
    })),
  };
}

/**
 * Whether the current inline edit can be confirmed: a student, at least one
 * charge, no duplicate/blank charges or amounts, and the amounts sum to the
 * transaction amount (the full transfer must be allocated).
 */
export function isEditConfirmable(edit: RowEdit, txAmount: number): boolean {
  if (edit.studentId <= 0) return false;
  if (edit.lines.length === 0) return false;
  if (edit.lines.some((l) => l.chargeId <= 0 || l.amount <= 0)) return false;
  const ids = edit.lines.map((l) => l.chargeId);
  if (new Set(ids).size !== ids.length) return false;
  return editSum(edit) === txAmount;
}

// ----------------------------------------------------------------------
// Matching explanation — for the read-only info panel.
// ----------------------------------------------------------------------

export type SignalCategory = "memo_grade" | "memo_name" | "account" | "amount";

const SIGNAL_CATEGORY: Record<SignalKind, SignalCategory | null> = {
  memo_grade_class: "memo_grade",
  memo_grade_wildcard: "memo_grade",
  memo_grade_level: "memo_grade",
  memo_name_full: "memo_name",
  memo_name_partial: "memo_name",
  memo_name_fuzzy: "memo_name",
  sender_account: "account",
  fee_hint_from_amount: "amount",
  fee_inferred_from_amount: "amount",
  fee_hint_explicit: null,
};

export function rollupSignals(signals: SignalKind[]): SignalCategory[] {
  const out = new Set<SignalCategory>();
  for (const s of signals) {
    const cat = SIGNAL_CATEGORY[s];
    if (cat) out.add(cat);
  }
  return [...out];
}

export function resultSignals(result: MatchResultWire): SignalKind[] {
  const out = new Set<SignalKind>();
  const collect = (ps: MatchProposalWire[]) => {
    for (const p of ps) for (const s of p.signals) out.add(s);
  };
  switch (result.kind) {
    case "matched":
    case "low_confidence":
      collect(result.proposals);
      break;
    case "matched_multi":
      collect(result.proposal.proposals);
      break;
    case "unmatched":
      break;
  }
  return [...out];
}

export function resultFlags(result: MatchResultWire): AllocationFlag[] {
  const out = new Set<AllocationFlag>();
  const collect = (ps: MatchProposalWire[]) => {
    for (const p of ps) for (const f of p.flags) out.add(f);
  };
  switch (result.kind) {
    case "matched":
    case "low_confidence":
      collect(result.proposals);
      break;
    case "matched_multi":
      collect(result.proposal.proposals);
      break;
    case "unmatched":
      break;
  }
  return [...out];
}

/** Alternative candidate students (proposals beyond the first) to one-click apply. */
export function resultAlternatives(result: MatchResultWire): MatchProposalWire[] {
  switch (result.kind) {
    case "matched":
    case "low_confidence":
      return result.proposals.slice(1);
    case "matched_multi":
    case "unmatched":
      return [];
  }
}
