import { z } from "zod";

// The two roles the app knows. Mirrors the users_role_check CHECK constraint
// in db/schema.ts.
export const USER_ROLES = ["accountant", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Emails are stored and compared lowercased — lib/auth.ts lowercases the
// session email before looking the row up, so an allowlist row entered as
// "Dolgor@Esm.edu.mn" would never match. Normalise on the way in.
const allowlistEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(255);

// Granting access: the row itself is the grant. A new user is always active;
// there is no reason to add someone pre-revoked.
export const createUserSchema = z.object({
  email: allowlistEmail,
  role: z.enum(USER_ROLES),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Editing an existing grant. The email is the identity the allowlist matches
// on and is deliberately NOT editable — changing it would silently transfer
// one person's audit trail to another. Remove the row's access and add the new
// address instead.
export const updateUserSchema = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.isActive !== undefined, {
    message: "Nothing to update.",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userIdParamSchema = z.string().uuid();
