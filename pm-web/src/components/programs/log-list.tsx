import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityLog } from "@/types/common";

interface LogListProps {
  logs: ActivityLog[];
  /** status code -> label, used for the "from -> to" line */
  statusLabels: Record<string, string>;
  /** Background the timeline sits on; the dots are cut out with a border of that colour. */
  surface?: "card" | "popover";
  className?: string;
}

/**
 * Audit trail, newest first. Same look as `common/history-timeline` without its card wrapper,
 * so it can sit inside a collapsible panel or a dialog without a frame inside a frame.
 */
export function LogList({ logs, statusLabels, surface = "card", className }: LogListProps) {
  const sorted = [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const label = (status: string | null) => (status ? (statusLabels[status] ?? status) : null);

  if (sorted.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Belum ada riwayat.</p>;
  }

  return (
    <ol className={cn("relative ml-1.5 space-y-4 border-l pl-5", className)}>
      {sorted.map((log, index) => {
        const from = label(log.from_status);
        const to = label(log.to_status);
        const latest = index === 0;
        return (
          <li key={log.id} className="relative">
            <span
              className={cn(
                "absolute -left-[26.5px] top-1 h-3 w-3 rounded-full border-2",
                surface === "popover" ? "border-popover" : "border-card",
                latest ? "bg-primary ring-4 ring-primary/15" : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            <p className={cn("text-sm", latest ? "font-semibold" : "font-medium")}>{log.action_label}</p>
            {from || to ? (
              <p className="text-xs text-muted-foreground">{from && to && from !== to ? `${from} → ${to}` : (to ?? from)}</p>
            ) : null}
            {log.notes ? <p className="mt-1 whitespace-pre-wrap break-words text-sm">{log.notes}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {log.user?.name ?? "Sistem"} &middot; <span className="tabular">{formatDateTime(log.created_at)}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
