import Link from "next/link";
import { CalendarClock, MapPin, UserRound, Users, Wrench } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { WorkOrderListItem } from "@/types/work-order";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { assigneeNames, categoryLabel, equipmentLabel } from "./helpers";

/** Mobile list (below md). The whole card is one link, so the tap target is the full card. */
export function WorkOrderCards({ items }: { items: WorkOrderListItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((wo) => {
        const equipment = equipmentLabel(wo);
        const category = categoryLabel(wo);
        const assignees = assigneeNames(wo);
        return (
          <li key={wo.id}>
            <Link
              href={`/work-orders/${wo.id}`}
              className="panel block p-4 transition-[background-color,border-color,box-shadow] duration-150 hover:bg-surface-2/60 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-primary">{wo.wo_number}</span>
                <StatusBadge status={wo.status} label={wo.status_label} />
              </div>
              <p className="mt-2 line-clamp-3 break-words text-sm font-medium">{wo.request_description}</p>
              <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <dt className="shrink-0">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Tanggal</span>
                  </dt>
                  <dd className="tabular">{formatDateTime(wo.issued_at)}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="shrink-0">
                    <UserRound className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Pemohon</span>
                  </dt>
                  <dd className="min-w-0 truncate">
                    {wo.requester.name}
                    {wo.requester_sub_bagian_name ? ` - ${wo.requester_sub_bagian_name}` : ""}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="shrink-0">
                    <Wrench className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Unit pelaksana</span>
                  </dt>
                  <dd className="min-w-0 truncate">
                    {wo.executor_unit.display_name}
                    {category ? ` / ${category}` : ""}
                  </dd>
                </div>
                {equipment || wo.location_name ? (
                  <div className="flex items-center gap-2">
                    <dt className="shrink-0">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">Alat dan lokasi</span>
                    </dt>
                    <dd className="min-w-0 truncate">{[equipment, wo.location_name].filter(Boolean).join(" @ ")}</dd>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <dt className="shrink-0">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Teknisi</span>
                  </dt>
                  <dd className="min-w-0 truncate">{assignees.length ? assignees.join(", ") : "Belum ada teknisi"}</dd>
                </div>
              </dl>
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
