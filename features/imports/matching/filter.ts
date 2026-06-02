import { normalize } from './normalize';
import type { BankTransactionInput } from './types';

const NON_PAYMENT_KEYWORDS_NORMALIZED: string[] = [
  'ooriin dans hoorond',  // "өөрийн данс хооронд" (between own accounts)
  'oorin dans',
  'swift',
  'shimtgel',             // "шимтгэл" (bank fee)
  'ibank',
];

export function shouldAttemptMatch(tx: BankTransactionInput): boolean {
  if (tx.isOutgoing === true) return false;

  const acc = (tx.senderAccount ?? '').trim();
  if (acc.length === 0) return false;
  if (acc.toUpperCase() === 'FEE') return false;

  const memo = normalize(tx.memo ?? '');
  for (const kw of NON_PAYMENT_KEYWORDS_NORMALIZED) {
    if (memo.includes(kw)) return false;
  }
  return true;
}
