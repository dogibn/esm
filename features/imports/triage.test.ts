import { describe, expect, it } from "vitest";

import {
  attentionReason,
  classifyProposal,
  confidentProposal,
  proposalToLines,
  sumAllocations,
} from "./triage";
import type { MatchProposalWire, MatchResultWire } from "./types";

function proposal(
  over: Partial<MatchProposalWire> = {},
): MatchProposalWire {
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

describe("classifyProposal", () => {
  it("is confident for a single balanced flag-free match", () => {
    expect(classifyProposal(matched(proposal()), 1_000)).toBe("confident");
  });

  it("is attention when the allocation does not balance the amount", () => {
    expect(classifyProposal(matched(proposal()), 999)).toBe("attention");
  });

  it("is attention when the proposal carries any flag", () => {
    expect(
      classifyProposal(matched(proposal({ flags: ["partial_payment"] })), 1_000),
    ).toBe("attention");
  });

  it("is attention when there are alternative candidates", () => {
    const result: MatchResultWire = {
      kind: "matched",
      proposals: [proposal(), proposal({ studentId: 2 })],
    };
    expect(classifyProposal(result, 1_000)).toBe("attention");
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

  it("is attention when the match has no allocations", () => {
    expect(classifyProposal(matched(proposal({ allocations: [] })), 0)).toBe(
      "attention",
    );
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

describe("proposalToLines", () => {
  it("maps allocations to confirm lines", () => {
    const values = proposalToLines(7, proposal({
      studentId: 3,
      allocations: [
        { chargeId: 10, amount: 600 },
        { chargeId: 11, amount: 400 },
      ],
    }));
    expect(values).toEqual({
      bankTransactionId: 7,
      lines: [
        { studentId: 3, chargeId: 10, amount: 600 },
        { studentId: 3, chargeId: 11, amount: 400 },
      ],
    });
  });

  it("emits a single zero line when there are no allocations", () => {
    const values = proposalToLines(7, proposal({ studentId: 3, allocations: [] }));
    expect(values.lines).toEqual([{ studentId: 3, chargeId: 0, amount: 0 }]);
  });

  it("sumAllocations totals the allocation amounts", () => {
    expect(
      sumAllocations(proposal({ allocations: [{ chargeId: 1, amount: 5 }, { chargeId: 2, amount: 7 }] })),
    ).toBe(12);
  });
});
