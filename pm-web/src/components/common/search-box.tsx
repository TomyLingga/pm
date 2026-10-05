"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBoxProps {
  /** Committed value (e.g. from the URL). */
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
}

/** Debounced search box that also follows external resets of the committed value. */
export function SearchBox({ value, onCommit, placeholder, ...aria }: SearchBoxProps) {
  const [text, setText] = React.useState(value);
  const committed = React.useRef(value);
  const timer = React.useRef<number | undefined>(undefined);
  const commitRef = React.useRef(onCommit);

  React.useEffect(() => {
    commitRef.current = onCommit;
  }, [onCommit]);

  React.useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(value);
    }
  }, [value]);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = (next: string) => {
    window.clearTimeout(timer.current);
    const trimmed = next.trim();
    if (trimmed === committed.current) return;
    committed.current = trimmed;
    commitRef.current(trimmed);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => commit(next), 450);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(text);
        }}
        placeholder={placeholder}
        className="pl-9"
        aria-label={aria["aria-label"] ?? placeholder}
      />
    </div>
  );
}
