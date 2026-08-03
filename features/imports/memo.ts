/**
 * Memo presentation. Display-only — the memo is stored exactly as the bank sent
 * it, because it is the record of what arrived and matching reads the raw text.
 */

/**
 * Words that mark a trailing parenthetical as the bank's own counterparty
 * block rather than something the payer wrote. Mongolian banks (`БАНК`), the
 * non-bank lenders that appear the same way (`ББСБ`, `БСБ`), the Latin spelling
 * used by M Bank, and SWIFT transfers.
 */
const BANK_BLOCK = /банк|bank|ббсб|бсб|swift/i;

/** A trailing `(...)` group with no nested parentheses. */
const TRAILING_PAREN = /\s*\(([^()]*)\)\s*$/;

/**
 * The memo with the bank's appended sender block removed, for display.
 *
 * Every incoming row arrives with the counterparty repeated in parentheses —
 * "Х.ЕСҮЙ ТӨЛБӨР (ГОЛОМТ БАНК БААСАНСҮРЭН БАТМӨНХ)" — which is the same
 * information the row already shows as Sender and Account, and it crowds out the
 * part the payer actually wrote. Some rows carry two such blocks (the payer's
 * bank and an intermediary), so they are peeled until one doesn't look like a
 * bank.
 *
 * Only parentheses naming a bank are removed: "TANAKA KANON 8E BUS (TERM4)" and
 * "(FOR 6TH CLASS)" are the payer talking, and those stay. A memo that is
 * *nothing but* a bank block is returned unchanged rather than blanked — an
 * empty cell would be worse than a redundant one.
 */
export function memoWithoutSenderBlock(memo: string | null): string | null {
  if (!memo) return memo;
  let out = memo.trim();
  for (;;) {
    const match = out.match(TRAILING_PAREN);
    if (!match || match.index === undefined) break;
    if (!BANK_BLOCK.test(match[1] ?? "")) break;
    const trimmed = out.slice(0, match.index).trimEnd();
    if (trimmed.length === 0) break;
    out = trimmed;
  }
  return out;
}
