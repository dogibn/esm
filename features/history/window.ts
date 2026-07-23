import { UNDO_WINDOW_DAYS } from "@/lib/config";

// Pure undo-window math. No DB, no env — safe to unit test in isolation.

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The deadline for undoing an action that happened at `createdAt`. Computed and
 * stored at write time so a later change to UNDO_WINDOW_DAYS never retroactively
 * moves an existing operation's window.
 */
export function undoableUntil(createdAt: Date): Date {
  return new Date(createdAt.getTime() + UNDO_WINDOW_DAYS * MS_PER_DAY);
}

export type UndoableOp = {
  undoableUntil: Date | null;
  undoneAt: Date | null;
};

/**
 * Whether an operation can still be undone right now: it must have a window
 * (non-undoable kinds like `undo` store NULL), must not already be undone, and
 * must be inside its window.
 */
export function isUndoable(op: UndoableOp, now: Date = new Date()): boolean {
  if (op.undoableUntil === null) return false;
  if (op.undoneAt !== null) return false;
  return now.getTime() < op.undoableUntil.getTime();
}
