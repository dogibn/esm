"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * Anything that is text rather than icon hides in the rail — when the sidebar
 * is collapsed, and always on narrow screens, where the rail is the only form
 * that fits. Driven by a data attribute on the root so it stays pure CSS.
 */
export const sidebarRailHiddenClass =
  "max-md:hidden group-data-[collapsed=true]/sidebar:hidden"

type SidebarContextValue = {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function useSidebar(): SidebarContextValue {
  const ctx = React.useContext(SidebarContext)
  if (ctx === null) {
    throw new Error("useSidebar must be used inside <Sidebar>")
  }
  return ctx
}

/**
 * App-shell navigation rail. Expanded is the real state — an icon-only rail
 * makes rarely-visited items unfindable — so collapse is a temporary "I need
 * the width for this table" gesture. The caller owns persistence via
 * `onCollapsedChange`; `defaultCollapsed` comes from the server so the first
 * paint is already in the right shape.
 */
function Sidebar({
  defaultCollapsed = false,
  onCollapsedChange,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"aside">, "onChange"> & {
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)

  const toggle = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      onCollapsedChange?.(next)
      return next
    })
  }, [onCollapsedChange])

  const value = React.useMemo(() => ({ collapsed, toggle }), [collapsed, toggle])

  return (
    <SidebarContext.Provider value={value}>
      <TooltipProvider>
        <aside
          data-slot="sidebar"
          data-collapsed={collapsed}
          className={cn(
            "group/sidebar sticky top-0 flex h-svh shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-200",
            // Below md there is no room for labels, so the rail is the only
            // layout; above it, the collapsed state decides.
            collapsed ? "w-14" : "w-14 md:w-60",
            className
          )}
          {...props}
        >
          {children}
        </aside>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn(
        "flex h-14 shrink-0 items-center gap-2 border-b border-border px-3",
        className
      )}
      {...props}
    />
  )
}

function SidebarToggle({
  expandLabel,
  collapseLabel,
}: {
  expandLabel: string
  collapseLabel: string
}) {
  const { collapsed, toggle } = useSidebar()
  const label = collapsed ? expandLabel : collapseLabel

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={label}
      aria-expanded={!collapsed}
      className={cn(
        // The toggle has no effect below md, where the rail is forced.
        "max-md:hidden",
        // In the rail it is the only thing in the header, and the way back out
        // of it — so it takes the middle rather than hugging an edge.
        "ml-auto group-data-[collapsed=true]/sidebar:mx-auto",
      )}
    >
      {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
    </Button>
  )
}

function SidebarNav({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="sidebar-nav"
      className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-3", className)}
      {...props}
    />
  )
}

function SidebarGroup({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { label?: string }) {
  return (
    <div
      data-slot="sidebar-group"
      // The heading below is display:none in the rail, so the grouping is
      // carried by the role instead of by text that may not be rendered.
      role={label ? "group" : undefined}
      aria-label={label}
      className={cn("flex flex-col gap-0.5 px-2", className)}
      {...props}
    >
      {label ? (
        <span
          data-slot="sidebar-group-label"
          className={cn(
            "px-2 pt-2 pb-1 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase",
            sidebarRailHiddenClass
          )}
        >
          {label}
        </span>
      ) : null}
      {children}
    </div>
  )
}

/**
 * One navigation destination. Active when the route matches or sits beneath it,
 * so a student detail page keeps Students lit.
 *
 * In the rail the label is gone, so the item grows a tooltip — a hover
 * affordance, which is why it is skipped on the touch-sized viewport where the
 * rail is forced.
 */
function SidebarItem({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  const pathname = usePathname()
  const { collapsed } = useSidebar()
  const active = pathname === href || pathname.startsWith(`${href}/`)

  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // Named even in the rail, where the visible label is display:none and the
      // icon is decorative — the tooltip is a hover affordance, not an
      // accessible name. Kept identical to the visible text so the two never
      // disagree when it is showing.
      aria-label={label}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        "[&_svg]:size-4 [&_svg]:shrink-0"
      )}
    >
      {icon}
      <span className={cn("min-w-0 truncate", sidebarRailHiddenClass)}>{label}</span>
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("shrink-0 border-t border-border p-2", className)}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
  SidebarToggle,
}
