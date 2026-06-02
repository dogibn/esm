import { describe, expect, it } from 'vitest';
import { buildMatchingContext } from './build-index';
import { match } from './match';
import type { BuildIndexInput } from './types';

function buildContext(overrides: Partial<BuildIndexInput> = {}) {
  return buildMatchingContext({
    students: [],
    enrollments: [],
    currentTermFees: [],
    currentYearFees: [],
    clubAliases: {},
    confirmedAccountLinks: [],
    openCharges: [],
    ...overrides,
  });
}

const baseStudents = [
  { id: 1, firstName: 'Baatar', lastName: 'B' },
  { id: 2, firstName: 'Amartuvshin', lastName: 'E' },
  { id: 3, firstName: 'Agvaanninj', lastName: 'X' },
  { id: 4, firstName: 'Anand', lastName: 'Bayarsaikhan' },
  { id: 7, firstName: 'Naidan', lastName: 'Bolor' },
];

const baseEnrollments = [
  { studentId: 1, gradeName: '8Д', gradeLevelCode: '8' },
  { studentId: 2, gradeName: '4BA', gradeLevelCode: '4' },
  { studentId: 3, gradeName: '4SA', gradeLevelCode: '4' },
  { studentId: 4, gradeName: '4SA', gradeLevelCode: '4' },
  { studentId: 7, gradeName: '5MA', gradeLevelCode: '5' },
];

