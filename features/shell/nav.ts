import {
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  History,
  Percent,
  School,
  ShieldCheck,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";

import { strings } from "@/app/strings";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden from accountants. Cosmetic only — the page and its API routes
   *  enforce the role themselves. */
  adminOnly?: boolean;
};

export type NavGroup = {
  /** Undefined for the unlabelled group of everyday work at the top. */
  label?: string;
  items: NavItem[];
};

/**
 * The app's navigation, in two groups.
 *
 * The top group is the daily loop — the work an accountant is here to do.
 * Everything below it is configuration: touched a few times a year, and read
 * far more often than written. History stays with the daily items on purpose;
 * it drives reversals and is used constantly, so filing it under Setup would
 * lend a daily tool the weight of "config I shouldn't be poking at".
 *
 * Pages that don't exist yet (Clubs) are absent rather than dead links —
 * adding a row here later is a two-line change.
 *
 * Setup ends with Users and access: it's the only item an accountant never
 * sees, and the one an admin reaches for least often, so it sits furthest
 * from the daily work. Use visibleNavGroups() to apply that filter.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/students", label: strings.nav.students, icon: Users },
      { href: "/imports", label: strings.nav.imports, icon: Upload },
      { href: "/transactions", label: strings.nav.transactions, icon: ArrowLeftRight },
      { href: "/history", label: strings.nav.history, icon: History },
    ],
  },
  {
    label: strings.nav.setupGroup,
    items: [
      { href: "/calendar", label: strings.nav.calendar, icon: CalendarDays },
      { href: "/classes", label: strings.nav.classes, icon: School },
      { href: "/fees", label: strings.nav.fees, icon: Banknote },
      { href: "/discounts", label: strings.nav.discounts, icon: Percent },
      {
        href: "/users",
        label: strings.nav.users,
        icon: ShieldCheck,
        adminOnly: true,
      },
    ],
  },
];

/**
 * The navigation as this role should see it. Groups that end up empty are
 * dropped, so an accountant never gets a "Setup" heading with nothing under it
 * — though today Setup still has four items for them.
 */
export function visibleNavGroups(role: string): NavGroup[] {
  const isAdmin = role === "admin";
  if (isAdmin) return NAV_GROUPS;

  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly),
  })).filter((group) => group.items.length > 0);
}
