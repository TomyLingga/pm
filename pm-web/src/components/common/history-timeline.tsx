import { History } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityLog } from "@/types/common";
import { Section } from "./section";

interface HistoryTimelineProps {
  logs: ActivityLog[];
  /** status code -> label, used for the "from -> to" line */
  statusLabels: Record<string, string>;
  title?: string;
}

/** Audit trail from `logs`, newest first. */
export function HistoryTimeline({ logs, statusLabels, title = "Riwayat" }: HistoryTimelineProps) {
  const sorted = [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const label = (status: string | null) => (status ? statusLabels[status] ?? status : null);

  return (
    <Section title={title} icon={<History className="h-4 w-4" aria-hidden />}>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
      ) : (
        <ol className="relative ml-1.5 space-y-5 border-l pl-5">
          {sorted.map((log, index) => {
            const from = label(log.from_status);
            const to = label(log.to_status);
            const latest = index === 0;
            return (
              <li key={log.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[26.5px] top-1 h-3 w-3 rounded-full border-2 border-card",
                    latest ? "bg-primary ring-4 ring-primary/15" : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
                <p className={cn("text-sm", latest ? "font-semibold" : "font-medium")}>{log.action_label}</p>
                {from || to ? (
                  <p className="text-xs text-muted-foreground">
                    {from && to && from !== to ? `${from} → ${to}` : to ?? from}
                  </p>
                ) : null}
                {log.notes ? <p className="mt-1 whitespace-pre-wrap break-words text-sm">{log.notes}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {log.user?.name ?? "Sistem"} &middot; <span className="tabular">{formatDateTime(log.created_at)}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
