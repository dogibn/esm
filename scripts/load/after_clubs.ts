/**
 * Loads scripts/scraped/after_clubs.json into the `fee_structures` table.
 * One row per active club, scoped to the current academic term.
 *
 *   - feeName         ← club.name
 *   - academicTermId  ← current academic_terms row (is_current = true)
 *   - effectiveFrom   ← that term's start_date
 *   - data            ← { fee, club_id, payment_model, teacher, schedule }
 *   - supersededAt    ← null
 *
 * Idempotent via the unique index (fee_name, academic_term_id, effective_from):
 * re-running updates `data` for matching rows rather than duplicating.
 *
 * Usage:
 *   pnpm load:after-clubs
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import { academicTerms, feeStructures } from "@/db/schema";

interface ScrapedClub {
  club_id: string;
  name: string;
  teacher: string | null;
  schedule: string | null;
  fee: number;
  status: string;
  payment_model: string | null;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { academicTerms, feeStructures } });

const inputPath = resolve(process.cwd(), "scripts/scraped/after_clubs.json");
let raw: string;
try {
  raw = readFileSync(inputPath, "utf-8");
} catch {
  console.error(`ERROR: cannot read ${inputPath} — run the scraper first.`);
  process.exit(1);
}

const scraped: ScrapedClub[] = JSON.parse(raw);
if (!Array.isArray(scraped) || scraped.length === 0) {
  console.error("ERROR: after_clubs.json is empty or not an array.");
  await client.end();
  process.exit(1);
}

const [currentTerm] = await db
  .select({
    id: academicTerms.id,
    name: academicTerms.name,
    startDate: academicTerms.startDate,
  })
  .from(academicTerms)
  .where(eq(academicTerms.isCurrent, true))
  .limit(1);

if (!currentTerm) {
  console.error("ERROR: no academic_terms row with is_current = true.");
  await client.end();
  process.exit(1);
}

console.log(
  `Loading ${scraped.length} club(s) into fee_structures for term '${currentTerm.name}' (id=${currentTerm.id}, start=${currentTerm.startDate}).`
);

const seenNames = new Set<string>();
let validationErrors = 0;

const rows: (typeof feeStructures.$inferInsert)[] = [];
for (const c of scraped) {
  if (!c.name) {
    console.error(`ERROR: club_id=${c.club_id} has empty name.`);
    validationErrors++;
    continue;
  }
  if (seenNames.has(c.name)) {
    console.error(`ERROR: duplicate club name '${c.name}' in scraped JSON.`);
    validationErrors++;
    continue;
  }
  seenNames.add(c.name);

  rows.push({
    feeName: c.name,
    academicTermId: currentTerm.id,
    effectiveFrom: currentTerm.startDate,
    data: {
      fee: c.fee,
      club_id: c.club_id,
      payment_model: c.payment_model,
      teacher: c.teacher,
      schedule: c.schedule,
    },
    supersededAt: null,
  });
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

const result = await db
  .insert(feeStructures)
  .values(rows)
  .onConflictDoUpdate({
    target: [feeStructures.feeName, feeStructures.academicTermId, feeStructures.effectiveFrom],
    set: {
      data: sql`excluded.data`,
      supersededAt: sql`excluded.superseded_at`,
    },
  })
  .returning({ id: feeStructures.id, createdAt: feeStructures.createdAt });

const now = Date.now();
const inserted = result.filter((r) => now - r.createdAt.getTime() < 5_000).length;
const updated = result.length - inserted;

console.log(`Done. ${inserted} inserted, ${updated} updated (${result.length} total).`);

await client.end();
