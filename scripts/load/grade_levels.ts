/**
 * Loads scripts/data/grade_level.json into the `gradeLevels` table.
 *
 * Usage:
 *   pnpm load:grade_levels
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { gradeLevels } from "@/db/schema";

interface GradeLevel {
  code: string;
  sort_order: number;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { gradeLevels } });

const inputPath = resolve(process.cwd(), "scripts/data/grade_level.json");
let raw: string;
try {
  raw = readFileSync(inputPath, "utf-8");
} catch {
  console.error(`ERROR: cannot read ${inputPath} — save the data first.`);
  process.exit(1);
}

const data: GradeLevel[] = JSON.parse(raw);
if (!Array.isArray(data) || data.length === 0) {
  console.error("ERROR: grade_levels.json is empty or not an array.");
  process.exit(1);
}

const rows = data.map((d) => ({
  code: d.code,
  sortOrder: d.sort_order,
}));

const result = await db
  .insert(gradeLevels)
  .values(rows)
  .onConflictDoUpdate({
    target: gradeLevels.code,
    set: {
      sortOrder: sql`excluded.sort_order`,
    },
  })
  .returning({ xmax: sql<string>`xmax` });

const inserted = result.filter((r) => r.xmax === "0").length;
const updated = result.length - inserted;

console.log(`Done. ${inserted} inserted, ${updated} updated (${result.length} total).`);

await client.end();
