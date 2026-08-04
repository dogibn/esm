import { allocateCharges } from './allocate-charges';
import { buildMatchingContext } from './build-index';
import { extractSignals } from './extract-signals';
import { looksNonStudent, shouldAttemptMatch } from './filter';
import { detectMultiStudent, resolveStudent } from './resolve-student';
import type {
  BankTransactionInput,
  ChargeWithBalance,
  ExtractedSignals,
  MatchProposal,
  MatchResult,
  MatchingContext,
  MultiStudentMatchProposal,
  StudentCandidate,
} from './types';

export { buildMatchingContext };

export function match(
  tx: BankTransactionInput,
  context: MatchingContext,
): MatchResult {
  if (!shouldAttemptMatch(tx)) {
    return { kind: 'unmatched', reason: 'filtered' };
  }

  // Income that is plainly not a fee payment (another school's tournament
  // invoice, an electricity refund) is called out before matching so it can be
  // discarded as a batch instead of masquerading as a failed match. A name in
  // the directory can still coincide with such a memo, so this runs first.
  if (looksNonStudent(tx)) {
    return { kind: 'unmatched', reason: 'not_student' };
  }

  const signals = extractSignals(tx.memo ?? '', tx.amount, context);
  const candidates = resolveStudent(signals, tx.senderAccount, context);

  if (candidates.length === 0) {
    return { kind: 'unmatched', reason: 'no_candidates' };
  }

  // Multi-student detection — uses the raw memo so explicit separators
  // (commas / "and" / "&" / ";") survive into segmentation.
  const multi = detectMultiStudent(
    candidates,
    signals,
    tx.memo ?? '',
    context,
  );
  if (multi) {
    const multiResult = allocateMulti(multi.studentIds, tx.amount, signals, context, candidates);
    if (multiResult) {
      return { kind: 'matched_multi', proposal: multiResult };
    }
    // Multi-student allocation failed → fall through to single-student.
  }

  const surfaceable = shortlist(candidates);
  if (surfaceable.length === 0) {
    return { kind: 'unmatched', reason: 'no_candidates' };
  }

  const proposals = rankByAllocation(
    surfaceable.map((c) => allocateCharges(c, tx.amount, signals, context)),
    tx.amount,
  );

  const allTier4 = surfaceable.every((c) => c.tier === 4);
  return {
    kind: allTier4 ? 'low_confidence' : 'matched',
    proposals,
  };
}

/**
 * Let the charge stage weigh in on which student the memo meant.
 *
 * Two students called Misheel in the same class are indistinguishable by name,
 * but if the memo says "homework" and only one of them holds a homework charge,
 * the ledger has already answered the question. Allocation quality is folded in
 * as a bonus on the evidence score rather than as a hard sort key, so it can
 * break a tie without ever letting a weakly-named student leapfrog a strongly
 * named one just for owing a convenient amount.
 */
function rankByAllocation(
  proposals: MatchProposal[],
  amount: bigint,
): MatchProposal[] {
  const bonus = (p: MatchProposal): number => {
    if (p.proposedCharge) return 0.2;
    if (p.allocations.length === 0) {
      return p.flags.has('no_open_charges') ? -0.15 : -0.1;
    }
    const allocated = p.allocations.reduce((s, a) => s + a.amount, BigInt('0'));
    if (allocated !== amount) return 0.05;
    const clean = ![...p.flags].some((f) => f !== 'partial_payment');
    return clean ? 0.3 : 0.15;
  };
  return [...proposals].sort(
    (a, b) => b.score + bonus(b) - (a.score + bonus(a)) || a.studentId - b.studentId,
  );
}

/** How many alternatives are worth putting in front of a reviewer. */
const MAX_PROPOSALS = 5;
/**
 * A candidate scoring below this fraction of the best one is noise next to it —
 * dropping it keeps the alternatives list short enough to actually read.
 */
const RELATIVE_FLOOR = 0.45;

function shortlist(candidates: StudentCandidate[]): StudentCandidate[] {
  const surfaceable = candidates.filter((c) => c.tier <= 4);
  if (surfaceable.length === 0) return [];
  const best = surfaceable[0]!.score; // resolveStudent sorts by score desc
  return surfaceable
    .filter((c) => c.score >= best * RELATIVE_FLOOR)
    .slice(0, MAX_PROPOSALS);
}

