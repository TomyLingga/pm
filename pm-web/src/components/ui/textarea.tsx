import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClassName, invalidFieldClassName } from "./input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, invalid, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn("flex min-h-[96px] px-3 py-2", fieldClassName, invalid && invalidFieldClassName, className)}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
