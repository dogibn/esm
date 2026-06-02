import { normalize } from './normalize';
import { KINDERGARTEN_LEVEL_CODES } from './vocabulary';
import type { ExtractedSignals, FeeTag, MatchingContext } from './types';

function feeTagKey(tag: FeeTag): string {
  if (typeof tag === 'string') return tag;
  return `club:${tag.feeStructureId}`;
}

export function extractSignals(
  memo: string,
  amount: bigint,
  context: MatchingContext,
): ExtractedSignals {
  // 1. Split off any trailing parenthetical block.
  let body = memo ?? '';
  let senderBlock = '';
  const parenMatch = body.match(/\(([^)]*)\)\s*$/);
  if (parenMatch) {
    senderBlock = normalize(parenMatch[1] ?? '');
    body = body.slice(0, parenMatch.index ?? body.length);
  }

  const norm = normalize(body);

  // Track which chars in `norm` have already been "consumed" by a matched
  // token so they don't end up in name_tokens.
  const consumed = new Array<boolean>(norm.length).fill(false);
  const consumeRange = (start: number, len: number) => {
    for (let i = start; i < start + len && i < consumed.length; i++) {
      consumed[i] = true;
    }
  };

  const classTokens: string[] = [];
  const wildcardTokens: string[] = [];
  const levelTokens: string[] = [];
  const explicitFeeHints: FeeTag[] = [];
  const seenFeeTags = new Set<string>();
  const addFeeHint = (tag: FeeTag) => {
    const key = feeTagKey(tag);
    if (seenFeeTags.has(key)) return;
    seenFeeTags.add(key);
    explicitFeeHints.push(tag);
  };

  // 3a. Class tokens via classAlternation.
  if (context.classAlternation) {
    const re = new RegExp(context.classAlternation.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(norm)) !== null) {
      classTokens.push(m[0]);
      consumeRange(m.index, m[0].length);
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  // 3b. Wildcard pattern \d+~\w*  — expand against class vocabulary by prefix.
  const wildcardRe = /(?<![a-z0-9~+])(\d+~[a-z0-9]*)/g;
  {
    let m: RegExpExecArray | null;
    while ((m = wildcardRe.exec(norm)) !== null) {
      const tok = m[1]!;
      const prefix = tok.replace(/~.*$/, '');
      const suffix = tok.slice(tok.indexOf('~') + 1);
      for (const cls of context.classVocabulary) {
        if (cls.startsWith(prefix) && cls.length > prefix.length) {
          // suffix may further constrain.
          if (suffix.length === 0 || cls.includes(suffix)) {
            wildcardTokens.push(cls);
          }
        }
      }
      consumeRange(m.index, tok.length);
    }
  }

  // 3c. Level tokens.
  if (context.levelAlternation) {
    const re = new RegExp(context.levelAlternation.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(norm)) !== null) {
      const digit = m[1]!;
      levelTokens.push(digit);
      consumeRange(m.index, m[0].length);
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  // 3d. Kindergarten — if hit AND no class token, add all + levels.
  const hasKindergarten = [...context.feeVocabulary.kindergartenTokens].some(
    (kw) => kw.length > 0 && norm.includes(kw),
  );
  if (hasKindergarten && classTokens.length === 0) {
    // Note: the plan calls these `level` tokens — they go into the same bucket.
    // They are the `+` levels and don't have entries in levelIndex (which
    // excludes +), so they only resolve via fuzzy/class fallback. We still
    // record them for downstream inspection.
    for (const lvl of KINDERGARTEN_LEVEL_CODES) {
      levelTokens.push(lvl);
    }
    // Consume the kindergarten word(s) so they don't show up as name tokens.
    for (const kw of context.feeVocabulary.kindergartenTokens) {
      if (kw.length === 0) continue;
      let idx = norm.indexOf(kw);
      while (idx !== -1) {
        consumeRange(idx, kw.length);
        idx = norm.indexOf(kw, idx + kw.length);
      }
    }
  }

  // 4a. Fee hints (explicit) via feeVocabulary alternation.
  if (context.feeVocabulary.alternation) {
    const re = new RegExp(context.feeVocabulary.alternation.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(norm)) !== null) {
      const matched = m[0];
      // Lookup the entry whose normalizedToken equals the match (case-insensitive).
      const entry = context.feeVocabulary.entries.find(
        (e) => e.normalizedToken === matched.toLowerCase(),
      );
      if (entry) addFeeHint(entry.tag);
      consumeRange(m.index, matched.length);
      if (matched.length === 0) re.lastIndex++;
    }
  }

  // 4b. Fee hint from amount.
  const fromAmount = context.amountFeeIndex.get(amount) ?? null;

  // 5. Name tokens — what's left in norm that wasn't consumed.
  const remaining: string[] = [];
  let buf = '';
  for (let i = 0; i < norm.length; i++) {
    if (consumed[i]) {
      if (buf) {
        remaining.push(buf);
        buf = '';
      }
      continue;
    }
    const ch = norm[i]!;
    if (ch === ' ') {
      if (buf) {
        remaining.push(buf);
        buf = '';
      }
    } else {
      buf += ch;
    }
  }
  if (buf) remaining.push(buf);

  // Strip generic payment tokens and short/numeric tokens.
  const nameTokens: string[] = [];
  for (const tok of remaining) {
    if (tok.length < 2) continue;
    if (/^\d+$/.test(tok)) continue;
    if (context.feeVocabulary.genericTokens.has(tok)) continue;
    // Strip leading/trailing punctuation chars except `.` (kept for initials).
    const trimmed = tok.replace(/^[-+]+|[-+]+$/g, '');
    if (trimmed.length < 2) continue;
    if (/^\d+$/.test(trimmed)) continue;
    nameTokens.push(trimmed);
  }

  return {
    gradeTokens: {
      class: dedupe(classTokens),
      wildcard: dedupe(wildcardTokens),
      level: dedupe(levelTokens),
    },
    nameTokens: dedupe(nameTokens),
    feeHints: { explicit: explicitFeeHints, fromAmount },
    senderBlock,
  };
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
