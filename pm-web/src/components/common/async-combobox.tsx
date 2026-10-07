"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SuggestInput, type SuggestInputProps } from "./suggest-input";

type BaseProps<T> = Omit<SuggestInputProps<T>, "value" | "onValueChange" | "onSelect">;

export interface AsyncComboboxProps<T> extends BaseProps<T> {
  selected: T | null;
  onChange: (item: T | null) => void;
  /** How the selected item is shown once picked. */
  renderSelected: (item: T) => React.ReactNode;
}

/** Search-and-pick combobox: shows the chosen item as a chip with a clear button. */
export function AsyncCombobox<T>({ selected, onChange, renderSelected, ...props }: AsyncComboboxProps<T>) {
  const [text, setText] = React.useState("");

  if (selected) {
    return (
      <div
        className={cn(
          "flex min-h-10 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-1.5 text-sm shadow-sm",
          props.invalid && "border-danger",
          props.disabled && "bg-surface-2 opacity-60",
          props.className,
        )}
      >
        <div className="min-w-0 flex-1">{renderSelected(selected)}</div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setText("");
          }}
          disabled={props.disabled}
          className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
          aria-label="Hapus pilihan"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <SuggestInput<T>
      {...props}
      value={text}
      onValueChange={setText}
      onSelect={(item) => {
        onChange(item);
        setText("");
      }}
    />
  );
}
