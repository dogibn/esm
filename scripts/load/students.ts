/**
 * Loads scripts/scraped/students.json into the `students` table.
 * See docs/scraping_esmlh.md for the full spec.
 *
 * Usage:
 *   pnpm load:students
 *
 * Required env var: DATABASE_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { students } from "@/db/schema";

interface ScrapedStudent {
  student_id: string;
  first_name: string;
  last_name: string;
  grade_name: string;
  academic_year_name: string;
  parent_phone: string | null;
  parent_email: string | null;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { students } });

const inputPath = resolve(process.cwd(), "scripts/scraped/students.json");
let raw: string;
try {
  raw = readFileSync(inputPath, "utf-8");
} catch {
  console.error(`ERROR: cannot read ${inputPath} — run the scraper first.`);
  process.exit(1);
}

const scraped: ScrapedStudent[] = JSON.parse(raw);
if (!Array.isArray(scraped) || scraped.length === 0) {
  console.error("ERROR: students.json is empty or not an array.");
  process.exit(1);
}

const rows = scraped.map((s) => ({
  studentId: s.student_id,
  firstName: s.first_name,
  lastName: s.last_name,
  parentPhone: s.parent_phone ?? null,
  parentEmail: s.parent_email ?? null,
}));

const result = await db
  .insert(students)
  .values(rows)
  .onConflictDoUpdate({
    target: students.studentId,
    set: {
      firstName: sql`excluded.first_name`,
      lastName: sql`excluded.last_name`,
      parentPhone: sql`excluded.parent_phone`,
      parentEmail: sql`excluded.parent_email`,
      updatedAt: sql`now()`,
    },
  })
  .returning({ createdAt: students.createdAt, updatedAt: students.updatedAt });

const inserted = result.filter(
  (r) => r.createdAt.getTime() === r.updatedAt.getTime()
).length;
const updated = result.length - inserted;

console.log(`Done. ${inserted} inserted, ${updated} updated (${result.length} total).`);

await client.end();
