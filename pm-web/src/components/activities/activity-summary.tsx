"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, CheckCircle2, CircleDashed, ClipboardList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DailyActivitySummary } from "@/types/daily-activity";

type Tone = "default" | "success" | "warning";

/** Value colour: semantic `-foreground` tokens read well on the card surface in both themes. */
const VALUE_TONES: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success-foreground",
  warning: "text-warning-foreground",
};

/** Icon chip: tinted `-soft` background with the matching foreground. */
const ICON_TONES: Record<Tone, string> = {
  default: "bg-surface-2 text-muted-foreground",
  success: "bg-success-soft text-success-foreground",
  warning: "bg-warning-soft text-warning-foreground",
};

interface TileSpec {
  /** Status the tile selects ("" = every status). */
  status: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  tone: Tone;
  value: (summary: DailyActivitySummary) => number;
}

const TILES: TileSpec[] = [
  { status: "", label: "Total laporan", sub: "sesuai filter", icon: ClipboardList, tone: "default", value: (s) => s.total },
  { status: "closed", label: "Closed", sub: "selesai", icon: CheckCircle2, tone: "success", value: (s) => s.closed },
  { status: "on_progress", label: "On Progress", sub: "sedang dikerjakan", icon: Activity, tone: "warning", value: (s) => s.on_progress },
  { status: "open", label: "Open", sub: "belum mulai", icon: CircleDashed, tone: "default", value: (s) => s.open },
];

const tileClassName = "panel block min-w-0 p-3 text-left sm:p-4";

/** Placeholder shaped like the tiles (icon chip, number, label). */
export function ActivitySummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-hidden>
      {TILES.map((tile) => (
        <div key={tile.status} className={tileClassName}>
          <Skeleton className="h-8 w-8" />
          <Skeleton className="mt-3 h-7 w-12" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

interface ActivitySummaryProps {
  summary: DailyActivitySummary;
  /** Statuses in effect (empty = every status); a tile is pressed when the selection is exactly its status. */
  selectedStatuses: readonly string[];
  /** Select exactly one status ("" = every status). */
  onStatusChange: (status: string) => void;
}

/** Four counters from `meta.summary`. Clicking a tile selects exactly that status (Total = every status). */
export function ActivitySummary({ summary, selectedStatuses, onStatusChange }: ActivitySummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" role="group" aria-label="Ringkasan status laporan">
      {TILES.map((tile) => {
        const Icon = tile.icon;
        const active =
          tile.status === ""
            ? selectedStatuses.length === 0
            : selectedStatuses.length === 1 && selectedStatuses[0] === tile.status;
        return (
          <button
            key={tile.status}
            type="button"
            aria-pressed={active}
            onClick={() => onStatusChange(tile.status)}
            className={cn(
              tileClassName,
              "transition-[background-color,border-color,box-shadow] duration-150 hover:border-primary/40 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]",
              active && "border-primary/60 ring-1 ring-primary/30",
            )}
          >
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", ICON_TONES[tile.tone])}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            {/* Spans, not paragraphs: a button may only contain phrasing content. */}
            <span className={cn("tabular mt-3 block text-2xl font-semibold leading-none tracking-tight", VALUE_TONES[tile.tone])}>
              {tile.value(summary).toLocaleString("id-ID")}
            </span>
            <span className="mt-1.5 block truncate text-xs font-medium text-muted-foreground">{tile.label}</span>
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/80">{tile.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
