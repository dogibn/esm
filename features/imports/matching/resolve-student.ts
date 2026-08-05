import { extractSignals } from './extract-signals';
import { fuzzyMatchNameTokens } from './fuzzy';
import { normalize } from './normalize';
import type {
  ExtractedSignals,
  MatchingContext,
  SignalKind,
  StudentCandidate,
} from './types';

/**
 * Candidate scoring.
 *
 * The old model counted *how many kinds of signal* fired and read a tier off a
 * ladder. That throws away the one thing that actually separates a good name
 * match from a bad one: how many students the matched token points at. "Baatar"
 * and "b.erkhembayar" both count as one name token, but the first narrows the
 * directory to forty students and the second to exactly one.
 *
 * So evidence is scored, and every name hit is weighted by the selectivity of
 * the token that produced it. The tier survives only as a label for the UI.
 *
 * Weights are calibrated against scripts/qa/fixtures/matching_cases.json — the
 * numbers below are not arbitrary, and changing one should be accompanied by a
 * `pnpm qa:matching:score` run.
 */
const W_ACCOUNT = 1.0;
const W_CLASS = 0.35;
const W_WILDCARD = 0.25;
const W_LEVEL = 0.15;
/**
 * Each written name beyond the first that hits the same student. Two name
 * groups landing on one student is the "Surname Firstname" memo shape — far
 * stronger identification than the sum of the individual token weights, which
 * is all it earned before this bonus existed.
 */
const W_COVERAGE = 0.25;
/**
 * Grade-consistency adjustment among near-tied candidates (see below): the
 * lift for being the only near-tied candidate the memo's grade fits, and the
 * cost of contradicting a grade some other near-tied candidate satisfies.
 */
const W_GRADE_UNIQUE = 0.35;
const W_GRADE_CONTRA = 0.15;
/**
 * The band of "near-tied": within triage's dominance ratio of the best score.
 * Grade adjustments apply only inside it, so a memo's (possibly stale) grade
 * can settle a toss-up between equally-named students but can never overturn a
 * clearly stronger name — parents write last year's class often enough that a
 * grade is a tie-breaker, not a veto.
 */
const TIE_BAND = 1 / 1.5;

/** Weight of one exact name hit, by how many students share the matched token. */
function nameWeight(sharedBy: number): number {
  if (sharedBy <= 1) return 0.85;
  if (sharedBy <= 3) return 0.6;
  if (sharedBy <= 10) return 0.4;
  return 0.25;
}

/**
 * A fuzzy hit is worth a fraction of the exact hit it approximates — enough to
 * surface the student as a candidate, never enough to confirm one on its own.
 */
function fuzzyDecay(distance: number): number {
  return distance <= 1 ? 0.45 : 0.25;
}

const TIER_THRESHOLDS: Array<{ min: number; tier: 1 | 2 | 3 | 4 }> = [
  { min: 1.2, tier: 1 },
  { min: 0.85, tier: 2 },
  { min: 0.55, tier: 3 },
  { min: 0.32, tier: 4 },
];

export function tierFromScore(score: number): 1 | 2 | 3 | 4 | 5 {
  for (const { min, tier } of TIER_THRESHOLDS) {
    if (score >= min) return tier;
  }
  return 5;
}

/** The `x.name` shape the school's memos use — "B.Baatar", "О.Эрхэмбаяр". */
function isInitialForm(token: string): boolean {
  return /^[a-z]\.[a-z]+$/.test(token);
}

type Accumulator = {
  signals: Set<SignalKind>;
  score: number;
  /**
   * The grade-signal portion of `score`. Kept apart so the tie band below can
   * be drawn on identity evidence (names, account) alone — otherwise a student
   * matching a mere fragment of the written name plus the class would count as
   * a contender for the grade, and the real tie would never resolve.
   */
  gradeScore: number;
  /** Identifying evidence — a name or an account, as opposed to a grade. */
  identified: boolean;
  fuzzyDistance?: number;
};

