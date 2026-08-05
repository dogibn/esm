"use client";

import { Logo } from "@/components/ui/Logo";
import {
  Sidebar,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
  SidebarToggle,
  sidebarRailHiddenClass,
} from "@/components/ui/sidebar";
import { strings } from "@/app/strings";
import { UserBlock } from "@/features/auth";
import { cn } from "@/lib/utils";

import { visibleNavGroups } from "../nav";
import { persistSidebarCollapsed } from "../sidebar-state";

type Props = {
  defaultCollapsed: boolean;
  user: {
    email: string;
    role: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

export function AppSidebar({ defaultCollapsed, user }: Props) {
  // Role comes from the server-rendered session, not from anything the client
  // can set, so hiding admin-only rows here is safe to trust visually. The
  // pages behind them still check the role themselves.
  const groups = visibleNavGroups(user.role);

  return (
    <Sidebar
      defaultCollapsed={defaultCollapsed}
      onCollapsedChange={persistSidebarCollapsed}
      aria-label={strings.nav.landmark}
    >
      <SidebarHeader>
        {/* The collapsed rail is 3.5rem: the mark and the toggle can't both
            have it, and the toggle is the way back out, so the mark yields.
            It stays on the forced mobile rail, which has no toggle. */}
        <span className="group-data-[collapsed=true]/sidebar:hidden">
          <Logo width={26} height={26} />
        </span>
        <span className={cn("flex min-w-0 flex-col leading-tight", sidebarRailHiddenClass)}>
          <span className="truncate text-sm font-semibold">
            {strings.brand.shortName}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {strings.brand.portalName}
          </span>
        </span>
        <SidebarToggle
          expandLabel={strings.nav.expand}
          collapseLabel={strings.nav.collapse}
        />
      </SidebarHeader>

      <SidebarNav>
        {groups.map((group, index) => (
          <SidebarGroup key={group.label ?? `group-${index}`} label={group.label}>
            {group.items.map((item) => (
              <SidebarItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<item.icon aria-hidden />}
              />
            ))}
          </SidebarGroup>
        ))}
      </SidebarNav>

      <SidebarFooter>
        <UserBlock
          email={user.email}
          role={user.role}
          displayName={user.displayName}
          avatarUrl={user.avatarUrl}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
