import { asc, eq } from "drizzle-orm";

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
