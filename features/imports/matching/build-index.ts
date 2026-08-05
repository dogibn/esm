import { normalize, visualVariants } from './normalize';
import {
  CLUB_CATEGORIES,
  GENERIC_PAYMENT_TOKENS,
  KINDERGARTEN_TOKENS,
  SPECIFIC_FEE_TOKENS,
} from './vocabulary';
import type {
  BuildIndexInput,
  ChargeWithBalance,
  FeeTag,
  FeeVocabulary,
  FeeVocabularyEntry,
  MatchingContext,
  ProposedCharge,
} from './types';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addToMultiMap<K>(map: Map<K, number[]>, key: K, value: number): void {
  const list = map.get(key);
  if (list) {
    if (!list.includes(value)) list.push(value);
  } else {
    map.set(key, [value]);
  }
}

function buildAlternation(tokens: string[]): RegExp | null {
  if (tokens.length === 0) return null;
  // Longest first to avoid prefix-overshadow (e.g. "5+a" before "5+").
  const sorted = [...new Set(tokens)].sort((a, b) => b.length - a.length);
  const pattern = sorted.map(escapeRegex).join('|');
  // Use lookarounds rather than \b so that tokens containing `+` (e.g. "5+a")
  // still anchor correctly — \b doesn't treat `+` as a word boundary.
  return new RegExp(`(?<![a-z0-9~+])(?:${pattern})(?![a-z0-9~+])`, 'gi');
}

function levelRegex(): RegExp {
  // Match "5 grade", "5grade", "5-r angi", "5r angi", "5 angi", "5angi".
  // Capture group: the digit(s). Avoid + levels by NOT consuming a trailing +.
  //
  // The regex runs on NORMALIZED text, so Cyrillic never reaches it — "5-р анги"
  // arrives as "5-r angi". The `r` (from "-р", the ordinal suffix) is optional:
  // plain "5 ANGI" and "5B ANGI" are at least as common as the suffixed form and
  // used to produce no level signal at all.
  //
  // `[a-z]{1,3}\s` absorbs a class letter sitting between the digit and the
  // keyword ("5B ANGI") — the class itself is picked up separately by the class
  // alternation when it is one the school actually has.
  return /(?<![a-z0-9~+])(\d{1,2})(?!\+)\s*(?:[a-z]{1,3}\s+)?-?\s*(?:r\s*)?(?:grade|angi)\b/gi;
}

