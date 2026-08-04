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

/**
 * Incoming money that is real, but is not a parent paying a fee: another school
 * settling a basketball tournament invoice, an electricity refund, a social
 * insurance transfer, the cash register.
 *
 * These reach matching (they are ordinary incoming transfers) and used to sit
 * in the unmatched pile beside genuine failures, where they cost a reviewer the
 * same attention as a payment that needs fixing. Recognising them lets the
 * review screen offer them as a batch to discard.
 *
 * Deliberately conservative: a hit means "do not treat as a student payment",
 * so a keyword that could plausibly appear in a parent's memo does not belong
 * here. Counterparty words ("сургууль" — school) only count alongside a second
 * signal, because a parent might well name the school in their memo.
 */
const NON_STUDENT_KEYWORDS: string[] = [
  'ubac', // the inter-school sports league
  'тэмцээн', // tournament
  'play off',
  'play-off',
  'playoff',
  'playoffs',
  'invoice',
  'цахилгаан', // electricity
  'кассаас', // from the cash register
  'тэтгэмж', // benefit / allowance
  'буцаалт', // refund returned
  'butsaalt',
  'conference',
  'зар сурталчилгаа', // advertising
];

const NON_STUDENT_NORMALIZED = NON_STUDENT_KEYWORDS.map((k) => normalize(k)).filter(
  (k) => k.length > 0,
);

export function looksNonStudent(tx: BankTransactionInput): boolean {
  const haystack = `${normalize(tx.memo ?? '')} ${normalize(tx.senderAccountName ?? '')}`;
  return NON_STUDENT_NORMALIZED.some((kw) => haystack.includes(kw));
}
