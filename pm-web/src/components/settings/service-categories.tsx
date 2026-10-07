"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Power, Tags, X } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { errorMessage, isApiError } from "@/lib/api";
import { addCategory, getCategorySections, updateCategory } from "@/lib/categories";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { CategorySection, CategoryUpdatePayload, ServiceCategoryItem } from "@/types/category";

interface Flags {
  for_work_order: boolean;
  for_request: boolean;
  requires_note: boolean;
}

function FlagChecks({ value, onChange, idPrefix, disabled }: { value: Flags; onChange: (next: Flags) => void; idPrefix: string; disabled?: boolean }) {
  const items: Array<[keyof Flags, string]> = [
    ["for_work_order", "Work Order"],
    ["for_request", "Form Request"],
    ["requires_note", "Wajib isi keterangan"],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {items.map(([key, label]) => (
        <label
          key={key}
          htmlFor={`${idPrefix}-${key}`}
          className={cn("flex min-h-8 cursor-pointer items-center gap-2 text-sm", disabled && "cursor-not-allowed opacity-60")}
        >
          <Checkbox
            id={`${idPrefix}-${key}`}
            checked={value[key]}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

/** Refresh everything that lists categories (forms, filters) and my executor units. */
function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.categorySections });
    void queryClient.invalidateQueries({ queryKey: ["executor-units"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.me });
  };
}

function CategoryRow({ category, canManage }: { category: ServiceCategoryItem; canManage: boolean }) {
  const invalidate = useInvalidateCategories();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(category.name);
  const [flags, setFlags] = React.useState<Flags>({
    for_work_order: category.for_work_order,
    for_request: category.for_request,
    requires_note: category.requires_note,
  });

  const mutation = useMutation({
    mutationFn: (payload: CategoryUpdatePayload) => updateCategory(category.id, payload),
    onSuccess: (saved, payload) => {
      invalidate();
      setEditing(false);
      toast.success(
        payload.is_active === false
          ? `Kategori "${saved.name}" dinonaktifkan.`
          : payload.is_active === true
            ? `Kategori "${saved.name}" diaktifkan kembali.`
            : `Kategori "${saved.name}" disimpan.`,
      );
    },
    onError: (error) => {
      if (!isApiError(error) || error.status !== 422) toast.error(errorMessage(error));
    },
  });
  const fieldError = isApiError(mutation.error)
    ? mutation.error.fieldError("name") ?? mutation.error.fieldError("for_work_order")
    : undefined;

  if (editing) {
    return (
      <li className="space-y-2 bg-surface-2/60 px-4 py-3 sm:px-5">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Nama kategori"
            maxLength={100}
            invalid={!!fieldError}
            autoComplete="off"
          />
          <Button
            size="icon"
            onClick={() => mutation.mutate({ name, ...flags })}
            disabled={name.trim().length < 2}
            loading={mutation.isPending}
            aria-label="Simpan kategori"
          >
            {mutation.isPending ? null : <Check aria-hidden />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setName(category.name);
              mutation.reset();
            }}
            disabled={mutation.isPending}
            aria-label="Batal ubah"
          >
            <X aria-hidden />
          </Button>
        </div>
        <FlagChecks value={flags} onChange={setFlags} idPrefix={`edit-${category.id}`} disabled={mutation.isPending} />
        <FieldError message={fieldError} />
      </li>
    );
  }

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-2 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2/60 sm:px-5",
        !category.is_active && "bg-surface-2/40 text-muted-foreground",
      )}
    >
      <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", !category.is_active && "line-through")}>
        {category.name}
      </span>
      <div className="flex flex-wrap gap-1">
        {category.for_work_order ? <Badge variant="neutral">WO</Badge> : null}
        {category.for_request ? <Badge variant="neutral">Request</Badge> : null}
        {category.requires_note ? <Badge variant="outline">Wajib keterangan</Badge> : null}
        {!category.is_active ? <Badge variant="dashed">Nonaktif</Badge> : null}
      </div>
      {canManage ? (
        <div className="flex gap-1">
          <Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Ubah ${category.name}`}>
            <Pencil aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => mutation.mutate({ is_active: !category.is_active })}
            disabled={mutation.isPending}
            aria-label={category.is_active ? `Nonaktifkan ${category.name}` : `Aktifkan ${category.name}`}
            title={category.is_active ? "Nonaktifkan" : "Aktifkan kembali"}
          >
            <Power className={category.is_active ? "text-danger" : "text-success"} aria-hidden />
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function AddCategoryForm({ section }: { section: CategorySection }) {
  const invalidate = useInvalidateCategories();
  const [name, setName] = React.useState("");
  const [flags, setFlags] = React.useState<Flags>({ for_work_order: true, for_request: true, requires_note: false });
  const idPrefix = `add-${section.org_unit.id}`;

  const mutation = useMutation({
    mutationFn: () => addCategory({ org_unit_id: section.org_unit.id, name: name.trim(), ...flags }),
    onSuccess: (saved) => {
      invalidate();
      setName("");
      setFlags({ for_work_order: true, for_request: true, requires_note: false });
      toast.success(`Kategori "${saved.name}" ditambahkan ke ${section.org_unit.name}.`);
    },
    onError: (error) => {
      if (!isApiError(error) || error.status !== 422) toast.error(errorMessage(error));
    },
  });
  const fieldError = isApiError(mutation.error) ? mutation.error.fieldError("name") ?? mutation.error.fieldError("org_unit_id") : undefined;
  const noTarget = !flags.for_work_order && !flags.for_request;

  return (
    <form
      className="space-y-2 rounded-lg border border-dashed bg-surface-2/40 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim().length >= 2 && !noTarget) mutation.mutate();
      }}
      noValidate
    >
      <Label htmlFor={`${idPrefix}-name`}>Tambah kategori</Label>
      <div className="flex gap-2">
        <Input
          id={`${idPrefix}-name`}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Contoh: CCTV, Kendaraan, Instalasi Listrik…"
          maxLength={100}
          disabled={mutation.isPending}
          invalid={!!fieldError}
          autoComplete="off"
        />
        <Button type="submit" disabled={name.trim().length < 2 || noTarget} loading={mutation.isPending}>
          {mutation.isPending ? null : <Plus aria-hidden />}
          <span className="hidden sm:inline">Tambah</span>
          <span className="sr-only sm:hidden">Tambah kategori</span>
        </Button>
      </div>
      <FlagChecks value={flags} onChange={setFlags} idPrefix={idPrefix} disabled={mutation.isPending} />
      {noTarget ? <FieldError message="Pilih minimal Work Order atau Form Request." /> : null}
      <FieldError message={fieldError} />
    </form>
  );
}

function SectionCard({ section }: { section: CategorySection }) {
  const active = section.categories.filter((c) => c.is_active).length;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>Seksi {section.org_unit.name}</CardTitle>
            <CardDescription className="mt-0.5">
              {section.org_unit.parents.length ? section.org_unit.parents.join(" · ") : section.org_unit.code}
            </CardDescription>
          </div>
          {section.executor_unit ? (
            <Badge variant="primary" className="tabular" title="Kode di nomor WO / Request">
              {section.executor_unit.code} · {active} kategori aktif
            </Badge>
          ) : (
            <Badge variant="dashed">Belum menerima WO/Request</Badge>
          )}
        </div>
      </CardHeader>
      {section.categories.length ? (
        <ul className="divide-y border-b">
          {section.categories.map((category) => (
            <CategoryRow key={category.id} category={category} canManage={section.can_manage} />
          ))}
        </ul>
      ) : (
        <p className="border-b px-4 py-3 text-sm text-muted-foreground sm:px-5">
          Seksi ini belum punya kategori. Setelah kategori pertama ditambahkan, seksi {section.org_unit.name} bisa dipilih
          sebagai unit pelaksana di form Work Order / Form Request.
        </p>
      )}
      <CardContent className="space-y-3 pt-4 sm:pt-4">
        <AddCategoryForm section={section} />
        {!section.can_manage && section.categories.length ? (
          <p className="text-xs text-muted-foreground">Mengubah nama atau menonaktifkan kategori hanya oleh pimpinan seksi.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Placeholder shaped like a section card (header, three rows, add form). */
function SectionSkeleton() {
  return (
    <div className="panel overflow-hidden" aria-hidden>
      <div className="flex items-start justify-between gap-2 border-b p-4 sm:p-5">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
      <ul className="divide-y border-b">
        {Array.from({ length: 3 }).map((_, index) => (
          <li key={index} className="flex items-center gap-2 px-4 py-3 sm:px-5">
            <Skeleton className="h-4 w-36 flex-1" />
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </li>
        ))}
      </ul>
      <div className="p-4 sm:p-5">
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Kategori layanan of the seksi I belong to (or lead from the sub bagian / bagian above). */
export function ServiceCategories() {
  const query = useQuery({ queryKey: queryKeys.categorySections, queryFn: ({ signal }) => getCategorySections(signal) });

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState title="Gagal memuat kategori" message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  }
  if (!query.data.length) {
    return (
      <EmptyState
        icon={<Tags className="h-5 w-5" aria-hidden />}
        title="Anda belum tergabung di seksi mana pun"
        description="Kategori layanan diatur per seksi pelaksana. Unit organisasi Anda di Portal bukan seksi, atau Anda bukan pimpinan sub bagian/bagian di atasnya."
      />
    );
  }

  return (
    <div className="space-y-4">
      {query.data.map((section) => (
        <SectionCard key={section.org_unit.id} section={section} />
      ))}
    </div>
  );
}
