/**
 * One-shot seed: populates the foundational reference tables
 * (grade_levels, academic_years, academic_terms) from scripts/data/*.json.
 *
 * Idempotent — re-runs upsert via onConflictDoUpdate, matching the per-table
 * load scripts under scripts/load/. For loading just one table, use the
 * existing pnpm load:* scripts.
 *
 * Usage:
 *   pnpm seed
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";

import { db } from "@/db/index";
import { academicTerms, academicYears, gradeLevels } from "@/db/schema";

const DATA_DIR = resolve(process.cwd(), "scripts/data");

function readSeed<T>(filename: string): T[] {
  const path = resolve(DATA_DIR, filename);
  const data = JSON.parse(readFileSync(path, "utf-8"));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`${filename} is empty or not an array.`);
  }
  return data as T[];
}

async function seedGradeLevels(): Promise<void> {
  type Row = { code: string; sort_order: number };
  const rows = readSeed<Row>("grade_level.json").map((r) => ({
    code: r.code,
    sortOrder: r.sort_order,
  }));

  const result = await db
    .insert(gradeLevels)
    .values(rows)
    .onConflictDoUpdate({
      target: gradeLevels.code,
      set: { sortOrder: sql`excluded.sort_order` },
    })
    .returning({ xmax: sql<string>`xmax` });

  const inserted = result.filter((r) => r.xmax === "0").length;
  console.log(`  grade_levels: ${inserted} inserted, ${result.length - inserted} updated`);
}

async function seedAcademicYears(): Promise<void> {
  type Row = { name: string; start_date: string; end_date: string; is_current: boolean };
  const rows = readSeed<Row>("academic_years.json").map((r) => ({
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    isCurrent: r.is_current,
  }));

  const result = await db
    .insert(academicYears)
    .values(rows)
    .onConflictDoUpdate({
      target: academicYears.name,
      set: {
        startDate: sql`excluded.start_date`,
        endDate: sql`excluded.end_date`,
        isCurrent: sql`excluded.is_current`,
      },
    })
    .returning({ xmax: sql<string>`xmax` });

  const inserted = result.filter((r) => r.xmax === "0").length;
  console.log(`  academic_years: ${inserted} inserted, ${result.length - inserted} updated`);
}

async function seedAcademicTerms(): Promise<void> {
  type Row = {
    academic_year_id: number;
    name: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
  };
  const rows = readSeed<Row>("academic_terms.json").map((r) => ({
    academicYearId: r.academic_year_id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    isCurrent: r.is_current,
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
  console.log(`  academic_terms: ${inserted} inserted, ${result.length - inserted} updated`);
}

async function main(): Promise<void> {
  console.log("Seeding from scripts/data/...");
  await seedGradeLevels();
  await seedAcademicYears();
  await seedAcademicTerms();
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
