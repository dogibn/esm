import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// Standard page heading block: bold title, optional muted subtitle, optional
// trailing actions. Every top-level page starts with one of these.
function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="page-header"
      className={cn("flex flex-wrap items-start justify-between gap-3", className)}
    >
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

// Constrained page body. Pages own their container now (instead of the app
// layout) so full-bleed sections like the student detail banner are possible.
function PageContainer({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="page-container"
      className={cn(
        "mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6",
        className
      )}
      {...props}
    />
  )
}

export { PageHeader, PageContainer }
