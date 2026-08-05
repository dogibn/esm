import { normalize } from './normalize';
import { KINDERGARTEN_LEVEL_CODES } from './vocabulary';
import type { ExtractedSignals, FeeTag, MatchingContext } from './types';

function feeTagKey(tag: FeeTag): string {
  if (typeof tag === 'string') return tag;
  if (tag.kind === 'club_category') return `club_category:${tag.category}`;
  return `club:${tag.feeStructureId}`;
}

/**
 * Separate a memo's payment text from the trailing "(BANK PAYER NAME)" block
 * the bank appends. That block names whoever holds the account — a parent, an
 * aunt, a company — never a student, so nothing that identifies a *student* may
 * read from it. Exported because multi-student detection works on the raw memo
 * (normalize wipes the commas it splits on) and would otherwise read a payer's
 * surname as a second child.
 */
export function splitSenderBlock(memo: string): { body: string; senderBlock: string } {
  const parenMatch = memo.match(/\(([^)]*)\)\s*$/);
  if (!parenMatch) return { body: memo, senderBlock: '' };
  return {
    body: memo.slice(0, parenMatch.index ?? memo.length),
    senderBlock: parenMatch[1] ?? '',
  };
}

export function extractSignals(
  memo: string,
  amount: bigint,
  context: MatchingContext,
): ExtractedSignals {
  // 1. Split off any trailing parenthetical block.
  const split = splitSenderBlock(memo ?? '');
  const body = split.body;
  const senderBlock = normalize(split.senderBlock);

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

  // Degrade a grade-like token that names no real class. "4A" when the classes
  // are 4BA/4SA/4+A is a parent abbreviating, not naming: the digit is still a
  // level, and the letter still narrows to the classes containing it — the same
  // constraint semantics as the explicit `4~a` wildcard. Dropping the token
  // (what happened before) threw away the memo's only disambiguator.
  const degradeClassLike = (digits: string, letters: string): void => {
    for (const cls of context.classVocabulary) {
      if (!cls.startsWith(digits)) continue;
      const rest = cls.slice(digits.length);
      if (rest.length === 0 || /^\d/.test(rest)) continue;
      if (rest.includes(letters)) wildcardTokens.push(cls);
    }
    levelTokens.push(digits);
  };

  // 3b-2. A class split across a separator — "3 LM", "4 BE.", "10 B". normalize
  // turns the separator into a space, so the contiguous pass above can't see it.
  // A join that lands on a real class (or a lookalike alias) is a class token;
  // one that doesn't ("5 В" — no such class) degrades to level + wildcard
  // rather than inventing a class.
  {
    // The trailing `.` guard keeps a level keyword's digit away from a
    // following initial form — "GRADE 12 E.TEMUULEN" is not "12 E".
    const splitRe = /(?<![a-z0-9~+])(\d{1,2})\s+([a-z]{1,3})(?![a-z0-9.])/g;
    let m: RegExpExecArray | null;
    while ((m = splitRe.exec(norm)) !== null) {
      const joined = `${m[1]}${m[2]}`;
      if (context.classLookup.has(joined)) {
        classTokens.push(joined);
        consumeRange(m.index, m[0].length);
      } else if (m[2]!.length <= 2) {
        degradeClassLike(m[1]!, m[2]!);
        consumeRange(m.index, m[0].length);
      }
    }
  }

  // 3c. Level tokens — digit-first ("5 angi") then keyword-first ("grade 12").
  const levelPatterns = [context.levelAlternation, context.levelFirstAlternation];
  for (const pattern of levelPatterns) {
    if (!pattern) continue;
    const re = new RegExp(pattern.source, 'gi');
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
  // Class names (with their lookalike aliases) sorted longest-first so a glued
  // prefix peels the most specific class ("8va" before "8v").
  const sortedClassVocab = [...context.classLookup].sort(
    (a, b) => b.length - a.length,
  );
  const isGeneric = (t: string) => context.feeVocabulary.genericTokens.has(t);
  // Each entry is one source token together with its alternate spellings; a
  // student matching any spelling counts once, not once per variant.
  const nameGroups: string[][] = [];
  const bareDigits: string[] = [];

  // A single-letter token next to a name is an initial the dot didn't survive
  // normalize: "I KHUSLEN" (leading), or "SONDOR.E" (trailing — the dot after a
  // multi-letter word becomes a space, stranding the surname initial). Re-join
  // it into the directory's `x.name` form, but only when that form actually
  // resolves — like the genitive recovery, consulting the index means this can
  // only ever add a real student, never noise.
  const initialJoins = new Map<number, string[]>();
  for (let i = 0; i < remaining.length; i++) {
    if (!/^[a-z]$/.test(remaining[i]!)) continue;
    outer: for (const j of [i + 1, i - 1]) {
      const name = remaining[j];
      if (!name || name.length < 2 || !/^[a-z][a-z-]+$/.test(name)) continue;
      // A bank prefix glued with a hyphen ("EB-ENEREL") hides the name, so try
      // the hyphen parts too.
      const parts = name.includes('-')
        ? [name, ...name.split('-').filter((p) => p.length >= 2)]
        : [name];
      for (const part of parts) {
        const joined = `${remaining[i]}.${part}`;
        if (!context.nameIndex.has(joined)) continue;
        const list = initialJoins.get(j);
        if (list) list.push(joined);
        else initialJoins.set(j, [joined]);
        break outer;
      }
    }
  }

  for (let tokIndex = 0; tokIndex < remaining.length; tokIndex++) {
    const tok = remaining[tokIndex]!;
    if (/^\d{1,2}$/.test(tok)) {
      // A lone 1–12 is a grade level far more often than it is anything else
      // ("Б.ЭЛБЭРЭЛ 3", "ENHBAT TSEGTSHUR 1"). Held back until we know the memo
      // carries a name too, so a stray number in an otherwise nameless memo
      // can't drag in a whole grade.
      bareDigits.push(tok);
      continue;
    }
    // A digit-letter token the class pass didn't consume is a grade the school
    // has no class for ("4A" against 4BA/4SA/4+A) — degrade it, never treat it
    // as a name.
    const classLike = tok.match(/^(\d{1,2})([a-z]{1,2})$/);
    if (classLike) {
      degradeClassLike(classLike[1]!, classLike[2]!);
      continue;
    }
    if (tok.length < 2) continue;
    if (/^\d+$/.test(tok)) continue;
    if (isGeneric(tok)) continue;
    // Strip leading/trailing punctuation chars except `.` (kept for initials).
    let trimmed = tok.replace(/^[-+]+|[-+]+$/g, '');
    if (trimmed.length < 2) continue;
    if (/^\d+$/.test(trimmed)) continue;
    // Peel a grade glued onto the name with no separator ("8вUjinlkham" →
    // class 8v + name ujinlkham; "Enuujin7" → name enuujin + level 7) so both
    // the grade and the name register instead of the whole blob being a dead
    // name token.
    const peeled = peelGluedGrade(trimmed, sortedClassVocab);
    // Only trust the peel when what's left is a plausible name. "CLUB1" and
    // "TERM4" peel to a generic word plus a digit, and that digit is not a
    // grade — committing it would put the whole of grade 1 in the running.
    const peelRestIsName = peeled.rest.length >= 2 && !isGeneric(peeled.rest);
    if (peelRestIsName) {
      if (peeled.classTok) classTokens.push(peeled.classTok);
      if (peeled.levelTok) levelTokens.push(peeled.levelTok);
      trimmed = peeled.rest;
    }
    if (trimmed.length < 2) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (isGeneric(trimmed)) continue;

    const group = new Set<string>([trimmed]);
    // A hyphenated name gets written every way round — "Anhil-Ujin",
    // "Anhil Ujin", "Anhiljin". The directory indexes all three (see
    // nameTokenForms); split here so the memo side meets it halfway.
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-').filter((p) => p.length >= 2 && !isGeneric(p));
      for (const p of parts) group.add(p);
      if (parts.length > 1) group.add(parts.join(''));
    }
    // Additively recover a name written in the genitive ("Ариунболдын" →
    // "Ariunbold"). Only emitted when it resolves to a real directory name, so
    // it never adds noise.
    for (const form of [...group]) {
      const deg = degenitiveVariant(form, context.nameIndex);
      if (deg) group.add(deg);
    }
    // An adjacent single-letter initial rejoined into the `x.name` form belongs
    // to this written name, not to a name of its own.
    for (const joined of initialJoins.get(tokIndex) ?? []) group.add(joined);
    nameGroups.push([...group]);
  }

  if (nameGroups.length > 0) {
    for (const d of bareDigits) {
      const n = Number(d);
      if (n >= 1 && n <= 12) levelTokens.push(String(n));
    }
  }

  return {
    gradeTokens: {
      class: dedupe(classTokens),
      wildcard: dedupe(wildcardTokens),
      level: dedupe(levelTokens),
    },
    nameTokens: dedupe(nameGroups.flat()),
    nameGroups,
    feeHints: { explicit: explicitFeeHints, fromAmount },
    senderBlock,
  };
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// Mongolian genitive/patronymic suffixes as they appear AFTER normalize()
// (transliteration + kh→h + o→u fold). A parent's or student's name is
// frequently written in the genitive in memos — "Ариунболдын Нандинбэлэг"
// ("Ariunbold's Nandinbeleg") — while the student directory stores the
// nominative ("Ariunbold"). Longest first so the most specific ending wins.
const GENITIVE_SUFFIXES = ['giin', 'iin', 'yin', 'iyn', 'yn', 'ny', 'in'];

// Return the de-genitive stem of `token` IFF the token itself is not a known
// name token but stripping a genitive suffix yields one that is. Consulting the
// index makes this precise: we never invent a variant that doesn't resolve to a
// real student, so it only ever *adds* a correct candidate — no spurious noise,
// and no double-counting against the distinct-name-token heuristic (the original
// form, being absent from the index, contributes no hit of its own).
export function degenitiveVariant(
  token: string,
  nameIndex: Map<string, number[]>,
): string | null {
  if (nameIndex.has(token)) return null;
  for (const suf of GENITIVE_SUFFIXES) {
    if (!token.endsWith(suf)) continue;
    const stem = token.slice(0, token.length - suf.length);
    if (stem.length < 4) continue;
    if (nameIndex.has(stem)) return stem;
  }
  return null;
}

// Split a grade glued directly onto a name (no separating space). Memos like
// "8вUjinlkham" or "Enuujin7" collapse, after normalize, to a single token that
// matches neither the grade alternation (its boundary lookarounds reject the
// adjacent letter/digit) nor any directory name. Peeling restores both signals.
//
// `sortedClassVocab` must be longest-first so the most specific class wins.
export function peelGluedGrade(
  token: string,
  sortedClassVocab: string[],
): { classTok: string | null; levelTok: string | null; rest: string } {
  // 1. Leading class-name prefix followed by a name: "8vujinlkham" → 8v + ...
  //    Classes always begin with a digit, so this never mis-fires on a plain
  //    (letter-initial) name.
  for (const c of sortedClassVocab) {
    if (c.length < 2 || token.length <= c.length) continue;
    if (!token.startsWith(c)) continue;
    if (/[a-z]/.test(token[c.length] ?? '')) {
      return { classTok: c, levelTok: null, rest: token.slice(c.length) };
    }
  }
  // 2. Leading bare grade level followed by a name: "7enuujin" → level 7 + ...
  const lead = token.match(/^(\d{1,2})([a-z]{2,}.*)$/);
  if (lead) {
    return { classTok: null, levelTok: lead[1]!, rest: lead[2]! };
  }
  // 3. Trailing digits on a name. 1–2 digits read as a grade level
  //    ("enuujin7" → 7); longer runs are stripped as noise (ids/phones).
  const trail = token.match(/^([a-z][a-z.\-]*?)(\d+)$/);
  if (trail) {
    const digits = trail[2]!;
    return {
      classTok: null,
      levelTok: digits.length <= 2 ? digits : null,
      rest: trail[1]!,
    };
  }
  return { classTok: null, levelTok: null, rest: token };
}