function acc(map: Map<number, Accumulator>, studentId: number): Accumulator {
  const existing = map.get(studentId);
  if (existing) return existing;
  const fresh: Accumulator = {
    signals: new Set(),
    score: 0,
    gradeScore: 0,
    identified: false,
  };
  map.set(studentId, fresh);
  return fresh;
}

export function resolveStudent(
  signals: ExtractedSignals,
  senderAccount: string | null,
  context: MatchingContext,
): StudentCandidate[] {
  const candidates = new Map<number, Accumulator>();

  // ---- Grade evidence. Narrowing only: it constrains who the payer *could*
  // mean, but on its own it names nobody (see the `identified` guard below).
  const addGrade = (
    tokens: string[],
    index: Map<string, number[]>,
    kind: SignalKind,
    weight: number,
  ) => {
    for (const t of tokens) {
      for (const sid of index.get(t) ?? []) {
        const a = acc(candidates, sid);
        if (a.signals.has(kind)) continue; // one grade token of a kind is enough
        a.signals.add(kind);
        a.score += weight;
        a.gradeScore += weight;
      }
    }
  };
  addGrade(signals.gradeTokens.class, context.gradeIndex, 'memo_grade_class', W_CLASS);
  addGrade(
    signals.gradeTokens.wildcard,
    context.gradeIndex,
    'memo_grade_wildcard',
    W_WILDCARD,
  );
  addGrade(
    // Kindergarten "+" levels have no levelIndex entry — they resolve by class.
    signals.gradeTokens.level.filter((t) => !t.includes('+')),
    context.levelIndex,
    'memo_grade_level',
    W_LEVEL,
  );

  // ---- Name evidence, one contribution per written name (group), weighted by
  // the selectivity of the best token that matched.
  const groupsHitPerStudent = new Map<number, number>();
  const matchedTokensPerStudent = new Map<number, Set<string>>();
  const exactlyMatchedGroups = new Set<number>();

  signals.nameGroups.forEach((group, groupIndex) => {
    // best[studentId] = the strongest weight this group can give that student.
    const best = new Map<number, { weight: number; initial: boolean }>();
    for (const token of group) {
      const ids = context.nameIndex.get(token);
      if (!ids || ids.length === 0) continue;
      exactlyMatchedGroups.add(groupIndex);
      const weight = nameWeight(ids.length);
      const initial = isInitialForm(token);
      for (const sid of ids) {
        const prev = best.get(sid);
        if (!prev || weight > prev.weight) best.set(sid, { weight, initial });
        let tokens = matchedTokensPerStudent.get(sid);
        if (!tokens) matchedTokensPerStudent.set(sid, (tokens = new Set()));
        tokens.add(token);
      }
    }
    for (const [sid, { weight, initial }] of best) {
      const a = acc(candidates, sid);
      a.score += weight;
      a.identified = true;
      if (initial) a.signals.add('memo_name_initial');
      groupsHitPerStudent.set(sid, (groupsHitPerStudent.get(sid) ?? 0) + 1);
    }
  });

  for (const [sid, hits] of groupsHitPerStudent) {
    acc(candidates, sid).signals.add(hits >= 2 ? 'memo_name_full' : 'memo_name_partial');
    // A second written name landing on the same student is corroboration the
    // per-token weights don't capture: "ENKHBAYAR ENEREL" naming one child is
    // categorically better evidence than either token alone.
    if (hits >= 2) acc(candidates, sid).score += W_COVERAGE * (hits - 1);
  }

  // ---- Fuzzy, for the groups that matched nothing exactly. Runs regardless of
  // whether *other* groups in the memo matched: one misspelled name next to one
  // correct one is the common case, and gating on "no exact hit anywhere" (as
  // this used to) threw the misspelled half away.
  signals.nameGroups.forEach((group, groupIndex) => {
    if (exactlyMatchedGroups.has(groupIndex)) return;
    const best = new Map<number, { weight: number; distance: number }>();
    for (const token of group) {
      for (const { token: hit, distance } of fuzzyMatchNameTokens(
        token,
        context.nameTokenList,
      )) {
        if (distance === 0) continue;
        const ids = context.nameIndex.get(hit) ?? [];
        const weight = nameWeight(ids.length) * fuzzyDecay(distance);
        for (const sid of ids) {
          const prev = best.get(sid);
          if (!prev || weight > prev.weight) best.set(sid, { weight, distance });
        }
      }
    }
    for (const [sid, { weight, distance }] of best) {
      const a = acc(candidates, sid);
      a.score += weight;
      a.identified = true;
      a.signals.add('memo_name_fuzzy');
      a.fuzzyDistance = Math.min(a.fuzzyDistance ?? Infinity, distance);
    }
  });

  // ---- Account. The only signal that identifies with certainty; siblings on a
  // shared account all get it and are separated later by the charge stage.
  if (senderAccount) {
    for (const sid of context.accountIndex.get(senderAccount) ?? []) {
      const a = acc(candidates, sid);
      a.signals.add('sender_account');
      a.score += W_ACCOUNT;
      a.identified = true;
    }
  }

  // ---- Grade consistency, among near-ties only. When the memo carries a
  // grade and the top candidates are otherwise level, the one the grade fits
  // is almost certainly the one the payer meant — and the ones it contradicts
  // almost certainly aren't. Confined to the tie band so a stale class in a
  // memo can never overturn a clearly stronger name match.
  const gradeConstrained =
    signals.gradeTokens.class.length > 0 ||
    signals.gradeTokens.wildcard.length > 0 ||
    signals.gradeTokens.level.length > 0;
  if (gradeConstrained) {
    const hasGrade = (a: Accumulator) =>
      a.signals.has('memo_grade_class') ||
      a.signals.has('memo_grade_wildcard') ||
      a.signals.has('memo_grade_level');
    const identified = [...candidates.values()].filter((a) => a.identified);
    if (identified.length >= 2) {
      // The band is drawn on identity evidence alone: whether a candidate is a
      // contender is a question about the *name* the payer wrote, and letting
      // the grade weights themselves vote would beg it.
      const identity = (a: Accumulator) => a.score - a.gradeScore;
      const best = Math.max(...identified.map(identity));
      const band = identified.filter((a) => identity(a) >= best * TIE_BAND);
      const withGrade = band.filter(hasGrade);
      if (band.length >= 2 && withGrade.length >= 1 && withGrade.length < band.length) {
        for (const a of band) {
          if (!hasGrade(a)) a.score = Math.max(0, a.score - W_GRADE_CONTRA);
        }
        if (withGrade.length === 1) withGrade[0]!.score += W_GRADE_UNIQUE;
      }
    }
  }

  const result: StudentCandidate[] = [];
  for (const [sid, a] of candidates) {
    // A grade with no name and no account is not a proposal — it would put a
    // whole class up as candidates. It still scores, so the row can explain
    // what it *did* read from the memo.
    const tier = a.identified ? tierFromScore(a.score) : 5;
    const cand: StudentCandidate = {
      studentId: sid,
      signals: a.signals,
      tier,
      score: a.score,
      nameGroupsHit: groupsHitPerStudent.get(sid) ?? 0,
    };
    const tokens = matchedTokensPerStudent.get(sid);
    if (tokens) cand.matchedNameTokens = tokens;
    if (a.fuzzyDistance !== undefined) cand.fuzzyDistance = a.fuzzyDistance;
    result.push(cand);
  }
  result.sort((a, b) => b.score - a.score || a.tier - b.tier || a.studentId - b.studentId);
  return result;
}

