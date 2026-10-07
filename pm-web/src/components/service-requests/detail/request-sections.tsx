import { BookOpenText, ClipboardList, FileText, IdCard, MessageSquareText } from "lucide-react";
import { PriorityBadge } from "@/components/common/badges";
import { InfoList, Section } from "@/components/common/section";
import { formatRupiah } from "@/lib/utils";
import type { ServiceRequestDetail } from "@/types/service-request";
import { IdentityBlock } from "../identity-block";
import { RequestRules } from "../request-rules";

/** KEPERLUAN (+ office and cost estimate). */
export function PurposeSection({ request }: { request: ServiceRequestDetail }) {
  return (
    <Section title="Keperluan" icon={<FileText aria-hidden />}>
      <div className="space-y-4">
        <p className="max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed">{request.purpose}</p>
        <InfoList
          className="border-t pt-4"
          items={[
            { label: "Office", value: request.office?.name },
            {
              label: "Estimasi biaya",
              value:
                request.estimated_cost !== null ? (
                  <span className="tabular font-medium">{formatRupiah(request.estimated_cost)}</span>
                ) : null,
            },
          ]}
        />
      </div>
    </Section>
  );
}

/** JENIS PERMINTAAN + PRIORITAS + executor assignment. */
export function RequestTypeSection({ request }: { request: ServiceRequestDetail }) {
  return (
    <Section title="Jenis Permintaan" icon={<ClipboardList aria-hidden />}>
      <InfoList
        items={[
          {
            label: "Jenis permintaan",
            value: request.service_category ? (
              <span className="font-semibold uppercase tracking-wide">{request.service_category.name}</span>
            ) : null,
          },
          { label: "Unit pelaksana", value: request.executor_unit.display_name },
          { label: "Prioritas", value: <PriorityBadge priority={request.priority} label={request.priority_label} /> },
          {
            label: "Pelaksana ditunjuk",
            value: request.assigned_executor ? (
              <span>
                {request.assigned_executor.name}
                {request.assigned_executor.position ? (
                  <span className="block text-xs text-muted-foreground">{request.assigned_executor.position}</span>
                ) : null}
              </span>
            ) : null,
          },
        ]}
      />
    </Section>
  );
}

/** KETERANGAN (executor notes) */
export function ExecutorNotesSection({ request }: { request: ServiceRequestDetail }) {
  return (
    <Section title="Keterangan" icon={<MessageSquareText aria-hidden />}>
      {request.executor_notes ? (
        <p className="max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed">{request.executor_notes}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Diisi pelaksana saat Form Request diselesaikan.</p>
      )}
    </Section>
  );
}

/** PETUNJUK DAN ATURAN */
export function RulesSection({ request }: { request: ServiceRequestDetail }) {
  return (
    <Section title="Petunjuk dan Aturan" icon={<BookOpenText aria-hidden />}>
      <RequestRules rules={request.rules} contactFooter={request.contact_footer} />
    </Section>
  );
}

/** IDENTITAS KARYAWAN (snapshot at submit). */
export function IdentitySection({ request }: { request: ServiceRequestDetail }) {
  const identity = request.identity ?? {
    name: request.requester.name,
    employment_status: null,
    nrk: request.requester.nrk,
    position: request.requester.position,
    superior_name: request.superior?.name ?? null,
    bagian: null,
    sub_bagian: request.requester_sub_bagian_name,
    email: null,
    phone: null,
  };
  return (
    <Section title="Identitas Karyawan" icon={<IdCard aria-hidden />}>
      <IdentityBlock identity={identity} />
    </Section>
  );
}
