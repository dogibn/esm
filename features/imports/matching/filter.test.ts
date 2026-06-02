import { describe, expect, it } from 'vitest';
import { shouldAttemptMatch } from './filter';
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
