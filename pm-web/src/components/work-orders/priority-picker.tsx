"use client";

import { PRIORITY_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Priority = "high" | "medium" | "low";

/** Same tones as `PriorityBadge` (common/badges.tsx): danger / warning / neutral. */
const ACTIVE_STYLES: Record<Priority, string> = {
  high: "border-danger bg-danger-soft text-danger-foreground ring-1 ring-danger",
  medium: "border-warning bg-warning-soft text-warning-foreground ring-1 ring-warning",
  low: "border-muted-foreground/60 bg-surface-2 text-foreground ring-1 ring-muted-foreground/60",
};

const DOT_STYLES: Record<Priority, string> = {
  high: "bg-danger",
  medium: "bg-warning",
  low: "bg-muted-foreground/60",
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
              "flex min-h-10 cursor-pointer flex-col gap-1 rounded-md border bg-card p-3 text-left shadow-sm transition-[background-color,border-color,color,box-shadow] duration-150 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
              checked ? ACTIVE_STYLES[option.value] : "hover:bg-surface-2",
              invalid && !checked && "border-danger",
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
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT_STYLES[option.value])} aria-hidden />
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
