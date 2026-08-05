// Where the sidebar's collapsed state lives.
//
// A cookie rather than a table: it has to be readable on the server so the
// first paint is already the right width (no expanded-then-snap flash), and
// `users` has no preferences column to put it in. One browser profile per
// member of staff, so per-browser is per-user in practice.

export const SIDEBAR_COOKIE = "esm-sidebar";

const COLLAPSED = "collapsed";
const EXPANDED = "expanded";

// A year: this is a preference, not a session.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isCollapsedCookie(value: string | undefined): boolean {
  return value === COLLAPSED;
}

export function sidebarCookieValue(collapsed: boolean): string {
  return collapsed ? COLLAPSED : EXPANDED;
}

/** Client-side write. Lax so it survives ordinary navigation. */
export function persistSidebarCollapsed(collapsed: boolean): void {
  document.cookie = `${SIDEBAR_COOKIE}=${sidebarCookieValue(collapsed)}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
