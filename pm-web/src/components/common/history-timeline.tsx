import { History } from "lucide-react";
import { formatDateTime } from "@/lib/format";
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
        <ol className="relative space-y-4 border-l pl-5">
          {sorted.map((log, index) => {
            const from = label(log.from_status);
            const to = label(log.to_status);
            return (
              <li key={log.id} className="relative">
                <span
                  className={
                    index === 0
                      ? "absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-card bg-primary"
                      : "absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-card bg-muted-foreground/40"
                  }
                  aria-hidden
                />
                <p className="text-sm font-semibold">{log.action_label}</p>
                {from || to ? (
                  <p className="text-xs text-muted-foreground">
                    {from && to && from !== to ? `${from} → ${to}` : to ?? from}
                  </p>
                ) : null}
                {log.notes ? <p className="mt-1 whitespace-pre-wrap text-sm">{log.notes}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {log.user?.name ?? "Sistem"} &middot; {formatDateTime(log.created_at)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
