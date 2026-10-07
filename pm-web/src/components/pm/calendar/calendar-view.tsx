"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useExecutorStaff, useExecutorUnits } from "@/hooks/use-lookups";
import { errorMessage } from "@/lib/api";
import { isAdmin, isExecutorStaff } from "@/lib/auth";
import { PM_STATUS_LABELS, PM_STATUS_OPTIONS } from "@/lib/pm-constants";
import { getPmCalendar } from "@/lib/pm-tasks";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarParams, PmTaskScope, UnitRef } from "@/types/pm";
import { EquipmentFilter } from "../equipment-filter";
import { PM_STATUS_DOTS } from "../pm-badges";
import {
  WEEKDAY_LABELS,
  dayKey,
  dayTitle,
  groupEventsByDay,
  isValidDayKey,
  parseDayKey,
  rangeTitle,
  shiftAnchor,
  todayKey,
  visibleRange,
  type CalendarViewMode,
} from "./calendar-utils";
import { AgendaRow, EventChip } from "./event-chip";

/** Events shown per day cell in the month grid before "+n lagi". */
const MAX_PER_CELL = 3;

const VIEW_OPTIONS = [
  { value: "month" as const, label: "Bulan" },
  { value: "week" as const, label: "Minggu" },
];

/** Saturday and Sunday in a Monday-first week. */
const isWeekendColumn = (index: number) => index % 7 >= 5;

/** View, anchor date and filters live in the URL. */
function useCalendarParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view: CalendarViewMode = searchParams.get("view") === "week" ? "week" : "month";
  const rawDate = searchParams.get("date");
  const today = todayKey();
  const anchor = isValidDayKey(rawDate) ? rawDate : today;
  const executorUnitId = searchParams.get("executor_unit_id") ?? "";
  const equipmentId = searchParams.get("equipment_id") ?? "";
  const picUserId = searchParams.get("pic_user_id") ?? "";

  const update = React.useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { view, anchor, today, executorUnitId, equipmentId, picUserId, update };
}

function Legend() {
  const entries = [...PM_STATUS_OPTIONS.map((option) => option.value as string), "projected"];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Keterangan warna">
      {entries.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", PM_STATUS_DOTS[status])} aria-hidden />
          {PM_STATUS_LABELS[status]}
        </li>
      ))}
    </ul>
  );
}

interface GridProps {
  days: Date[];
  eventsByDay: Map<string, CalendarEvent[]>;
  today: string;
  anchor: string;
  onShowDay: (key: string) => void;
}

/** Hairline grid: cells carry right/bottom borders; the last column and row drop theirs. */
const gridClassName =
  "grid min-w-[40rem] grid-cols-7 [&>*:nth-child(7n)]:border-r-0 [&>*:nth-last-child(-n+7)]:border-b-0";

function WeekdayHeader() {
  return (
    <div className="grid min-w-[40rem] grid-cols-7 border-b bg-surface-2/70 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {WEEKDAY_LABELS.map((label, index) => (
        <div key={label} className={cn("px-2 py-2", isWeekendColumn(index) && "text-muted-foreground/70")}>
          {label}
        </div>
      ))}
    </div>
  );
}

function DayNumber({ date, isToday, muted }: { date: Date; isToday: boolean; muted?: boolean }) {
  return (
    <span
      className={cn(
        "tabular inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold",
        isToday ? "bg-primary text-primary-foreground shadow-sm" : muted ? "text-muted-foreground/70" : "text-foreground",
      )}
      aria-current={isToday ? "date" : undefined}
    >
      {date.getDate()}
    </span>
  );
}

/** Day cell chrome shared by the month and week grids. */
function dayCellClassName(options: { isToday: boolean; weekend: boolean; outside?: boolean }) {
  return cn(
    "relative min-w-0 space-y-1 border-b border-r p-1.5 transition-colors duration-150",
    options.weekend && "bg-surface-2/40",
    options.outside && "bg-surface-2/70",
    options.isToday &&
      "bg-primary-soft/40 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary before:content-['']",
  );
}

