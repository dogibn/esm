import { normalize } from './normalize';
import type { BankTransactionInput } from './types';

// Raw keywords — normalized (and therefore o/u-folded) at module load so they
// compare against the normalized memo on the same footing. Written in their
// natural form rather than a hand-rolled normalized spelling, which previously
// drifted out of sync with normalize() (e.g. "ooriin" never matched the folded
// "uuriin" that the Cyrillic "өөрийн" actually produces).
const NON_PAYMENT_KEYWORDS: string[] = [
  'өөрийн данс хооронд',   // between own accounts
  'свифт',                 // SWIFT
  'swift',
  'шимтгэл',               // bank fee
  'ibank',
];

const NON_PAYMENT_KEYWORDS_NORMALIZED: string[] = NON_PAYMENT_KEYWORDS.map(
  (kw) => normalize(kw),
).filter((kw) => kw.length > 0);

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
