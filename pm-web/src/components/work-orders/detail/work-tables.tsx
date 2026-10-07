import { ClipboardCheck, HardHat, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CLEARANCE_LABELS, DEFAULT_CLEARANCE_ITEMS } from "@/lib/constants";
import { formatDateTime, formatMinutes } from "@/lib/format";
import { formatNumber } from "@/lib/utils";
import type { ClearanceResult, WorkOrderClearance, WorkOrderDetail } from "@/types/work-order";
import { Section } from "@/components/common/section";

/** Section content flush with the card edges so the table hairlines meet the border. */
const flush = "px-0 pb-0 sm:px-0 sm:pb-0";

export function MaterialsSection({ wo }: { wo: WorkOrderDetail }) {
  return (
    <Section title="Material" icon={<Package className="h-4 w-4" aria-hidden />} contentClassName={flush}>
      {wo.materials.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-5">Tidak ada material yang dicatat.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">No</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Satuan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wo.materials.map((material, index) => (
              <TableRow key={material.id ?? index}>
                <TableCell className="tabular text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="break-words font-medium">{material.material_name}</TableCell>
                <TableCell className="tabular text-right">{formatNumber(material.quantity)}</TableCell>
                <TableCell>{material.unit || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

export function LaboursSection({ wo }: { wo: WorkOrderDetail }) {
  return (
    <Section title="Pekerja" icon={<HardHat className="h-4 w-4" aria-hidden />} contentClassName={flush}>
      {wo.labours.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-5">Belum ada data pekerja.</p>
      ) : (
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">No</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Mulai</TableHead>
              <TableHead>Selesai</TableHead>
              <TableHead className="text-right">Durasi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wo.labours.map((labour, index) => (
              <TableRow key={labour.id ?? index}>
                <TableCell className="tabular text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="break-words font-medium">{labour.worker_name}</TableCell>
                <TableCell className="tabular whitespace-nowrap">{formatDateTime(labour.started_at)}</TableCell>
                <TableCell className="tabular whitespace-nowrap">{formatDateTime(labour.finished_at)}</TableCell>
                <TableCell className="tabular whitespace-nowrap text-right">
                  {formatMinutes(labour.duration_minutes)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="text-right">
                Total durasi
              </TableCell>
              <TableCell className="tabular whitespace-nowrap text-right">
                {formatMinutes(wo.total_labour_minutes)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </Section>
  );
}

/** OK / TDK result of a clearance item (semantic tones, readable in both themes). */
function ResultPill({ result }: { result: ClearanceResult | null }) {
  if (!result) return <span className="text-muted-foreground">-</span>;
  return (
    <Badge variant={result === "ok" ? "success" : "danger"} className="rounded-md px-2 text-[11px] font-bold">
      {CLEARANCE_LABELS[result]}
    </Badge>
  );
}

function Confirmation({
  result,
  name,
  at,
}: {
  result: ClearanceResult | null;
  name: string | null | undefined;
  at: string | null;
}) {
  return (
    <div className="space-y-1">
      <ResultPill result={result} />
      {name ? <p className="break-words text-xs">{name}</p> : null}
      {at ? <p className="tabular text-xs text-muted-foreground">{formatDateTime(at)}</p> : null}
    </div>
  );
}

function clearanceRows(wo: WorkOrderDetail): WorkOrderClearance[] {
  if (wo.clearances.length) return [...wo.clearances].sort((a, b) => a.item_no - b.item_no);
  return DEFAULT_CLEARANCE_ITEMS.map((item) => ({
    ...item,
    mtc_result: null,
    mtc_confirmed_by: null,
    mtc_confirmed_at: null,
    user_result: null,
    user_confirmed_by: null,
    user_confirmed_at: null,
  }));
}

export function ClearanceSection({ wo }: { wo: WorkOrderDetail }) {
  const rows = clearanceRows(wo);
  const userName = (row: WorkOrderClearance) =>
    row.user_confirmed_by?.name ?? (wo.auto_accepted && row.user_result ? "Otomatis (sistem)" : null);

  return (
    <Section
      title="Maintenance Clearance Checklist"
      icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
      contentClassName={flush}
    >
      {/* Desktop */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">No</TableHead>
              <TableHead>Kondisi</TableHead>
              <TableHead>Konfirmasi MTC</TableHead>
              <TableHead>Konfirmasi User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.item_no}>
                <TableCell className="tabular text-muted-foreground">{row.item_no}</TableCell>
                <TableCell className="font-medium">{row.item_label}</TableCell>
                <TableCell>
                  <Confirmation result={row.mtc_result} name={row.mtc_confirmed_by?.name} at={row.mtc_confirmed_at} />
                </TableCell>
                <TableCell>
                  <Confirmation result={row.user_result} name={userName(row)} at={row.user_confirmed_at} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Mobile */}
      <ul className="divide-y sm:hidden">
        {rows.map((row) => (
          <li key={row.item_no} className="space-y-2 px-4 py-3">
            <p className="text-sm font-medium">
              <span className="tabular">{row.item_no}.</span> {row.item_label}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">MTC</p>
                <Confirmation result={row.mtc_result} name={row.mtc_confirmed_by?.name} at={row.mtc_confirmed_at} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">User</p>
                <Confirmation result={row.user_result} name={userName(row)} at={row.user_confirmed_at} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
