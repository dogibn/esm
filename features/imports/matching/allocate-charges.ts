import { categoryOfFeeName } from './vocabulary';
import { NEW_CHARGE_PLACEHOLDER_ID } from './types';
import type {
  AllocationFlag,
  ChargeWithBalance,
  ExtractedSignals,
  FeeTag,
  MatchProposal,
  MatchingContext,
  ProposedCharge,
  SignalKind,
  StudentCandidate,
} from './types';

export function feeTagMatches(feeName: string, hints: FeeTag[]): boolean {
  for (const h of hints) {
    if (typeof h === 'string') {
      if (h === 'tuition' && feeName === 'tuition') return true;
      if (h === 'bus' && (feeName === 'bus_fee' || feeName === 'bus')) return true;
      if (h === 'registration' && feeName === 'registration') return true;
    } else if (h.kind === 'club') {
      if (h.feeName === feeName) return true;
    } else if (h.kind === 'club_category') {
      // A category hint matches any open club charge of that category.
      if (categoryOfFeeName(feeName) === h.category) return true;
    }
  }
  return false;
}

/**
 * The fee to propose creating for this payment, or null.
 *
 * Deliberately narrow: the amount must equal the school's rate exactly. A
 * parent paying two terms of bus in one transfer, or one transfer covering two
 * siblings, is a decision about how many charges to create and for whom — that
 * belongs to a human, not to a rule that would guess.
 */
function proposableFor(
  hintedFees: FeeTag[],
  amount: bigint,
  context: MatchingContext,
): ProposedCharge | null {
  for (const hint of hintedFees) {
    if (typeof hint !== 'string') continue; // clubs are never auto-proposed
    const fee = context.proposableFees.get(hint);
    if (fee && fee.amount === amount) return fee;
  }
  return null;
}

function sumBalances(charges: ChargeWithBalance[]): bigint {
  let s = BigInt('0');
  for (const c of charges) s += c.outstandingBalance;
  return s;
}

// Find every subset of `charges` whose balances sum to `target`.
// Pruned: stop expanding if the running sum exceeds target.
export function findCombosSummingTo(
  charges: ChargeWithBalance[],
  target: bigint,
): ChargeWithBalance[][] {
  if (target <= BigInt('0')) return [];
  const results: ChargeWithBalance[][] = [];
  const pos = charges.filter((c) => c.outstandingBalance > BigInt('0'));
  // Sort largest first for tighter pruning.
  pos.sort((a, b) => (a.outstandingBalance < b.outstandingBalance ? 1 : -1));

  function recur(i: number, acc: ChargeWithBalance[], sum: bigint): void {
    if (sum === target && acc.length > 0) {
      results.push([...acc]);
      return;
    }
    if (sum > target) return;
    if (i >= pos.length) return;
    const c = pos[i]!;
    acc.push(c);
    recur(i + 1, acc, sum + c.outstandingBalance);
    acc.pop();
    recur(i + 1, acc, sum);
  }
  recur(0, [], BigInt('0'));
  return results;
}

