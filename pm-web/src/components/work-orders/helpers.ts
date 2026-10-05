import type { WorkOrderDetail, WorkOrderListItem } from "@/types/work-order";
import { joinUnique } from "@/lib/utils";

/** "PRN-01 - Printer Epson L3110" (master or manually typed equipment). */
export function equipmentLabel(wo: Pick<WorkOrderListItem, "equipment_code" | "equipment_name">): string {
  return [wo.equipment_code, wo.equipment_name].filter(Boolean).join(" - ");
}

/** "Hardware" or "Lain-lain: pemasangan rak". */
export function categoryLabel(wo: Pick<WorkOrderListItem, "service_category" | "category_note">): string {
  const name = wo.service_category?.name ?? "";
  if (name && wo.category_note) return `${name}: ${wo.category_note}`;
  return name || wo.category_note || "";
}

/** Assignee names with the lead first. */
export function assigneeNames(wo: Pick<WorkOrderListItem, "assignees">): string[] {
  return [...wo.assignees].sort((a, b) => Number(b.is_lead) - Number(a.is_lead)).map((a) => a.name);
}

/** Department / Section of the requester. */
export function requesterDepartment(wo: WorkOrderDetail): string {
  return joinUnique([wo.requester_bagian_name, wo.requester_sub_bagian_name, wo.requester_org_unit_name]);
}

export function locationLabel(wo: WorkOrderDetail): string {
  const base = wo.location
    ? [wo.location.code, wo.location.name].filter(Boolean).join(" - ")
    : wo.location_name ?? "";
  if (base && wo.location_note) return `${base} (${wo.location_note})`;
  return base || wo.location_note || "";
}
