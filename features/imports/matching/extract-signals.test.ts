import { describe, expect, it } from 'vitest';
import { buildMatchingContext } from './build-index';
import { degenitiveVariant, extractSignals, peelGluedGrade } from './extract-signals';
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
    expect(s.senderBlock).toBe('bayarsaihan'); // kh→h folded

    expect(s.gradeTokens.class).toContain('4sa');
  });

  it('fee_hint_from_amount fires when amount uniquely identifies a fee', () => {
    const c = ctx({
      currentYearFees: [{ feeName: 'bus_fee', amount: BigInt('375000') }],
    });
    const s = extractSignals('random memo', BigInt('375000'), c);
    expect(s.feeHints.fromAmount).toBe('bus');
  });

  it('recognizes a Cyrillic club term as a club_category hint without a club fee structure', () => {
    // No club fee structures in this context — the static category dictionary
    // still turns "сагсан бөмбөг" into a basketball hint.
    const c = ctx({});
    const s = extractSignals('Б.БААТАР 8Д САГСАН БӨМБӨГ', BigInt('210000'), c);
    expect(
      s.feeHints.explicit.some(
        (t) => typeof t === 'object' && t.kind === 'club_category' && t.category === 'basketball',
      ),
    ).toBe(true);
    // The club words are consumed, not leaked as name tokens.
    expect(s.nameTokens).not.toContain('sagsan');
  });

  it("splits a grade glued onto a name ('8дUjinlkham' → class 8d + name)", () => {
    const s = extractSignals('8дUjinlkham гар бөмбөг', BigInt('0'), sampleContext);
    expect(s.gradeTokens.class).toContain('8d');
    expect(s.nameTokens).toContain('ujinlham'); // kh→h folded
  });

  it('recovers a genitive-case parent name to the nominative directory form', () => {
    const c = ctx({
      students: [{ id: 10, firstName: 'Nandinbeleg', lastName: 'Ariunbold' }],
      enrollments: [{ studentId: 10, gradeName: '1JA', gradeLevelCode: '1' }],
    });
    // "Ариунболдын" (genitive) → "ariunbuldin"; directory "Ariunbold" →
    // "ariunbuld". The additive de-genitive variant bridges them while the
    // original token is still emitted.
    const s = extractSignals('Ариунболдын Нандинбэлэг', BigInt('0'), c);
    expect(s.nameTokens).toContain('ariunbuld');
    expect(s.nameTokens).toContain('nandinbeleg');
  });
});

describe('degenitiveVariant', () => {
  const idx = new Map<string, number[]>([
    ['ariunbuld', [1]],
    ['azjargal', [2]],
    ['bayanmunh', [3]],
  ]);

  it('strips -in / -iin / -yn genitive endings when the stem is a known name', () => {
    expect(degenitiveVariant('ariunbuldin', idx)).toBe('ariunbuld');
    expect(degenitiveVariant('azjargalin', idx)).toBe('azjargal');
    expect(degenitiveVariant('bayanmunhiin', idx)).toBe('bayanmunh');
  });

  it('returns null when the token already is a known name (no needless strip)', () => {
    expect(degenitiveVariant('ariunbuld', idx)).toBeNull();
  });

  it('returns null when the stem is not a real directory name (no noise)', () => {
    // "nomin" ends in "in" but "nom" is not a name → left untouched.
    expect(degenitiveVariant('nomin', idx)).toBeNull();
    expect(degenitiveVariant('khulan', idx)).toBeNull();
  });
});

describe('peelGluedGrade', () => {
  const vocab = ['8va', '8v', '8d', '4sa'].sort((a, b) => b.length - a.length);

  it('peels a leading class prefix glued to a name', () => {
    expect(peelGluedGrade('8vujinlkham', vocab)).toEqual({
      classTok: '8v',
      levelTok: null,
      rest: 'ujinlkham',
    });
  });

  it('prefers the longest matching class', () => {
    expect(peelGluedGrade('8vamisheel', vocab)).toEqual({
      classTok: '8va',
      levelTok: null,
      rest: 'misheel',
    });
  });

  it('reads a trailing 1–2 digit run as a grade level', () => {
    expect(peelGluedGrade('enuujin7', vocab)).toEqual({
      classTok: null,
      levelTok: '7',
      rest: 'enuujin',
    });
  });

  it('strips a long trailing digit run (id/phone) as noise', () => {
    expect(peelGluedGrade('anir99102455', vocab)).toEqual({
      classTok: null,
      levelTok: null,
      rest: 'anir',
    });
  });

  it('peels a leading bare grade level', () => {
    expect(peelGluedGrade('7enuujin', vocab)).toEqual({
      classTok: null,
      levelTok: '7',
      rest: 'enuujin',
    });
  });

  it('leaves a plain name untouched', () => {
    expect(peelGluedGrade('baatar', vocab)).toEqual({
      classTok: null,
      levelTok: null,
      rest: 'baatar',
    });
  });
});

