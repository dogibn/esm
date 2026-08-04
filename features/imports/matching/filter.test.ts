import { describe, expect, it } from 'vitest';
import { looksNonStudent, shouldAttemptMatch } from './filter';
import type { BankTransactionInput } from './types';

function tx(overrides: Partial<BankTransactionInput> = {}): BankTransactionInput {
  return {
    memo: '',
    amount: BigInt('100000'),
    senderAccount: 'ACC1',
    ...overrides,
  };
}

describe('shouldAttemptMatch', () => {
  it('rejects outgoing transactions', () => {
    expect(shouldAttemptMatch(tx({ isOutgoing: true }))).toBe(false);
  });

  it('rejects blank sender_account', () => {
    expect(shouldAttemptMatch(tx({ senderAccount: '' }))).toBe(false);
    expect(shouldAttemptMatch(tx({ senderAccount: null }))).toBe(false);
    expect(shouldAttemptMatch(tx({ senderAccount: '   ' }))).toBe(false);
  });

  it('rejects sender_account "FEE"', () => {
    expect(shouldAttemptMatch(tx({ senderAccount: 'FEE' }))).toBe(false);
    expect(shouldAttemptMatch(tx({ senderAccount: 'fee' }))).toBe(false);
  });

  it('rejects inter-account transfers ("өөрийн данс хооронд")', () => {
    expect(
      shouldAttemptMatch(tx({ memo: 'Өөрийн данс хооронд шилжүүлэг' })),
    ).toBe(false);
  });

  it('rejects SWIFT-tagged memos', () => {
    expect(shouldAttemptMatch(tx({ memo: 'SWIFT incoming' }))).toBe(false);
  });

  it('rejects bank-fee memos (шимтгэл)', () => {
    expect(shouldAttemptMatch(tx({ memo: 'шимтгэл' }))).toBe(false);
  });

  it('rejects ibank rows', () => {
    expect(shouldAttemptMatch(tx({ memo: 'ibank payment fee' }))).toBe(false);
  });

  it('accepts a real student payment memo', () => {
    expect(
      shouldAttemptMatch(
        tx({ memo: '4SA AGVAANNINJ BUS PAYMENT', senderAccount: '1234' }),
      ),
    ).toBe(true);
  });

  it('accepts a Cyrillic real student payment memo', () => {
    expect(
      shouldAttemptMatch(
        tx({ memo: 'Б.БААТАР 8Д САГСАН БӨМБӨГ', senderAccount: '5678' }),
      ),
    ).toBe(true);
  });
});

describe('looksNonStudent', () => {
  const tx = (memo: string, senderAccountName = ''): BankTransactionInput => ({
    memo,
    amount: BigInt('120000'),
    senderAccount: 'MN01',
    senderAccountName,
    isOutgoing: false,
  });

  it('recognises another school settling a tournament invoice', () => {
    expect(looksNonStudent(tx('EB -Acd. 5395348, UBAC HS girls Basketball Playoffs, ESM'))).toBe(true);
    expect(looksNonStudent(tx('EB -Жэт сургууль, UBAC тэмцээний төлбөр'))).toBe(true);
  });

  it('recognises utility bills, refunds and the cash register', () => {
    expect(looksNonStudent(tx('EB -цахилгааны төлбөрт'))).toBe(true);
    expect(looksNonStudent(tx('кассаас'))).toBe(true);
    expect(looksNonStudent(tx('TAETSEG BUTSAALT'))).toBe(true);
  });

  it('leaves ordinary fee payments alone', () => {
    expect(looksNonStudent(tx('Б.БААТАР 8Д САГСАН БӨМБӨГ'))).toBe(false);
    expect(looksNonStudent(tx('BUS 11A KHERLEN'))).toBe(false);
    expect(looksNonStudent(tx('EB -B.Margad 11B bus fee term3'))).toBe(false);
  });
});