const MULTI_SPLIT_RE = /\s*(?:,|，|、| and | & |;|\/)\s*/i;

export function detectMultiStudent(
  candidates: StudentCandidate[],
  signals: ExtractedSignals,
  rawMemo: string,
  context: MatchingContext,
): { studentIds: number[] } | null {
  void signals;
  // Gate: at least two distinct candidates with non-trivial confidence. A
  // tier-4 exact name counts — "Egshiglen, Tselmeg.G" names a second child
  // whose bare first name is shared by five students, and requiring tier ≤3 of
  // both children let the strong one swallow the whole transfer unflagged.
  // Fuzzy-only candidates stay out: a misspelling is not a second child.
  const tierLow = candidates.filter(
    (c) =>
      c.tier <= 3 ||
      (c.tier === 4 && (c.nameGroupsHit ?? 0) > 0 && !c.signals.has('memo_name_fuzzy')),
  );
  if (tierLow.length < 2) return null;
  const distinctIds = new Set(tierLow.map((c) => c.studentId));
  if (distinctIds.size < 2) return null;

  // Try explicit separators on the RAW memo (normalize wipes commas), then the
  // implicit boundaries sibling memos actually use — a fresh `X.Name` initial
  // form starts a new child ("Б.Батул Б.Жамул"), and so does the class that
  // ends the previous one ("З.ОЮУДАРЬ 11A З.НОМИНДАРЬ 8D").
  const norm = normalize(rawMemo);
  const attempts: string[][] = [
    rawMemo.split(MULTI_SPLIT_RE).map((s) => s.trim()).filter((s) => s.length > 0),
    splitOnInitialForms(norm),
    splitAfterClassTokens(norm, context),
    splitOnGradeBoundaries(norm),
  ];

  for (const segments of attempts) {
    if (segments.length < 2) continue;
    const perSegmentStudents = resolveEachSegment(segments, context);
    if (!perSegmentStudents) continue;
    if (perSegmentStudents.length < 2) continue;
    if (new Set(perSegmentStudents).size < 2) continue;
    return { studentIds: perSegmentStudents };
  }
  return null;
}

