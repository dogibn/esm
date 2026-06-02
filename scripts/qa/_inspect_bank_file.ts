import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";

const path = resolve(process.cwd(), process.argv[2] ?? "features/imports/data/bank_transactions_sample.xlsx");
const wb = XLSX.read(readFileSync(path), { type: "buffer" });
const sheet = wb.Sheets[wb.SheetNames[0]!]!;
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: null });
console.log("Sheet names:", wb.SheetNames);
console.log("Row count:", rows.length);
if (rows[0]) {
  console.log("Columns:", Object.keys(rows[0]));
  console.log("First row:", JSON.stringify(rows[0], null, 2));
  console.log("Second row:", JSON.stringify(rows[1], null, 2));
}
