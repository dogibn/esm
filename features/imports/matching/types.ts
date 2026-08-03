import type { ChargeScope, ChargeWithBalance } from '@/features/students/balance';

export type { ChargeScope, ChargeWithBalance };

export type FeeTag =
  | 'tuition'
  | 'bus'
  | 'registration'
  | { kind: 'club'; feeStructureId: number; feeName: string }
  // A club identified only by category (e.g. "basketball") from a memo keyword,
  // not by a specific fee structure. Matches any open club charge whose fee name
  // classifies to the same category — needed because club fee structures are not
  // always loaded for the current term even when the club charges exist.
  | { kind: 'club_category'; category: string };

export type SignalKind =
  | 'memo_grade_class'
  | 'memo_grade_wildcard'
  | 'memo_grade_level'
  | 'memo_name_full'
  | 'memo_name_partial'
  // The "B.Baatar" shape: last-name initial + first name. Recorded separately
  // because it is a deliberate identifier and nearly always unique, where a
  // bare first name rarely is.
  | 'memo_name_initial'
  | 'memo_name_fuzzy'
  | 'sender_account'
  | 'fee_hint_explicit'
  | 'fee_hint_from_amount'
  | 'fee_inferred_from_amount';

export type ExtractedSignals = {
  gradeTokens: { class: string[]; wildcard: string[]; level: string[] };
  /** Flat, deduped list of every name spelling in the memo — used by fuzzy. */
  nameTokens: string[];
  /**
   * The same names grouped by the memo token they came from: one entry per
   * written name, holding its alternate spellings (hyphen splits, genitive
   * stems). Candidate resolution counts *groups*, not tokens, so writing one
   * hyphenated name doesn't look like writing two names.
   */
  nameGroups: string[][];
  feeHints: { explicit: FeeTag[]; fromAmount: FeeTag | null };
  senderBlock: string;
};

export type StudentCandidate = {
  studentId: number;
  signals: Set<SignalKind>;
  /** Label derived from `score` — 1 is best, 5 is "do not propose". */
  tier: 1 | 2 | 3 | 4 | 5;
  /** Accumulated evidence weight; the actual ranking key. */
  score: number;
  fuzzyDistance?: number;
};

export type AllocationFlag =
  | 'no_open_charges'
  | 'overpayment'
  | 'partial_payment'
  | 'ambiguous_target'
  | 'multiple_valid_combos'
  | 'multiple_tuition_charges'
  | 'fee_inferred_from_amount'
  | 'manual_review';

/**
 * A charge the student does not have yet, but that the transaction clearly pays
 * for. Bus is the motivating case: the school has a bus fee structure but bus
 * opt-in is not imported (docs/notes.md), so no bus Charge rows exist and every
 * bus payment dead-ends. Rather than leave those for manual entry, matching
 * proposes the charge and confirming creates it — one operation, still undoable.
 *
 * Carries everything `createCharge` needs; the reviewer confirms or discards it.
 */
export type ProposedCharge = {
  feeName: string;
  amount: bigint;
  scope: 'term' | 'annual';
  academicTermId: number | null;
  reason: 'fee_hint_explicit' | 'fee_hint_from_amount';
};

export type MatchProposal = {
  studentId: number;
  allocations: Array<{ chargeId: number; amount: bigint }>;
  signals: Set<SignalKind>;
  flags: Set<AllocationFlag>;
  /**
   * The candidate's evidence score (see resolve-student.ts). Carried onto the
   * proposal so triage can tell "one obvious student, plus some weak also-rans"
   * apart from "genuinely two plausible students" — without it, surfacing
   * alternatives at all would force every such row to a human.
   */
  score: number;
  /**
   * Set when the allocation depends on a charge that must be created first. The
   * `allocations` array then references it by the placeholder id
   * NEW_CHARGE_PLACEHOLDER_ID, which confirm resolves after the insert.
   */
  proposedCharge?: ProposedCharge;
};

/**
 * Stand-in charge id used inside a proposal's allocations when the charge does
 * not exist yet. Negative so it can never collide with a real serial id, and so
 * anything that forgets to resolve it fails loudly at the DB instead of writing
 * a payment against the wrong charge.
 */
export const NEW_CHARGE_PLACEHOLDER_ID = -1;

export type MultiStudentMatchProposal = {
  proposals: MatchProposal[];
  totalAmount: bigint;
};

export type MatchResult =
  | { kind: 'matched'; proposals: MatchProposal[] }
  | { kind: 'matched_multi'; proposal: MultiStudentMatchProposal }
  | { kind: 'low_confidence'; proposals: MatchProposal[] }
  | { kind: 'unmatched'; reason: 'no_candidates' | 'filtered' | 'not_student' | 'no_open_charges' };

export type FeeVocabularyEntry = {
  normalizedToken: string;
  tag: FeeTag;
};

export type FeeVocabulary = {
  entries: FeeVocabularyEntry[];
  alternation: RegExp | null;
  genericTokens: Set<string>;
  kindergartenTokens: Set<string>;
};

export type MatchingContext = {
  classAlternation: RegExp | null;
  /** Digit-first grade level: "5 angi", "5-r angi", "5grade". */
  levelAlternation: RegExp | null;
  /** Keyword-first grade level: "grade 12", "angi 5". */
  levelFirstAlternation: RegExp | null;
  /** Canonical class names only — what wildcard (`3~`) expansion draws from. */
  classVocabulary: string[];
  /**
   * Canonical class names *plus* their Cyrillic-lookalike aliases. The
   * membership test for "is this token a class", used when peeling a glued
   * grade off a name and when re-joining a class split across a space.
   */
  classLookup: Set<string>;
  feeVocabulary: FeeVocabulary;
  gradeIndex: Map<string, number[]>;
  levelIndex: Map<string, number[]>;
  nameIndex: Map<string, number[]>;
  nameTokenList: string[];
  accountIndex: Map<string, number[]>;
  openChargesByStudent: Map<number, ChargeWithBalance[]>;
  amountFeeIndex: Map<bigint, FeeTag>;
  /**
   * Fees a payment may legitimately bring into existence, keyed by fee tag.
   * Only school-wide term/year fees qualify: the school has a rate for them, so
   * the charge the reviewer would otherwise type by hand is fully determined.
   */
  proposableFees: Map<string, ProposedCharge>;
};

export type BankTransactionInput = {
  memo: string | null;
  amount: bigint;
  senderAccount: string | null;
  senderAccountName?: string | null;
  isOutgoing?: boolean;
};

export type BuildIndexInput = {
  /** Current term, for charges a match proposes creating. */
  academicTermId?: number | null;
  students: Array<{ id: number; firstName: string; lastName: string }>;
  enrollments: Array<{
    studentId: number;
    gradeName: string;
    gradeLevelCode: string;
  }>;
  currentTermFees: Array<{
    feeStructureId: number;
    feeName: string;
    amount: bigint;
    isClub: boolean;
  }>;
  currentYearFees: Array<{ feeName: string; amount: bigint }>;
  clubAliases: Record<string, string[]>;
  confirmedAccountLinks: Array<{ senderAccount: string; studentId: number }>;
  openCharges: Array<ChargeWithBalance & { studentId: number }>;
  openChargesByStudent?: Map<number, ChargeWithBalance[]>;
};
