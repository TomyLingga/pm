"use client";

import { canAccessPm } from "@/lib/auth";
import type { Me } from "@/types/auth";
import type { Dashboard } from "@/types/dashboard";
import { PmUpcomingList, TechnicianWorkloadTable } from "./dashboard-tables";
import { EquipmentBreakdownChart, EquipmentTopFailures } from "./equipment-charts";
import { PmComplianceChart, RequestsByStatusChart } from "./request-pm-charts";
import { WoByCategoryChart, WoByPriorityChart, WoByStatusChart, WoSlaChart, WoTrendChart } from "./wo-charts";

/**
 * All charts and tables below the KPI row. Loaded with `next/dynamic` (no SSR) so Recharts
 * only ships to the browser.
 */
export function DashboardCharts({ data, me }: { data: Dashboard; me: Me }) {
  const bucket = data.period.bucket;
  const showPm = canAccessPm(me);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <WoByStatusChart data={data.wo_by_status} />
      <WoByPriorityChart data={data.wo_by_priority} />
      <WoTrendChart data={data.wo_trend} bucket={bucket} />
      <WoSlaChart data={data.wo_sla_by_priority} />
      <WoByCategoryChart data={data.wo_by_category} />
      <RequestsByStatusChart data={data.requests_by_status} pendingBySteps={data.requests_pending_by_step} />
      {showPm ? (
        <div className="lg:col-span-2">
          <PmComplianceChart trend={data.pm_trend} compliance={data.pm_compliance} bucket={bucket} />
        </div>
      ) : null}
      <EquipmentBreakdownChart data={data.equipment_breakdown_hours} />
      <EquipmentTopFailures data={data.equipment_top_failures} />
      {showPm ? (
        <>
          <div className="lg:col-span-2">
            <TechnicianWorkloadTable data={data.technician_workload} scope={data.scope} />
          </div>
          <div className="lg:col-span-2">
            <PmUpcomingList data={data.pm_upcoming} />
          </div>
        </>
      ) : null}
    </div>
  );
}
