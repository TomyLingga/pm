import { ClipboardList, Crown, FileCheck2, Users } from "lucide-react";
import { UserAvatar } from "@/components/common/user-avatar";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatMinutes } from "@/lib/format";
import { formatNumber } from "@/lib/utils";
import type { WorkOrderDetail } from "@/types/work-order";
import { PriorityBadge } from "@/components/common/badges";
import { categoryLabel, locationLabel, requesterDepartment } from "../helpers";
import { InfoList, PersonStamp, Section } from "@/components/common/section";

/** Request data (top of form FM-BOPS-10/05). */
export function InfoSection({ wo }: { wo: WorkOrderDetail }) {
  const equipment = wo.equipment
    ? [wo.equipment.code, wo.equipment.name].filter(Boolean).join(" - ")
    : [wo.equipment_code, wo.equipment_name].filter(Boolean).join(" - ");

  return (
    <Section title="Informasi" icon={<ClipboardList className="h-4 w-4" aria-hidden />}>
      <InfoList
        items={[
          {
            label: "Pemohon",
            value: (
              <span>
                {wo.requester.name}
                <span className="block text-xs text-muted-foreground">
                  {[wo.requester.nrk && `NRK ${wo.requester.nrk}`, wo.requester.position].filter(Boolean).join(" - ")}
                </span>
              </span>
            ),
          },
          { label: "Department / Section", value: requesterDepartment(wo) },
          { label: "Unit pelaksana", value: wo.executor_unit.display_name },
          { label: "Kategori", value: categoryLabel(wo) },
          {
            label: "No. & nama alat",
            value: equipment ? (
              <span>
                {equipment}
                {!wo.equipment ? <span className="block text-xs text-muted-foreground">Diisi manual</span> : null}
              </span>
            ) : null,
          },
          { label: "Lokasi", value: locationLabel(wo) },
          { label: "Prioritas", value: <PriorityBadge priority={wo.priority} label={wo.priority_label} /> },
          { label: "Tanggal terbit", value: <span className="tabular">{formatDateTime(wo.issued_at)}</span> },
          {
            label: "Permintaan pekerjaan",
            value: <span className="whitespace-pre-wrap">{wo.request_description}</span>,
            wide: true,
          },
        ]}
      />
    </Section>
  );
}

/** Assignment, timing and SLA. */
export function AssignmentSection({ wo }: { wo: WorkOrderDetail }) {
  const assignees = [...wo.assignees].sort((a, b) => Number(b.is_lead) - Number(a.is_lead));

  return (
    <Section title="Penugasan" icon={<Users className="h-4 w-4" aria-hidden />}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Teknisi</p>
          {assignees.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Belum ada teknisi yang ditugaskan.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {assignees.map((assignee) => (
                <li key={assignee.id} className="flex items-center gap-2.5">
                  <UserAvatar name={assignee.name} photoUrl={assignee.photo_url} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{assignee.name}</span>
                      {assignee.is_lead ? (
                        <Badge variant="warning" className="gap-0.5 px-1.5 py-0 text-[10px] leading-4">
                          <Crown className="h-3 w-3" aria-hidden />
                          Ketua
                        </Badge>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[assignee.nrk, assignee.position].filter(Boolean).join(" - ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <InfoList
          className="border-t pt-4 sm:grid-cols-1"
          items={[
            {
              label: "Diterima / ditugaskan oleh",
              value: wo.received_by ? (
                <PersonStamp name={wo.received_by.name} time={formatDateTime(wo.received_at)} />
              ) : null,
            },
            {
              label: "Diambil / mulai dikerjakan",
              value:
                wo.picked_by || wo.picked_at ? (
                  <PersonStamp name={wo.picked_by?.name ?? null} time={formatDateTime(wo.picked_at, "")} />
                ) : null,
            },
            {
              label: "Waktu penyelesaian (SLA)",
              value: wo.sla_minutes !== null ? <span className="tabular">{formatMinutes(wo.sla_minutes)}</span> : null,
            },
            ...(wo.acceptance_due_at && wo.status === "completed"
              ? [
                  {
                    label: "Batas konfirmasi penerimaan",
                    value: <span className="tabular">{formatDateTime(wo.acceptance_due_at)}</span>,
                  },
                ]
              : []),
            ...(wo.rework_count > 0 ? [{ label: "Dikerjakan ulang", value: `${wo.rework_count} kali` }] : []),
            ...(wo.status === "cancelled"
              ? [
                  { label: "Dibatalkan", value: <span className="tabular">{formatDateTime(wo.cancelled_at)}</span> },
                  { label: "Alasan pembatalan", value: <span className="whitespace-pre-wrap">{wo.cancel_reason}</span> },
                ]
              : []),
          ]}
        />
      </div>
    </Section>
  );
}

/** Completion and user acceptance. */
export function WorkDoneSection({ wo }: { wo: WorkOrderDetail }) {
  return (
    <Section title="Pekerjaan Selesai" icon={<FileCheck2 className="h-4 w-4" aria-hidden />}>
      <InfoList
        items={[
          {
            label: "Pekerjaan perbaikan selesai",
            value: wo.work_done ? <span className="whitespace-pre-wrap">{wo.work_done}</span> : null,
            wide: true,
          },
          {
            label: "Diselesaikan oleh",
            value: wo.completed_by ? (
              <PersonStamp name={wo.completed_by.name} time={formatDateTime(wo.completed_at)} />
            ) : null,
          },
          {
            label: "Penerimaan pengguna",
            value: wo.accepted_at ? (
              <PersonStamp
                name={wo.auto_accepted ? "Diterima otomatis oleh sistem" : wo.accepted_by?.name ?? "-"}
                time={formatDateTime(wo.accepted_at)}
              />
            ) : null,
          },
          {
            label: "Total breakdown",
            value:
              wo.total_breakdown_hours !== null ? (
                <span className="tabular">{formatNumber(wo.total_breakdown_hours)} jam</span>
              ) : null,
          },
          { label: "Remarks", value: wo.remarks ? <span className="whitespace-pre-wrap">{wo.remarks}</span> : null },
        ]}
      />
    </Section>
  );
}
