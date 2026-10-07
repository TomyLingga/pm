import Link from "next/link";
import { Building2, CalendarClock, ChevronRight, Hourglass, UserRound, Wrench } from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { ServiceRequestListItem } from "@/types/service-request";
import { RequestNumber } from "./request-number";

/** Mobile list (below md). Each card is one tap target that opens the detail. */
export function RequestCards({ items }: { items: ServiceRequestListItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((request) => {
        const step = request.current_step;
        return (
          <li key={request.id}>
            <Link
              href={`/requests/${request.id}`}
              className="panel relative block min-h-[44px] p-4 pr-10 transition-[background-color,border-color,box-shadow] duration-150 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <RequestNumber number={request.request_number} className="text-primary" />
                  {request.revision_no > 0 ? (
                    <span className="tabular ml-2 text-[11px] text-muted-foreground">Revisi ke-{request.revision_no}</span>
                  ) : null}
                </div>
                <StatusBadge status={request.status} label={request.status_label} />
              </div>
              <p className="mt-2 line-clamp-3 break-words text-sm font-medium">{request.purpose}</p>
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="tabular">{formatDateTime(request.submitted_at ?? request.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">
                    {request.requester.name}
                    {request.requester_sub_bagian_name ? ` - ${request.requester_sub_bagian_name}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">
                    {request.executor_unit.display_name}
                    {request.service_category ? ` / ${request.service_category.name}` : ""}
                  </span>
                </div>
                {request.office ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{request.office.name}</span>
                  </div>
                ) : null}
                {step ? (
                  <div className="flex items-center gap-2">
                    <Hourglass className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">
                      {step.label}
                      {step.assignee_label ? ` - ${step.assignee_label}` : ""}
                      {step.waiting_since ? ` (${formatRelative(step.waiting_since)})` : ""}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="mt-3">
                <PriorityBadge priority={request.priority} label={request.priority_label} />
              </div>
              <ChevronRight
                className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
