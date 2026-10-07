import { cn } from "@/lib/utils";

/** Shimmering placeholder; shape it like the content it replaces. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-2 before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.06] before:to-transparent motion-reduce:before:hidden",
        className,
      )}
      aria-hidden
      {...props}
    />
  );
}

export { Skeleton };
