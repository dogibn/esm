"use client"

import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const progressVariants = cva("relative w-full overflow-hidden rounded-full bg-muted", {
  variants: {
    size: {
      // Hairline rule under a value in a dense table cell.
      xs: "h-[3px]",
      sm: "h-1.5",
      md: "h-2",
    },
    tone: {
      primary: "[--progress-fill:var(--color-primary)]",
      success: "[--progress-fill:var(--color-success)]",
      warning: "[--progress-fill:var(--color-warning)]",
    },
  },
  defaultVariants: { size: "md", tone: "primary" },
})

/**
 * Determinate progress bar.
 *
 * `value` is clamped into `[min, max]` here — Base UI converts it to a width
 * percentage without clamping, so an overshoot (an overpaid charge) would
 * otherwise render past the track. A non-positive range renders an empty
 * track, since there is no ratio to draw.
 */
function Progress({
  className,
  indicatorClassName,
  size,
  tone,
  value,
  min = 0,
  max = 100,
  ...props
}: ProgressPrimitive.Root.Props &
  VariantProps<typeof progressVariants> & { indicatorClassName?: string }) {
  const hasRange = max > min
  const clamped =
    value === null || !hasRange ? null : Math.min(Math.max(value, min), max)

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={hasRange ? clamped : 0}
      min={min}
      max={hasRange ? max : min + 1}
      {...props}
    >
      <ProgressPrimitive.Track
        data-slot="progress-track"
        className={cn(progressVariants({ size, tone }), className)}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className={cn(
            "h-full rounded-full bg-(--progress-fill) transition-[width]",
            indicatorClassName
          )}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress, progressVariants }