function levelFirstRegex(): RegExp {
  // The keyword-first form: "grade 12", "grade-12", "angi 5".
  return /\b(?:grade|angi)\s*[-#]?\s*(\d{1,2})(?!\+)(?![a-z0-9])/gi;
}

/**
 * Alternate spellings of a class name that a Cyrillic-keyboard memo produces
 * ("8B" ← "8В" → "8v"), keyed alias → canonical class.
 *
 * An alias is dropped when it collides with a real class name or with another
 * class's alias: guessing between two real classes is worse than not resolving
 * the token at all, and the level signal still survives.
 */
export function buildClassAliases(classVocabulary: string[]): Map<string, string> {
  const real = new Set(classVocabulary);
  const aliases = new Map<string, string>();
  const collided = new Set<string>();
  for (const cls of classVocabulary) {
    for (const variant of visualVariants(cls)) {
      if (variant === cls || real.has(variant)) continue;
      if (aliases.has(variant) && aliases.get(variant) !== cls) {
        collided.add(variant);
        continue;
      }
      aliases.set(variant, cls);
    }
  }
  for (const c of collided) aliases.delete(c);
  return aliases;
}

export function buildMatchingContext(input: BuildIndexInput): MatchingContext {
  // 1. classAlternation — every distinct normalized grade name in enrollments,
  //    plus the Cyrillic-lookalike aliases of each.
  const classVocabSet = new Set<string>();
  for (const e of input.enrollments) {
    const c = normalize(e.gradeName);
    if (c.length > 0) classVocabSet.add(c);
  }
  const classVocabulary = [...classVocabSet];
  const classAliases = buildClassAliases(classVocabulary);
  const classAlternation = buildAlternation([
    ...classVocabulary,
    ...classAliases.keys(),
  ]);

  // 2. level patterns — fixed; don't need to depend on data.
  const levelAlternation = levelRegex();
  const levelFirstAlternation = levelFirstRegex();

  // 3. feeVocabulary — combine specific fee tokens + per-term club tokens.
  const entries: FeeVocabularyEntry[] = [];
  for (const { token, tag } of SPECIFIC_FEE_TOKENS) {
    const n = normalize(token);
    if (n.length > 0) entries.push({ normalizedToken: n, tag });
  }
  for (const f of input.currentTermFees) {
    if (!f.isClub) continue;
    const tag: FeeTag = {
      kind: 'club',
      feeStructureId: f.feeStructureId,
      feeName: f.feeName,
    };
    const feeNameNorm = normalize(f.feeName);
    if (feeNameNorm.length > 0) entries.push({ normalizedToken: feeNameNorm, tag });
    // Each fee-name token individually as well (so "Cheerleading GR3" also
    // matches the word "cheerleading" in a memo).
    for (const tok of feeNameNorm.split(' ')) {
      if (tok.length >= 3) entries.push({ normalizedToken: tok, tag });
    }
    const aliases = input.clubAliases[String(f.feeStructureId)] ?? [];
    for (const a of aliases) {
      const an = normalize(a);
      if (an.length > 0) entries.push({ normalizedToken: an, tag });
    }
  }
  // Club-category aliases (Cyrillic + Latin) come LAST so a specific club fee
  // structure (above) wins the dedup for any shared token; the category hint is
  // the fallback that works even when no club fee structure is loaded for the
  // term — which is the common case (only the per-student club charges load).
  for (const cat of CLUB_CATEGORIES) {
    for (const alias of cat.aliases) {
      const n = normalize(alias);
      if (n.length > 0) {
        entries.push({
          normalizedToken: n,
          tag: { kind: 'club_category', category: cat.category },
        });
      }
    }
  }

  // Deduplicate (token, tag) pairs; if the same token maps to multiple tags,
  // the first one wins (specific fee tokens come first in the iteration above).
  const seen = new Set<string>();
  const dedupedEntries: FeeVocabularyEntry[] = [];
  for (const e of entries) {
    if (seen.has(e.normalizedToken)) continue;
    seen.add(e.normalizedToken);
    dedupedEntries.push(e);
  }

  const feeAlternation = buildAlternation(dedupedEntries.map((e) => e.normalizedToken));
  const feeVocabulary: FeeVocabulary = {
    entries: dedupedEntries,
    alternation: feeAlternation,
    genericTokens: new Set(GENERIC_PAYMENT_TOKENS.map((t) => normalize(t)).filter((t) => t.length > 0)),
    kindergartenTokens: new Set(KINDERGARTEN_TOKENS.map((t) => normalize(t)).filter((t) => t.length > 0)),
  };

  // 4. gradeIndex — normalized class name (and its aliases) → student_ids.
  const gradeIndex = new Map<string, number[]>();
  // 5. levelIndex — non-+ grade levels → student_ids.
  const levelIndex = new Map<string, number[]>();
  for (const e of input.enrollments) {
    const c = normalize(e.gradeName);
    if (c.length > 0) addToMultiMap(gradeIndex, c, e.studentId);
    if (!e.gradeLevelCode.includes('+')) {
      const lvl = normalize(e.gradeLevelCode);
      if (lvl.length > 0) addToMultiMap(levelIndex, lvl, e.studentId);
    }
  }
  for (const [alias, canonical] of classAliases) {
    for (const sid of gradeIndex.get(canonical) ?? []) {
      addToMultiMap(gradeIndex, alias, sid);
    }
  }

  // 6. nameIndex — name tokens → student_ids.
  const nameIndex = new Map<string, number[]>();
  const lastNameNormByStudent = new Map<number, string>();
  for (const s of input.students) {
    const lastNorm = normalize(s.lastName ?? '');
    if (lastNorm.length > 0) lastNameNormByStudent.set(s.id, lastNorm);
  }
  for (const s of input.students) {
    const tokens = new Set<string>();
    for (const raw of (s.firstName ?? '').split(/\s+/)) {
      for (const n of nameTokenForms(raw)) tokens.add(n);
    }
    for (const raw of (s.lastName ?? '').split(/\s+/)) {
      for (const n of nameTokenForms(raw)) tokens.add(n);
    }
    // Initial form: lastName[0] . firstName  (e.g. "b.baatar")
    const firstNorm = normalize(s.firstName ?? '');
    const lastNorm = normalize(s.lastName ?? '');
    if (lastNorm.length > 0 && firstNorm.length > 0) {
      const firstChunk = firstNorm.split(' ')[0] ?? '';
      const lastInitial = lastNorm[0] ?? '';
      if (lastInitial && firstChunk) {
        tokens.add(`${lastInitial}.${firstChunk}`);
      }
    }
    for (const t of tokens) addToMultiMap(nameIndex, t, s.id);
  }
  const nameTokenList = [...nameIndex.keys()];

  // 7. accountIndex — sender_account → student_ids (siblings = multiple).
  const accountIndex = new Map<string, number[]>();
  for (const link of input.confirmedAccountLinks) {
    addToMultiMap(accountIndex, link.senderAccount, link.studentId);
  }

  // 8. amountFeeIndex — unique amount → FeeTag. Collisions drop.
  const amountCandidates = new Map<bigint, FeeTag[]>();
  const addAmount = (amount: bigint, tag: FeeTag) => {
    const list = amountCandidates.get(amount);
    if (list) list.push(tag);
    else amountCandidates.set(amount, [tag]);
  };
  for (const f of input.currentYearFees) {
    const tag = feeNameToStaticTag(f.feeName);
    if (tag) addAmount(f.amount, tag);
  }
  for (const f of input.currentTermFees) {
    if (f.isClub) {
      addAmount(f.amount, {
        kind: 'club',
        feeStructureId: f.feeStructureId,
        feeName: f.feeName,
      });
    } else {
      const tag = feeNameToStaticTag(f.feeName);
      if (tag) addAmount(f.amount, tag);
    }
  }
  const amountFeeIndex = new Map<bigint, FeeTag>();
  for (const [amount, tags] of amountCandidates) {
    if (tags.length === 1) amountFeeIndex.set(amount, tags[0]!);
  }

  // 8b. proposableFees — the school-wide fees a payment may create.
  //
  // Restricted to non-club fees: a bus or registration rate is the same for
  // every student, so a charge built from it is exactly the one an accountant
  // would have entered. Clubs are per-student enrolments with per-session
  // pricing (domain_model.md) — inventing one from a bank memo would be a guess
  // about what the child attends, so those stay a manual decision.
  const proposableFees = new Map<string, ProposedCharge>();
  for (const f of input.currentTermFees) {
    if (f.isClub) continue;
    const tag = feeNameToStaticTag(f.feeName);
    if (!tag || typeof tag !== 'string') continue;
    if (input.academicTermId == null) continue;
    proposableFees.set(tag, {
      feeName: f.feeName,
      amount: f.amount,
      scope: 'term',
      academicTermId: input.academicTermId,
      reason: 'fee_hint_explicit',
    });
  }
  for (const f of input.currentYearFees) {
    const tag = feeNameToStaticTag(f.feeName);
    if (!tag || typeof tag !== 'string') continue;
    if (proposableFees.has(tag)) continue; // a term rate is more specific
    proposableFees.set(tag, {
      feeName: f.feeName,
      amount: f.amount,
      scope: 'annual',
      academicTermId: null,
      reason: 'fee_hint_explicit',
    });
  }

  // 9. openChargesByStudent — pre-group if not provided.
  const openChargesByStudent =
    input.openChargesByStudent ?? groupChargesByStudent(input.openCharges);

  return {
    classAlternation,
    levelAlternation,
    levelFirstAlternation,
    classVocabulary,
    classLookup: new Set([...classVocabulary, ...classAliases.keys()]),
    feeVocabulary,
    gradeIndex,
    levelIndex,
    nameIndex,
    nameTokenList,
    lastNameNormByStudent,
    accountIndex,
    openChargesByStudent,
    amountFeeIndex,
    proposableFees,
  };
}

/**
 * Every indexable form of one directory name part. A hyphenated Mongolian name
 * gets written all three ways in memos — "Nomin-Erdene", "Nomin Erdene",
 * "Nominerdene" — so all three are indexed and any of them resolves the student.
 *
 * The parts are indexed individually too, which is what lets a memo that writes
 * the halves as separate words hit this student twice and register as a full
 * name rather than a partial.
 */
export function nameTokenForms(raw: string): string[] {
  const n = normalize(raw ?? '');
  if (n.length < 2 || /^\d+$/.test(n)) return [];
  const forms = new Set<string>([n]);
  if (n.includes('-')) {
    const parts = n.split('-').filter((p) => p.length >= 2 && !/^\d+$/.test(p));
    for (const p of parts) forms.add(p);
    if (parts.length > 1) forms.add(parts.join(''));
  }
  return [...forms];
}

function feeNameToStaticTag(feeName: string): FeeTag | null {
  switch (feeName) {
    case 'tuition':
      return 'tuition';
    case 'bus_fee':
    case 'bus':
      return 'bus';
    case 'registration':
      return 'registration';
    default:
      return null;
  }
}

function groupChargesByStudent(
  charges: Array<ChargeWithBalance & { studentId: number }>,
): Map<number, ChargeWithBalance[]> {
  const map = new Map<number, ChargeWithBalance[]>();
  for (const { studentId, ...rest } of charges) {
    const list = map.get(studentId);
    if (list) list.push(rest);
    else map.set(studentId, [rest]);
  }
  return map;
}
