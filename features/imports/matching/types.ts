export type FeeTag =
  | 'tuition'
  | 'bus'
  | 'registration'
  | { kind: 'club'; feeStructureId: number; feeName: string };

export type SignalKind =
  | 'memo_grade_class'
  | 'memo_grade_wildcard'
  | 'memo_grade_level'
  | 'memo_name_full'
  | 'memo_name_partial'
  | 'memo_name_fuzzy'
  | 'sender_account'
  | 'fee_hint_explicit'
  | 'fee_hint_from_amount'
  | 'fee_inferred_from_amount';

export type ExtractedSignals = {
  gradeTokens: { class: string[]; wildcard: string[]; level: string[] };
  nameTokens: string[];
  feeHints: { explicit: FeeTag[]; fromAmount: FeeTag | null };
  senderBlock: string;
};

export type StudentCandidate = {
  studentId: number;
  signals: Set<SignalKind>;
  tier: 1 | 2 | 3 | 4 | 5;
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

export type MatchProposal = {
  studentId: number;
  allocations: Array<{ chargeId: number; amount: bigint }>;
  signals: Set<SignalKind>;
  flags: Set<AllocationFlag>;
};

export type MultiStudentMatchProposal = {
  proposals: MatchProposal[];
  totalAmount: bigint;
};

export type MatchResult =
  | { kind: 'matched'; proposals: MatchProposal[] }
  | { kind: 'matched_multi'; proposal: MultiStudentMatchProposal }
  | { kind: 'low_confidence'; proposals: MatchProposal[] }
  | { kind: 'unmatched'; reason: 'no_candidates' | 'filtered' | 'no_open_charges' };

export type ChargeScope =
  | { kind: 'year'; academicYearId: number }
  | { kind: 'term'; academicTermId: number };

export type ChargeWithBalance = {
  id: number;
  feeName: string;
  scope: ChargeScope;
  grossAmount: bigint;
  outstandingBalance: bigint;
};

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
  levelAlternation: RegExp | null;
  classVocabulary: string[];
  feeVocabulary: FeeVocabulary;
  gradeIndex: Map<string, number[]>;
  levelIndex: Map<string, number[]>;
  nameIndex: Map<string, number[]>;
  nameTokenList: string[];
  accountIndex: Map<string, number[]>;
  openChargesByStudent: Map<number, ChargeWithBalance[]>;
  amountFeeIndex: Map<bigint, FeeTag>;
};

export type BankTransactionInput = {
  memo: string | null;
  amount: bigint;
  senderAccount: string | null;
  senderAccountName?: string | null;
  isOutgoing?: boolean;
};

export type BuildIndexInput = {
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
