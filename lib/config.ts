// Non-secret runtime tunables. Unlike lib/env.ts these are safe to read from
// anywhere and don't fail the app if unset — they have committed defaults.

/**
 * How long a user action stays reversible after it happens. Past this window
 * the Undo action is refused (the record is still kept for audit — the window
 * governs reversibility only, not retention). See
 * docs/history_and_reversibility.md.
 *
 * 30 = 1 month. Set to 120 for 1 semester.
 */
export const UNDO_WINDOW_DAYS = 30;
