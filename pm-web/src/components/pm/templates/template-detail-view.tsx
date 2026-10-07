"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LoadError } from "@/components/common/load-error";
import { PageHeader } from "@/components/common/page-header";
import { InfoList, Section } from "@/components/common/section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { ApiError, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { deleteChecklistTemplate, duplicateChecklistTemplate, getChecklistTemplate } from "@/lib/pm-templates";
import { queryKeys } from "@/lib/query-keys";
import { ActiveBadge } from "../pm-badges";
import { ChecklistPreview } from "../tasks/detail/checklist-preview";
import { TemplateForm } from "./template-form";

/** Placeholder shaped like the page: header, template card, checklist card. */
function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
      <div className="panel p-4 sm:p-5">
        <Skeleton className="mb-4 h-4 w-24" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="panel p-4 sm:p-5">
        <Skeleton className="mb-4 h-4 w-40" />
        <div className="divide-y rounded-md border">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
              <Skeleton className="h-16 w-full" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Template page: edit form when `can_update`, otherwise a read-only view. Plus duplicate / delete. */
export function TemplateDetailView({ id }: { id: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [busy, setBusy] = React.useState<"duplicate" | "delete" | null>(null);

  const query = useQuery({
    queryKey: queryKeys.checklistTemplate(id),
    queryFn: ({ signal }) => getChecklistTemplate(id, signal),
  });

  if (query.isPending) {
    return <DetailSkeleton />;
  }
  if (query.isError) {
    return (
      <LoadError
        error={query.error}
        onRetry={() => query.refetch()}
        entity="Template checklist"
        backHref="/pm/templates"
      />
    );
  }

  const template = query.data;
  const { can_update: canUpdate, can_delete: canDelete } = template.permissions;

  const onDuplicate = async () => {
    setBusy("duplicate");
    try {
      const copy = await duplicateChecklistTemplate(template.id);
      queryClient.setQueryData(queryKeys.checklistTemplate(copy.id), copy);
      void queryClient.invalidateQueries({ queryKey: queryKeys.checklistTemplates, refetchType: "active" });
      toast.success(`Template diduplikat menjadi "${copy.name}".`);
      router.push(`/pm/templates/${copy.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async () => {
    setBusy("delete");
    try {
      await deleteChecklistTemplate(template.id);
      toast.success("Template checklist dihapus.");
      queryClient.removeQueries({ queryKey: queryKeys.checklistTemplate(template.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.checklistTemplates });
      router.replace("/pm/templates");
    } catch (error) {
      setConfirmDelete(false);
      setBusy(null);
      if (error instanceof ApiError && error.status === 409) {
        // Still referenced by a PM schedule.
        toast.error("Template tidak dapat dihapus", { description: error.message, duration: 8000 });
      } else {
        toast.error(errorMessage(error));
      }
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        eyebrow="Template checklist"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {template.name}
            <ActiveBadge active={template.is_active} />
          </span>
        }
        description={`${template.executor_unit.display_name} · ${template.items_count} butir · dipakai ${template.schedules_count} jadwal`}
        backHref="/pm/templates"
        backLabel="Daftar Template"
        actions={
          <>
            {canUpdate ? (
              <Button variant="outline" onClick={() => void onDuplicate()} loading={busy === "duplicate"} disabled={!!busy}>
                {busy === "duplicate" ? null : <Copy />}
                Duplikat
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
                <Trash2 />
                Hapus
              </Button>
            ) : null}
          </>
        }
      />

      {canUpdate ? (
        <TemplateForm key={template.id} template={template} />
      ) : (
        <>
          <Section title="Template">
            <InfoList
              items={[
                { label: "Unit pelaksana", value: template.executor_unit.display_name },
                {
                  label: "Diperbarui",
                  value: <span className="tabular">{formatDateTime(template.updated_at)}</span>,
                },
                {
                  label: "Deskripsi",
                  value: template.description ? <span className="whitespace-pre-wrap">{template.description}</span> : null,
                  wide: true,
                },
              ]}
            />
            <p className="mt-4 text-xs text-muted-foreground">
              Hanya pimpinan unit pelaksana template ini atau admin yang dapat mengubahnya.
            </p>
          </Section>
          <ChecklistPreview items={template.items} footnote="" />
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus template "${template.name}"?`}
        description="Template yang masih dipakai jadwal PM tidak dapat dihapus."
        confirmLabel="Hapus Template"
        confirmVariant="destructive"
        loading={busy === "delete"}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