function resolveEachSegment(
  segments: string[],
  context: MatchingContext,
): number[] | null {
  // A segment naming nobody is not a failure — memos routinely lead with the
  // fee ("BUS FEE, BAT-ERDENE 8B, ANAR 6E") or trail with a phone number.
  // It contributes no student and the rest of the split stands.
  type Seg = { unique: number } | { ties: number[] };
  const segs: Seg[] = [];
  for (const seg of segments) {
    const segSignals = extractSignals(seg, BigInt('0'), context);
    const segCands = resolveStudent(segSignals, null, context);
    const top = segCands.filter((c) => c.tier <= 3);
    if (top.length === 0) {
      // A bare first name shared by many students scores tier 4 — too weak to
      // name anyone on its own, but exactly what a sibling list looks like
      // ("…ЕСҮХЭЙ, ЕСҮЙ, ЕСҮТЭЙ"). Exact hits (never fuzzy) enter as a tie for
      // the surname inference below to settle; they can never resolve alone.
      const weak = segCands.filter(
        (c) =>
          c.tier === 4 &&
          (c.nameGroupsHit ?? 0) > 0 &&
          !c.signals.has('memo_name_fuzzy'),
      );
      if (weak.length === 0) continue;
      const bestScore = weak[0]!.score;
      segs.push({ ties: weak.filter((c) => c.score === bestScore).map((c) => c.studentId) });
      continue;
    }
    const bestScore = top[0]!.score;
    const ties = top.filter((c) => c.score === bestScore);
    if (ties.length === 1) segs.push({ unique: ties[0]!.studentId });
    else segs.push({ ties: ties.map((c) => c.studentId) });
  }

  // A segment that could be either of two students means we do not know who
  // that share belongs to — unless its siblings answer for it: children in one
  // memo share a surname, so a tie that leaves exactly one student with a
  // surname the resolved segments carry is no tie at all ("Х. ЕСҮХЭЙ, ЕСҮЙ,
  // ЕСҮТЭЙ" — the bare ЕСҮЙ is ambiguous until the Х/Kherlen siblings pin it).
  const resolvedSurnames = new Set<string>();
  for (const s of segs) {
    if ('unique' in s) {
      const surname = context.lastNameNormByStudent.get(s.unique);
      if (surname) resolvedSurnames.add(surname);
    }
  }
  const ids: number[] = [];
  for (const s of segs) {
    if ('unique' in s) {
      ids.push(s.unique);
      continue;
    }
    const bySurname = s.ties.filter((id) =>
      resolvedSurnames.has(context.lastNameNormByStudent.get(id) ?? ''),
    );
    if (bySurname.length !== 1) return null;
    ids.push(bySurname[0]!);
  }
  return ids;
}

