"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> {
  value: number | null;
  onChange: (value: number | null) => void;
  invalid?: boolean;
}

const formatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Whole-rupiah input: shows "1.500.000" with an "Rp" prefix, emits a number (or null when empty). */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, invalid, ...props }, ref) => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        Rp
      </span>
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value === null ? "" : formatter.format(value)}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 15);
          onChange(digits ? Number(digits) : null);
        }}
        invalid={invalid}
        className={cn("pl-10 tabular-nums", className)}
        {...props}
      />
    </div>
  ),
);
CurrencyInput.displayName = "CurrencyInput";
