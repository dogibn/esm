import type { ReactNode } from "react";

// Small labelled section header (accent bar + title, optional trailing action).
// Reused across every panel of the student detail page.
export function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="h-4 w-[3px] rounded-full bg-primary" aria-hidden />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  );
}