export function allocateCharges(
  candidate: StudentCandidate,
  amount: bigint,
  signals: ExtractedSignals,
  context: MatchingContext,
): MatchProposal {
  const charges = context.openChargesByStudent.get(candidate.studentId) ?? [];
  const flags = new Set<AllocationFlag>();
  const proposalSignals = new Set<SignalKind>(candidate.signals);

  if (signals.feeHints.explicit.length > 0) {
    proposalSignals.add('fee_hint_explicit');
  }
  if (signals.feeHints.fromAmount) {
    proposalSignals.add('fee_hint_from_amount');
  }

  const hintedFees: FeeTag[] = [...signals.feeHints.explicit];
  if (signals.feeHints.fromAmount) hintedFees.push(signals.feeHints.fromAmount);

  const proposeMissingCharge = (): MatchProposal | null => {
    const fee = hintedFees.length > 0 ? proposableFor(hintedFees, amount, context) : null;
    if (!fee) return null;
    return {
      studentId: candidate.studentId,
      score: candidate.score,
      allocations: [{ chargeId: NEW_CHARGE_PLACEHOLDER_ID, amount }],
      signals: proposalSignals,
      flags,
      proposedCharge: fee,
    };
  };

  if (charges.length === 0) {
    // Owing nothing is no reason to give up: a student with a clean ledger who
    // pays the bus fee still needs the bus charge created.
    const proposed = proposeMissingCharge();
    if (proposed) return proposed;
    flags.add('no_open_charges');
    return {
      studentId: candidate.studentId,
      score: candidate.score,
      allocations: [],
      signals: proposalSignals,
      flags,
    };
  }

  // Case A: single open charge whose balance equals amount.
  if (charges.length === 1 && charges[0]!.outstandingBalance === amount) {
    return {
      studentId: candidate.studentId,
      score: candidate.score,
      allocations: [{ chargeId: charges[0]!.id, amount }],
      signals: proposalSignals,
      flags,
    };
  }

  // Case B: explicit fee hint resolves the target. An in-memo fee keyword
  // ("basketball", "bus", "registration") is authoritative, so this runs BEFORE
  // the generic amount-subset search below — otherwise a coincidental subset of
  // unrelated charges could win over the fee the parent actually named.
  if (hintedFees.length > 0) {
    const matchingCharges = charges.filter((c) => feeTagMatches(c.feeName, hintedFees));
    const sum = sumBalances(matchingCharges);
    // B1: hinted charges sum exactly to the amount → pay them in full.
    if (sum === amount && matchingCharges.length > 0) {
      return {
        studentId: candidate.studentId,
        score: candidate.score,
        allocations: matchingCharges.map((c) => ({
          chargeId: c.id,
          amount: c.outstandingBalance,
        })),
        signals: proposalSignals,
        flags,
      };
    }
    // B2: exactly one charge of the named fee, and the amount doesn't equal its
    // balance. The target is not in doubt — the parent said which fee — so the
    // payment lands on it either way, flagged for what it is.
    //
    // Over-payment is not an anomaly here: club charges priced Per Session
    // (homework club, see domain_model.md) accrue with attendance while parents
    // pay the standard term rate, so paid > balance is routine. Bailing out to
    // manual_review on those was the single largest source of "right student,
    // no allocation" rows.
    if (matchingCharges.length === 1 && amount > BigInt('0')) {
      const target = matchingCharges[0]!;
      flags.add(
        amount < target.outstandingBalance ? 'partial_payment' : 'overpayment',
      );
      return {
        studentId: candidate.studentId,
        score: candidate.score,
        allocations: [{ chargeId: target.id, amount }],
        signals: proposalSignals,
        flags,
      };
    }
    // B3: several charges of the named fee — look for a subset of *those* that
    // fits, before falling through to the search over everything the student owes.
    if (matchingCharges.length > 1) {
      const hintedCombos = findCombosSummingTo(matchingCharges, amount);
      if (hintedCombos.length === 1) {
        return {
          studentId: candidate.studentId,
          score: candidate.score,
          allocations: hintedCombos[0]!.map((c) => ({
            chargeId: c.id,
            amount: c.outstandingBalance,
          })),
          signals: proposalSignals,
          flags,
        };
      }
    }
  }

  // Case C: any subset of charges sums to amount.
  const combos = findCombosSummingTo(charges, amount);
  if (combos.length === 1) {
    const pick = combos[0]!;
    return {
      studentId: candidate.studentId,
      score: candidate.score,
      allocations: pick.map((c) => ({ chargeId: c.id, amount: c.outstandingBalance })),
      signals: proposalSignals,
      flags,
    };
  }
  if (combos.length > 1) {
    flags.add('multiple_valid_combos');
    const ranked = [...combos].sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      const sa = sumBalances(a);
      const sb = sumBalances(b);
      if (sa === sb) return 0;
      return sb > sa ? 1 : -1;
    });
    const pick = ranked[0]!;
    return {
      studentId: candidate.studentId,
      score: candidate.score,
      allocations: pick.map((c) => ({ chargeId: c.id, amount: c.outstandingBalance })),
      signals: proposalSignals,
      flags,
    };
  }

  // Case C2: the memo names a fee the student has no charge for, and the
  // transfer is exactly the school's rate for it. Nothing on the ledger explains
  // the money (cases A–C all failed), so the missing charge is the explanation:
  // propose creating it, and confirming will do both in one operation.
  //
  // This is what unblocks bus. The school has a bus rate but bus opt-in is not
  // imported (docs/notes.md), so no bus Charge exists for anyone and every bus
  // payment used to dead-end in manual_review.
  {
    const proposed = proposeMissingCharge();
    if (proposed) return proposed;
  }

  // Case D: overpayment.
  const totalOutstanding = sumBalances(charges);
  if (amount > totalOutstanding) {
    flags.add('overpayment');
    return {
      studentId: candidate.studentId,
      score: candidate.score,
      allocations: charges
        .filter((c) => c.outstandingBalance > BigInt('0'))
        .map((c) => ({ chargeId: c.id, amount: c.outstandingBalance })),
      signals: proposalSignals,
      flags,
    };
  }

  // Case E: amount-based tuition fallback.
  if (hintedFees.length === 0 && amount >= BigInt('1000000')) {
    const tuitionCharges = charges.filter((c) => c.feeName === 'tuition' && c.outstandingBalance > BigInt('0'));
    if (tuitionCharges.length === 1) {
      const t = tuitionCharges[0]!;
      flags.add('fee_inferred_from_amount');
      proposalSignals.add('fee_inferred_from_amount');
      if (amount < t.outstandingBalance) flags.add('partial_payment');
      return {
        studentId: candidate.studentId,
      score: candidate.score,
        allocations: [{ chargeId: t.id, amount }],
        signals: proposalSignals,
        flags,
      };
    }
    if (tuitionCharges.length > 1) {
      flags.add('multiple_tuition_charges');
      flags.add('manual_review');
      return {
        studentId: candidate.studentId,
      score: candidate.score,
        allocations: [],
        signals: proposalSignals,
        flags,
      };
    }
  }

  // Case G: nothing fits cleanly.
  flags.add('manual_review');
  return {
    studentId: candidate.studentId,
    score: candidate.score,
    allocations: [],
    signals: proposalSignals,
    flags,
  };
}
