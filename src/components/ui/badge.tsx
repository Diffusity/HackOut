import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Emphasis, not colour. The palette is neutral by design, so severity is
   * carried by fill weight: `solid` for the thing that matters most on the
   * card, `outline` for context, `muted` for background detail.
   */
  variant?: "solid" | "outline" | "muted";
}

function Badge({ className, variant = "outline", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
        {
          "border-transparent bg-accent text-accent-fg": variant === "solid",
          "border-line-strong bg-transparent text-fg": variant === "outline",
          "border-transparent bg-surface-2 text-fg-muted": variant === "muted",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
