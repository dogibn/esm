export type { BankTransaction, NewBankTransaction } from "@/db/schema";

import type {
  AllocationFlag,
  MatchProposal,
  MatchResult,
  MultiStudentMatchProposal,
  SignalKind,
} from "./matching";

export type { AllocationFlag, MatchResult, SignalKind } from "./matching";

// ----------------------------------------------------------------------
// Proposals endpoint — server-side (canonical) types
// ----------------------------------------------------------------------
//
// MatchResult / MatchProposal are EPHEMERAL (domain_model.md) — they are NOT
// persisted, NOT a table. The service recomputes them on every call.
//
// The service returns the canonical matching types (Set, bigint). The HTTP
// boundary serializes via the *Wire types below: Set→array, bigint→number,
// Date→ISO string. Don't pass the canonical type to Response.json directly —
// JSON.stringify throws on bigint and collapses Set to {}.

export type TransactionPreview = {
  transactionId: string;
  senderName: string | null;
  senderAccount: string | null;
  memo: string | null;
  amount: number;
  transactionAt: Date;
};

export type ProposalListItem = {
  bankTransactionId: number;
  transactionPreview: TransactionPreview;
  result: MatchResult;
};

export type ReviewStudent = {
  id: number;
  firstName: string;
  lastName: string;
  gradeName: string | null;
  gradeLevelCode: string | null;
};

export type ReviewOpenCharge = {
  id: number;
  studentId: number;
  feeName: string;
  grossAmount: number;
  outstandingBalance: number;
};

export type ReviewClass = {
  gradeName: string;
  gradeLevelCode: string;
};

export type ReviewContext = {
  students: ReviewStudent[];
  openCharges: ReviewOpenCharge[];
  classes: ReviewClass[];
};

export type ProposalListResponse = {
  proposals: ProposalListItem[];
  meta: {
    yearName: string;
    termName: string;
    totalUnmatched: number;
  };
  context: ReviewContext;
};

// ----------------------------------------------------------------------
// Proposals endpoint — wire (JSON-safe) types
// ----------------------------------------------------------------------

export type MatchProposalWire = {
  studentId: number;
  allocations: Array<{ chargeId: number; amount: number }>;
  signals: SignalKind[];
  flags: AllocationFlag[];
};

export type MultiStudentMatchProposalWire = {
  proposals: MatchProposalWire[];
  totalAmount: number;
};

export type MatchResultWire =
  | { kind: "matched"; proposals: MatchProposalWire[] }
  | { kind: "matched_multi"; proposal: MultiStudentMatchProposalWire }
  | { kind: "low_confidence"; proposals: MatchProposalWire[] }
  | { kind: "unmatched"; reason: "no_candidates" | "filtered" | "no_open_charges" };

export type TransactionPreviewWire = Omit<TransactionPreview, "transactionAt"> & {
  transactionAt: string; // ISO 8601
};

export type ProposalListItemWire = {
  bankTransactionId: number;
  transactionPreview: TransactionPreviewWire;
  result: MatchResultWire;
};

export type ProposalListResponseWire = {
  proposals: ProposalListItemWire[];
  meta: ProposalListResponse["meta"];
  context: ReviewContext;
};

// ----------------------------------------------------------------------
// Wire converters
// ----------------------------------------------------------------------

function matchProposalToWire(p: MatchProposal): MatchProposalWire {
  return {
    studentId: p.studentId,
    allocations: p.allocations.map((a) => ({
      chargeId: a.chargeId,
      amount: Number(a.amount),
    })),
    signals: [...p.signals],
    flags: [...p.flags],
  };
}

function multiToWire(m: MultiStudentMatchProposal): MultiStudentMatchProposalWire {
  return {
    proposals: m.proposals.map(matchProposalToWire),
    totalAmount: Number(m.totalAmount),
  };
}

export function matchResultToWire(r: MatchResult): MatchResultWire {
  switch (r.kind) {
    case "matched":
      return { kind: "matched", proposals: r.proposals.map(matchProposalToWire) };
    case "matched_multi":
      return { kind: "matched_multi", proposal: multiToWire(r.proposal) };
    case "low_confidence":
      return { kind: "low_confidence", proposals: r.proposals.map(matchProposalToWire) };
    case "unmatched":
      return { kind: "unmatched", reason: r.reason };
  }
}

export function proposalListResponseToWire(
  r: ProposalListResponse,
): ProposalListResponseWire {
  return {
    proposals: r.proposals.map((item) => ({
      bankTransactionId: item.bankTransactionId,
      transactionPreview: {
        ...item.transactionPreview,
        transactionAt: item.transactionPreview.transactionAt.toISOString(),
      },
      result: matchResultToWire(item.result),
    })),
    meta: r.meta,
    context: r.context,
  };
}

// Returned by the confirm endpoint. JSON-safe as-is (no Date/bigint/Set).
export type ConfirmResult = {
  bankTransactionId: number;
  paymentsCreated: number;
  totalAllocated: number;
};

export type ParsedBankRow = {
  transactionId: string;
  senderName: string | null;
  senderAccount: string | null;
  memo: string | null;
  amount: number; // integer MNT
  transactionAt: Date;
};

export type ParseError = {
  rowIndex: number; // 0-based source row; -1 for workbook-level failures
  reason: string;
};

export type ParseResult = {
  rows: ParsedBankRow[];
  errors: ParseError[];
  skippedOutgoing: number;
};

// Wire shape returned by the upload endpoint to the client. Date is serialized
// as ISO string over the wire; ParsedBankRow stays a Date in service code.
export type UploadResultWire = {
  parsedCount: number;
  insertedCount: number;
  skippedDuplicates: number;
  skippedOutgoing: number;
  inserted: Array<{
    transactionId: string;
    senderName: string | null;
    senderAccount: string | null;
    memo: string | null;
    amount: number;
    transactionAt: string;
  }>;
  parseErrors: ParseError[];
};

// Server-side result shape returned by the service (Date kept as Date).
export type UploadResult = {
  parsedCount: number;
  insertedCount: number;
  skippedDuplicates: number;
  skippedOutgoing: number;
  inserted: ParsedBankRow[];
  parseErrors: ParseError[];
};
