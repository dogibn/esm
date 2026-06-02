import { extractSignals } from './extract-signals';
import { fuzzyMatchNameTokens } from './fuzzy';
import { normalize } from './normalize';
import type {
  ExtractedSignals,
  MatchingContext,
  SignalKind,
  StudentCandidate,
} from './types';

function addSignal(
  map: Map<number, Set<SignalKind>>,
  studentId: number,
  kind: SignalKind,
): void {
  const set = map.get(studentId);
  if (set) set.add(kind);
  else map.set(studentId, new Set([kind]));
}

export function resolveStudent(
  signals: ExtractedSignals,
  senderAccount: string | null,
  context: MatchingContext,
): StudentCandidate[] {
  const candidates = new Map<number, Set<SignalKind>>();
  const fuzzyDistances = new Map<number, number>();

  for (const t of signals.gradeTokens.class) {
    for (const sid of context.gradeIndex.get(t) ?? []) {
      addSignal(candidates, sid, 'memo_grade_class');
    }
  }
  for (const t of signals.gradeTokens.wildcard) {
    for (const sid of context.gradeIndex.get(t) ?? []) {
      addSignal(candidates, sid, 'memo_grade_wildcard');
    }
  }
  for (const t of signals.gradeTokens.level) {
    if (t.includes('+')) continue; // kindergarten + levels resolve via class only
    for (const sid of context.levelIndex.get(t) ?? []) {
      addSignal(candidates, sid, 'memo_grade_level');
    }
  }

  // Name tokens: count distinct hits per student.
  const nameHitsPerStudent = new Map<number, Set<string>>();
  for (const t of signals.nameTokens) {
    for (const sid of context.nameIndex.get(t) ?? []) {
      const set = nameHitsPerStudent.get(sid);
      if (set) set.add(t);
      else nameHitsPerStudent.set(sid, new Set([t]));
    }
  }
  for (const [sid, tokens] of nameHitsPerStudent) {
    addSignal(candidates, sid, tokens.size >= 2 ? 'memo_name_full' : 'memo_name_partial');
  }

  // Account index.
  if (senderAccount) {
    for (const sid of context.accountIndex.get(senderAccount) ?? []) {
      addSignal(candidates, sid, 'sender_account');
    }
  }

  // Fuzzy fallback — only if no exact name match anywhere.
  const anyExactName = [...candidates.values()].some(
    (s) => s.has('memo_name_full') || s.has('memo_name_partial'),
  );
  if (!anyExactName) {
    for (const memoToken of signals.nameTokens) {
      const hits = fuzzyMatchNameTokens(memoToken, context.nameTokenList);
      for (const { token, distance } of hits) {
        if (distance === 0) continue; // exact would've been caught above
        for (const sid of context.nameIndex.get(token) ?? []) {
          addSignal(candidates, sid, 'memo_name_fuzzy');
          const prev = fuzzyDistances.get(sid) ?? Infinity;
          if (distance < prev) fuzzyDistances.set(sid, distance);
        }
      }
    }
  }

  const result: StudentCandidate[] = [];
  for (const [sid, sigs] of candidates) {
    const cand: StudentCandidate = {
      studentId: sid,
      signals: sigs,
      tier: assignTier(sigs),
    };
    const fd = fuzzyDistances.get(sid);
    if (fd !== undefined) cand.fuzzyDistance = fd;
    result.push(cand);
  }
  result.sort((a, b) => a.tier - b.tier || a.studentId - b.studentId);
  return result;
}

export function assignTier(sigs: Set<SignalKind>): 1 | 2 | 3 | 4 | 5 {
  const hasStrongGrade = sigs.has('memo_grade_class');
  const hasAnyGrade =
    hasStrongGrade ||
    sigs.has('memo_grade_wildcard') ||
    sigs.has('memo_grade_level');
  const hasNameFull = sigs.has('memo_name_full');
  const hasNamePartial = sigs.has('memo_name_partial');
  const hasFuzzy = sigs.has('memo_name_fuzzy');
  const hasAccount = sigs.has('sender_account');

  const strongCount = [hasStrongGrade, hasNameFull, hasAccount].filter(Boolean).length;
  if (strongCount >= 2) return 1;

  if ((hasAnyGrade && hasNameFull) || (hasNameFull && hasAccount) || (hasAnyGrade && hasAccount)) {
    return 2;
  }

  if (hasAccount && sigs.size === 1) return 3;
  if (hasNameFull && sigs.size === 1) return 3;
  if (hasAnyGrade && hasNamePartial) return 3;

  if (hasFuzzy && hasAnyGrade) return 4;

  return 5;
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
    // Each segment must resolve uniquely to a tier-≤3 candidate. If multiple
    // top-tier candidates exist for one segment, it's ambiguous → abandon.
    const top = segCands.filter((c) => c.tier <= 3);
    if (top.length === 0) return null;
    const bestTier = top[0]!.tier;
    const ties = top.filter((c) => c.tier === bestTier);
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
    if (/^\d+grade$/i.test(tok) || /^\d+$/.test(tok) && buf.length > 1) {
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