// Regression cases for the extraction fixes — each one is a memo shape that
// produced no usable signal at all before (see docs/import_matching_plan.md § 2).
describe('extractSignals — grade shapes that used to be missed', () => {
  const gradeCtx = ctx({
    students: [
      { id: 1, firstName: 'Anujin', lastName: 'Sarantsetseg' },
      { id: 2, firstName: 'Temuulen', lastName: 'Enkhbat' },
      { id: 3, firstName: 'Nomin-Erdene', lastName: 'Bold' },
      { id: 4, firstName: 'Khongorzul', lastName: 'Altaibayar' },
      { id: 5, firstName: 'Elberel', lastName: 'Batbayar' },
    ],
    enrollments: [
      { studentId: 1, gradeName: '5MA', gradeLevelCode: '5' },
      { studentId: 2, gradeName: '12A', gradeLevelCode: '12' },
      { studentId: 3, gradeName: '3LM', gradeLevelCode: '3' },
      { studentId: 4, gradeName: '8B', gradeLevelCode: '8' },
      { studentId: 5, gradeName: '3CL', gradeLevelCode: '3' },
    ],
  });

  it("reads a bare 'angi' as a grade level — 'S.ANUJIN,5B ANGI'", () => {
    const s = extractSignals('S.ANUJIN,5B ANGI 99706387', BigInt('2150000'), gradeCtx);
    expect(s.gradeTokens.level).toContain('5');
    expect(s.nameTokens).toContain('s.anujin');
  });

  it("reads the keyword-first form — 'GRADE 12 E.TEMUULEN'", () => {
    const s = extractSignals('GRADE 12 E.TEMUULEN', BigInt('2500000'), gradeCtx);
    expect(s.gradeTokens.level).toContain('12');
    expect(s.nameTokens).toContain('e.temuulen');
  });

  it("maps a Cyrillic lookalike class letter — '8В' means class 8B", () => {
    const s = extractSignals('ХОНГОРЗУЛ 8В ВОЛЛЕЙБОЛ', BigInt('210000'), gradeCtx);
    expect(s.gradeTokens.class).toContain('8v');
  });

  it("re-joins a class split across a space — '3 LM'", () => {
    const s = extractSignals('A.OYU-VJIN 3 LM', BigInt('2350000'), gradeCtx);
    expect(s.gradeTokens.class).toContain('3lm');
  });

  it('does not invent a class when the join is not a real one', () => {
    const s = extractSignals('L. Amir 5 V payment', BigInt('4350000'), gradeCtx);
    expect(s.gradeTokens.class).toEqual([]);
  });

  it('reads a bare trailing digit as a grade level when a name is present', () => {
    const s = extractSignals('Б. ЭЛБЭРЭЛ 3', BigInt('400000'), gradeCtx);
    expect(s.gradeTokens.level).toContain('3');
  });

  it('ignores a bare digit when the memo carries no name at all', () => {
    const s = extractSignals('3', BigInt('400000'), gradeCtx);
    expect(s.gradeTokens.level).toEqual([]);
  });

  it("does not read the digit in 'CLUB1' as a grade level", () => {
    const s = extractSignals('E.MISHEEL HOMEWORK CLUB1', BigInt('225000'), gradeCtx);
    expect(s.gradeTokens.level).toEqual([]);
  });

  it('strips the EB- bank prefix instead of gluing it to the name', () => {
    const s = extractSignals('EB-ANIR 1-R ANGI', BigInt('400000'), gradeCtx);
    expect(s.nameTokens).toContain('anir');
    expect(s.gradeTokens.level).toContain('1');
  });

  it('splits a hyphenated name into one group with several spellings', () => {
    const s = extractSignals('BOLD NOMIN-ERDENE', BigInt('210000'), gradeCtx);
    const group = s.nameGroups.find((g) => g.includes('numin-erdene'));
    expect(group).toBeDefined();
    expect(group).toEqual(expect.arrayContaining(['numin', 'erdene', 'numinerdene']));
    // One written name stays one group, however many spellings it has.
    expect(s.nameGroups.length).toBe(2);
  });
});