/**
 * Segment on the tokens that *start* a written child: an `x.name` initial form,
 * or a stranded single-letter initial followed by a name ("I KHUSLEN I KHULAN").
 * Only fires when at least two such starts exist — one initial form is just one
 * child's name, not a list.
 */
function splitOnInitialForms(normalizedMemo: string): string[] {
  const tokens = normalizedMemo.split(/\s+/).filter((t) => t.length > 0);
  const isStart = (i: number): boolean =>
    /^[a-z]\.[a-z]/.test(tokens[i]!) ||
    (/^[a-z]$/.test(tokens[i]!) &&
      i + 1 < tokens.length &&
      /^[a-z][a-z-]+$/.test(tokens[i + 1]!));
  const starts = tokens.map((_, i) => isStart(i));
  if (starts.filter(Boolean).length < 2) return [];
  const segments: string[] = [];
  let buf: string[] = [];
  tokens.forEach((tok, i) => {
    if (starts[i] && buf.length > 0) {
      segments.push(buf.join(' '));
      buf = [];
    }
    buf.push(tok);
  });
  if (buf.length > 0) segments.push(buf.join(' '));
  return segments;
}

/**
 * Segment *after* each class token: in the "NAME 11A NAME 8D" shape the class
 * closes its child's clause. Needs two class hits — one class is one child.
 */
function splitAfterClassTokens(
  normalizedMemo: string,
  context: MatchingContext,
): string[] {
  if (!context.classAlternation) return [];
  const re = new RegExp(context.classAlternation.source, 'gi');
  const cuts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalizedMemo)) !== null) {
    cuts.push(m.index + m[0].length);
    if (m[0].length === 0) re.lastIndex++;
  }
  if (cuts.length < 2) return [];
  const segments: string[] = [];
  let start = 0;
  for (const cut of cuts) {
    const seg = normalizedMemo.slice(start, cut).trim();
    if (seg.length > 0) segments.push(seg);
    start = cut;
  }
  const tail = normalizedMemo.slice(start).trim();
  if (tail.length > 0) segments.push(tail);
  return segments;
}

function splitOnGradeBoundaries(normalizedMemo: string): string[] {
  // Try splitting on "<digit> grade" or "<digit><class-token>" boundaries.
  // For each match end position, slice into a segment.
  const tokens = normalizedMemo.split(/\s+/);
  const segments: string[] = [];
  let buf: string[] = [];
  for (const tok of tokens) {
    buf.push(tok);
    if (/^\d+grade$/i.test(tok) || (/^\d+$/.test(tok) && buf.length > 1)) {
      // Heuristic boundary on "Ngrade" form; less precise on bare digit.
      segments.push(buf.join(' '));
      buf = [];
    } else if (tok.toLowerCase() === 'grade' && buf.length > 1) {
      segments.push(buf.join(' '));
      buf = [];
    }
  }
  if (buf.length > 0) segments.push(buf.join(' '));
  return segments;
}

// Re-export for callers that want to normalize the raw memo at the orchestrator.
export { normalize };
