import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
  children: React.ReactNode;
}

/** Card with a titled header used by every detail section. */
export function Section({ title, icon, actions, className, contentClassName, id, children }: SectionProps) {
  return (
    <Card id={id} className={cn("scroll-mt-20", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b py-3 sm:py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
        {actions}
      </CardHeader>
      <CardContent className={cn("pt-4 sm:pt-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export interface InfoItem {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}

/** Responsive label/value grid. Empty values render as "-". */
export function InfoList({ items, className }: { items: InfoItem[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className={cn("min-w-0", item.wide && "sm:col-span-2")}>
          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 break-words text-sm">
            {item.value === null || item.value === undefined || item.value === "" ? "-" : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Person + timestamp pair. */
export function PersonStamp({ name, time }: { name?: string | null; time?: string | null }) {
  if (!name && !time) return <span>-</span>;
  return (
    <span>
      {name ?? "-"}
      {time ? <span className="tabular block text-xs text-muted-foreground">{time}</span> : null}
    </span>
  );
}
