import { describe, expect, it } from 'vitest';
import { buildMatchingContext } from './build-index';
import type { BuildIndexInput } from './types';

function makeInput(overrides: Partial<BuildIndexInput> = {}): BuildIndexInput {
  return {
    students: [],
    enrollments: [],
    currentTermFees: [],
    currentYearFees: [],
    clubAliases: {},
    confirmedAccountLinks: [],
    openCharges: [],
    ...overrides,
  };
}

describe('buildMatchingContext', () => {
  it('two students with same first name in same class — name index has both', () => {
    const ctx = buildMatchingContext(
      makeInput({
        students: [
          { id: 1, firstName: 'Bayar', lastName: 'Bat' },
          { id: 2, firstName: 'Bayar', lastName: 'Tsen' },
        ],
        enrollments: [
          { studentId: 1, gradeName: '4BA', gradeLevelCode: '4' },
          { studentId: 2, gradeName: '4BA', gradeLevelCode: '4' },
        ],
      }),
    );
    expect(ctx.nameIndex.get('bayar')?.sort()).toEqual([1, 2]);
    expect(ctx.gradeIndex.get('4ba')?.sort()).toEqual([1, 2]);
  });

  it('class 4+A appears in classAlternation but NOT in levelIndex under 4', () => {
    const ctx = buildMatchingContext(
      makeInput({
        students: [{ id: 10, firstName: 'A', lastName: 'B' }],
        enrollments: [{ studentId: 10, gradeName: '4+A', gradeLevelCode: '4+' }],
      }),
    );
    expect(ctx.gradeIndex.get('4+a')).toEqual([10]);
    expect(ctx.levelIndex.get('4')).toBeUndefined();
    expect(ctx.levelIndex.get('4+')).toBeUndefined();
  });

  it('amount 375000 only for bus_fee appears in amountFeeIndex', () => {
    const ctx = buildMatchingContext(
      makeInput({
        currentYearFees: [{ feeName: 'bus_fee', amount: BigInt('375000') }],
      }),
    );
    expect(ctx.amountFeeIndex.get(BigInt('375000'))).toBe('bus');
  });

  it('amount collision drops from amountFeeIndex', () => {
    const ctx = buildMatchingContext(
      makeInput({
        currentYearFees: [{ feeName: 'bus_fee', amount: BigInt('300000') }],
        currentTermFees: [
          {
            feeStructureId: 99,
            feeName: 'Ballet',
            amount: BigInt('300000'),
            isClub: true,
          },
        ],
      }),
    );
    expect(ctx.amountFeeIndex.get(BigInt('300000'))).toBeUndefined();
  });

  it('sibling case: one account linked to two student_ids', () => {
    const ctx = buildMatchingContext(
      makeInput({
        confirmedAccountLinks: [
          { senderAccount: 'ACC123', studentId: 5 },
          { senderAccount: 'ACC123', studentId: 6 },
        ],
      }),
    );
    expect(ctx.accountIndex.get('ACC123')?.sort()).toEqual([5, 6]);
  });

  it('initial form name token is added (b.baatar)', () => {
    const ctx = buildMatchingContext(
      makeInput({
        students: [{ id: 7, firstName: 'Baatar', lastName: 'Bat' }],
      }),
    );
    expect(ctx.nameIndex.get('b.baatar')).toEqual([7]);
  });

  it('club alias is added to fee vocabulary', () => {
    const ctx = buildMatchingContext(
      makeInput({
        currentTermFees: [
          {
            feeStructureId: 15,
            feeName: 'Cheerleading GR3',
            amount: BigInt('200000'),
            isClub: true,
          },
        ],
        clubAliases: { '15': ['cheer', 'чирлидинг'] },
      }),
    );
    const tokens = ctx.feeVocabulary.entries.map((e) => e.normalizedToken);
    expect(tokens).toContain('cheer');
    expect(tokens).toContain('cheerleading gr3');
  });

  it('classAlternation matches a grade name in a memo via test()', () => {
    const ctx = buildMatchingContext(
      makeInput({
        students: [{ id: 1, firstName: 'A', lastName: 'B' }],
        enrollments: [{ studentId: 1, gradeName: '4BA', gradeLevelCode: '4' }],
      }),
    );
    expect(ctx.classAlternation).not.toBeNull();
    const re = ctx.classAlternation!;
    re.lastIndex = 0;
    expect('4ba payment'.match(re)?.[0]).toBe('4ba');
  });

  it('openCharges grouped into openChargesByStudent', () => {
    const ctx = buildMatchingContext(
      makeInput({
        openCharges: [
          {
            studentId: 1,
            id: 100,
            feeName: 'tuition',
            scope: { kind: 'year', academicYearId: 1 },
            grossAmount: BigInt('2000000'),
            outstandingBalance: BigInt('2000000'),
          },
          {
            studentId: 1,
            id: 101,
            feeName: 'bus_fee',
            scope: { kind: 'term', academicTermId: 4 },
            grossAmount: BigInt('300000'),
            outstandingBalance: BigInt('300000'),
          },
          {
            studentId: 2,
            id: 200,
            feeName: 'tuition',
            scope: { kind: 'year', academicYearId: 1 },
            grossAmount: BigInt('2200000'),
            outstandingBalance: BigInt('0'),
          },
        ],
      }),
    );
    expect(ctx.openChargesByStudent.get(1)?.length).toBe(2);
    expect(ctx.openChargesByStudent.get(2)?.length).toBe(1);
  });
});
