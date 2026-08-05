import { describe, expect, it } from 'vitest';
import { allocateCharges, feeTagMatches, findCombosSummingTo } from './allocate-charges';
import { buildMatchingContext } from './build-index';
import { NEW_CHARGE_PLACEHOLDER_ID } from './types';
import type {
  ChargeWithBalance,
  ExtractedSignals,
  FeeTag,
  MatchingContext,
  StudentCandidate,
} from './types';

function signals(overrides: Partial<ExtractedSignals> = {}): ExtractedSignals {
  return {
    gradeTokens: { class: [], wildcard: [], level: [] },
    nameTokens: [],
    nameGroups: [],
    feeHints: { explicit: [], fromAmount: null },
    senderBlock: '',
    ...overrides,
  };
}

function candidate(id: number): StudentCandidate {
  return {
    studentId: id,
    signals: new Set(['memo_grade_class', 'memo_name_full']),
    tier: 1,
    score: 1.3,
  };
}

function charge(
  id: number,
  feeName: string,
  balance: bigint,
  scope: ChargeWithBalance['scope'] = { kind: 'year', academicYearId: 1 },
): ChargeWithBalance {
  return { id, feeName, scope, grossAmount: balance, outstandingBalance: balance };
}

function ctxWithCharges(studentId: number, charges: ChargeWithBalance[]): MatchingContext {
  return buildMatchingContext({
    students: [],
    enrollments: [],
    currentTermFees: [],
    currentYearFees: [],
    clubAliases: {},
    confirmedAccountLinks: [],
    openCharges: charges.map((c) => ({ ...c, studentId })),
  });
}

describe('feeTagMatches', () => {
  it('matches string tags against canonical fee names', () => {
    expect(feeTagMatches('tuition', ['tuition'])).toBe(true);
    expect(feeTagMatches('bus_fee', ['bus'])).toBe(true);
    expect(feeTagMatches('registration', ['registration'])).toBe(true);
  });
  it('matches club tags by feeName equality', () => {
    const tag: FeeTag = { kind: 'club', feeStructureId: 1, feeName: 'Ballet' };
    expect(feeTagMatches('Ballet', [tag])).toBe(true);
    expect(feeTagMatches('Basketball', [tag])).toBe(false);
  });
  it('matches a club_category hint against any open club charge of that category', () => {
    const tag: FeeTag = { kind: 'club_category', category: 'basketball' };
    expect(feeTagMatches('Basketball 3-5 /Term 4/', [tag])).toBe(true);
    expect(feeTagMatches('basketball GR 6-9 Term 4', [tag])).toBe(true);
    expect(feeTagMatches('Volleyball 1-3pm Term 4', [tag])).toBe(false);
    expect(feeTagMatches('tuition', [tag])).toBe(false);
  });
});

describe('findCombosSummingTo', () => {
  it('finds the exact subset', () => {
    const cs = [charge(1, 'a', BigInt('100')), charge(2, 'b', BigInt('200')), charge(3, 'c', BigInt('300'))];
    const combos = findCombosSummingTo(cs, BigInt('500'));
    expect(combos.length).toBe(1);
    expect(combos[0]!.map((c) => c.id).sort()).toEqual([2, 3]);
  });
  it('finds multiple subsets when ambiguous', () => {
    const cs = [charge(1, 'a', BigInt('100')), charge(2, 'b', BigInt('100')), charge(3, 'c', BigInt('200'))];
    const combos = findCombosSummingTo(cs, BigInt('200'));
    expect(combos.length).toBe(2);
  });
});

