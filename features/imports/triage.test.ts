import { describe, expect, it } from "vitest";

import {
  attentionReason,
  classifyProposal,
  confidentProposal,
  editSum,
  editToLines,
  isEditConfirmable,
  proposalToEdit,
  rollupSignals,
  type RowEdit,
} from "./triage";
import type {
  MatchProposalWire,
  MatchResultWire,
  ProposalListItemWire,
} from "./types";

function proposal(over: Partial<MatchProposalWire> = {}): MatchProposalWire {
  return {
    studentId: 1,
    allocations: [{ chargeId: 10, amount: 1_000 }],
    signals: ["memo_name_full"],
    flags: [],
    ...over,
  };
}

const matched = (p: MatchProposalWire): MatchResultWire => ({
  kind: "matched",
  proposals: [p],
});

function item(result: MatchResultWire, amount = 1_000): ProposalListItemWire {
  return {
    bankTransactionId: 7,
    transactionPreview: {
      transactionId: "TX",
      senderName: null,
      senderAccount: null,
      memo: null,
      amount,
      transactionAt: "2026-01-01T00:00:00Z",
    },
    result,
  };
}

describe("classifyProposal", () => {
  it("is confident for a single balanced flag-free single-charge match", () => {
    expect(classifyProposal(matched(proposal()), 1_000)).toBe("confident");
  });

  it("is attention when the match has more than one allocation (a split)", () => {
    const p = proposal({
      allocations: [
        { chargeId: 10, amount: 600 },
        { chargeId: 11, amount: 400 },
      ],
    });
    expect(classifyProposal(matched(p), 1_000)).toBe("attention");
  });

  it("is attention when unbalanced, flagged, or with alternatives", () => {
    expect(classifyProposal(matched(proposal()), 999)).toBe("attention");
    expect(
      classifyProposal(matched(proposal({ flags: ["partial_payment"] })), 1_000),
    ).toBe("attention");
    expect(
      classifyProposal(
        { kind: "matched", proposals: [proposal(), proposal({ studentId: 2 })] },
        1_000,
      ),
    ).toBe("attention");
  });

  it("is attention for matched_multi, low_confidence, and unmatched", () => {
    expect(
      classifyProposal(
        { kind: "matched_multi", proposal: { proposals: [proposal()], totalAmount: 1_000 } },
        1_000,
      ),
    ).toBe("attention");
    expect(
      classifyProposal({ kind: "low_confidence", proposals: [proposal()] }, 1_000),
    ).toBe("attention");
    expect(
      classifyProposal({ kind: "unmatched", reason: "no_candidates" }, 1_000),
    ).toBe("attention");
  });
});

describe("confidentProposal", () => {
  it("returns the proposal when confident, null otherwise", () => {
    expect(confidentProposal(matched(proposal()), 1_000)).not.toBeNull();
    expect(confidentProposal(matched(proposal()), 500)).toBeNull();
  });
});

describe("attentionReason", () => {
  it("maps each non-confident shape to a reason", () => {
    expect(attentionReason({ kind: "unmatched", reason: "filtered" }, 0)).toBe(
      "unmatched",
    );
    expect(
      attentionReason({ kind: "low_confidence", proposals: [proposal()] }, 1_000),
    ).toBe("low_confidence");
    expect(
      attentionReason(
        { kind: "matched_multi", proposal: { proposals: [], totalAmount: 0 } },
        0,
      ),
    ).toBe("multi_student");
    expect(
      attentionReason(
        { kind: "matched", proposals: [proposal(), proposal({ studentId: 2 })] },
        1_000,
      ),
    ).toBe("multiple_candidates");
    expect(
      attentionReason(matched(proposal({ flags: ["ambiguous_target"] })), 1_000),
    ).toBe("flagged");
    expect(attentionReason(matched(proposal()), 999)).toBe("unbalanced");
  });
});

describe("inline edit helpers", () => {
  it("seeds an edit from the top proposal", () => {
    const edit = proposalToEdit(
      item(matched(proposal({ studentId: 3, allocations: [{ chargeId: 10, amount: 1_000 }] }))),
    );
    expect(edit).toEqual({ studentId: 3, lines: [{ chargeId: 10, amount: 1_000 }] });
  });

  it("seeds an empty edit for an unmatched row", () => {
    expect(proposalToEdit(item({ kind: "unmatched", reason: "no_candidates" }))).toEqual({
      studentId: 0,
      lines: [],
    });
  });

  it("editToLines stamps the student onto every charge line", () => {
    const edit: RowEdit = {
      studentId: 5,
      lines: [
        { chargeId: 10, amount: 600 },
        { chargeId: 11, amount: 400 },
      ],
    };
    expect(editToLines(7, edit)).toEqual({
      bankTransactionId: 7,
      lines: [
        { studentId: 5, chargeId: 10, amount: 600 },
        { studentId: 5, chargeId: 11, amount: 400 },
      ],
    });
    expect(editSum(edit)).toBe(1_000);
  });

  it("isEditConfirmable requires a student, charges, and a balanced total", () => {
    const ok: RowEdit = { studentId: 5, lines: [{ chargeId: 10, amount: 1_000 }] };
    expect(isEditConfirmable(ok, 1_000)).toBe(true);
    expect(isEditConfirmable(ok, 999)).toBe(false); // unbalanced
    expect(isEditConfirmable({ studentId: 0, lines: ok.lines }, 1_000)).toBe(false);
    expect(isEditConfirmable({ studentId: 5, lines: [] }, 0)).toBe(false);
    expect(
      isEditConfirmable(
        { studentId: 5, lines: [{ chargeId: 0, amount: 1_000 }] },
        1_000,
      ),
    ).toBe(false); // no charge chosen
    expect(
      isEditConfirmable(
        {
          studentId: 5,
          lines: [
            { chargeId: 10, amount: 500 },
            { chargeId: 10, amount: 500 },
          ],
        },
        1_000,
      ),
    ).toBe(false); // duplicate charge
  });
});

describe("rollupSignals", () => {
  it("collapses granular signals into categories", () => {
    expect(
      rollupSignals(["memo_name_full", "memo_name_fuzzy", "sender_account", "fee_hint_explicit"]),
    ).toEqual(["memo_name", "account"]);
  });
});
