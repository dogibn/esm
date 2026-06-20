import { describe, expect, it } from 'vitest';
import { buildMatchingContext } from './build-index';
import { extractSignals } from './extract-signals';
import { normalize } from './normalize';
import {
  assignTier,
  detectMultiStudent,
  resolveStudent,
} from './resolve-student';
import type { BuildIndexInput, SignalKind } from './types';

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

describe('assignTier', () => {
  function t(...sigs: SignalKind[]) {
    return assignTier(new Set(sigs));
  }

  it('tier 1: two strong signals', () => {
    expect(t('memo_grade_class', 'memo_name_full')).toBe(1);
    expect(t('memo_grade_class', 'sender_account')).toBe(1);
    expect(t('memo_name_full', 'sender_account')).toBe(1);
  });

  it('tier 2: grade + name_full (non-class grade)', () => {
    expect(t('memo_grade_level', 'memo_name_full')).toBe(2);
    expect(t('memo_grade_wildcard', 'memo_name_full')).toBe(2);
  });

  it('tier 3: sender_account alone, name_full alone, or grade + name_partial', () => {
    expect(t('sender_account')).toBe(3);
    expect(t('memo_name_full')).toBe(3);
    expect(t('memo_grade_class', 'memo_name_partial')).toBe(3);
    expect(t('memo_grade_level', 'memo_name_partial')).toBe(3);
  });

  it('tier 4: fuzzy + grade', () => {
    expect(t('memo_grade_class', 'memo_name_fuzzy')).toBe(4);
  });

  it('tier 5: weak signal alone', () => {
    expect(t('memo_grade_level')).toBe(5);
    expect(t('memo_name_partial')).toBe(5);
    expect(t('memo_name_fuzzy')).toBe(5);
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

  it("'AGVAANNINJ 4SA' → student 3 gets memo_grade_class + memo_name_partial (tier 3)", () => {
    const signals = extractSignals('AGVAANNINJ 4SA', BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, null, fullContext);
    const agv = cands.find((c) => c.studentId === 3);
    expect(agv).toBeDefined();
    expect(agv?.tier).toBe(3);
  });

  it('sender_account alone → tier 3 candidate', () => {
    const signals = extractSignals('random memo', BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, 'ACC-ONE', fullContext);
    const c = cands.find((c) => c.studentId === 1);
    expect(c).toBeDefined();
    expect(c?.tier).toBe(3);
  });

  it('fuzzy only fires when no exact name match exists', () => {
    // Misspelled "amartubshin" (b vs v).
    const signals = extractSignals('4BA amartubshin', BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, null, fullContext);
    const ama = cands.find((c) => c.signals.has('memo_name_fuzzy'));
    expect(ama?.fuzzyDistance).toBe(1);
  });

  it("'AGVAANNINJ' (no grade) — single name token = partial, tier 5", () => {
    const signals = extractSignals('AGVAANNINJ payment', BigInt('100000'), fullContext);
    const cands = resolveStudent(signals, null, fullContext);
    const agv = cands.find((c) => c.studentId === 3);
    expect(agv?.tier).toBe(5);
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
