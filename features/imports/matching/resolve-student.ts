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
  /** Identifying evidence — a name or an account, as opposed to a grade. */
  identified: boolean;
  fuzzyDistance?: number;
};

function acc(map: Map<number, Accumulator>, studentId: number): Accumulator {
  const existing = map.get(studentId);
  if (existing) return existing;
  const fresh: Accumulator = { signals: new Set(), score: 0, identified: false };
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
    };
    if (a.fuzzyDistance !== undefined) cand.fuzzyDistance = a.fuzzyDistance;
    result.push(cand);
  }
  result.sort((a, b) => b.score - a.score || a.tier - b.tier || a.studentId - b.studentId);
  return result;
}

const MULTI_SPLIT_RE = /\s*(?:,| and | & |;)\s*/i;

export function detectMultiStudent(
  candidates: StudentCandidate[],
  signals: ExtractedSignals,
  rawMemo: string,
  context: MatchingContext,
): { studentIds: number[] } | null {
  void signals;
  // Gate: at least two distinct candidates with non-trivial confidence.
  const tierLow = candidates.filter((c) => c.tier <= 3);
  if (tierLow.length < 2) return null;
  const distinctIds = new Set(tierLow.map((c) => c.studentId));
  if (distinctIds.size < 2) return null;

  // Try explicit separators on the RAW memo (normalize wipes commas).
  const segments = rawMemo
    .split(MULTI_SPLIT_RE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let perSegmentStudents: number[] | null = null;
  if (segments.length >= 2) {
    perSegmentStudents = resolveEachSegment(segments, context);
  }

  if (perSegmentStudents === null) {
    // Fallback: split the normalized memo on "grade" boundaries.
    const altSegments = splitOnGradeBoundaries(normalize(rawMemo));
    if (altSegments.length >= 2) {
      perSegmentStudents = resolveEachSegment(altSegments, context);
    }
  }

  if (!perSegmentStudents) return null;
  if (perSegmentStudents.length < 2) return null;
  if (new Set(perSegmentStudents).size < 2) return null;

  return { studentIds: perSegmentStudents };
}

function resolveEachSegment(
  segments: string[],
  context: MatchingContext,
): number[] | null {
  const ids: number[] = [];
  for (const seg of segments) {
    const segSignals = extractSignals(seg, BigInt('0'), context);
    const segCands = resolveStudent(segSignals, null, context);
    const top = segCands.filter((c) => c.tier <= 3);
    // A segment naming nobody is not a failure — memos routinely lead with the
    // fee ("BUS FEE, BAT-ERDENE 8B, ANAR 6E") or trail with a phone number.
    // It contributes no student and the rest of the split stands.
    if (top.length === 0) continue;
    // Ambiguity is different: a segment that could be either of two students
    // means we do not know who this share belongs to, so the split is off.
    const bestScore = top[0]!.score;
    const ties = top.filter((c) => c.score === bestScore);
    if (ties.length !== 1) return null;
    ids.push(top[0]!.studentId);
  }
  return ids;
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
