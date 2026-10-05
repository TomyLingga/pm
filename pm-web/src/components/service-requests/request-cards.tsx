import Link from "next/link";
import { Building2, CalendarClock, Hourglass, UserRound, Wrench } from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { ServiceRequestListItem } from "@/types/service-request";
import { RequestNumber } from "./request-number";

/** Mobile list (below md). */
export function RequestCards({ items }: { items: ServiceRequestListItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((request) => {
        const step = request.current_step;
        return (
          <li key={request.id}>
            <Link
              href={`/requests/${request.id}`}
              className="block rounded-lg border bg-card p-4 shadow-sm transition-colors active:bg-muted/60"
            >
              <div className="flex items-start justify-between gap-2">
                <RequestNumber number={request.request_number} className="text-primary" />
                <StatusBadge status={request.status} label={request.status_label} />
              </div>
              <p className="mt-2 line-clamp-3 text-sm font-medium">{request.purpose}</p>
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{formatDateTime(request.submitted_at ?? request.created_at)}</span>
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
                    <span>{request.office.name}</span>
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
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
