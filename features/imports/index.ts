export {
  confirmAllocation,
  discardUnmatchedTransaction,
  listProposals,
  undoOperation,
  uploadBankTransactions,
} from "./api";
export { loadMatchingContextInput } from "./matching/load-context";
export type {
  LoadMatchingContextInputResult,
  MatchingPeriod,
} from "./matching/load-context";
export {
  matchResultToWire,
  proposalListResponseToWire,
} from "./types";
export {
  BANK_COLUMN_PATTERNS,
  filterNewTransactions,
  parseBankWorkbook,
  parseTransactionAt,
} from "./parsing/bank-file";
export {
  parsedBankRowSchema,
  uploadFileSchema,
} from "./schemas";
export type { ParsedBankRowInput, UploadFileInput } from "./schemas";
export { strings } from "./strings";
export type {
  BankTransaction,
  ConfirmResult,
  MatchProposalWire,
  MatchResultWire,
  MultiStudentMatchProposalWire,
  NewBankTransaction,
  ParseError,
  ParseResult,
  ParsedBankRow,
  ProposalListItem,
  ProposalListItemWire,
  ProposalListResponse,
  ProposalListResponseWire,
  ReviewClass,
  ReviewContext,
  ReviewOpenCharge,
  ReviewStudent,
  TransactionPreview,
  TransactionPreviewWire,
  UndoResult,
  UploadResult,
  UploadResultWire,
} from "./types";
export { AllocationForm } from "./components/AllocationForm";
export { ImportsView } from "./components/ImportsView";
export { ReviewTable, type ReviewTableHandle } from "./components/ReviewTable";
export { UploadDropzone } from "./components/UploadDropzone";
export {
  allocationFormSchema,
  allocationLineSchema,
} from "./schemas";
export type { AllocationFormValues, AllocationLine } from "./schemas";

// Re-export matching's public surface untouched.
export {
  buildMatchingContext,
  match,
} from "./matching";
export type {
  AllocationFlag,
  BankTransactionInput,
  BuildIndexInput,
  ChargeScope,
  ChargeWithBalance,
  ExtractedSignals,
  FeeTag,
  FeeVocabulary,
  FeeVocabularyEntry,
  MatchProposal,
  MatchResult,
  MatchingContext,
  MultiStudentMatchProposal,
  SignalKind,
  StudentCandidate,
} from "./matching";
