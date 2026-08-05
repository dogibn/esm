# Change note — Group by class on the tracking table

**Date:** 2026-08-06

A **Group by class** toggle beside the fee tabs on the Tuition scope. Off is
the flat list as before. On, each class gets a short row above its students —
class name, teacher, student count, and the class's own due / paid /
outstanding — with a chevron that collapses it. Classes are open by default:
grouping is a reading aid, not a way to hide students.

**No migration, no `db/schema.ts` change.**

---

## Grouping paginates by class

The one decision worth stating. The class row's figures are the *class's*, so a
class has to be whole on the page it lands on. Paginating by student would
split a class across a page boundary and print its row twice, each with a
partial count and partial totals — the kind of number an accountant would
rightly file as a bug.

So while grouping, `page`/`pageSize` count classes (ten per page, since each
carries its students with it), not students. The response says which is which
rather than making the client guess:

- `total` — students matching the filters, always. Never the class count.
- `totalGroups` — classes matching the filters; null when ungrouped.
- `pageCount` — pages, over whichever unit is being paged.

The footer reads "Showing 10 of 43 classes · 251 students".

## Tuition only

Tuition is the fee every enrolled student carries, so a class row there sums
the whole class. In a scope that drops students who hold no such charge — bus,
registration, clubs — the row would sum a subset while naming the class, which
is worse than not offering it. Leaving the Tuition tab turns grouping off, so
the toggle never disappears while the table stays grouped — and a hand-edited
`?fee=bus&groupBy=class` is reconciled the same way on first load, by the same
`resolveGroupBy` both sides call. The API stays permissive; this is a UI
policy, defined once.

## Shape

- `features/students/grouping.ts` — new pure module: `groupRowsByClass` folds
  rows into classes in the order they arrive (the query already sorts
  class-first, so nothing re-sorts). No db import, so `grouping.test.ts` can
  exercise the totals, the order, and the overpayment case directly.
- `StudentRow` gains `gradeId` (what grouping folds on). `teacherName` is class
  metadata and stays off the row DTO — it rides on the group.
- `StudentTable` renders the class rows and slices the table's own rows per
  class, so the student cells are rendered by exactly one code path in both
  modes.
- `groupBy` is a query param on both the page and `/api/students`, validated by
  a zod enum with `.catch(default)` — the same treatment `?fee=` gets, for the
  same reason: a stale bookmark should open the tracker, not 400.

## Not done

Grouping is display-only and collapses nothing server-side: the page still
ships every student row it groups. At ten classes that's ~250 rows, which is
fine. If the class rows later want to stand alone — collapsed by default, rows
fetched per class on expand — that's a different endpoint shape, not a tweak to
this one.

---

**Touched:** `features/students/{api,grouping,schemas,strings,types,index}.ts`,
`features/students/components/{StudentTable,StudentsView,GroupByToggle}.tsx`,
`app/(app)/students/page.tsx`, `docs/user_flows.md` § 1,
`features/students/{grouping,schemas}.test.ts`.
