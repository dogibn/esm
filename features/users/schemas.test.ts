import { describe, expect, it } from "vitest";

import { createUserSchema, updateUserSchema, userIdParamSchema } from "./schemas";

describe("createUserSchema", () => {
  it("normalises the email to lowercase and trims it", () => {
    // lib/auth.ts lowercases the session email before the allowlist lookup, so
    // a row stored with capitals would never match anyone.
    const parsed = createUserSchema.parse({
      email: "  Dolgor@ESM.edu.MN  ",
      role: "admin",
    });
    expect(parsed).toEqual({ email: "dolgor@esm.edu.mn", role: "admin" });
  });

  it("rejects a malformed email", () => {
    expect(createUserSchema.safeParse({ email: "nope", role: "admin" }).success).toBe(
      false,
    );
  });

  it("rejects a role outside the users_role_check constraint", () => {
    const result = createUserSchema.safeParse({
      email: "a@esm.edu.mn",
      role: "superuser",
    });
    expect(result.success).toBe(false);
  });

  it("requires a role — there is no implicit default", () => {
    expect(createUserSchema.safeParse({ email: "a@esm.edu.mn" }).success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("accepts a role-only change", () => {
    expect(updateUserSchema.parse({ role: "accountant" })).toEqual({
      role: "accountant",
    });
  });

  it("accepts an active-only change", () => {
    expect(updateUserSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });

  it("rejects an empty patch", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });

  it("ignores an email — the allowlist identity is not editable", () => {
    const parsed = updateUserSchema.parse({
      role: "admin",
      email: "someone-else@esm.edu.mn",
    });
    expect(parsed).not.toHaveProperty("email");
  });
});

describe("userIdParamSchema", () => {
  it("accepts a uuid", () => {
    expect(
      userIdParamSchema.safeParse("3f1a6f1e-5b2c-4d7e-9a0b-8c1d2e3f4a5b").success,
    ).toBe(true);
  });

  it("rejects a serial id — users are keyed by uuid, unlike the other tables", () => {
    expect(userIdParamSchema.safeParse("12").success).toBe(false);
  });
});
