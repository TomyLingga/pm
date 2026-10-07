"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/lib/api";
import { formatDateTimeLong } from "@/lib/format";
import { previewPmSchedule } from "@/lib/pm-schedules";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { PmSchedulePreviewPayload } from "@/types/pm";

interface SchedulePreviewProps {
  /** Valid preview input, or null while the frequency/start fields are incomplete. */
  payload: PmSchedulePreviewPayload | null;
}

/** Live "Pratinjau jadwal": the next occurrences as the server would generate them. */
export function SchedulePreview({ payload }: SchedulePreviewProps) {
  // Serialise so the debounce compares by value, not by object identity.
  const key = useDebouncedValue(payload ? JSON.stringify(payload) : "", 500);
  const debounced: PmSchedulePreviewPayload | null = key ? (JSON.parse(key) as PmSchedulePreviewPayload) : null;

  const query = useQuery({
    queryKey: queryKeys.pmSchedulePreview(debounced ?? ({} as PmSchedulePreviewPayload)),
    queryFn: ({ signal }) => previewPmSchedule(debounced as PmSchedulePreviewPayload, signal),
    enabled: debounced !== null,
    staleTime: 60 * 1000,
    retry: false,
  });

  return (
    <div className="rounded-md border border-dashed bg-surface-2/50 p-4" aria-live="polite">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
        <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
        Pratinjau jadwal
        {query.data ? (
          <span className="font-normal text-muted-foreground">&middot; {query.data.frequency_label}</span>
        ) : null}
      </p>

      {!payload ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Lengkapi frekuensi dan waktu mulai untuk melihat tanggal-tanggal berikutnya.
        </p>
      ) : query.isError ? (
        <p className="mt-2 text-sm font-medium text-danger-foreground" role="alert">
          {errorMessage(query.error)}
        </p>
      ) : !query.data ? (
        <div className="mt-2">
          <Spinner label="Menghitung jadwal…" />
        </div>
      ) : query.data.dates.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Tidak ada kejadian pada rentang yang dipilih.</p>
      ) : (
        <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {query.data.dates.map((date, index) => (
            <li key={`${date}-${index}`} className="flex items-baseline gap-2">
              <span className="tabular w-5 shrink-0 text-right text-xs text-muted-foreground">{index + 1}.</span>
              <span className={cn("tabular", index === 0 ? "font-medium text-foreground" : "text-foreground/90")}>
                {formatDateTimeLong(date)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
