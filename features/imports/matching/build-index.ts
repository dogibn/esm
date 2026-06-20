import { normalize } from './normalize';
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
  // Match patterns like "5 grade", "5grade", "5-р анги", "5-r angi", "5 анги".
  // Capture group: the digit(s). Avoid + levels by NOT consuming a trailing +.
  return /(?<![a-z0-9~+])(\d{1,2})(?!\+)\s*(?:grade|анги|-?\s*р\s*анги|-?\s*r\s*angi)\b/gi;
}

export function buildMatchingContext(input: BuildIndexInput): MatchingContext {
  // 1. classAlternation — every distinct normalized grade name in enrollments.
  const classVocabSet = new Set<string>();
  for (const e of input.enrollments) {
    const c = normalize(e.gradeName);
    if (c.length > 0) classVocabSet.add(c);
  }
  const classVocabulary = [...classVocabSet];
  const classAlternation = buildAlternation(classVocabulary);

  // 2. levelAlternation — fixed pattern; doesn't need to depend on data.
  const levelAlternation = levelRegex();

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

  // 4. gradeIndex — normalized class name → student_ids.
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

  // 6. nameIndex — name tokens → student_ids.
  const nameIndex = new Map<string, number[]>();
  for (const s of input.students) {
    const tokens = new Set<string>();
    for (const raw of (s.firstName ?? '').split(/\s+/)) {
      const n = normalize(raw);
      if (n.length >= 2 && !/^\d+$/.test(n)) tokens.add(n);
    }
    for (const raw of (s.lastName ?? '').split(/\s+/)) {
      const n = normalize(raw);
      if (n.length >= 2 && !/^\d+$/.test(n)) tokens.add(n);
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

  // 9. openChargesByStudent — pre-group if not provided.
  const openChargesByStudent =
    input.openChargesByStudent ?? groupChargesByStudent(input.openCharges);

  return {
    classAlternation,
    levelAlternation,
    classVocabulary,
    feeVocabulary,
    gradeIndex,
    levelIndex,
    nameIndex,
    nameTokenList,
    accountIndex,
    openChargesByStudent,
    amountFeeIndex,
  };
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
