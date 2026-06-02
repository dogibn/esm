import { describe, expect, it } from 'vitest';
import { allocateCharges, feeTagMatches, findCombosSummingTo } from './allocate-charges';
import { buildMatchingContext } from './build-index';
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
    feeHints: { explicit: [], fromAmount: null },
    senderBlock: '',
    ...overrides,
  };
}

function candidate(id: number): StudentCandidate {
  return { studentId: id, signals: new Set(['memo_grade_class', 'memo_name_full']), tier: 1 };
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

  it('case F: partial payment with hint', () => {
    const ctx = ctxWithCharges(1, [charge(11, 'bus_fee', BigInt('300000'))]);
    const s = signals({ feeHints: { explicit: ['bus'], fromAmount: null } });
    const p = allocateCharges(candidate(1), BigInt('100000'), s, ctx);
    expect(p.flags.has('partial_payment')).toBe(true);
    expect(p.allocations).toEqual([{ chargeId: 11, amount: BigInt('100000') }]);
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
