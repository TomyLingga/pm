import Link from "next/link";
import { CalendarClock, MapPin, UserRound, Users, Wrench } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { WorkOrderListItem } from "@/types/work-order";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { assigneeNames, categoryLabel, equipmentLabel } from "./helpers";

/** Mobile list (below md). */
export function WorkOrderCards({ items }: { items: WorkOrderListItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((wo) => {
        const equipment = equipmentLabel(wo);
        const assignees = assigneeNames(wo);
        return (
          <li key={wo.id}>
            <Link
              href={`/work-orders/${wo.id}`}
              className="block rounded-lg border bg-card p-4 shadow-sm transition-colors active:bg-muted/60"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-primary">{wo.wo_number}</span>
                <StatusBadge status={wo.status} label={wo.status_label} />
              </div>
              <p className="mt-2 line-clamp-3 text-sm font-medium">{wo.request_description}</p>
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{formatDateTime(wo.issued_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">
                    {wo.requester.name}
                    {wo.requester_sub_bagian_name ? ` - ${wo.requester_sub_bagian_name}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">
                    {wo.executor_unit.display_name}
                    {categoryLabel(wo) ? ` / ${categoryLabel(wo)}` : ""}
                  </span>
                </div>
                {equipment || wo.location_name ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{[equipment, wo.location_name].filter(Boolean).join(" @ ")}</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">{assignees.length ? assignees.join(", ") : "Belum ada teknisi"}</span>
                </div>
              </div>
              <div className="mt-3">
                <PriorityBadge priority={wo.priority} label={wo.priority_label} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
