import * as XLSX from "xlsx";

/**
 * Pure server-side parser for bank Excel/CSV files. Adjustable column mapping
 * lives below — do not silently guess. The sample at
 * `features/imports/data/bank_transactions_sample.xlsx` is the Khan/Golomt
 * Mongolian-format export; other banks differ. To support a new bank, add
 * regex patterns to `BANK_COLUMN_PATTERNS`.
 *
 * Domain decisions encoded here (call out if any are wrong):
 *   1. Date and time are stored in TWO separate columns and joined to a
 *      single timestamp with +08:00 (Ulaanbaatar; no DST).
 *   2. `Журнал` arrives as a numeric cell in the sample (12-digit journal
 *      number). It is coerced to string at the boundary; values must be
 *      ≤ 2^53 for safety.
 *   3. Outgoing transactions (Зарлага > 0) are SKIPPED, not stored —
 *      `bank_transactions` represents money received by the school. The
 *      `skippedOutgoing` count is returned for the UI.
 *   4. Rows with missing transaction_id, missing date, or unparseable
 *      amount become parse errors with the row index and a reason. Parsing
 *      continues; the upload doesn't crash.
 */

import type { ParseError, ParsedBankRow, ParseResult } from "../types";

export const BANK_COLUMN_PATTERNS = {
  transactionId: [
    /^журнал$/i,
    /transaction.*id/i,
    /гүйлгээний\s*дугаар/i,
    /^reference$/i,
    /tx.*id/i,
  ],
  memo: [
    /^утга$/i,
    /^memo$/i,
    /гүйлгээний\s*утга/i,
    /^utga$/i,
    /^description$/i,
    /^narration$/i,
  ],
  amountIn: [/^орлого$/i, /^credit$/i, /^income$/i, /^amount$/i, /amount.*in/i],
  amountOut: [/^зарлага$/i, /^debit$/i, /^expense$/i, /amount.*out/i],
  senderAccount: [
    /^харьцсан\s*данс$/i,
    /sender.*account/i,
    /from.*account/i,
    /дансны\s*дугаар/i,
    /данс.*дугаар/i,
    /account.*no/i,
  ],
  senderName: [
    /^дансны\s*нэр$/i,
    /sender.*name/i,
    /from.*name/i,
    /данс.*нэр/i,
  ],
  date: [
    /^тайлант\s*огноо$/i,
    /^огноо$/i,
    /^date$/i,
    /transaction.*date/i,
    /value.*date/i,
  ],
  time: [/^цаг$/i, /^time$/i, /transaction.*time/i],
} as const;

type ColumnKey = keyof typeof BANK_COLUMN_PATTERNS;

type ColumnMap = Partial<Record<ColumnKey, string>>;

function findColumn(headerKeys: string[], patterns: readonly RegExp[]): string | null {
  for (const re of patterns) {
    const hit = headerKeys.find((k) => re.test(k));
    if (hit) return hit;
  }
  return null;
}

