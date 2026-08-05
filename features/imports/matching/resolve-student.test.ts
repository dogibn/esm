import { describe, expect, it } from 'vitest';
import { buildMatchingContext } from './build-index';
import { extractSignals } from './extract-signals';
import {
  detectMultiStudent,
  resolveStudent,
  tierFromScore,
} from './resolve-student';
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

const fullContext = ctx({
  students: [
    { id: 1, firstName: 'Baatar', lastName: 'B' },
    { id: 2, firstName: 'Amartuvshin', lastName: 'E' },
    { id: 3, firstName: 'Agvaanninj', lastName: 'X' },
    { id: 4, firstName: 'Anand', lastName: 'Bayarsaikhan' },
    { id: 5, firstName: 'Tushig', lastName: 'A' },
    { id: 6, firstName: 'Sergelen Saran', lastName: 'B' },
    { id: 7, firstName: 'Naidan', lastName: 'Bolor' },
  ],
  enrollments: [
    { studentId: 1, gradeName: '8Д', gradeLevelCode: '8' },
    { studentId: 2, gradeName: '4BA', gradeLevelCode: '4' },
    { studentId: 3, gradeName: '4SA', gradeLevelCode: '4' },
    { studentId: 4, gradeName: '4SA', gradeLevelCode: '4' },
    { studentId: 5, gradeName: '4MA', gradeLevelCode: '4' },
    { studentId: 6, gradeName: '7MA', gradeLevelCode: '7' },
    { studentId: 7, gradeName: '5MA', gradeLevelCode: '5' },
  ],
  confirmedAccountLinks: [{ senderAccount: 'ACC-ONE', studentId: 1 }],
});

describe('tierFromScore', () => {
  it('reads a tier off the evidence score, best first', () => {
    expect(tierFromScore(1.7)).toBe(1);
    expect(tierFromScore(1.2)).toBe(1);
    expect(tierFromScore(0.9)).toBe(2);
    expect(tierFromScore(0.6)).toBe(3);
    expect(tierFromScore(0.35)).toBe(4);
    expect(tierFromScore(0.2)).toBe(5);
    expect(tierFromScore(0)).toBe(5);
  });
});

describe('resolveStudent', () => {
  it("'Б.БААТАР 8Д' → student 1 with class + name signals (tier 1)", () => {
    const signals = extractSignals('Б.БААТАР 8Д', BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, null, fullContext);
    const baatar = cands.find((c) => c.studentId === 1);
    expect(baatar?.signals.has('memo_grade_class')).toBe(true);
    expect(baatar?.signals.has('memo_name_partial')).toBe(true);
  });

  it("'AGVAANNINJ 4SA' → class + a name nobody else shares is a top-tier match", () => {
    const signals = extractSignals('AGVAANNINJ 4SA', BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, null, fullContext);
    const agv = cands.find((c) => c.studentId === 3);
    expect(agv).toBeDefined();
    expect(agv?.signals.has('memo_grade_class')).toBe(true);
    expect(agv?.tier).toBe(1);
    // Classmates share the class but not the name, so they rank below and stay
    // out of proposal range.
    const classmate = cands.find((c) => c.studentId === 4);
    expect(classmate?.tier).toBe(5);
  });

  it('sender_account alone identifies the student outright', () => {
    const signals = extractSignals('random memo', BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, 'ACC-ONE', fullContext);
    const c = cands.find((c) => c.studentId === 1);
    expect(c).toBeDefined();
    expect(c?.tier).toBe(2);
  });

  it('a grade with no name proposes nobody — a class is not an identification', () => {
    const signals = extractSignals('4SA tulbur', BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, null, fullContext);
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.every((c) => c.tier === 5)).toBe(true);
  });

  it('fuzzy fires for a misspelled name', () => {
    // Misspelled "amartubshin" (b vs v).
    const signals = extractSignals('4BA amartubshin', BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, null, fullContext);
    const ama = cands.find((c) => c.signals.has('memo_name_fuzzy'));
    expect(ama?.fuzzyDistance).toBe(1);
  });

  it("'AGVAANNINJ' with no grade is still proposable — the name is unique", () => {
    const signals = extractSignals('AGVAANNINJ payment', BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, null, fullContext);
    const agv = cands.find((c) => c.studentId === 3);
    expect(agv?.signals.has('memo_name_partial')).toBe(true);
    expect(agv?.tier).toBeLessThanOrEqual(3);
  });

  it('scores an initial-form name and marks it as such', () => {
    const signals = extractSignals('B.BAATAR tulbur', BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, null, fullContext);
    const baatar = cands.find((c) => c.studentId === 1);
    expect(baatar?.signals.has('memo_name_initial')).toBe(true);
    expect(baatar?.tier).toBeLessThanOrEqual(3);
  });

  it('weighs a shared name below a unique one', () => {
    const shared = ctx({
      students: [
        { id: 1, firstName: 'Bilguun', lastName: 'A' },
        { id: 2, firstName: 'Bilguun', lastName: 'B' },
        { id: 3, firstName: 'Bilguun', lastName: 'C' },
        { id: 4, firstName: 'Bilguun', lastName: 'D' },
        { id: 5, firstName: 'Bilguun', lastName: 'E' },
        { id: 6, firstName: 'Otgonbayar', lastName: 'F' },
      ],
      enrollments: [],
    });
    const common = resolveStudent(
      extractSignals('Bilguun tulbur', BigInt('1'), shared),
      null,
      shared,
    );
    const unique = resolveStudent(
      extractSignals('Otgonbayar tulbur', BigInt('1'), shared),
      null,
      shared,
    );
    expect(unique[0]!.score).toBeGreaterThan(common[0]!.score);
  });

  it('resolves a name whose memo spelling differs from the directory only by o↔u', () => {
    // Student 7's surname is "Bolor"; a memo writer spells it "Bulur". The o/u
    // fold makes them converge, so this stays an exact name match (not a miss).
    const variant = extractSignals('Bulur 5MA', BigInt('100000'), fullContext);
    const baseline = extractSignals('Bolor 5MA', BigInt('100000'), fullContext);
    const vCand = resolveStudent(variant, null, fullContext).find((c) => c.studentId === 7);
    const bCand = resolveStudent(baseline, null, fullContext).find((c) => c.studentId === 7);
    expect(vCand).toBeDefined();
    expect(vCand?.signals.has('memo_name_partial')).toBe(true);
    expect(vCand?.signals.has('memo_grade_class')).toBe(true);
    // Same student, same tier regardless of which vowel the writer chose.
    expect(vCand?.tier).toBe(bCand?.tier);
  });
});

