# Change note — Sidebar navigation

**Date:** 2026-08-05
**Branch:** `claude/student-tracker-ui-redesign-ued84c`

The top tab bar becomes a collapsible left sidebar. Navigation only — no page,
route, query, or schema changed.

## What moved

- **Header bar deleted.** The brand, the navigation, and the account menu all
  lived there; the sidebar takes all three. Each page's own `PageHeader` now
  owns the top of the screen — title plus that page's primary action, which is
  where "New contract" already wanted to be.
- **Two groups.** The daily loop (Students, Imports, Transactions, **History**)
  unlabelled at the top; **Setup** (Academic calendar, Classes, Fee rates,
  Discounts) below it.
- **Identity moved to the foot of the sidebar** — avatar, name, role, sign-out —
  so there is exactly one place for "things about me". `UserMenu` is replaced by
  `UserBlock`; `components/ui/nav-link.tsx` is gone with the tab bar.

## Collapse

- Persisted in an `esm-sidebar` cookie, **read on the server** so a reload
  paints at the right width instead of expanding and snapping. A cookie rather
  than a column on `users`: it has to be readable during render, and one
  browser profile per member of staff makes per-browser per-user in practice.
- Collapsed is an **icon rail with tooltips**, not a hidden sidebar. Expanded is
  treated as the real state.
- Below the `md` breakpoint the rail is the only layout — there is no room for
  labels — and the toggle is hidden, since it would have nothing to do.

## Two things the browser pass caught

1. **Nav links had no accessible name in the rail.** The label is
   `display: none` there and the icon is `aria-hidden`, so the only thing left
   was a tooltip — a hover affordance, which is not an accessible name and does
   not exist on touch. Every item now carries an `aria-label` in both states,
   identical to the visible text so the two never disagree. The Setup group
   likewise gets `role="group"` + `aria-label`, because its heading is hidden in
   the rail too. All ten sidebar controls were then confirmed to expose a name.
2. **The collapse toggle was clipped in the rail.** Mark plus toggle don't fit
   in 3.5 rem. The toggle is the way back out of the rail, so the mark yields to
   it there (and stays on the forced mobile rail, which has no toggle).

## New primitives

- `components/ui/sidebar.tsx` — `Sidebar`, `SidebarHeader`, `SidebarNav`,
  `SidebarGroup`, `SidebarItem`, `SidebarFooter`, `SidebarToggle`. Rail-hiding
  is a data attribute on the root plus one exported class, so it stays CSS
  rather than JavaScript.
- `components/ui/tooltip.tsx` — Base UI tooltip, needed by the rail. Written by
  hand for the same reason as `progress.tsx`: `ui.shadcn.com` is unreachable
  from this environment, so the CLI can't fetch the registry.
- `features/shell/` — the ESM-specific composition: the nav model (`nav.ts`),
  the cookie helpers (`sidebar-state.ts`), and `AppSidebar`.

## One correction to the brief

**Discounts kept its nav row.** The brief said the `DiscountType` reference
table is a v2 idea with no page to point at. It exists and ships: `discount_types`
is a table in `db/schema.ts` and `schema.md`, `domain_model.md` § DiscountType
describes it, `user_flows.md` flow 4 documents the workflow, and
`app/(app)/discounts/page.tsx` is a working admin CRUD screen. Dropping the row
would have orphaned a live page. (The v2 note in `domain_model.md` is about
re-linking **Discount → Charge** for non-tuition discounts — a different
question.) Say the word if you want it out anyway.

**Clubs** and **Users and access** have no rows, as instructed — those pages
don't exist. Adding either is a two-line change in `features/shell/nav.ts`;
`SidebarItem` has no admin-only flag yet, which is what "Users and access"
will need.

## Testing

- 299 tests and the production build pass; typecheck clean.
- Driven in a browser against a production build with a real database: collapse
  and expand, tooltips in the rail, active-route highlighting, the identity
  block, and **persistence across a full page load** (cookie `collapsed`,
  sidebar still 56 px after navigating to another route). Narrow viewport
  confirmed to force the rail. No console or page errors.
- The auth stub used to reach the pages without a Supabase session was reverted;
  `lib/auth.ts` and `middleware.ts` are byte-identical to before.
