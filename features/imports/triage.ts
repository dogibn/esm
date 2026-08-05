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

/**
 * A sibling split that meets the same bar as a confident single: every child
 * resolved uniquely (the splitter guarantees that), every share fully allocated
 * against charges that already exist, nothing but benign flags, and the shares
 * together covering the whole transfer. Charge-creating splits (a bus fee per
 * child) stay out — writing charges to the ledger remains opt-in, same as the
 * Missing fee group.
 */
export function isConfidentMulti(
  result: MatchResultWire,
  txAmount: number,
): boolean {
  if (result.kind !== "matched_multi") return false;
  const ps = result.proposal.proposals;
  if (ps.length < 2) return false;
  let total = 0;
  for (const p of ps) {
    if (p.proposedCharge) return false;
    if (p.allocations.length === 0) return false;
    if (p.allocations.some((a) => a.chargeId <= 0)) return false;
    if (!p.flags.every((f) => BENIGN_FLAGS.has(f))) return false;
    total += sumAllocations(p);
  }
  return total === txAmount;
}

export function classifyProposal(
  result: MatchResultWire,
  txAmount: number,
): ProposalTier {
  if (isConfidentMulti(result, txAmount)) return "confident";
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
// Inline edit state — a list of charge lines, each naming its own student. A
// transfer paying two children is the same shape as one paying two of a single
// child's fees, which is why the student sits on the line rather than above it.
// The row controls this; ReviewTable owns the map so bulk confirm reads live
// edits.
//
// Invariant: at least one line. A row with nothing filled in holds one blank
// line, so the editor always has a student and charge cell to render.
// ----------------------------------------------------------------------

export type ChargeLine = {
  studentId: number;
  chargeId: number;
  amount: number;
  /**
   * A fee to create for this line's student as part of confirming — the bus
   * case, where the school has a rate but no Charge row. It stays on the line
   * while that student does, even if the charge cell currently points at a real
   * charge, so switching back to "+ Add bus" remains possible. The line pays it
   * by carrying `chargeId: NEW_CHARGE_PLACEHOLDER_ID`; the server swaps in the
   * real id once the charge exists.
   */
  newCharge?: ProposedChargeWire;
};
export type RowEdit = { lines: ChargeLine[] };

/** An empty line to start from, taking the whole transfer. */
export function blankLine(amount: number): ChargeLine {
  return { studentId: 0, chargeId: 0, amount };
}

/** Does this line bring a charge into existence when confirmed? */
export function lineCreatesCharge(line: ChargeLine): boolean {
  return line.chargeId === NEW_CHARGE_PLACEHOLDER_ID && line.newCharge !== undefined;
}

/** Does this edit pay a charge that doesn't exist yet? */
export function editCreatesCharge(edit: RowEdit): boolean {
  return edit.lines.some(lineCreatesCharge);
}

/**
 * The proposals the editor is seeded from: a sibling split contributes every
 * child, anything else its best candidate. Alternatives are offered separately
 * (see `resultCandidates`) rather than stacked into the same edit.
 */
function seedProposals(result: MatchResultWire): MatchProposalWire[] {
  switch (result.kind) {
    case "matched":
    case "low_confidence":
      return result.proposals.slice(0, 1);
    case "matched_multi":
      return result.proposal.proposals;
    case "unmatched":
      return [];
  }
}

/** The edit lines a single proposal contributes, one per allocated charge. */
export function proposalLines(p: MatchProposalWire, fallbackAmount: number): ChargeLine[] {
  if (p.allocations.length === 0) {
    // A student with no charge picked yet — keep the student, leave the charge
    // cell empty rather than dropping the match the matcher did make.
    return [{ studentId: p.studentId, chargeId: 0, amount: fallbackAmount }];
  }
  return p.allocations.map((a) => ({
    studentId: p.studentId,
    chargeId: a.chargeId,
    amount: a.amount,
    ...(p.proposedCharge ? { newCharge: p.proposedCharge } : {}),
  }));
}

/** Seed the inline editor from a match result. */
export function proposalToEdit(item: ProposalListItemWire): RowEdit {
  const amount = item.transactionPreview.amount;
  const proposals = seedProposals(item.result);
  if (proposals.length === 0) return { lines: [blankLine(amount)] };
  // One proposal splitting the transfer between charges keeps the whole amount
  // on its single line; several proposals each hold their own share already.
  // A lone proposal with nothing allocated yet may as well claim the whole
  // transfer; one child of a split must not, or the shares would overshoot.
  const fallback = proposals.length === 1 ? amount : 0;
  const lines = proposals.flatMap((p) => proposalLines(p, fallback));
  return { lines: lines.length > 0 ? lines : [blankLine(amount)] };
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
      studentId: l.studentId,
      chargeId: l.chargeId,
      amount: l.amount,
    })),
  };
  // One fee per student, matching what the confirm endpoint accepts — two lines
  // for the same child's new fee are rejected before we get here.
  const createCharges = edit.lines.filter(lineCreatesCharge).map((l) => ({
    studentId: l.studentId,
    feeName: l.newCharge!.feeName,
    amount: l.newCharge!.amount,
    scope: l.newCharge!.scope,
    academicTermId: l.newCharge!.academicTermId,
  }));
  if (createCharges.length > 0) values.createCharges = createCharges;
  return values;
}

/**
 * Whether the current inline edit can be confirmed: every line names a student,
 * a charge and a positive amount; no charge is paid twice; and the amounts sum
 * to the transaction amount (the full transfer must be allocated).
 *
 * A line against a not-yet-created charge is legitimate, but only while the
 * line still carries the fee to create — switching that line's student clears
 * it, and a dangling placeholder must not be confirmable. Two placeholder lines
 * for one student are rejected too: both would resolve to the same new charge.
 */
export function isEditConfirmable(edit: RowEdit, txAmount: number): boolean {
  if (edit.lines.length === 0) return false;
  for (const l of edit.lines) {
    if (l.studentId <= 0) return false;
    if (l.amount <= 0) return false;
    if (l.chargeId === NEW_CHARGE_PLACEHOLDER_ID) {
      if (!l.newCharge) return false;
    } else if (l.chargeId <= 0) {
      return false;
    }
  }
  const realIds = edit.lines
    .map((l) => l.chargeId)
    .filter((id) => id !== NEW_CHARGE_PLACEHOLDER_ID);
  if (new Set(realIds).size !== realIds.length) return false;
  const newFeeStudents = edit.lines
    .filter((l) => l.chargeId === NEW_CHARGE_PLACEHOLDER_ID)
    .map((l) => l.studentId);
  if (new Set(newFeeStudents).size !== newFeeStudents.length) return false;
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

/**
 * Every candidate student the matcher considered, best first, to one-click
 * apply. The top candidate is included rather than dropped as "the one already
 * filled in": once a reviewer tries an alternative, the original is the thing
 * they most often want back, and slicing it off left no way to return to it.
 */
export function resultCandidates(result: MatchResultWire): MatchProposalWire[] {
  switch (result.kind) {
    case "matched":
    case "low_confidence":
      return result.proposals;
    case "matched_multi":
    case "unmatched":
      return [];
  }
}
