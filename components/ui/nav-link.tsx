"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
};

// Top-nav tab: full-height link with a bottom accent border on the active
// route, matching the portal's underline-tab navigation.
export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-full items-center border-b-2 px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:px-4",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
