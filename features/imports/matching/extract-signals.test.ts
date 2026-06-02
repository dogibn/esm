import { describe, expect, it } from 'vitest';
import { buildMatchingContext } from './build-index';
import { extractSignals } from './extract-signals';
import type { BuildIndexInput } from './types';

function ctx(overrides: Partial<BuildIndexInput> = {}) {
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

const sampleContext = ctx({
  students: [
    { id: 1, firstName: 'Baatar', lastName: 'B' },
    { id: 2, firstName: 'Amartuvshin', lastName: 'E' },
    { id: 3, firstName: 'Agvaanninj', lastName: 'X' },
    { id: 4, firstName: 'Anand', lastName: 'Bayarsaikhan' },
  ],
  enrollments: [
    { studentId: 1, gradeName: '8Д', gradeLevelCode: '8' },
    { studentId: 2, gradeName: '4BA', gradeLevelCode: '4' },
    { studentId: 3, gradeName: '4SA', gradeLevelCode: '4' },
    { studentId: 4, gradeName: '4SA', gradeLevelCode: '4' },
    { studentId: 99, gradeName: '3BA', gradeLevelCode: '3' },
    { studentId: 98, gradeName: '3MA', gradeLevelCode: '3' },
  ],
  currentTermFees: [
    {
      feeStructureId: 15,
      feeName: 'Basketball',
      amount: BigInt('210000'),
      isClub: true,
    },
    {
      feeStructureId: 23,
      feeName: 'Ballet',
      amount: BigInt('300000'),
      isClub: true,
    },
  ],
  clubAliases: { '15': ['sagsan bombog'], '23': ['baletiin duguilang'] },
});

describe('extractSignals', () => {
  it("'Б.БААТАР 8Д САГСАН БӨМБӨГ' → class 8d, name b.baatar, basketball club", () => {
    const s = extractSignals('Б.БААТАР 8Д САГСАН БӨМБӨГ', BigInt('210000'), sampleContext);
    expect(s.gradeTokens.class).toContain('8d');
    expect(s.nameTokens).toContain('b.baatar');
    expect(s.feeHints.explicit.some((t) => typeof t === 'object' && t.kind === 'club' && t.feeName === 'Basketball')).toBe(true);
  });

  it("'4SA AGVAANNINJ BUS PAYMENT' → class 4sa, fee bus", () => {
    const s = extractSignals('4SA AGVAANNINJ BUS PAYMENT', BigInt('300000'), sampleContext);
    expect(s.gradeTokens.class).toContain('4sa');
    expect(s.feeHints.explicit).toContain('bus');
    expect(s.nameTokens).toContain('agvaanninj');
  });

  it("'4BA Э,Амартүвшин сургалтын төлбөр' → class 4ba, name amartuvshin, tuition (no generic)", () => {
    const s = extractSignals('4BA Э,Амартүвшин сургалтын төлбөр', BigInt('19500000'), sampleContext);
    expect(s.gradeTokens.class).toContain('4ba');
    expect(s.nameTokens).toContain('amartuvshin');
    expect(s.feeHints.explicit).toContain('tuition');
    // Generic 'tolbor' (from төлбөр) must not appear as a name token.
    expect(s.nameTokens).not.toContain('tolbor');
    expect(s.nameTokens).not.toContain('tulbur');
  });

  it("'EB -Bayarsaikhan-ii Anand 4SA angi tulbur' → class 4sa, name tokens, no specific fee", () => {
    const s = extractSignals(
      'EB -Bayarsaikhan-ii Anand 4SA angi tulbur',
      BigInt('19000000'),
      sampleContext,
    );
    expect(s.gradeTokens.class).toContain('4sa');
    expect(s.nameTokens).toContain('anand');
    expect(s.feeHints.explicit.length).toBe(0);
    // 'tulbur' is generic and should not leak as a name token.
    expect(s.nameTokens).not.toContain('tulbur');
  });

  it("'baletiin duguilangiin tulbur' → club Ballet hint, no tuition", () => {
    const s = extractSignals('baletiin duguilang tulbur', BigInt('300000'), sampleContext);
    expect(
      s.feeHints.explicit.some(
        (t) => typeof t === 'object' && t.kind === 'club' && t.feeName === 'Ballet',
      ),
    ).toBe(true);
    expect(s.feeHints.explicit).not.toContain('tuition');
  });

  it("'3?' wildcard expands to all 3-prefixed classes", () => {
    const s = extractSignals('payment for 3?', BigInt('100000'), sampleContext);
    expect(s.gradeTokens.wildcard.sort()).toEqual(['3ba', '3ma']);
  });

  it("'preschool 5' → kindergarten + level 5", () => {
    const s = extractSignals('preschool 5 munkhbadrakh', BigInt('100000'), sampleContext);
    // 5 should appear (kindergarten levels + the explicit '5' if it matched a
    // 'grade' pattern). We at least expect 5+ in the level bucket.
    expect(s.gradeTokens.level).toContain('5+');
  });

  it('strips parenthetical sender block', () => {
    const s = extractSignals('4SA Anand tulbur (BAYARSAIKHAN)', BigInt('100000'), sampleContext);
    expect(s.senderBlock).toBe('bayarsaikhan');
    expect(s.gradeTokens.class).toContain('4sa');
  });

  it('fee_hint_from_amount fires when amount uniquely identifies a fee', () => {
    const c = ctx({
      currentYearFees: [{ feeName: 'bus_fee', amount: BigInt('375000') }],
    });
    const s = extractSignals('random memo', BigInt('375000'), c);
    expect(s.feeHints.fromAmount).toBe('bus');
  });
});