describe('match — orchestrator', () => {
  it('filters out an outgoing transaction', () => {
    const ctx = buildContext();
    const result = match(
      { memo: 'foo', amount: BigInt('100'), senderAccount: 'A', isOutgoing: true },
      ctx,
    );
    expect(result.kind).toBe('unmatched');
    if (result.kind === 'unmatched') expect(result.reason).toBe('filtered');
  });

  it("'Б.БААТАР 8Д САГСАН БӨМБӨГ' matches student 1 with basketball-balance allocation", () => {
    const ctx = buildContext({
      students: baseStudents,
      enrollments: baseEnrollments,
      currentTermFees: [
        { feeStructureId: 15, feeName: 'Basketball', amount: BigInt('210000'), isClub: true },
      ],
      clubAliases: { '15': ['sagsan bombog'] },
      openCharges: [
        {
          studentId: 1,
          id: 100,
          feeName: 'Basketball',
          scope: { kind: 'term', academicTermId: 4 },
          grossAmount: BigInt('210000'),
          outstandingBalance: BigInt('210000'),
        },
      ],
    });
    const result = match(
      { memo: 'Б.БААТАР 8Д САГСАН БӨМБӨГ', amount: BigInt('210000'), senderAccount: 'ACC1' },
      ctx,
    );
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      const top = result.proposals[0];
      expect(top?.studentId).toBe(1);
      expect(top?.allocations).toEqual([{ chargeId: 100, amount: BigInt('210000') }]);
    }
  });

  it("'4SA AGVAANNINJ BUS PAYMENT' matches student 3 to bus charge", () => {
    const ctx = buildContext({
      students: baseStudents,
      enrollments: baseEnrollments,
      openCharges: [
        {
          studentId: 3,
          id: 200,
          feeName: 'bus_fee',
          scope: { kind: 'term', academicTermId: 4 },
          grossAmount: BigInt('300000'),
          outstandingBalance: BigInt('300000'),
        },
      ],
    });
    const result = match(
      { memo: '4SA AGVAANNINJ BUS PAYMENT', amount: BigInt('300000'), senderAccount: 'ACC2' },
      ctx,
    );
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      expect(result.proposals[0]?.studentId).toBe(3);
      expect(result.proposals[0]?.allocations).toEqual([{ chargeId: 200, amount: BigInt('300000') }]);
    }
  });

  it("'EB -Bayarsaikhan-ii Anand 4SA angi tulbur' triggers tuition fallback for 19.5M", () => {
    const ctx = buildContext({
      students: baseStudents,
      enrollments: baseEnrollments,
      openCharges: [
        {
          studentId: 4,
          id: 300,
          feeName: 'tuition',
          scope: { kind: 'year', academicYearId: 1 },
          grossAmount: BigInt('19500000'),
          outstandingBalance: BigInt('19500000'),
        },
      ],
    });
    const result = match(
      {
        memo: 'EB -Bayarsaikhan-ii Anand 4SA angi tulbur',
        amount: BigInt('19500000'),
        senderAccount: 'ACC3',
      },
      ctx,
    );
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      const anand = result.proposals.find((p) => p.studentId === 4);
      expect(anand).toBeDefined();
      expect(anand?.allocations[0]?.chargeId).toBe(300);
    }
  });

  it("'4BA Э,Амартүвшин сургалтын төлбөр' matches student 2 → tuition", () => {
    const ctx = buildContext({
      students: baseStudents,
      enrollments: baseEnrollments,
      openCharges: [
        {
          studentId: 2,
          id: 400,
          feeName: 'tuition',
          scope: { kind: 'year', academicYearId: 1 },
          grossAmount: BigInt('19500000'),
          outstandingBalance: BigInt('19500000'),
        },
      ],
    });
    const result = match(
      {
        memo: '4BA Э,Амартүвшин сургалтын төлбөр',
        amount: BigInt('19500000'),
        senderAccount: 'ACC4',
      },
      ctx,
    );
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      const top = result.proposals[0];
      expect(top?.studentId).toBe(2);
      expect(top?.signals.has('fee_hint_explicit')).toBe(true);
    }
  });

  it("'BOLOR NAIDAN 5MA ..., BOLOR NAIDAN 5MA ...' resolves single-student (not multi)", () => {
    const ctx = buildContext({
      students: baseStudents,
      enrollments: baseEnrollments,
      openCharges: [
        {
          studentId: 7,
          id: 500,
          feeName: 'tuition',
          scope: { kind: 'year', academicYearId: 1 },
          grossAmount: BigInt('2000000'),
          outstandingBalance: BigInt('2000000'),
        },
      ],
    });
    const result = match(
      {
        memo: 'BOLOR NAIDAN 5MA (FOR 6TH CLASS), BOLOR NAIDAN 5MA (FOR 6TH CLASS)',
        amount: BigInt('2000000'),
        senderAccount: 'ACC5',
      },
      ctx,
    );
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      expect(result.proposals[0]?.studentId).toBe(7);
    }
  });

  it('multi-student: Baatar and Amartuvshin pay tuition together', () => {
    const ctx = buildContext({
      students: baseStudents,
      enrollments: baseEnrollments,
      openCharges: [
        {
          studentId: 1,
          id: 1001,
          feeName: 'tuition',
          scope: { kind: 'year', academicYearId: 1 },
          grossAmount: BigInt('2000000'),
          outstandingBalance: BigInt('2000000'),
        },
        {
          studentId: 2,
          id: 1002,
          feeName: 'tuition',
          scope: { kind: 'year', academicYearId: 1 },
          grossAmount: BigInt('2500000'),
          outstandingBalance: BigInt('2500000'),
        },
      ],
    });
    const result = match(
      {
        memo: 'Baatar 8Д tuition, Amartuvshin 4BA tuition',
        amount: BigInt('4500000'),
        senderAccount: 'ACC6',
      },
      ctx,
    );
    expect(result.kind).toBe('matched_multi');
    if (result.kind === 'matched_multi') {
      expect(result.proposal.proposals.length).toBe(2);
      expect(result.proposal.totalAmount).toBe(BigInt('4500000'));
    }
  });

  it('returns unmatched/no_candidates when nothing in the memo links to a student', () => {
    const ctx = buildContext({
      students: baseStudents,
      enrollments: baseEnrollments,
    });
    const result = match(
      { memo: 'random gibberish xyz', amount: BigInt('1000'), senderAccount: 'ACC9' },
      ctx,
    );
    expect(result.kind).toBe('unmatched');
  });
});
