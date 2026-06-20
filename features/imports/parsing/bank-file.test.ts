import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  filterNewTransactions,
  parseBankWorkbook,
  parseTransactionAt,
} from "./bank-file";
import type { ParsedBankRow } from "../types";

function makeWorkbook(rows: Array<Record<string, unknown>>): Buffer {
  const headers = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      for (const k of Object.keys(r)) acc.add(k);
      return acc;
    }, new Set()),
  );
  const aoa: unknown[][] = [
    headers,
    ...rows.map((r) => headers.map((h) => r[h] ?? null)),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

const TX = {
  date: "Тайлант огноо",
  time: "Цаг",
  id: "Журнал",
  memo: "Утга",
  inFlow: "Орлого",
  outFlow: "Зарлага",
  account: "Харьцсан данс",
  senderName: "Дансны нэр",
};

describe("parseTransactionAt", () => {
  it("combines date and time as UB local (+08:00)", () => {
    const d = parseTransactionAt("2026.03.01", "08:17");
    expect(d).not.toBeNull();
    // 08:17 UB == 00:17 UTC.
    expect(d!.toISOString()).toBe("2026-03-01T00:17:00.000Z");
  });

  it("treats missing time as 00:00", () => {
    const d = parseTransactionAt("2026.03.01", null);
    expect(d!.toISOString()).toBe("2026-02-28T16:00:00.000Z");
  });

  it("returns null for unparseable date", () => {
    expect(parseTransactionAt("not a date", "08:17")).toBeNull();
  });

  it("returns null for unparseable time", () => {
    expect(parseTransactionAt("2026.03.01", "garbage")).toBeNull();
  });
});

describe("parseBankWorkbook", () => {
  it("parses a well-formed incoming row", () => {
    const buf = makeWorkbook([
      {
        [TX.date]: "2026.03.01",
        [TX.time]: "08:17",
        [TX.id]: "955690685507",
        [TX.memo]: "Tuition payment",
        [TX.inFlow]: 4250000,
        [TX.outFlow]: 0,
        [TX.account]: "MN730004000436028195",
        [TX.senderName]: "PARENT NAME",
      },
    ]);
    const result = parseBankWorkbook(buf);
    expect(result.errors).toEqual([]);
    expect(result.skippedOutgoing).toBe(0);
    expect(result.rows).toHaveLength(1);
    const r = result.rows[0]!;
    expect(r.transactionId).toBe("955690685507");
    expect(r.amount).toBe(4250000);
    expect(r.memo).toBe("Tuition payment");
    expect(r.senderAccount).toBe("MN730004000436028195");
    expect(r.senderName).toBe("PARENT NAME");
    expect(r.transactionAt.toISOString()).toBe("2026-03-01T00:17:00.000Z");
  });

  it("skips outgoing rows (Зарлага > 0) without counting them as errors", () => {
    const buf = makeWorkbook([
      {
        [TX.date]: "2026.03.01",
        [TX.time]: "10:00",
        [TX.id]: "111",
        [TX.inFlow]: 0,
        [TX.outFlow]: 1000,
      },
      {
        [TX.date]: "2026.03.01",
        [TX.time]: "10:01",
        [TX.id]: "222",
        [TX.inFlow]: 5000,
        [TX.outFlow]: 0,
      },
    ]);
    const result = parseBankWorkbook(buf);
    expect(result.skippedOutgoing).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.transactionId).toBe("222");
  });

  it("reports missing transaction_id as a parse error, doesn't crash", () => {
    const buf = makeWorkbook([
      { [TX.date]: "2026.03.01", [TX.time]: "10:00", [TX.id]: null, [TX.inFlow]: 5000, [TX.outFlow]: 0 },
      { [TX.date]: "2026.03.01", [TX.time]: "10:01", [TX.id]: "good", [TX.inFlow]: 5000, [TX.outFlow]: 0 },
    ]);
    const result = parseBankWorkbook(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.reason).toMatch(/missing transaction_id/i);
  });

  it("reports unparseable amount as a parse error", () => {
    const buf = makeWorkbook([
      { [TX.date]: "2026.03.01", [TX.time]: "10:00", [TX.id]: "abc", [TX.inFlow]: "not-a-number", [TX.outFlow]: 0 },
    ]);
    const result = parseBankWorkbook(buf);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.reason).toMatch(/unparseable amount/i);
    expect(result.rows).toEqual([]);
  });

  it("reports unparseable date as a parse error", () => {
    const buf = makeWorkbook([
      { [TX.date]: "not-a-date", [TX.time]: "10:00", [TX.id]: "abc", [TX.inFlow]: 5000, [TX.outFlow]: 0 },
    ]);
    const result = parseBankWorkbook(buf);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.reason).toMatch(/date/i);
  });

  it("coerces numeric transaction_id to string", () => {
    const buf = makeWorkbook([
      { [TX.date]: "2026.03.01", [TX.time]: "10:00", [TX.id]: 955690685507, [TX.inFlow]: 1000, [TX.outFlow]: 0 },
    ]);
    const result = parseBankWorkbook(buf);
    expect(result.rows[0]!.transactionId).toBe("955690685507");
    expect(typeof result.rows[0]!.transactionId).toBe("string");
  });

  it("fails fast when a required column is missing", () => {
    const buf = makeWorkbook([{ "Тайлант огноо": "2026.03.01", "Орлого": 1000 }]);
    const result = parseBankWorkbook(buf);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.reason).toMatch(/transactionId/i);
    expect(result.rows).toEqual([]);
  });
});

describe("filterNewTransactions", () => {
  function row(id: string): ParsedBankRow {
    return {
      transactionId: id,
      senderName: null,
      senderAccount: null,
      memo: null,
      amount: 1000,
      transactionAt: new Date("2026-03-01T00:00:00Z"),
    };
  }

  it("keeps rows whose transaction_id is not in the existing set", () => {
    const result = filterNewTransactions(
      [row("a"), row("b"), row("c")],
      new Set(["b"]),
    );
    expect(result.map((r) => r.transactionId)).toEqual(["a", "c"]);
  });

  it("returns zero rows when all are duplicates (safe re-upload)", () => {
    const parsed = [row("a"), row("b"), row("c")];
    const existing = new Set(parsed.map((r) => r.transactionId));
    expect(filterNewTransactions(parsed, existing)).toEqual([]);
  });

  it("returns all rows when nothing is duplicated", () => {
    const parsed = [row("a"), row("b")];
    const result = filterNewTransactions(parsed, new Set());
    expect(result).toHaveLength(2);
  });
});
