// Pure module — no db import, so the client-side view can share this rule with
// the server instead of restating it.

export type TermChoice = { isCurrent: boolean };

/**
 * Which term becomes current when a year is made current.
 *
 * `academic_years.is_current` and `academic_terms.is_current` are read
 * independently across the app, so the two must always name the same year (see
 * api.ts § setCurrentAcademicYear). When the year changes, one of its terms has
 * to take the flag: a term already marked current inside that year keeps it,
 * otherwise the year's earliest term takes over.
 *
 * `terms` must be ordered by start date. Returns null for a year with no terms —
 * the caller decides whether that is an error (the server) or nothing to
 * announce (the confirm dialog).
 */
export function pickCurrentTerm<T extends TermChoice>(terms: T[]): T | null {
  return terms.find((t) => t.isCurrent) ?? terms[0] ?? null;
}
