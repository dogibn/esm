import { NEW_CHARGE_PLACEHOLDER_ID } from "./matching";
import type { AllocationFlag, SignalKind } from "./matching";
import type { AllocationFormValues } from "./schemas";
import type {
  MatchProposalWire,
  MatchResultWire,
  ProposalListItemWire,
  ProposedChargeWire,
} from "./types";

// Two-tier triage over match results. Confident means "a reviewer would confirm
// this without thinking about it": one student clearly ahead of any alternative,
// and an allocation that accounts for the whole transfer. Everything else needs
// a human and lands in the attention tier.

export type ProposalTier = "confident" | "attention";

export type AttentionReason =
  | "unmatched"
  | "low_confidence"
  | "multi_student"
  | "multiple_candidates"
  | "flagged"
  | "missing_charge"
  | "not_student"
  | "unbalanced";

export function sumAllocations(p: MatchProposalWire): number {
  return p.allocations.reduce((sum, a) => sum + a.amount, 0);
}

/**
 * How far ahead the top candidate must be before its alternatives stop counting
 * as competition. Surfacing alternatives is useful — every near-miss is one
 * click away — but without this, listing them at all would drag every row with
 * a common first name into manual review.
 */
const DOMINANCE_RATIO = 1.5;

/**
 * Flags that describe a payment the school sees every day rather than a problem
 * to investigate. A partial payment of a single open charge is what installment
 * payers do; it needs recording, not deciding.
 */
const BENIGN_FLAGS: ReadonlySet<string> = new Set(["partial_payment"]);

/**
 * "We read the fee off the amount rather than off the memo." Tolerable only
 * when the student is beyond doubt — the inference itself is sound (nothing but
 * tuition costs millions, and the matcher only draws it when the student has
 * exactly one open tuition charge), so what remains at risk is *who* paid.
 */
const INFERRED_FEE_FLAG = "fee_inferred_from_amount";
const INFERRED_FEE_MIN_SCORE = 1.2;

function flagsAcceptable(p: MatchProposalWire): boolean {
  return p.flags.every(
    (f) =>
      BENIGN_FLAGS.has(f) ||
      (f === INFERRED_FEE_FLAG && p.score >= INFERRED_FEE_MIN_SCORE),
  );
}

function dominatesAlternatives(proposals: MatchProposalWire[]): boolean {
  const [top, ...rest] = proposals;
  if (!top) return false;
  if (rest.length === 0) return true;
  const runnerUp = Math.max(...rest.map((p) => p.score));
  if (runnerUp <= 0) return true;
  return top.score >= runnerUp * DOMINANCE_RATIO;
}

/**
 * The confident proposal for a result, or null. Confident =
 *  - the top candidate is clearly ahead of any alternative,
 *  - every allocated charge exists (nothing to create first),
 *  - the allocation covers exactly the transaction amount, and
 *  - no flag beyond the benign ones above.
 */
export function confidentProposal(
  result: MatchResultWire,
  txAmount: number,
): MatchProposalWire | null {
  if (result.kind !== "matched") return null;
  const p = result.proposals[0];
  if (!p) return null;
  if (!dominatesAlternatives(result.proposals)) return null;
  if (p.proposedCharge) return null;
  if (!flagsAcceptable(p)) return null;
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
      return result.reason === "not_student" ? "not_student" : "unmatched";
    case "low_confidence":
      return "low_confidence";
    case "matched_multi":
      return "multi_student";
    case "matched": {
      const p = result.proposals[0];
      if (!p) return "unbalanced";
      // Ordered by what the reviewer has to do about it: create a charge, pick
      // between students, fix the amounts, or just check a flag.
      if (p.proposedCharge) return "missing_charge";
      if (!dominatesAlternatives(result.proposals)) return "multiple_candidates";
      if (p.allocations.length === 0 || sumAllocations(p) !== txAmount) {
        return "unbalanced";
      }
      return "flagged";
    }
  }
}

/**
 * Attention reasons in the order they are worth working through: rows where a
 * person picks between named students first, rows where the numbers need fixing
 * next, and the ones where the matcher has nothing to offer last.
 *
 * `missing_charge` and `not_student` are absent on purpose — those rows have
 * their own sections and bulk actions in the review screen.
 */
export const ATTENTION_REASON_ORDER: AttentionReason[] = [
  "multiple_candidates",
  "multi_student",
  "unbalanced",
  "flagged",
  "low_confidence",
  "unmatched",
  "missing_charge",
  "not_student",
];

