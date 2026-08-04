import { describe, expect, it } from "vitest";

import { NEW_CHARGE_PLACEHOLDER_ID } from "./matching";
import {
  attentionReason,
  classifyProposal,
  confidentProposal,
  editSum,
  editToLines,
  groupByAttentionReason,
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
    score: 1.3,
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

  it("is confident for a balanced split across two charges", () => {
    const p = proposal({
      allocations: [
        { chargeId: 10, amount: 600 },
        { chargeId: 11, amount: 400 },
      ],
    });
    expect(classifyProposal(matched(p), 1_000)).toBe("confident");
  });

  it("is confident for a partial payment that still allocates the whole transfer", () => {
    // Paying 1,000 against a larger tuition balance is what installment payers
    // do — it needs recording, not a decision.
    expect(
      classifyProposal(matched(proposal({ flags: ["partial_payment"] })), 1_000),
    ).toBe("confident");
  });

  it("is attention when unbalanced, non-benignly flagged, or genuinely contested", () => {
    expect(classifyProposal(matched(proposal()), 999)).toBe("attention");
    expect(
      classifyProposal(matched(proposal({ flags: ["overpayment"] })), 1_000),
    ).toBe("attention");
    expect(
      classifyProposal(
        {
          kind: "matched",
          proposals: [proposal(), proposal({ studentId: 2, score: 1.2 })],
        },
        1_000,
      ),
    ).toBe("attention");
  });

  it("is confident when the runner-up is far enough behind to be noise", () => {
    expect(
      classifyProposal(
        {
          kind: "matched",
          proposals: [
            proposal({ score: 1.4 }),
            proposal({ studentId: 2, score: 0.4 }),
          ],
        },
        1_000,
      ),
    ).toBe("confident");
  });

  it("is attention when the allocation needs a charge that does not exist yet", () => {
    const p = proposal({
      proposedCharge: {
        feeName: "bus_fee",
        amount: 375_000,
        scope: "term",
        academicTermId: 4,
        reason: "fee_hint_explicit",
      },
    });
    expect(classifyProposal(matched(p), 1_000)).toBe("attention");
    expect(attentionReason(matched(p), 1_000)).toBe("missing_charge");
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

describe("edits that create a charge", () => {
  const busEdit: RowEdit = {
    studentId: 5,
    lines: [{ chargeId: NEW_CHARGE_PLACEHOLDER_ID, amount: 375_000 }],
    newCharge: {
      feeName: "bus",
      amount: 375_000,
      scope: "term",
      academicTermId: 4,
      reason: "fee_hint_explicit",
    },
  };

  it("carries the fee to create onto the confirm payload", () => {
    const values = editToLines(7, busEdit);
    expect(values.createCharges).toEqual([
      {
        studentId: 5,
        feeName: "bus",
        amount: 375_000,
        scope: "term",
        academicTermId: 4,
      },
    ]);
    expect(values.lines[0]!.chargeId).toBe(NEW_CHARGE_PLACEHOLDER_ID);
  });

  it("is confirmable when balanced", () => {
    expect(isEditConfirmable(busEdit, 375_000)).toBe(true);
  });

  it("is not confirmable once the fee to create has gone", () => {
    const orphan: RowEdit = { studentId: 5, lines: busEdit.lines };
    expect(isEditConfirmable(orphan, 375_000)).toBe(false);
  });

  it("omits createCharges when no line actually pays the new fee", () => {
    const values = editToLines(7, {
      ...busEdit,
      lines: [{ chargeId: 99, amount: 375_000 }],
    });
    expect(values.createCharges).toBeUndefined();
  });

  it("seeds the editor from a proposal that wants a charge created", () => {
    const p = proposal({
      allocations: [{ chargeId: NEW_CHARGE_PLACEHOLDER_ID, amount: 375_000 }],
      proposedCharge: {
        feeName: "bus",
        amount: 375_000,
        scope: "term",
        academicTermId: 4,
        reason: "fee_hint_explicit",
      },
    });
    const edit = proposalToEdit(item(matched(p), 375_000));
    expect(edit.newCharge?.feeName).toBe("bus");
    expect(edit.lines).toEqual([
      { chargeId: NEW_CHARGE_PLACEHOLDER_ID, amount: 375_000 },
    ]);
  });
});

describe("groupByAttentionReason", () => {
  const row = (id: number, result: MatchResultWire, amount = 1_000) => ({
    ...item(result, amount),
    bankTransactionId: id,
  });

  it("buckets rows by reason and drops empty buckets", () => {
    const groups = groupByAttentionReason([
      row(1, { kind: "unmatched", reason: "no_candidates" }),
      row(2, matched(proposal({ flags: ["overpayment"] }))),
      row(3, { kind: "unmatched", reason: "no_candidates" }),
    ]);
    expect(groups.map((g) => g.reason)).toEqual(["flagged", "unmatched"]);
    expect(groups.find((g) => g.reason === "unmatched")?.items.map((i) => i.bankTransactionId))
      .toEqual([1, 3]);
  });

  it("orders groups by how actionable they are", () => {
    const groups = groupByAttentionReason([
      row(1, { kind: "unmatched", reason: "no_candidates" }),
      row(2, { kind: "low_confidence", proposals: [proposal()] }),
      row(3, {
        kind: "matched",
        proposals: [proposal(), proposal({ studentId: 2, score: 1.2 })],
      }),
    ]);
    expect(groups.map((g) => g.reason)).toEqual([
      "multiple_candidates",
      "low_confidence",
      "unmatched",
    ]);
  });

  it("keeps every row — the total across groups is the input", () => {
    const rows = [
      row(1, { kind: "unmatched", reason: "no_candidates" }),
      row(2, matched(proposal({ flags: ["overpayment"] }))),
      row(3, matched(proposal()), 999),
    ];
    const groups = groupByAttentionReason(rows);
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(rows.length);
  });

  it("returns nothing for an empty list", () => {
    expect(groupByAttentionReason([])).toEqual([]);
  });
});
