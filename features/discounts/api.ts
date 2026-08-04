import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/index";
import { discountTypes, type User } from "@/db/schema";
import { HttpError } from "@/lib/errors";

import type { DiscountUnit } from "./calc";
import type { DiscountTypeInput } from "./schemas";

// Serializable catalog row for the client. `value === null` means "custom"
// (entered when the discount is applied).
export type DiscountTypeRow = {
  id: number;
  name: string;
  unit: DiscountUnit;
  value: number | null;
  note: string | null;
  isActive: boolean;
};

function toRow(r: {
  id: number;
  name: string;
  unit: string;
  value: number | null;
  note: string | null;
  isActive: boolean;
}): DiscountTypeRow {
  return { ...r, unit: r.unit as DiscountUnit };
}

const selection = {
  id: discountTypes.id,
  name: discountTypes.name,
  unit: discountTypes.unit,
  value: discountTypes.value,
  note: discountTypes.note,
  isActive: discountTypes.isActive,
};

// Readable by every accountant. `activeOnly` powers the apply-time pickers,
// which should never offer a retired type.
export async function listDiscountTypes(opts?: {
  activeOnly?: boolean;
}): Promise<DiscountTypeRow[]> {
  const rows = await db
    .select(selection)
    .from(discountTypes)
    .orderBy(asc(discountTypes.name));
  const mapped = rows.map(toRow);
  return opts?.activeOnly ? mapped.filter((r) => r.isActive) : mapped;
}

// A discount as chosen when applying it to a student. Normally a catalog entry
// (`discountTypeId` set) plus a value for "custom" types. `discountTypeId: null`
// is a legacy/manual passthrough — a discount loaded before the catalog existed
// — carrying its own name/unit/value so an edit can preserve it unchanged.
export type AppliedDiscountInput = {
  discountTypeId: number | null;
  name?: string | null;
  unit?: DiscountUnit | null;
  value?: number | null;
  siblingStudentId?: number | null;
};

// A resolved application: for catalog entries unit and name come from the
// catalog (authoritative); value is the catalog default or the supplied custom
// value. For passthrough rows they come straight from the input.
export type ResolvedApplication = {
  discountTypeId: number | null;
  name: string;
  unit: DiscountUnit;
  value: number;
  siblingStudentId: number | null;
};

/**
 * Resolve applied discounts, preserving input order (which is the compounding
 * order). Catalog entries: fixed-value types ignore any supplied value; custom
 * types (catalog value NULL) require one. Passthrough rows (discountTypeId null)
 * keep their own name/unit/value. Throws on unknown types or a missing/invalid
 * value. The MNT reductions are then produced by computeTuition.
 */
export async function resolveDiscountApplications(
  applied: AppliedDiscountInput[],
): Promise<ResolvedApplication[]> {
  if (applied.length === 0) return [];
  const ids = [
    ...new Set(
      applied
        .map((a) => a.discountTypeId)
        .filter((id): id is number => id !== null),
    ),
  ];
  const rows =
    ids.length > 0
      ? await db
          .select({
            id: discountTypes.id,
            name: discountTypes.name,
            unit: discountTypes.unit,
            value: discountTypes.value,
          })
          .from(discountTypes)
          .where(inArray(discountTypes.id, ids))
      : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  return applied.map((a) => {
    // Passthrough (pre-catalog) row: trust its own name/unit/value.
    if (a.discountTypeId === null) {
      const unit = a.unit ?? "mnt";
      const value = a.value ?? null;
      const name = a.name?.trim();
      if (!name) throw new HttpError(400, "A discount is missing its name.");
      if (value === null || !Number.isFinite(value)) {
        throw new HttpError(400, `"${name}" needs an amount.`);
      }
      return {
        discountTypeId: null,
        name,
        unit,
        value,
        siblingStudentId: a.siblingStudentId ?? null,
      };
    }

    const t = byId.get(a.discountTypeId);
    if (!t) throw new HttpError(400, "That discount is no longer available.");
    const unit = t.unit as DiscountUnit;
    const value = t.value !== null ? t.value : (a.value ?? null);
    if (value === null || !Number.isFinite(value)) {
      throw new HttpError(400, `"${t.name}" needs an amount.`);
    }
    if (value < 0) throw new HttpError(400, `"${t.name}" can't be negative.`);
    if (unit === "percent" && value > 100) {
      throw new HttpError(400, `"${t.name}" can't exceed 100%.`);
    }
    return {
      discountTypeId: t.id,
      name: t.name,
      unit,
      value,
      siblingStudentId: a.siblingStudentId ?? null,
    };
  });
}

async function ensureNameFree(name: string, exceptId?: number): Promise<void> {
  const [clash] = await db
    .select({ id: discountTypes.id })
    .from(discountTypes)
    .where(eq(discountTypes.name, name))
    .limit(1);
  if (clash && clash.id !== exceptId) {
    throw new HttpError(409, `A discount named "${name}" already exists.`);
  }
}

// Admin-only (route enforces requireAdmin); `user` is the audit author.
export async function createDiscountType(
  user: User,
  input: DiscountTypeInput,
): Promise<DiscountTypeRow> {
  await ensureNameFree(input.name);
  const [created] = await db
    .insert(discountTypes)
    .values({
      name: input.name,
      unit: input.unit,
      value: input.value,
      note: input.note,
      isActive: input.isActive,
      createdBy: user.id,
    })
    .returning(selection);
  return toRow(created!);
}

export async function updateDiscountType(
  _user: User,
  id: number,
  input: DiscountTypeInput,
): Promise<DiscountTypeRow> {
  const [existing] = await db
    .select({ id: discountTypes.id })
    .from(discountTypes)
    .where(eq(discountTypes.id, id))
    .limit(1);
  if (!existing) throw new HttpError(404, "Discount type not found");
  await ensureNameFree(input.name, id);

  const [updated] = await db
    .update(discountTypes)
    .set({
      name: input.name,
      unit: input.unit,
      value: input.value,
      note: input.note,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(eq(discountTypes.id, id))
    .returning(selection);
  return toRow(updated!);
}