/**
 * Turn a set of students the memo named into one proposal each.
 *
 * Two shapes are recognised, in order:
 *
 *  1. Tuition settled together — each child has exactly one open tuition
 *     charge and the balances add up to the transfer.
 *  2. An equal share each — one transfer covering the same fee for every
 *     sibling ("BUS FEE, BAT-ERDENE 8B, ANAR 6E" at twice the bus rate). The
 *     share is handed to the ordinary charge stage, so it resolves against
 *     real charges, and proposes creating the missing ones on the same terms
 *     as a single-student match.
 *
 * Anything else returns null and the caller falls back to a single-student
 * reading, where a human sees the whole amount and decides.
 */
function allocateMulti(
  studentIds: number[],
  totalAmount: bigint,
  signals: ExtractedSignals,
  context: MatchingContext,
  candidates: StudentCandidate[],
): MultiStudentMatchProposal | null {
  return (
    allocateMultiTuition(studentIds, totalAmount, signals, context, candidates) ??
    allocateMultiEqualShare(studentIds, totalAmount, signals, context, candidates)
  );
}

/**
 * One transfer, the same fee for each sibling. Only an exact division counts:
 * an uneven split is a judgement about who owes what, not arithmetic.
 */
function allocateMultiEqualShare(
  studentIds: number[],
  totalAmount: bigint,
  signals: ExtractedSignals,
  context: MatchingContext,
  candidates: StudentCandidate[],
): MultiStudentMatchProposal | null {
  const n = BigInt(studentIds.length);
  if (n < BigInt('2')) return null;
  if (totalAmount % n !== BigInt('0')) return null;
  const share = totalAmount / n;
  if (share <= BigInt('0')) return null;

  const proposals: MatchProposal[] = [];
  for (const sid of studentIds) {
    const cand = candidates.find((c) => c.studentId === sid);
    if (!cand) return null;
    const p = allocateCharges(cand, share, signals, context);
    // Every share must land somewhere definite; one sibling the matcher can't
    // place makes the whole split a guess.
    if (p.allocations.length === 0) return null;
    if (p.flags.has('manual_review') || p.flags.has('multiple_valid_combos')) return null;
    const allocated = p.allocations.reduce((s, a) => s + a.amount, BigInt('0'));
    if (allocated !== share) return null;
    proposals.push(p);
  }
  return { proposals, totalAmount };
}

function allocateMultiTuition(
  studentIds: number[],
  totalAmount: bigint,
  signals: ExtractedSignals,
  context: MatchingContext,
  candidates: StudentCandidate[],
): MultiStudentMatchProposal | null {
  // Each student must have exactly one open tuition charge, and the sum of
  // their tuition balances must equal totalAmount.
  type Slot = { studentId: number; tuition: ChargeWithBalance; cand: StudentCandidate };
  const slots: Slot[] = [];
  let sum = BigInt('0');
  for (const sid of studentIds) {
    const charges = context.openChargesByStudent.get(sid) ?? [];
    const tuitionCharges = charges.filter(
      (c) => c.feeName === 'tuition' && c.outstandingBalance > BigInt('0'),
    );
    if (tuitionCharges.length !== 1) return null;
    const cand = candidates.find((c) => c.studentId === sid);
    if (!cand) return null;
    slots.push({ studentId: sid, tuition: tuitionCharges[0]!, cand });
    sum += tuitionCharges[0]!.outstandingBalance;
  }
  if (sum !== totalAmount) return null;

  const proposals: MatchProposal[] = slots.map(({ tuition, cand }) => {
    const proposalSignals = new Set(cand.signals);
    if (signals.feeHints.explicit.length > 0) {
      proposalSignals.add('fee_hint_explicit');
    }
    return {
      studentId: cand.studentId,
      score: cand.score,
      allocations: [{ chargeId: tuition.id, amount: tuition.outstandingBalance }],
      signals: proposalSignals,
      flags: new Set(),
    };
  });
  return { proposals, totalAmount };
}
