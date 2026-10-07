"use client";

import * as React from "react";
import Link from "next/link";
import { Camera, ClipboardCheck, Package, Wrench } from "lucide-react";
import { StatusBadge } from "@/components/common/badges";
import { Section } from "@/components/common/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatNumber } from "@/lib/utils";
import type { PmTaskDetail, PmTaskItem } from "@/types/pm";
import { ResultChip } from "../../pm-badges";
import { PhotoStrip } from "../../photo-strip";
import { answerFromItem, groupBySection, itemValueText, rangeHint } from "./checklist-model";
import { CreateWoDialog } from "./create-wo-dialog";

const linkClassName =
  "rounded-sm font-mono text-xs font-semibold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ResultValue({ item }: { item: PmTaskItem }) {
  const value = itemValueText(item);
  const hint = item.input_type === "number" ? rangeHint(item) : null;
  return (
    <div className="space-y-1">
      <ResultChip result={item.result} label={item.result_label} />
      {value && value !== "-" ? (
        <p className={cn("text-sm", item.input_type === "number" ? "tabular font-semibold" : "whitespace-pre-wrap")}>
          {value}
        </p>
      ) : null}
      {hint ? <p className="tabular text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function WorkOrderCell({
  item,
  canCreate,
  onCreate,
}: {
  item: PmTaskItem;
  canCreate: boolean;
  onCreate: (item: PmTaskItem) => void;
}) {
  if (item.work_order) {
    return (
      <div className="space-y-1">
        <Link href={`/work-orders/${item.work_order.id}`} className={linkClassName}>
          {item.work_order.wo_number}
        </Link>
        <div>
          <StatusBadge status={item.work_order.status} label={item.work_order.status_label} />
        </div>
      </div>
    );
  }
  if (item.result === "not_ok" && canCreate) {
    return (
      <Button variant="outline" size="sm" onClick={() => onCreate(item)}>
        <Wrench />
        Buat WO
      </Button>
    );
  }
  return <span className="text-xs text-muted-foreground">-</span>;
}

function ItemPhotos({ item }: { item: PmTaskItem }) {
  if (item.attachments.length === 0) {
    return item.photo_required ? (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-foreground">
        <Camera className="h-3 w-3" aria-hidden />
        Foto wajib belum ada
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">-</span>
    );
  }
  return <PhotoStrip label={item.description} attachments={item.attachments} max={item.attachments.length} canAdd={false} />;
}

/** Read-only checklist results: findings highlighted, with photos and work-order links. */
export function TaskResults({ task }: { task: PmTaskDetail }) {
  const [woItem, setWoItem] = React.useState<PmTaskItem | null>(null);
  const canCreate = task.permissions.can_create_work_order;
  const groups = groupBySection(task.items);
  const sorted = [...task.items].sort((a, b) => a.sort_order - b.sort_order);
  const positions = new Map(sorted.map((item, index) => [item.id, index + 1]));

  const counts = {
    ok: sorted.filter((item) => item.result === "ok").length,
    not_ok: sorted.filter((item) => item.result === "not_ok").length,
    na: sorted.filter((item) => item.result === "na").length,
    empty: sorted.filter((item) => !item.result).length,
  };

  return (
    <>
      <Section
        title="Hasil Checklist"
        icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
        contentClassName="space-y-4"
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="success" className="tabular">
            OK: {counts.ok}
          </Badge>
          <Badge variant={counts.not_ok ? "danger-solid" : "danger"} className="tabular">
            Tidak OK (temuan): {counts.not_ok}
          </Badge>
          <Badge variant="neutral" className="tabular">
            N/A: {counts.na}
          </Badge>
          {counts.empty > 0 ? (
            <Badge variant="dashed" className="tabular">
              Belum diisi: {counts.empty}
            </Badge>
          ) : null}
        </div>

        {groups.map((group) => (
          <div key={group.section ?? "__default"} className="space-y-2">
            {group.section || groups.length > 1 ? (
              <h3 className="text-sm font-semibold">{group.section ?? "Umum"}</h3>
            ) : null}

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-lg border md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10">No</TableHead>
                    <TableHead>Butir</TableHead>
                    <TableHead className="w-[150px]">Hasil</TableHead>
                    <TableHead className="w-[26%]">Catatan</TableHead>
                    <TableHead className="w-[150px]">Foto</TableHead>
                    <TableHead className="w-[150px]">Work Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((item) => (
                    <TableRow
                      key={item.id}
                      className={cn(item.result === "not_ok" && "bg-danger-soft/50 hover:bg-danger-soft/60")}
                    >
                      <TableCell className="tabular text-muted-foreground">{positions.get(item.id)}</TableCell>
                      <TableCell className="font-medium">
                        {item.description}
                        {item.is_required ? (
                          <span className="ml-1 text-destructive" aria-hidden>
                            *
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <ResultValue item={item} />
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm">{item.notes || "-"}</TableCell>
                      <TableCell>
                        <ItemPhotos item={item} />
                      </TableCell>
                      <TableCell>
                        <WorkOrderCell item={item} canCreate={canCreate} onCreate={setWoItem} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-2 md:hidden">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "space-y-2 rounded-lg border p-3",
                    item.result === "not_ok" && "border-danger/30 bg-danger-soft/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      <span className="tabular text-muted-foreground">{positions.get(item.id)}. </span>
                      {item.description}
                      {item.is_required ? (
                        <span className="ml-1 text-destructive" aria-hidden>
                          *
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <ResultValue item={item} />
                  {item.notes ? <p className="whitespace-pre-wrap text-sm">Catatan: {item.notes}</p> : null}
                  {item.attachments.length > 0 || item.photo_required ? <ItemPhotos item={item} /> : null}
                  {item.work_order || (item.result === "not_ok" && canCreate) ? (
                    <WorkOrderCell item={item} canCreate={canCreate} onCreate={setWoItem} />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {task.items.length === 0 ? <p className="text-sm text-muted-foreground">Checklist belum diisi.</p> : null}
      </Section>

      <Section title="Foto Umum" icon={<Camera className="h-4 w-4" aria-hidden />}>
        <PhotoStrip
          label="foto umum tugas"
          size="md"
          attachments={task.attachments}
          max={task.attachments.length}
          canAdd={false}
          emptyText="Tidak ada foto umum."
        />
      </Section>

      <Section title="Material" icon={<Package className="h-4 w-4" aria-hidden />}>
        {task.materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada material yang dicatat.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {task.materials.map((material, index) => (
              <li key={material.id ?? index} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium">{material.material_name}</span>
                <span className="tabular shrink-0 text-muted-foreground">
                  {formatNumber(material.quantity)} {material.unit ?? ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <CreateWoDialog
        task={task}
        item={woItem}
        answer={woItem ? answerFromItem(woItem) : null}
        onOpenChange={(open) => !open && setWoItem(null)}
      />
    </>
  );
}
