# Change note — sub-tabs on Classes and Fee rates

**Date:** 2026-08-06

Both admin-config screens stacked every section into one long scroll. They now
split into tabs. **No migration, no `db/schema.ts` change, no API change.**

---

## Classes (`/classes`)

Two tabs: **Classes** (default) and **Grade levels** — the two cards that were
stacked before, unchanged apart from their order. Classes leads because it is
the one read per year; levels are near-static.

## Fee rates (`/fees`)

Three tabs: **Tuition** (default), **Clubs**, **Others**.

Tuition and Clubs are the cards that were there before. **Others** is new: one
table of `Fee | Amount | Applies from` for every school-wide fee except tuition
— registration, bus, and anything else the import loads — instead of a card per
fee.

A card held two things a table cell can't: a per-grade breakdown and the fee's
earlier rates. Neither is dropped — a row expands to both, and the chevron is
hidden on rows with nothing to expand. Publishing a new rate stays available
per row for admins, so no fee lost its write.

`TUITION_FEE_NAME` (`features/fees/shape.ts`) is what splits the two tabs — the
fee name is already a JSONB-level contract in that module, so the constant
belongs next to it rather than in the view.

## Tab state

Both pages keep the selection in the URL (`?tab=`), validated server-side by a
zod enum with `.catch(default)` — an unrecognised tab falls back rather than
erroring an otherwise usable link. Switching tabs does a shallow
`history.replaceState` (the pattern `StudentsView` uses for `?fee=`): every tab
reads data the page already loaded, so re-running the server component would be
pure waste.

The one exception is the Classes year picker, which *is* a real navigation: it
carries the current tab in the pushed URL, or changing year would bounce you
back to the default section.

---

**Touched:** `features/classes/{schemas,strings,index}.ts`,
`features/classes/components/ClassesView.tsx`,
`features/fees/{schemas,shape,strings,index}.ts`,
`features/fees/components/FeesView.tsx`, `app/(app)/{classes,fees}/page.tsx`,
`docs/user_flows.md` §§ 6–7.