describe('detectMultiStudent', () => {
  it('same name twice (BOLOR NAIDAN 5MA, BOLOR NAIDAN 5MA) → NOT multi-student', () => {
    const memo = 'BOLOR NAIDAN 5MA (FOR 6TH CLASS), BOLOR NAIDAN 5MA (FOR 6TH CLASS)';
    const signals = extractSignals(memo, BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, null, fullContext);
    const multi = detectMultiStudent(cands, signals, memo, fullContext);
    expect(multi).toBeNull();
  });

  it('two distinct names separated by " and " → multi-student', () => {
    // Both students exist; commas/and split memo.
    const memo = 'Baatar 8Д and Amartuvshin 4BA';
    const signals = extractSignals(memo, BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, null, fullContext);
    const multi = detectMultiStudent(cands, signals, memo, fullContext);
    expect(multi?.studentIds.sort()).toEqual([1, 2]);
  });
});

describe('resolveStudent — Phase 9 scoring', () => {
  // "ENKHBAYAR ENEREL 12B": the child's surname doubles as another student's
  // first name. Both names landing on one student must outweigh one shared
  // token plus the same class.
  const phase9Ctx = ctx({
    students: [
      { id: 1, firstName: 'Enerel', lastName: 'Enkhbayar' },
      { id: 2, firstName: 'Enkhbayar', lastName: 'Otgonbayar' },
      { id: 3, firstName: 'Enkh-Uchral', lastName: 'Tuguldur' },
      { id: 4, firstName: 'Enkh-Uchral', lastName: 'Gurbazar' },
    ],
    enrollments: [
      { studentId: 1, gradeName: '12B', gradeLevelCode: '12' },
      { studentId: 2, gradeName: '12B', gradeLevelCode: '12' },
      { studentId: 3, gradeName: '5IA', gradeLevelCode: '5' },
      { studentId: 4, gradeName: '4SA', gradeLevelCode: '4' },
    ],
  });

  it('a full name (both groups) clearly outscores its own surname on another student', () => {
    const signals = extractSignals('ENKHBAYAR ENEREL ULDEGDEL TOLBOR 12B', BigInt('7000000'), phase9Ctx);
    const cands = resolveStudent(signals, null, phase9Ctx);
    const full = cands.find((c) => c.studentId === 1)!;
    const partial = cands.find((c) => c.studentId === 2)!;
    expect(full.signals.has('memo_name_full')).toBe(true);
    expect(full.nameGroupsHit).toBe(2);
    expect(partial.nameGroupsHit).toBe(1);
    expect(full.score).toBeGreaterThan(partial.score);
  });

  it("a grade only one of two same-named students satisfies breaks the tie — 'Энх-Учрал 4А'", () => {
    const signals = extractSignals('Энх-Учрал 4А', BigInt('1625000'), phase9Ctx);
    const cands = resolveStudent(signals, null, phase9Ctx);
    const inGrade = cands.find((c) => c.studentId === 4)!;
    const outOfGrade = cands.find((c) => c.studentId === 3)!;
    // 1.5× is triage's dominance bar; the tie-break must clear it.
    expect(inGrade.score).toBeGreaterThanOrEqual(outOfGrade.score * 1.5);
  });

  it('the grade tie-break never fires when no candidate satisfies the grade (stale class)', () => {
    // Memo says grade 9; neither Enkh-Uchral is in it — scores stay level.
    const signals = extractSignals('Энх-Учрал 9А', BigInt('1625000'), phase9Ctx);
    const cands = resolveStudent(signals, null, phase9Ctx);
    const a = cands.find((c) => c.studentId === 3)!;
    const b = cands.find((c) => c.studentId === 4)!;
    expect(a.score).toBe(b.score);
  });
});

