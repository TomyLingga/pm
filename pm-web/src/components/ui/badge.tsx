import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Pill badge. `variant` picks a semantic tone (tinted) or a solid/outline chrome.
 * Status badges across the app are built from these tones (see components/common/badges.tsx).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        neutral: "border-border bg-surface-2 text-muted-foreground",
        primary: "border-primary/20 bg-primary-soft text-primary-soft-foreground",
        success: "border-success/25 bg-success-soft text-success-foreground",
        warning: "border-warning/30 bg-warning-soft text-warning-foreground",
        danger: "border-danger/25 bg-danger-soft text-danger-foreground",
        info: "border-info/25 bg-info-soft text-info-foreground",
        "success-solid": "border-transparent bg-success text-success-on-solid",
        "danger-solid": "border-transparent bg-danger text-danger-on-solid",
        "warning-solid": "border-transparent bg-warning text-warning-on-solid",
        "info-solid": "border-transparent bg-info text-info-on-solid",
        dashed: "border-dashed border-muted-foreground/50 bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