describe('allocateCharges', () => {
  it('case A: single open charge equal to amount → exact allocation', () => {
    const ctx = ctxWithCharges(1, [charge(10, 'tuition', BigInt('2000000'))]);
    const p = allocateCharges(candidate(1), BigInt('2000000'), signals(), ctx);
    expect(p.allocations).toEqual([{ chargeId: 10, amount: BigInt('2000000') }]);
    expect(p.flags.size).toBe(0);
  });

  it('case B: hinted fees sum to amount', () => {
    const ctx = ctxWithCharges(1, [
      charge(10, 'tuition', BigInt('2000000')),
      charge(11, 'bus_fee', BigInt('300000')),
    ]);
    const s = signals({ feeHints: { explicit: ['tuition', 'bus'], fromAmount: null } });
    const p = allocateCharges(candidate(1), BigInt('2300000'), s, ctx);
    expect(p.allocations.length).toBe(2);
    expect(p.flags.has('manual_review')).toBe(false);
  });

  it('case C: combo summing to amount', () => {
    const ctx = ctxWithCharges(1, [
      charge(10, 'tuition', BigInt('2000000')),
      charge(11, 'bus_fee', BigInt('300000')),
      charge(12, 'Ballet', BigInt('300000')),
    ]);
    const p = allocateCharges(candidate(1), BigInt('600000'), signals(), ctx);
    expect(p.allocations.length).toBe(2);
    expect(p.flags.has('multiple_valid_combos')).toBe(false);
  });

  it('case C: multiple valid combos → flag multiple_valid_combos', () => {
    const ctx = ctxWithCharges(1, [
      charge(10, 'a', BigInt('100')),
      charge(11, 'b', BigInt('100')),
      charge(12, 'c', BigInt('200')),
    ]);
    const p = allocateCharges(candidate(1), BigInt('200'), signals(), ctx);
    expect(p.flags.has('multiple_valid_combos')).toBe(true);
  });

  it('case D: overpayment → flag + allocate all open balances', () => {
    const ctx = ctxWithCharges(1, [
      charge(10, 'tuition', BigInt('1000000')),
      charge(11, 'bus_fee', BigInt('300000')),
    ]);
    const p = allocateCharges(candidate(1), BigInt('5000000'), signals(), ctx);
    expect(p.flags.has('overpayment')).toBe(true);
    expect(p.allocations.length).toBe(2);
  });

  it('case E: amount-based tuition fallback (≥1M, no hint, single tuition, no clean combo)', () => {
    // Amount doesn't cleanly sum to any subset of balances — falls to case E.
    const ctx = ctxWithCharges(1, [
      charge(10, 'tuition', BigInt('19500000')),
      charge(11, 'bus_fee', BigInt('300000')),
    ]);
    const p = allocateCharges(candidate(1), BigInt('17000000'), signals(), ctx);
    expect(p.flags.has('fee_inferred_from_amount')).toBe(true);
    expect(p.flags.has('partial_payment')).toBe(true);
    expect(p.allocations).toEqual([{ chargeId: 10, amount: BigInt('17000000') }]);
  });

  it('case E: amount-based tuition fallback partial payment', () => {
    const ctx = ctxWithCharges(1, [charge(10, 'tuition', BigInt('19500000'))]);
    const p = allocateCharges(candidate(1), BigInt('10000000'), signals(), ctx);
    expect(p.flags.has('partial_payment')).toBe(true);
    expect(p.flags.has('fee_inferred_from_amount')).toBe(true);
  });

  it('case E: multiple tuition charges → manual_review', () => {
    const ctx = ctxWithCharges(1, [
      charge(10, 'tuition', BigInt('2000000'), { kind: 'year', academicYearId: 1 }),
      charge(20, 'tuition', BigInt('2000000'), { kind: 'year', academicYearId: 2 }),
    ]);
    const p = allocateCharges(candidate(1), BigInt('1500000'), signals(), ctx);
    expect(p.flags.has('multiple_tuition_charges')).toBe(true);
    expect(p.flags.has('manual_review')).toBe(true);
    expect(p.allocations.length).toBe(0);
  });

  it('case B2: partial payment with hint', () => {
    const ctx = ctxWithCharges(1, [charge(11, 'bus_fee', BigInt('300000'))]);
    const s = signals({ feeHints: { explicit: ['bus'], fromAmount: null } });
    const p = allocateCharges(candidate(1), BigInt('100000'), s, ctx);
    expect(p.flags.has('partial_payment')).toBe(true);
    expect(p.allocations).toEqual([{ chargeId: 11, amount: BigInt('100000') }]);
  });

  it('club_category hint: partial payment lands on the matching club charge', () => {
    // The "Б.БААТАР 8Д САГСАН БӨМБӨГ" 210,000 scenario: a basketball charge of
    // 300,000 paid short. Before the category hint this fell to manual_review.
    const ctx = ctxWithCharges(1, [
      charge(10, 'tuition', BigInt('4000000')),
      charge(12, 'Basketball 3-5 /Term 4/', BigInt('300000')),
    ]);
    const s = signals({
      feeHints: { explicit: [{ kind: 'club_category', category: 'basketball' }], fromAmount: null },
    });
    const p = allocateCharges(candidate(1), BigInt('210000'), s, ctx);
    expect(p.flags.has('partial_payment')).toBe(true);
    expect(p.allocations).toEqual([{ chargeId: 12, amount: BigInt('210000') }]);
  });

  it('club_category hint: exact payment pays the club charge in full', () => {
    const ctx = ctxWithCharges(1, [
      charge(10, 'tuition', BigInt('4000000')),
      charge(12, 'Volleyball 1-3pm Term 4', BigInt('255000')),
    ]);
    const s = signals({
      feeHints: { explicit: [{ kind: 'club_category', category: 'volleyball' }], fromAmount: null },
    });
    const p = allocateCharges(candidate(1), BigInt('255000'), s, ctx);
    expect(p.allocations).toEqual([{ chargeId: 12, amount: BigInt('255000') }]);
    expect(p.flags.has('manual_review')).toBe(false);
  });

  it('explicit hint is authoritative over a coincidental amount-subset', () => {
    // Amount 300k equals BOTH the bus+nothing and the ballet charge; the bus
    // hint must route it to the bus charge, not the equal-valued ballet one.
    const ctx = ctxWithCharges(1, [
      charge(11, 'bus_fee', BigInt('300000')),
      charge(12, 'Ballet Mon, Wed Term 4', BigInt('300000')),
    ]);
    const s = signals({ feeHints: { explicit: ['bus'], fromAmount: null } });
    const p = allocateCharges(candidate(1), BigInt('300000'), s, ctx);
    expect(p.allocations).toEqual([{ chargeId: 11, amount: BigInt('300000') }]);
  });

  it('case G: nothing fits → manual_review', () => {
    const ctx = ctxWithCharges(1, [charge(10, 'tuition', BigInt('2000000'))]);
    const p = allocateCharges(candidate(1), BigInt('999999'), signals(), ctx);
    expect(p.flags.has('manual_review')).toBe(true);
    expect(p.allocations.length).toBe(0);
  });

  it('no open charges → flag no_open_charges', () => {
    const ctx = ctxWithCharges(99, []);
    const p = allocateCharges(candidate(99), BigInt('100000'), signals(), ctx);
    expect(p.flags.has('no_open_charges')).toBe(true);
    expect(p.allocations.length).toBe(0);
  });
});

