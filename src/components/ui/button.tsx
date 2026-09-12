import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-40",
        {
          "bg-accent text-accent-fg hover:opacity-90": variant === "default",
          "border border-line bg-transparent text-fg hover:bg-surface-2": variant === "outline",
          "text-fg-muted hover:bg-surface-2 hover:text-fg": variant === "ghost",
          "text-fg underline-offset-4 hover:underline": variant === "link",
          "h-9 px-4": size === "default",
          "h-8 rounded px-3 text-xs": size === "sm",
          "h-11 px-6": size === "lg",
          "h-9 w-9": size === "icon",
        },
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button };
