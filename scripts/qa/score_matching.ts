/**
 * Score the matching pipeline against hand-labelled cases.
 *
 * The dry run says how many rows land in each bucket; it cannot say whether the
 * student we picked is the *right* student. This does: every case in
 * scripts/qa/fixtures/matching_cases.json names the expected outcome, and the
 * script reports precision (of the rows we proposed, how many were correct) and
 * recall (of the rows with a knowable answer, how many we proposed at all).
 *
 * Precision is the number to protect. Loosening the matcher always lifts recall;
 * this is what catches it doing so by inventing wrong students.
 *
 * Any expected student name that is not in the directory is a FIXTURE ERROR and
 * fails the run — a mislabelled case is worse than no case.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/qa/score_matching.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildMatchingContext, match } from "@/features/imports/matching";
import { loadMatchingContextInput } from "@/features/imports/matching/load-context";
import { normalize } from "@/features/imports/matching/normalize";
import type { MatchProposal } from "@/features/imports/matching";

const FIXTURE_PATH = "scripts/qa/fixtures/matching_cases.json";

type Case = {
  memo: string;
  amount: number;
  student?: string | null;
  students?: string[];
  charge?: string;
  kind?: "not_student" | "multi_student" | "ambiguous";
  why?: string;
};

type Outcome = "correct" | "wrong" | "missed" | "spurious" | "skipped";

// Name comparison goes through normalize() so a fixture written "Munkh-Erdene"
// still equals a directory "Munkh Erdene" — the point of a case is the student
// it names, not the punctuation.
function nameKey(s: string): string {
  return normalize(s).replace(/[\s.-]/g, "");
}

async function main(): Promise<void> {
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), FIXTURE_PATH), "utf-8")) as {
    cases: Case[];
  };
  const { input } = await loadMatchingContextInput();
  const context = buildMatchingContext(input);

  const nameOf = new Map<number, string>();
  const idsByName = new Map<string, number[]>();
  for (const s of input.students) {
    const full = `${s.firstName} ${s.lastName}`.trim();
    nameOf.set(s.id, full);
    const key = nameKey(full);
    const list = idsByName.get(key);
    if (list) list.push(s.id);
    else idsByName.set(key, [s.id]);
  }

  // Fixture integrity first — refuse to score against labels we can't resolve.
  const fixtureErrors: string[] = [];
  for (const c of raw.cases) {
    for (const n of [c.student, ...(c.students ?? [])]) {
      if (!n) continue;
      const hits = idsByName.get(nameKey(n)) ?? [];
      if (hits.length === 0) fixtureErrors.push(`unknown student "${n}" (memo: ${c.memo})`);
      else if (hits.length > 1) {
        fixtureErrors.push(`ambiguous student "${n}" → ids ${hits.join(",")} (memo: ${c.memo})`);
      }
    }
    if (c.charge && !input.openCharges.some((ch) => ch.feeName === c.charge)) {
      // bus_fee legitimately has no charge rows yet — that is the point of those
      // cases, so only flag a charge name that matches nothing at all.
      if (c.charge !== "bus_fee") {
        fixtureErrors.push(`unknown charge fee_name "${c.charge}" (memo: ${c.memo})`);
      }
    }
  }
  if (fixtureErrors.length > 0) {
    console.error("FIXTURE ERRORS — fix these labels before trusting any score:");
    for (const e of fixtureErrors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const results: Array<{ c: Case; outcome: Outcome; detail: string }> = [];

  for (const c of raw.cases) {
    const result = match(
      {
        memo: c.memo,
        amount: BigInt(c.amount),
        senderAccount: "FIXTURE",
        isOutgoing: false,
      },
      context,
    );

    const proposals: MatchProposal[] =
      result.kind === "matched" || result.kind === "low_confidence"
        ? result.proposals
        : result.kind === "matched_multi"
          ? result.proposal.proposals
          : [];
    const top = proposals[0] ?? null;
    const topName = top ? (nameOf.get(top.studentId) ?? "?") : null;

    if (c.kind === "not_student") {
      results.push(
        top === null
          ? { c, outcome: "correct", detail: "no proposal (correct)" }
          : { c, outcome: "spurious", detail: `proposed ${topName}` },
      );
      continue;
    }

    if (c.kind === "ambiguous") {
      results.push({ c, outcome: "skipped", detail: topName ? `proposed ${topName}` : "no proposal" });
      continue;
    }

    if (c.kind === "multi_student") {
      const want = new Set((c.students ?? []).map(nameKey));
      const got = new Set(proposals.map((p) => nameKey(nameOf.get(p.studentId) ?? "")));
      const hit = [...want].filter((w) => got.has(w)).length;
      if (result.kind === "matched_multi" && hit === want.size) {
        results.push({ c, outcome: "correct", detail: "all siblings proposed" });
      } else if (hit > 0) {
        results.push({ c, outcome: "wrong", detail: `${hit}/${want.size} siblings, kind=${result.kind}` });
      } else {
        results.push({ c, outcome: "missed", detail: `kind=${result.kind}` });
      }
      continue;
    }

    // Single-student case.
    if (c.student) {
      if (top === null) {
        results.push({ c, outcome: "missed", detail: `kind=${result.kind}` });
      } else if (nameKey(topName!) === nameKey(c.student)) {
        const chargeOk = c.charge
          ? chargeMatches(top, c.charge, input.openCharges)
          : true;
        results.push(
          chargeOk
            ? { c, outcome: "correct", detail: topName! }
            : { c, outcome: "wrong", detail: `${topName!} but wrong/absent charge (want ${c.charge})` },
        );
      } else {
        results.push({ c, outcome: "wrong", detail: `proposed ${topName}, want ${c.student}` });
      }
      continue;
    }

    // Charge-only case (no student label): judge the charge alone.
    if (c.charge) {
      const ok = top !== null && chargeMatches(top, c.charge, input.openCharges);
      results.push(
        ok
          ? { c, outcome: "correct", detail: `charge ${c.charge}` }
          : { c, outcome: "missed", detail: top ? `${topName}, no ${c.charge}` : "no proposal" },
      );
      continue;
    }

    results.push({ c, outcome: "skipped", detail: "no label" });
  }

  const tally = new Map<Outcome, number>();
  for (const r of results) tally.set(r.outcome, (tally.get(r.outcome) ?? 0) + 1);

  console.log("\n=== Matching fixture score ===\n");
  for (const r of results) {
    const mark =
      r.outcome === "correct"
        ? "PASS"
        : r.outcome === "skipped"
          ? "skip"
          : r.outcome.toUpperCase();
    console.log(`${mark.padEnd(9)} ${r.c.memo.slice(0, 62).padEnd(64)} ${r.detail}`);
  }

  const correct = tally.get("correct") ?? 0;
  const wrong = (tally.get("wrong") ?? 0) + (tally.get("spurious") ?? 0);
  const missed = tally.get("missed") ?? 0;
  const scored = correct + wrong + missed;
  const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${Math.round((n / d) * 100)}%`);

  console.log(
    `\ncorrect ${correct}  wrong ${wrong}  missed ${missed}  skipped ${tally.get("skipped") ?? 0}`,
  );
  console.log(`precision ${pct(correct, correct + wrong)} · recall ${pct(correct, scored)}`);
  process.exit(0);
}

/**
 * Fee names that denote the same fee. The school's fee_structures row is called
 * "bus" while domain_model.md's fee-name table calls it "bus_fee", and matching
 * accepts either (see feeTagMatches) — a fixture labelled with one must not
 * fail against the other.
 */
function sameFee(a: string, b: string): boolean {
  const canon = (n: string) => (n === "bus_fee" ? "bus" : n);
  return canon(a) === canon(b);
}

function chargeMatches(
  p: MatchProposal,
  wantFeeName: string,
  openCharges: Array<{ id: number; feeName: string }>,
): boolean {
  if (p.proposedCharge && sameFee(p.proposedCharge.feeName, wantFeeName)) return true;
  const byId = new Map(openCharges.map((c) => [c.id, c.feeName]));
  return p.allocations.some((a) => {
    const feeName = byId.get(a.chargeId);
    return feeName !== undefined && sameFee(feeName, wantFeeName);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
