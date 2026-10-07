"use client";

import { Info } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ScopeTabsProps<T extends string> {
  scopes: readonly T[];
  value: T;
  labels: Record<T, string>;
  /** One sentence per tab telling the user what the tab contains. */
  descriptions: Record<T, string>;
  onChange: (scope: T) => void;
  ariaLabel?: string;
}

/** List scope switcher with an explanation line of the active tab (shown above the filter panel). */
export function ScopeTabs<T extends string>({ scopes, value, labels, descriptions, onChange, ariaLabel }: ScopeTabsProps<T>) {
  return (
    <div className="space-y-2">
      <Tabs value={value} onValueChange={(next) => onChange(next as T)}>
        <TabsList className="w-full justify-start sm:w-auto" aria-label={ariaLabel}>
          {scopes.map((scope) => (
            <TabsTrigger key={scope} value={scope}>
              {labels[scope]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="flex items-start gap-1.5 text-sm text-muted-foreground" aria-live="polite">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
        <span>
          <span className="font-medium text-foreground">{labels[value]}:</span> {descriptions[value]}
        </span>
      </p>
    </div>
  );
}
