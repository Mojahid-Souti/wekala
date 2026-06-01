import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Settings row: a left label/description column and a right controls column,
 * stacked on mobile, divided by a hairline. The standard SaaS-settings layout
 * (GitHub/Linear/Vercel) — fills horizontal space and keeps each control at a
 * readable width instead of a lone narrow card.
 */
export function SettingsSection({
  title,
  description,
  children,
  contentClassName,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <section className="grid gap-x-12 gap-y-4 border-b border-neutral-200 py-8 first:pt-2 last:border-0 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
        {description && <p className="text-sm leading-relaxed text-neutral-500">{description}</p>}
      </div>
      <div className={cn("min-w-0", contentClassName)}>{children}</div>
    </section>
  );
}
