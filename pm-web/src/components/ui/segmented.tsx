"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Extra classes applied when this option is selected (e.g. danger for "TDK"). */
  activeClassName?: string;
}

interface SegmentedProps<T extends string> {
  name: string;
  value: T | null | undefined;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** `sm` for dense filters (32px), `default` 36px, `lg` 48px touch targets on phone checklists. */
  size?: "sm" | "default" | "lg";
  className?: string;
  "aria-label"?: string;
}

const SIZE_CLASSES = {
  sm: "min-w-0 px-2.5 py-1 text-xs",
  default: "min-w-[3.5rem] px-3 py-1.5 text-sm",
  lg: "min-w-[4rem] px-4 py-2.5 text-base",
} as const;

/** Compact radio group rendered as toggle buttons (OK / TDK, Ya / Tidak, ...). */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  disabled,
  invalid,
  size = "default",
  className,
  ...aria
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      aria-invalid={invalid || undefined}
      className={cn("inline-flex rounded-md border bg-surface-2 p-0.5", invalid && "border-danger", className)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "relative flex cursor-pointer items-center justify-center rounded-[5px] font-medium transition-[background-color,color,box-shadow] duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              SIZE_CLASSES[size],
              checked
                ? (option.activeClassName ?? "bg-primary text-primary-foreground shadow-sm")
                : "text-muted-foreground hover:bg-card hover:text-foreground",
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
