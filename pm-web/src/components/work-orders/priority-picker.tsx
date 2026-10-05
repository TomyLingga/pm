"use client";

import { PRIORITY_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Priority = "high" | "medium" | "low";

const ACTIVE_STYLES: Record<Priority, string> = {
  high: "border-red-500 bg-red-50 ring-1 ring-red-500",
  medium: "border-amber-500 bg-amber-50 ring-1 ring-amber-500",
  low: "border-slate-500 bg-slate-50 ring-1 ring-slate-500",
};

const DOT_STYLES: Record<Priority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

interface PriorityPickerProps {
  name?: string;
  value: Priority | null;
  onChange: (value: Priority) => void;
  /** Defaults to the WO labels (Tinggi/Menengah/Rendah); Form Request passes Tinggi/Sedang/Rendah. */
  options?: Array<{ value: Priority; label: string; description: string }>;
  disabled?: boolean;
  invalid?: boolean;
  /** Compact = no descriptions (dialogs). */
  compact?: boolean;
}

/** Priority as radio cards. */
export function PriorityPicker({
  name = "priority",
  value,
  onChange,
  options = PRIORITY_OPTIONS,
  disabled,
  invalid,
  compact,
}: PriorityPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-invalid={invalid || undefined}
      className={cn("grid grid-cols-3 gap-2", compact ? "" : "sm:gap-3")}
    >
      {options.map((option) => {
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-lg border bg-card p-3 text-left shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted/50",
              checked && ACTIVE_STYLES[option.value],
              invalid && !checked && "border-destructive",
              disabled && "cursor-not-allowed opacity-60",
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
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className={cn("h-2.5 w-2.5 rounded-full", DOT_STYLES[option.value])} aria-hidden />
              {option.label}
            </span>
            {compact ? null : (
              <span className="hidden text-xs text-muted-foreground sm:block">{option.description}</span>
            )}
          </label>
        );
      })}
    </div>
  );
}