export type AttentionGroup = {
  reason: AttentionReason;
  items: ProposalListItemWire[];
};

/**
 * Bucket attention rows by why they need a human.
 *
 * The reason used to be a badge on every row, which repeated the same short
 * phrase down the whole list. Saying it once per group costs a heading and
 * gives every row its width back.
 *
 * Empty groups are dropped, so the caller renders exactly what exists.
 */
export function groupByAttentionReason(
  items: ProposalListItemWire[],
): AttentionGroup[] {
  const byReason = new Map<AttentionReason, ProposalListItemWire[]>();
  for (const item of items) {
    const reason = attentionReason(item.result, item.transactionPreview.amount);
    const bucket = byReason.get(reason);
    if (bucket) bucket.push(item);
    else byReason.set(reason, [item]);
  }
  const groups: AttentionGroup[] = [];
  for (const reason of ATTENTION_REASON_ORDER) {
    const bucket = byReason.get(reason);
    if (bucket && bucket.length > 0) groups.push({ reason, items: bucket });
  }
  // Anything the order list doesn't mention still gets shown rather than lost.
  for (const [reason, bucket] of byReason) {
    if (!ATTENTION_REASON_ORDER.includes(reason)) groups.push({ reason, items: bucket });
  }
  return groups;
}

// ----------------------------------------------------------------------
// Inline edit state — one student, one or more charges (a split). The row
// controls this; ReviewTable owns the map so bulk confirm reads live edits.
// ----------------------------------------------------------------------

export type ChargeLine = { chargeId: number; amount: number };
export type RowEdit = {
  studentId: number;
  lines: ChargeLine[];
  /**
   * A fee to create for this student as part of confirming. Lines that pay it
   * carry `chargeId: NEW_CHARGE_PLACEHOLDER_ID`; the server swaps in the real
   * id once the charge exists.
   */
  newCharge?: ProposedChargeWire;
};

/** Does this edit pay a charge that doesn't exist yet? */
export function editCreatesCharge(edit: RowEdit): boolean {
  return (
    edit.newCharge !== undefined &&
    edit.lines.some((l) => l.chargeId === NEW_CHARGE_PLACEHOLDER_ID)
  );
}

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
  const edit: RowEdit = {
    studentId: p.studentId,
    lines: p.allocations.map((a) => ({ chargeId: a.chargeId, amount: a.amount })),
  };
  if (p.proposedCharge) edit.newCharge = p.proposedCharge;
  return edit;
}

export function editSum(edit: RowEdit): number {
  return edit.lines.reduce((s, l) => s + l.amount, 0);
}

export function editToLines(
  bankTransactionId: number,
  edit: RowEdit,
): AllocationFormValues {
  const values: AllocationFormValues = {
    bankTransactionId,
    lines: edit.lines.map((l) => ({
      studentId: edit.studentId,
      chargeId: l.chargeId,
      amount: l.amount,
    })),
  };
  if (editCreatesCharge(edit)) {
    const c = edit.newCharge!;
    values.createCharges = [
      {
        studentId: edit.studentId,
        feeName: c.feeName,
        amount: c.amount,
        scope: c.scope,
        academicTermId: c.academicTermId,
      },
    ];
  }
  return values;
}

/**
 * Whether the current inline edit can be confirmed: a student, at least one
 * charge, no duplicate/blank charges or amounts, and the amounts sum to the
 * transaction amount (the full transfer must be allocated).
 *
 * A line against a not-yet-created charge is legitimate, but only while the
 * edit still carries the fee to create — switching the student clears it, and
 * a dangling placeholder must not be confirmable.
 */
export function isEditConfirmable(edit: RowEdit, txAmount: number): boolean {
  if (edit.studentId <= 0) return false;
  if (edit.lines.length === 0) return false;
  const placeholders = edit.lines.filter(
    (l) => l.chargeId === NEW_CHARGE_PLACEHOLDER_ID,
  );
  if (placeholders.length > 0 && !edit.newCharge) return false;
  if (placeholders.length > 1) return false;
  if (
    edit.lines.some(
      (l) =>
        (l.chargeId <= 0 && l.chargeId !== NEW_CHARGE_PLACEHOLDER_ID) || l.amount <= 0,
    )
  ) {
    return false;
  }
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
  memo_name_initial: "memo_name",
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
