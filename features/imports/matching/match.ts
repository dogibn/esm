import { allocateCharges } from './allocate-charges';
import { buildMatchingContext } from './build-index';
import { extractSignals } from './extract-signals';
import { shouldAttemptMatch } from './filter';
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

  const surfaceable = candidates.filter((c) => c.tier <= 4);
  if (surfaceable.length === 0) {
    return { kind: 'unmatched', reason: 'no_candidates' };
  }

  const proposals = surfaceable.map((c) =>
    allocateCharges(c, tx.amount, signals, context),
  );

  const allTier4 = surfaceable.every((c) => c.tier === 4);
  return {
    kind: allTier4 ? 'low_confidence' : 'matched',
    proposals,
  };
}

function allocateMulti(
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
      allocations: [{ chargeId: tuition.id, amount: tuition.outstandingBalance }],
      signals: proposalSignals,
      flags: new Set(),
    };
  });
  return { proposals, totalAmount };
}
