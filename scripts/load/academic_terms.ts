/**
 * Loads scripts/data/academic_terms.json into the `academicTerms` table.
 *
 * Usage:
 *   pnpm load:academic_terms
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { academicTerms } from "@/db/schema";

interface AcademicTerm {
  academic_year_id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { academicTerms } });

const inputPath = resolve(process.cwd(), "scripts/data/academic_terms.json");
let raw: string;
try {
  raw = readFileSync(inputPath, "utf-8");
} catch {
  console.error(`ERROR: cannot read ${inputPath} — save the data first.`);
  process.exit(1);
}

const data: AcademicTerm[] = JSON.parse(raw);
if (!Array.isArray(data) || data.length === 0) {
  console.error("ERROR: academic_terms.json is empty or not an array.");
  process.exit(1);
}

const rows = data.map((d) => ({
  academicYearId: d.academic_year_id,
  name: d.name,
  startDate: d.start_date,
  endDate: d.end_date,
  isCurrent: d.is_current,
}));

const result = await db
  .insert(academicTerms)
  .values(rows)
  .onConflictDoUpdate({
    target: [academicTerms.academicYearId, academicTerms.name],
    set: {
      startDate: sql`excluded.start_date`,
      endDate: sql`excluded.end_date`,
      isCurrent: sql`excluded.is_current`,
    },
  })
  .returning({ xmax: sql<string>`xmax` });

const inserted = result.filter((r) => r.xmax === "0").length;
const updated = result.length - inserted;

console.log(`Done. ${inserted} inserted, ${updated} updated (${result.length} total).`);

await client.end();