// The charge stage on fees the ledger doesn't have yet, and on club charges
// whose amount moves under the student (see docs/import_matching_plan.md § 2).
describe('allocateCharges — fees the student has no charge for', () => {
  function ctxWithFees(
    studentId: number,
    charges: ChargeWithBalance[],
    termFees: Array<{ feeStructureId: number; feeName: string; amount: bigint; isClub: boolean }>,
  ): MatchingContext {
    return buildMatchingContext({
      academicTermId: 4,
      students: [],
      enrollments: [],
      currentTermFees: termFees,
      currentYearFees: [],
      clubAliases: {},
      confirmedAccountLinks: [],
      openCharges: charges.map((c) => ({ ...c, studentId })),
    });
  }

  const busFee = {
    feeStructureId: 1,
    feeName: 'bus',
    amount: BigInt('375000'),
    isClub: false,
  };

  it('proposes creating the bus charge when the amount is the school rate', () => {
    const ctx = ctxWithFees(1, [charge(10, 'tuition', BigInt('20000000'))], [busFee]);
    const s = signals({ feeHints: { explicit: ['bus'], fromAmount: null } });
    const p = allocateCharges(candidate(1), BigInt('375000'), s, ctx);
    expect(p.proposedCharge).toEqual({
      feeName: 'bus',
      amount: BigInt('375000'),
      scope: 'term',
      academicTermId: 4,
      reason: 'fee_hint_explicit',
    });
    expect(p.allocations).toEqual([
      { chargeId: NEW_CHARGE_PLACEHOLDER_ID, amount: BigInt('375000') },
    ]);
    expect(p.flags.has('manual_review')).toBe(false);
  });

  it('proposes the bus charge even for a student who owes nothing', () => {
    const ctx = ctxWithFees(1, [], [busFee]);
    const s = signals({ feeHints: { explicit: ['bus'], fromAmount: null } });
    const p = allocateCharges(candidate(1), BigInt('375000'), s, ctx);
    expect(p.proposedCharge?.feeName).toBe('bus');
    expect(p.flags.has('no_open_charges')).toBe(false);
  });

  it('refuses to guess when the amount is a multiple of the rate', () => {
    // 750,000 is two terms, or two siblings — a decision, not a deduction.
    const ctx = ctxWithFees(1, [charge(10, 'tuition', BigInt('20000000'))], [busFee]);
    const s = signals({ feeHints: { explicit: ['bus'], fromAmount: null } });
    const p = allocateCharges(candidate(1), BigInt('750000'), s, ctx);
    expect(p.proposedCharge).toBeUndefined();
  });

  it('prefers an existing charge over creating one', () => {
    const ctx = ctxWithFees(
      1,
      [charge(10, 'bus_fee', BigInt('375000'))],
      [busFee],
    );
    const s = signals({ feeHints: { explicit: ['bus'], fromAmount: null } });
    const p = allocateCharges(candidate(1), BigInt('375000'), s, ctx);
    expect(p.proposedCharge).toBeUndefined();
    expect(p.allocations).toEqual([{ chargeId: 10, amount: BigInt('375000') }]);
  });

  it('never proposes creating a club charge', () => {
    const ctx = ctxWithFees(
      1,
      [charge(10, 'tuition', BigInt('20000000'))],
      [{ feeStructureId: 2, feeName: 'Ballet Mon, Wed Term 4', amount: BigInt('285000'), isClub: true }],
    );
    const s = signals({
      feeHints: { explicit: [{ kind: 'club_category', category: 'ballet' }], fromAmount: null },
    });
    const p = allocateCharges(candidate(1), BigInt('285000'), s, ctx);
    expect(p.proposedCharge).toBeUndefined();
  });
});

