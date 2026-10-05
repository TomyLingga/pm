"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Extra classes applied when this option is selected (e.g. red for "TDK"). */
  activeClassName?: string;
}

interface SegmentedProps<T extends string> {
  name: string;
  value: T | null | undefined;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Compact radio group rendered as toggle buttons (OK / TDK, Ya / Tidak, ...). */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  disabled,
  invalid,
  className,
  ...aria
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      aria-invalid={invalid || undefined}
      className={cn(
        "inline-flex rounded-md border bg-card p-0.5 shadow-sm",
        invalid && "border-destructive",
        className,
      )}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "relative flex min-w-[3.5rem] cursor-pointer items-center justify-center rounded px-3 py-1.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring",
              checked ? option.activeClassName ?? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
