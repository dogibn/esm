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