function buildColumnMap(headerKeys: string[]): ColumnMap {
  const out: ColumnMap = {};
  for (const key of Object.keys(BANK_COLUMN_PATTERNS) as ColumnKey[]) {
    const col = findColumn(headerKeys, BANK_COLUMN_PATTERNS[key]);
    if (col) out[key] = col;
  }
  return out;
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[, ]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const DATE_DOT = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/;
const TIME_PARTS = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;

/**
 * Parse the bank file's date + time columns into a JS Date interpreted as
 * Ulaanbaatar local time (UTC+8, no DST). Returns null if either component
 * fails to parse.
 */
export function parseTransactionAt(
  dateValue: unknown,
  timeValue: unknown,
): Date | null {
  let yyyy: number;
  let mm: number;
  let dd: number;

  if (dateValue instanceof Date) {
    yyyy = dateValue.getUTCFullYear();
    mm = dateValue.getUTCMonth() + 1;
    dd = dateValue.getUTCDate();
  } else {
    const dateStr = asString(dateValue);
    if (!dateStr) return null;
    const m = DATE_DOT.exec(dateStr);
    if (!m) return null;
    yyyy = Number(m[1]);
    mm = Number(m[2]);
    dd = Number(m[3]);
  }

  let hh = 0;
  let mi = 0;
  let ss = 0;
  const timeStr = asString(timeValue);
  if (timeStr) {
    const t = TIME_PARTS.exec(timeStr);
    if (!t) return null;
    hh = Number(t[1]);
    mi = Number(t[2]);
    ss = t[3] !== undefined ? Number(t[3]) : 0;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = `${yyyy}-${pad(mm)}-${pad(dd)}T${pad(hh)}:${pad(mi)}:${pad(ss)}+08:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse a workbook buffer. Returns { rows, errors, skippedOutgoing }. Never
 * throws on row-level issues — those become entries in `errors`.
 */
export function parseBankWorkbook(buffer: ArrayBuffer | Buffer): ParseResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch (e) {
    return {
      rows: [],
      errors: [
        {
          rowIndex: -1,
          reason: `Failed to read workbook: ${(e as Error).message}`,
        },
      ],
      skippedOutgoing: 0,
    };
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      errors: [{ rowIndex: -1, reason: "Workbook has no sheets" }],
      skippedOutgoing: 0,
    };
  }
  const sheet = wb.Sheets[sheetName]!;
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: null,
  });

  if (raw.length === 0) {
    return { rows: [], errors: [], skippedOutgoing: 0 };
  }

  const map = buildColumnMap(Object.keys(raw[0]!));
  const required: ColumnKey[] = ["transactionId", "amountIn", "date"];
  const missingRequired = required.filter((k) => !map[k]);
  if (missingRequired.length > 0) {
    return {
      rows: [],
      errors: [
        {
          rowIndex: -1,
          reason: `Missing required column(s): ${missingRequired.join(", ")}. Headers seen: ${Object.keys(raw[0]!).join(" | ")}`,
        },
      ],
      skippedOutgoing: 0,
    };
  }

  const rows: ParsedBankRow[] = [];
  const errors: ParseError[] = [];
  let skippedOutgoing = 0;

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]!;

    const amtIn = asNumber(row[map.amountIn!]);
    const amtOut = map.amountOut ? asNumber(row[map.amountOut]) : null;

    // Skip outgoing (debit) rows — not stored.
    if ((amtIn === null || amtIn === 0) && amtOut !== null && amtOut > 0) {
      skippedOutgoing++;
      continue;
    }

    // Skip blank rows silently.
    const txIdRaw = row[map.transactionId!];
    if ((amtIn === null || amtIn === 0) && (txIdRaw === null || txIdRaw === undefined || txIdRaw === "")) {
      continue;
    }

    if (amtIn === null) {
      errors.push({ rowIndex: i, reason: "Unparseable amount" });
      continue;
    }
    if (!Number.isInteger(amtIn)) {
      errors.push({
        rowIndex: i,
        reason: `Amount is not an integer MNT value: ${amtIn}`,
      });
      continue;
    }

    const txId = asString(txIdRaw);
    if (!txId) {
      errors.push({ rowIndex: i, reason: "Missing transaction_id" });
      continue;
    }

    const transactionAt = parseTransactionAt(
      row[map.date!],
      map.time ? row[map.time] : null,
    );
    if (!transactionAt) {
      errors.push({ rowIndex: i, reason: "Unparseable transaction date/time" });
      continue;
    }

    rows.push({
      transactionId: txId,
      senderName: map.senderName ? asString(row[map.senderName]) : null,
      senderAccount: map.senderAccount ? asString(row[map.senderAccount]) : null,
      memo: map.memo ? asString(row[map.memo]) : null,
      amount: amtIn,
      transactionAt,
    });
  }

  return { rows, errors, skippedOutgoing };
}

/**
 * Pure dedupe filter — given parsed rows and the set of existing
 * transaction_ids in the DB, return only the rows that aren't already stored.
 * Extracted so the dedupe behavior is unit-testable without a DB.
 */
export function filterNewTransactions(
  parsed: ParsedBankRow[],
  existingIds: Set<string>,
): ParsedBankRow[] {
  return parsed.filter((r) => !existingIds.has(r.transactionId));
}
