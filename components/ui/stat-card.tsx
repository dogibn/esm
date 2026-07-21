import type { ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const statCardVariants = cva(
  "relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-4 shadow-xs",
  {
    variants: {
      accent: {
        primary: "[--stat-accent:var(--color-primary)]",
        success: "[--stat-accent:var(--color-success)]",
        warning: "[--stat-accent:var(--color-warning)]",
        destructive: "[--stat-accent:var(--color-destructive)]",
      },
    },
    defaultVariants: { accent: "primary" },
  }
)

// Summary metric card with a colored accent bar, icon chip, uppercase label,
// large value, and a muted footnote — per the dashboard design.
function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
  className,
}: {
  label: string
  value: string
  sub?: string
  icon?: ReactNode
  className?: string
} & VariantProps<typeof statCardVariants>) {
  return (
    <div data-slot="stat-card" className={cn(statCardVariants({ accent }), className)}>
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-(--stat-accent)"
      />
      {icon ? (
        <span className="ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--stat-accent)/10 text-(--stat-accent) [&_svg]:size-4.5">
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
        <span className="text-xl leading-none font-bold tabular-nums">{value}</span>
        {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
      </div>
    </div>
  )
}

export { StatCard }