describe('detectMultiStudent — Phase 9 segmentation', () => {
  const siblingsCtx = ctx({
    students: [
      { id: 1, firstName: 'Oyudari', lastName: 'Zolbayar' },
      { id: 2, firstName: 'Nomindari', lastName: 'Zolbayar' },
      { id: 3, firstName: 'Bayasgalan', lastName: 'Narandash' },
      { id: 4, firstName: 'Tushig', lastName: 'Narandash' },
      { id: 5, firstName: 'Yesui', lastName: 'Kherlen' },
      { id: 6, firstName: 'Esukhei', lastName: 'Kherlen' },
      { id: 7, firstName: 'Yesui', lastName: 'Batbold' },
      { id: 8, firstName: 'Yesui', lastName: 'Dorj' },
    ],
    enrollments: [
      { studentId: 1, gradeName: '11A', gradeLevelCode: '11' },
      { studentId: 2, gradeName: '8D', gradeLevelCode: '8' },
      { studentId: 3, gradeName: '12B', gradeLevelCode: '12' },
      { studentId: 4, gradeName: '9B', gradeLevelCode: '9' },
      { studentId: 5, gradeName: '3A', gradeLevelCode: '3' },
      { studentId: 6, gradeName: '5A', gradeLevelCode: '5' },
      { studentId: 7, gradeName: '2A', gradeLevelCode: '2' },
      { studentId: 8, gradeName: '7A', gradeLevelCode: '7' },
    ],
  });

  const detect = (memo: string) => {
    const signals = extractSignals(memo, BigInt('750000'), siblingsCtx);
    const cands = resolveStudent(signals, null, siblingsCtx);
    return detectMultiStudent(cands, signals, memo, siblingsCtx);
  };

  it("splits two initial-form siblings with no separator — 'З.ОЮУДАРЬ 11A З.НОМИНДАРЬ 8D'", () => {
    expect(detect('З.ОЮУДАРЬ 11A З.НОМИНДАРЬ 8D')?.studentIds.sort()).toEqual([1, 2]);
  });

  it("splits slash-separated siblings — 'Н. Баясгалан 12В/ Н. Түшиг 9В автобус'", () => {
    expect(detect('Н. Баясгалан 12В/ Н. Түшиг 9В автобус')?.studentIds.sort()).toEqual([3, 4]);
  });

  it('resolves an ambiguous bare sibling name through the surname its co-segments pin down', () => {
    // "ЕСҮЙ" alone is three students; the resolved Х./Kherlen sibling settles it.
    expect(detect('Х.ЕСҮХЭЙ, ЕСҮЙ ТӨЛБӨР')?.studentIds.sort()).toEqual([5, 6]);
  });

  it('still refuses an ambiguous segment no sibling surname can settle', () => {
    expect(detect('ЕСҮЙ, ОЮУДАРЬ ТӨЛБӨР')).toBeNull();
  });
});