/** 7-column month grid (md and up). Scrolls inside its panel instead of widening the page. */
function MonthGrid({ days, eventsByDay, today, anchor, onShowDay }: GridProps) {
  const month = parseDayKey(anchor).getMonth();
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <WeekdayHeader />
        <div className={gridClassName}>
          {days.map((date, index) => {
            const key = dayKey(date);
            const events = eventsByDay.get(key) ?? [];
            const outside = date.getMonth() !== month;
            const isToday = key === today;
            const hidden = events.length - MAX_PER_CELL;
            return (
              <div
                key={key}
                className={cn(
                  dayCellClassName({ isToday, weekend: isWeekendColumn(index), outside }),
                  "min-h-[7.5rem]",
                )}
              >
                <div className="flex justify-end">
                  <DayNumber date={date} isToday={isToday} muted={outside} />
                </div>
                {events.slice(0, MAX_PER_CELL).map((event) => (
                  <EventChip key={event.key} event={event} />
                ))}
                {hidden > 0 ? (
                  <button
                    type="button"
                    onClick={() => onShowDay(key)}
                    className="w-full rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold text-primary transition-colors duration-150 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    +{hidden} lagi
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 7-column week view (md and up): every event of each day. */
function WeekGrid({ days, eventsByDay, today }: Omit<GridProps, "anchor" | "onShowDay">) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <WeekdayHeader />
        <div className={gridClassName}>
          {days.map((date, index) => {
            const key = dayKey(date);
            const events = eventsByDay.get(key) ?? [];
            const isToday = key === today;
            return (
              <div
                key={key}
                className={cn(dayCellClassName({ isToday, weekend: isWeekendColumn(index) }), "min-h-[22rem]")}
              >
                <div className="flex justify-end">
                  <DayNumber date={date} isToday={isToday} />
                </div>
                {events.map((event) => (
                  <EventChip key={event.key} event={event} showName />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Phone layout: agenda grouped by day (only days that have events). */
function Agenda({ days, eventsByDay, today }: Omit<GridProps, "anchor" | "onShowDay">) {
  const withEvents = days.map((date) => dayKey(date)).filter((key) => (eventsByDay.get(key)?.length ?? 0) > 0);

  if (withEvents.length === 0) {
    return <EmptyState title="Tidak ada tugas PM" description="Tidak ada tugas atau proyeksi pada rentang ini." />;
  }

  return (
    <div className="space-y-5">
      {withEvents.map((key) => (
        <section key={key}>
          <h2
            className={cn(
              "sticky top-14 z-[5] -mx-4 border-b bg-background/95 px-4 py-1.5 text-sm font-semibold backdrop-blur sm:top-16 sm:-mx-6 sm:px-6",
              key === today && "text-primary",
            )}
          >
            {dayTitle(key)}
            {key === today ? " (hari ini)" : ""}
          </h2>
          <ul className="mt-2 space-y-2">
            {(eventsByDay.get(key) ?? []).map((event) => (
              <li key={event.key}>
                <AgendaRow event={event} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Placeholder shaped like the grid (desktop) and the agenda (phones). */
function CalendarSkeleton({ view }: { view: CalendarViewMode }) {
  const cells = view === "week" ? 7 : 35;
  return (
    <div aria-hidden>
      <div className="panel hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b bg-surface-2/70">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="flex justify-center px-2 py-2">
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
        <div className={gridClassName}>
          {Array.from({ length: cells }).map((_, index) => (
            <div
              key={index}
              className={cn("space-y-1.5 border-b border-r p-1.5", view === "week" ? "min-h-[22rem]" : "min-h-[7.5rem]")}
            >
              <div className="flex justify-end">
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
              {index % 3 !== 1 ? <Skeleton className="h-5 w-full" /> : null}
              {index % 4 === 0 ? <Skeleton className="h-5 w-4/5" /> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-5 md:hidden">
        {Array.from({ length: 2 }).map((_, group) => (
          <div key={group} className="space-y-2">
            <Skeleton className="h-5 w-48" />
            {Array.from({ length: 3 }).map((_, row) => (
              <Skeleton key={row} className="h-[4.5rem] w-full rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CalendarView() {
  const me = useCurrentUser();
  const { view, anchor, today, executorUnitId, equipmentId, picUserId, update } = useCalendarParams();
  const [dialogDay, setDialogDay] = React.useState<string | null>(null);

  // Admin/management see every unit; staff see their own units.
  const scope: PmTaskScope = isAdmin(me) ? "all" : "unit";
  const allUnits = useExecutorUnits("work_order");
  const units: UnitRef[] = scope === "all" ? allUnits.data ?? [] : me.executor_units;

  // PIC options come from one unit's staff: the selected unit, or the user's only unit.
  const staffUnitId = executorUnitId
    ? Number(executorUnitId)
    : me.executor_units.length === 1
      ? me.executor_units[0].id
      : null;
  const staff = useExecutorStaff(staffUnitId);
  const staffOptions = (staff.data ?? []).filter((person) => person.id !== me.id);
  const picKnown =
    !picUserId || picUserId === String(me.id) || staffOptions.some((person) => String(person.id) === picUserId);

  const range = React.useMemo(() => visibleRange(view, anchor), [view, anchor]);
  const params: CalendarParams = React.useMemo(
    () => ({
      start: range.startKey,
      end: range.endKey,
      scope,
      executor_unit_id: executorUnitId || undefined,
      equipment_id: equipmentId || undefined,
      pic_user_id: picUserId || undefined,
    }),
    [equipmentId, executorUnitId, picUserId, range.endKey, range.startKey, scope],
  );

  const query = useQuery({
    queryKey: queryKeys.pmCalendar(params),
    queryFn: ({ signal }) => getPmCalendar(params, signal),
    placeholderData: keepPreviousData,
  });

  const events = React.useMemo(() => query.data ?? [], [query.data]);
  const eventsByDay = React.useMemo(() => groupEventsByDay(events), [events]);
  const month = parseDayKey(anchor).getMonth();
  // The phone agenda of a month lists that month only (the grid also shows neighbouring days).
  const agendaDays = view === "month" ? range.days.filter((date) => date.getMonth() === month) : range.days;
  const taskCount = events.filter((event) => !event.projected).length;
  const projectedCount = events.length - taskCount;
  const dialogEvents = dialogDay ? eventsByDay.get(dialogDay) ?? [] : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kalender PM"
        description="Tugas preventive maintenance per tanggal jatuh tempo, termasuk proyeksi jadwal yang belum digenerate."
      />

      <div className="panel space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => update({ date: shiftAnchor(view, anchor, -1) })}
              aria-label={view === "week" ? "Minggu sebelumnya" : "Bulan sebelumnya"}
            >
              <ChevronLeft />
            </Button>
            <Button variant="outline" onClick={() => update({ date: "" })} disabled={anchor === today}>
              Hari ini
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => update({ date: shiftAnchor(view, anchor, 1) })}
              aria-label={view === "week" ? "Minggu berikutnya" : "Bulan berikutnya"}
            >
              <ChevronRight />
            </Button>
          </div>
          <h2
            className="order-first w-full text-center text-lg font-semibold tracking-tight sm:order-none sm:w-auto"
            aria-live="polite"
          >
            {rangeTitle(view, anchor)}
          </h2>
          <Segmented
            name="calendar-view"
            aria-label="Tampilan kalender"
            value={view}
            options={VIEW_OPTIONS}
            onChange={(value) => update({ view: value === "month" ? "" : value })}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-3">
          <Field label="Unit pelaksana" htmlFor="cal-unit">
            <Select
              id="cal-unit"
              value={executorUnitId}
              onChange={(event) => update({ executor_unit_id: event.target.value, pic_user_id: "", equipment_id: "" })}
              disabled={units.length === 0}
            >
              <option value="">Semua unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={String(unit.id)}>
                  {unit.display_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Equipment" htmlFor="cal-equipment">
            <EquipmentFilter
              id="cal-equipment"
              value={equipmentId}
              onChange={(value) => update({ equipment_id: value })}
              executorUnitId={executorUnitId ? Number(executorUnitId) : null}
            />
          </Field>

          <Field
            label="PIC"
            htmlFor="cal-pic"
            hint={staffUnitId === null ? "Pilih unit untuk melihat daftar staf." : undefined}
          >
            <Select id="cal-pic" value={picUserId} onChange={(event) => update({ pic_user_id: event.target.value })}>
              <option value="">Semua PIC</option>
              {isExecutorStaff(me) ? <option value={String(me.id)}>Saya ({me.name})</option> : null}
              {!picKnown ? <option value={picUserId}>PIC terpilih</option> : null}
              {staffOptions.map((person) => (
                <option key={person.id} value={String(person.id)}>
                  {person.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <Legend />
          <p className="tabular text-xs text-muted-foreground" aria-live="polite">
            {query.isFetching
              ? "Memuat…"
              : `${taskCount} tugas${projectedCount ? `, ${projectedCount} proyeksi` : ""}`}
          </p>
        </div>
      </div>

      {query.isPending ? (
        <CalendarSkeleton view={view} />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <div className={cn("transition-opacity duration-150", query.isPlaceholderData && "opacity-60")}>
          <div className="hidden md:block">
            {view === "month" ? (
              <MonthGrid
                days={range.days}
                eventsByDay={eventsByDay}
                today={today}
                anchor={anchor}
                onShowDay={setDialogDay}
              />
            ) : (
              <WeekGrid days={range.days} eventsByDay={eventsByDay} today={today} />
            )}
          </div>
          <div className="md:hidden">
            <Agenda days={agendaDays} eventsByDay={eventsByDay} today={today} />
          </div>
        </div>
      )}

      <Dialog open={!!dialogDay} onOpenChange={(open) => !open && setDialogDay(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogDay ? dayTitle(dialogDay) : ""}</DialogTitle>
            <DialogDescription>{dialogEvents.length} tugas / proyeksi pada hari ini.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {dialogEvents.map((event) => (
              <li key={event.key}>
                <AgendaRow event={event} />
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
