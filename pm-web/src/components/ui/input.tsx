import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/** Shared field chrome for Input / Select / Textarea. */
export const fieldClassName =
  "w-full rounded-md border border-input bg-card text-base text-foreground shadow-sm transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/80 hover:border-muted-foreground/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60 sm:text-sm";

export const invalidFieldClassName = "border-danger hover:border-danger focus-visible:border-danger focus-visible:ring-danger/30";

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, invalid, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-10 px-3 py-2 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        fieldClassName,
        invalid && invalidFieldClassName,
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
