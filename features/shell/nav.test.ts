import { describe, expect, it } from "vitest";

import { NAV_GROUPS, visibleNavGroups } from "./nav";

const hrefs = (role: string) =>
  visibleNavGroups(role).flatMap((g) => g.items.map((i) => i.href));

describe("visibleNavGroups", () => {
  it("shows every row to an admin", () => {
    expect(visibleNavGroups("admin")).toEqual(NAV_GROUPS);
    expect(hrefs("admin")).toContain("/users");
  });

  it("hides admin-only rows from an accountant", () => {
    expect(hrefs("accountant")).not.toContain("/users");
  });

  it("treats an unknown role as non-admin", () => {
    expect(hrefs("")).not.toContain("/users");
  });

  it("leaves the shared rows untouched for an accountant", () => {
    const shared = NAV_GROUPS.flatMap((g) =>
      g.items.filter((i) => !i.adminOnly).map((i) => i.href),
    );
    expect(hrefs("accountant")).toEqual(shared);
  });

  it("drops a group that would render as an empty heading", () => {
    for (const group of visibleNavGroups("accountant")) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it("keeps Users and access last under Setup", () => {
    const setup = NAV_GROUPS.at(-1)!;
    expect(setup.items.at(-1)?.href).toBe("/users");
  });
});
