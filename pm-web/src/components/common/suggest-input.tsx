"use client";

import * as React from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface SuggestInputProps<T> {
  id?: string;
  /** Text in the input (controlled). */
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (item: T) => void;
  queryKey: (q: string) => QueryKey;
  fetcher: (q: string, signal?: AbortSignal) => Promise<T[]>;
  getKey: (item: T) => string | number;
  renderOption: (item: T) => React.ReactNode;
  /** Minimum characters before searching (0 = show suggestions on focus). */
  minChars?: number;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
  showSearchIcon?: boolean;
  className?: string;
  /** Extra content at the bottom of the popup (e.g. "isi manual"). Receives a close callback. */
  footer?: (close: () => void) => React.ReactNode;
  "aria-label"?: string;
}

/**
 * Free-text input with async suggestions (keyboard accessible). Used directly for
 * free-text-or-pick fields (materials) and wrapped by AsyncCombobox for pick-only fields.
 */
export function SuggestInput<T>({
  id,
  value,
  onValueChange,
  onSelect,
  queryKey,
  fetcher,
  getKey,
  renderOption,
  minChars = 1,
  placeholder,
  emptyText = "Tidak ada hasil.",
  disabled,
  invalid,
  showSearchIcon = true,
  className,
  footer,
  ...aria
}: SuggestInputProps<T>) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-listbox`;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const term = value.trim();
  const debounced = useDebouncedValue(term, 300);
  const enabled = open && debounced.length >= minChars;

  const query = useQuery({
    queryKey: queryKey(debounced),
    queryFn: ({ signal }) => fetcher(debounced, signal),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: (previous) => previous,
  });

  const items = React.useMemo(() => (enabled ? query.data ?? [] : []), [enabled, query.data]);

  React.useEffect(() => {
    setActiveIndex(-1);
  }, [debounced]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = React.useCallback(() => setOpen(false), []);

  const choose = (item: T) => {
    onSelect(item);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      // Never let Enter in the search box submit the surrounding form.
      if (open) event.preventDefault();
      if (open && activeIndex >= 0 && items[activeIndex]) choose(items[activeIndex]);
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  };

  const showPopup = open && (term.length >= minChars || !!footer);
  const waiting = enabled && (query.isFetching || debounced !== term);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        {showSearchIcon ? (
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        ) : null}
        <Input
          id={inputId}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          invalid={invalid}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-label={aria["aria-label"]}
          aria-expanded={showPopup}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          className={cn(showSearchIcon && "pl-9", waiting && "pr-9")}
        />
        {waiting ? (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>

      {showPopup ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg shadow-edge">
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1 [overscroll-behavior:contain]">
            {term.length < minChars ? null : query.isError ? (
              <li className="px-2 py-2 text-sm text-danger-foreground">{errorMessage(query.error)}</li>
            ) : items.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted-foreground" aria-live="polite">
                {waiting ? "Mencari…" : emptyText}
              </li>
            ) : (
              items.map((item, index) => (
                <li
                  key={getKey(item)}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item)}
                  className={cn(
                    "cursor-pointer rounded-md px-2 py-2 text-sm transition-colors duration-150",
                    index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-surface-2",
                  )}
                >
                  {renderOption(item)}
                </li>
              ))
            )}
          </ul>
          {footer ? <div className="border-t bg-surface-2/60 p-1">{footer(close)}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
