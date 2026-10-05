import * as React from "react";
import { cn } from "@/lib/utils";

type NativeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/** Native checkbox styled with the theme accent colour (large touch target friendly). */
const Checkbox = React.forwardRef<HTMLInputElement, NativeInputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      "h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";

/** Native radio styled with the theme accent colour. */
const Radio = React.forwardRef<HTMLInputElement, NativeInputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="radio"
    className={cn(
      "h-4 w-4 shrink-0 cursor-pointer border-input accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Radio.displayName = "Radio";

export { Checkbox, Radio };
