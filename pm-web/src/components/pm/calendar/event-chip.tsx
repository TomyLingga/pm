import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/pm";
import { LateChip, PM_STATUS_STYLES, PmStatusBadge } from "../pm-badges";
import { eventHref, eventTime } from "./calendar-utils";

function eventTitle(event: CalendarEvent): string {
  const equipment = [event.equipment.code, event.equipment.name].filter(Boolean).join(" - ");
  return `${eventTime(event)} ${equipment} | ${event.schedule_name} (${event.status_label})`;
}

/** Compact chip for the month/week grid: time + equipment code, coloured by status (projections are dashed). */
export function EventChip({ event, showName }: { event: CalendarEvent; showName?: boolean }) {
  return (
    <Link
      href={eventHref(event)}
      title={eventTitle(event)}
      className={cn(
        "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight transition-[opacity,box-shadow] duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        PM_STATUS_STYLES[event.status] ?? PM_STATUS_STYLES.scheduled,
        event.is_late && "ring-1 ring-danger",
      )}
    >
      <span className="tabular shrink-0">{eventTime(event)}</span>
      <span className="min-w-0 truncate">
        {event.equipment.code ?? event.equipment.name}
        {showName && event.equipment.code ? <span className="font-normal"> {event.equipment.name}</span> : null}
      </span>
    </Link>
  );
}

/** Full-width row for the phone agenda and the "all events of a day" dialog. */
export function AgendaRow({ event }: { event: CalendarEvent }) {
  return (
    <Link
      href={eventHref(event)}
      className={cn(
        "flex items-start gap-3 rounded-md border bg-card p-3 transition-colors duration-150 hover:bg-surface-2/60 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        event.projected && "border-dashed bg-transparent",
      )}
    >
      <span className="tabular mt-0.5 w-11 shrink-0 text-sm font-semibold">{eventTime(event)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {event.equipment.code ? <span className="font-mono text-xs">{event.equipment.code} &middot; </span> : null}
          {event.equipment.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {event.schedule_name}
          {event.pic ? ` · ${event.pic.name}` : ""}
        </span>
        {event.projected ? (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">Proyeksi jadwal (belum menjadi tugas)</span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <PmStatusBadge status={event.status} label={event.status_label} />
        {event.is_late ? <LateChip /> : null}
      </span>
    </Link>
  );
}