describe('allocateCharges — a named fee whose balance has moved', () => {
  it('pays a per-session club charge that is owed less than was paid', () => {
    // Homework club accrues per session; the parent pays the standard rate.
    const ctx = ctxWithCharges(1, [
      charge(10, 'tuition', BigInt('20000000')),
      charge(11, 'HW GR1 Term 4', BigInt('555000')),
    ]);
    const s = signals({
      feeHints: { explicit: [{ kind: 'club_category', category: 'homework' }], fromAmount: null },
    });
    const p = allocateCharges(candidate(1), BigInt('690000'), s, ctx);
    expect(p.allocations).toEqual([{ chargeId: 11, amount: BigInt('690000') }]);
    expect(p.flags.has('overpayment')).toBe(true);
    expect(p.flags.has('manual_review')).toBe(false);
  });

  it('refuses to pay an unrelated charge that merely costs the same', () => {
    // "TAEKWONDO 400,000" against a student with no taekwondo charge but a
    // 400,000 registration charge: the amounts agree, the fees do not, and the
    // memo already said which fee this is.
    const ctx = ctxWithCharges(1, [
      charge(10, 'tuition', BigInt('20000000')),
      charge(11, 'registration', BigInt('400000')),
    ]);
    const s = signals({
      feeHints: { explicit: [{ kind: 'club_category', category: 'taekwondo' }], fromAmount: null },
    });
    const p = allocateCharges(candidate(1), BigInt('400000'), s, ctx);
    expect(p.allocations).toEqual([]);
    expect(p.flags.has('manual_review')).toBe(true);
  });

  it('refuses a sole open charge of the wrong fee even when it matches to the tugrik', () => {
    const ctx = ctxWithCharges(1, [charge(11, 'registration', BigInt('400000'))]);
    const s = signals({
      feeHints: { explicit: [{ kind: 'club_category', category: 'taekwondo' }], fromAmount: null },
    });
    const p = allocateCharges(candidate(1), BigInt('400000'), s, ctx);
    expect(p.allocations).toEqual([]);
    expect(p.flags.has('manual_review')).toBe(true);
  });

  it('still empties the ledger when the named fee is the one that is owed', () => {
    const ctx = ctxWithCharges(1, [charge(11, 'registration', BigInt('400000'))]);
    const s = signals({ feeHints: { explicit: ['registration'], fromAmount: null } });
    const p = allocateCharges(candidate(1), BigInt('400000'), s, ctx);
    expect(p.allocations).toEqual([{ chargeId: 11, amount: BigInt('400000') }]);
  });

  it('pays a named fee short without giving up', () => {
    const ctx = ctxWithCharges(1, [
      charge(10, 'tuition', BigInt('20000000')),
      charge(11, 'HW GR1 Term 4', BigInt('705000')),
    ]);
    const s = signals({
      feeHints: { explicit: [{ kind: 'club_category', category: 'homework' }], fromAmount: null },
    });
    const p = allocateCharges(candidate(1), BigInt('225000'), s, ctx);
    expect(p.allocations).toEqual([{ chargeId: 11, amount: BigInt('225000') }]);
    expect(p.flags.has('partial_payment')).toBe(true);
  });
});
