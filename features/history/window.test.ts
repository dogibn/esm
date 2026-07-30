import { describe, expect, it } from "vitest";

import { MS_PER_DAY, isUndoable, undoableUntil } from "./window";

// UNDO_WINDOW_DAYS is 30 in lib/config.ts.
const WINDOW_DAYS = 30;

describe("undoableUntil", () => {
  it("adds the configured window to the creation time", () => {
    const created = new Date("2026-01-01T00:00:00Z");
    const until = undoableUntil(created);
    expect(until.getTime() - created.getTime()).toBe(WINDOW_DAYS * MS_PER_DAY);
  });
});

describe("isUndoable", () => {
  const created = new Date("2026-01-01T00:00:00Z");
  const until = undoableUntil(created);

  it("is true inside the window and not yet undone", () => {
    const now = new Date(created.getTime() + 5 * MS_PER_DAY);
    expect(isUndoable({ undoableUntil: until, undoneAt: null }, now)).toBe(true);
  });

  it("is false once the window has passed", () => {
    const now = new Date(until.getTime() + 1);
    expect(isUndoable({ undoableUntil: until, undoneAt: null }, now)).toBe(false);
  });

  it("is false exactly at the deadline (strictly-before check)", () => {
    expect(isUndoable({ undoableUntil: until, undoneAt: null }, until)).toBe(false);
  });

  it("is false when already undone, even inside the window", () => {
    const now = new Date(created.getTime() + 1 * MS_PER_DAY);
    expect(
      isUndoable({ undoableUntil: until, undoneAt: new Date(now) }, now),
    ).toBe(false);
  });

  it("is false when the operation has no window (non-undoable kind)", () => {
    expect(isUndoable({ undoableUntil: null, undoneAt: null })).toBe(false);
  });
});
