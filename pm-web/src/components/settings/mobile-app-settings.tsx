"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/states";
import { AppDownloadCardView } from "@/components/dashboard/app-download-card";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api";
import { getAppDownloads, updateAppDownloads } from "@/lib/app-downloads";
import { isAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { firstError, unmatchedValidationMessage } from "@/lib/validation";
import type { ValidationErrors } from "@/types/api";
import type { AppDownloads, AppDownloadsPayload, AppDownloadsResponse } from "@/types/app-downloads";

type FieldKey = keyof AppDownloadsPayload;
type FormState = Record<FieldKey, string>;

const FIELD_KEYS: FieldKey[] = ["android_url", "android_version", "ios_url", "ios_version", "notes"];
const URL_MAX = 500;
const VERSION_MAX = 50;
const NOTES_MAX = 500;

function formFrom(data: AppDownloads): FormState {
  return {
    android_url: data.android_url ?? "",
    android_version: data.android_version ?? "",
    ios_url: data.ios_url ?? "",
    ios_version: data.ios_version ?? "",
    notes: data.notes ?? "",
  };
}

/** Trims every field; empty strings become null (the server stores them as null anyway). */
function toPayload(form: FormState): AppDownloadsPayload {
  const value = (key: FieldKey) => form[key].trim() || null;
  return {
    android_url: value("android_url"),
    android_version: value("android_version"),
    ios_url: value("ios_url"),
    ios_version: value("ios_version"),
    notes: value("notes"),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validate(form: FormState): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  const android = form.android_url.trim();
  const ios = form.ios_url.trim();
  if (android && !isHttpUrl(android)) errors.android_url = "Tautan harus diawali http:// atau https://.";
  if (ios && !isHttpUrl(ios)) errors.ios_url = "Tautan harus diawali http:// atau https://.";
  if (form.android_version.trim() && !android) errors.android_url = "Isi tautan Android bila versinya diisi.";
  if (form.ios_version.trim() && !ios) errors.ios_url = "Isi tautan iPhone bila versinya diisi.";
  return errors;
}

function FormSkeleton() {
  return (
    <Card aria-hidden>
      <CardHeader className="border-b">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 sm:grid-cols-3 sm:pt-5">
        <Skeleton className="h-16 w-full sm:col-span-2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full sm:col-span-2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-28 w-full sm:col-span-3" />
      </CardContent>
    </Card>
  );
}

function MobileAppForm({ current }: { current: AppDownloadsResponse }) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<FormState>(() => formFrom(current.data));
  const [dirty, setDirty] = React.useState(false);
  const [clientErrors, setClientErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [serverErrors, setServerErrors] = React.useState<ValidationErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  // Follow background refetches as long as the admin has not started editing.
  React.useEffect(() => {
    if (!dirty) setForm(formFrom(current.data));
  }, [current, dirty]);

  const update = (key: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setClientErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };
  const errorFor = (key: FieldKey) => clientErrors[key] ?? firstError(serverErrors, key);

  const mutation = useMutation({
    mutationFn: (payload: AppDownloadsPayload) => updateAppDownloads(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.appDownloads, saved);
      setForm(formFrom(saved.data));
      setDirty(false);
      setServerErrors({});
      setFormError(null);
      toast.success("Tautan unduhan disimpan.");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) {
        setServerErrors(error.errors);
        setFormError(unmatchedValidationMessage(error, FIELD_KEYS) ?? null);
        return;
      }
      setFormError(errorMessage(error));
      toast.error(errorMessage(error));
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setServerErrors({});
    setFormError(null);
    const errors = validate(form);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError("Periksa kembali isian yang ditandai.");
      return;
    }
    mutation.mutate(toPayload(form));
  };

  const reset = () => {
    setForm(formFrom(current.data));
    setDirty(false);
    setClientErrors({});
    setServerErrors({});
    setFormError(null);
  };

  const submitting = mutation.isPending;
  const preview = toPayload(form);
  const previewHasLinks = !!(preview.android_url || preview.ios_url);
  const { updated_at: updatedAt, updated_by: updatedBy } = current.data;

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate>
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>Tautan unduhan</CardTitle>
            <CardDescription>
              Tombol unduh tampil di Dashboard semua pengguna. Kosongkan tautan untuk menyembunyikan tombolnya.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 sm:pt-5">
            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger-foreground"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{formError}</span>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Tautan unduhan Android (APK)"
                htmlFor="mobile-android-url"
                error={errorFor("android_url")}
                hint="Tautan file .apk, misalnya dari Google Drive. Dibuka di tab baru."
                className="sm:col-span-2"
              >
                <Input
                  id="mobile-android-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  value={form.android_url}
                  onChange={(event) => update("android_url", event.target.value)}
                  placeholder="https://drive.google.com/…"
                  maxLength={URL_MAX}
                  disabled={submitting}
                  invalid={!!errorFor("android_url")}
                />
              </Field>
              <Field label="Versi Android" htmlFor="mobile-android-version" error={errorFor("android_version")}>
                <Input
                  id="mobile-android-version"
                  autoComplete="off"
                  value={form.android_version}
                  onChange={(event) => update("android_version", event.target.value)}
                  placeholder="1.2.1"
                  maxLength={VERSION_MAX}
                  disabled={submitting}
                  invalid={!!errorFor("android_version")}
                />
              </Field>

              <Field
                label="Tautan iPhone"
                htmlFor="mobile-ios-url"
                error={errorFor("ios_url")}
                hint="Tautan halaman build EAS / TestFlight / Google Drive berisi file .ipa."
                className="sm:col-span-2"
              >
                <Input
                  id="mobile-ios-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  value={form.ios_url}
                  onChange={(event) => update("ios_url", event.target.value)}
                  placeholder="https://expo.dev/…"
                  maxLength={URL_MAX}
                  disabled={submitting}
                  invalid={!!errorFor("ios_url")}
                />
              </Field>
              <Field label="Versi iPhone" htmlFor="mobile-ios-version" error={errorFor("ios_version")}>
                <Input
                  id="mobile-ios-version"
                  autoComplete="off"
                  value={form.ios_version}
                  onChange={(event) => update("ios_version", event.target.value)}
                  placeholder="1.2.1"
                  maxLength={VERSION_MAX}
                  disabled={submitting}
                  invalid={!!errorFor("ios_version")}
                />
              </Field>

              <Field
                label="Catatan"
                htmlFor="mobile-notes"
                error={errorFor("notes")}
                hint="Ditampilkan di bawah tombol unduh, misalnya cara pasang APK atau versi Android minimum."
                className="sm:col-span-3"
              >
                <Textarea
                  id="mobile-notes"
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  rows={3}
                  maxLength={NOTES_MAX}
                  placeholder="Opsional"
                  disabled={submitting}
                  invalid={!!errorFor("notes")}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {updatedAt
                  ? updatedBy
                    ? `Terakhir diubah oleh ${updatedBy.name} · ${formatDateTime(updatedAt)}`
                    : `Terakhir diubah ${formatDateTime(updatedAt)}`
                  : "Belum pernah diatur."}
              </p>
              <div className="flex flex-wrap gap-2">
                {dirty ? (
                  <Button type="button" variant="ghost" onClick={reset} disabled={submitting}>
                    Batalkan perubahan
                  </Button>
                ) : null}
                <Button type="submit" loading={submitting}>
                  Simpan Tautan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      <section className="space-y-2" aria-label="Pratinjau kartu di Dashboard">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Pratinjau</h2>
          <p className="text-xs text-muted-foreground">
            Tampilan kartu di Dashboard untuk pengguna biasa, mengikuti isian di atas (termasuk yang belum disimpan).
          </p>
        </div>
        {previewHasLinks ? (
          <AppDownloadCardView data={preview} />
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Kartu tidak ditampilkan ke pengguna biasa sampai minimal satu tautan diisi. Admin tetap melihat pengingat
            untuk mengatur tautan di Dashboard.
          </div>
        )}
      </section>
    </div>
  );
}

/** Admin page: Android/iPhone download links shown on the dashboard. */
export function MobileAppSettings() {
  const me = useCurrentUser();
  const admin = isAdmin(me);

  const query = useQuery({
    queryKey: queryKeys.appDownloads,
    queryFn: ({ signal }) => getAppDownloads(signal),
    staleTime: 5 * 60 * 1000,
    enabled: admin,
  });

  if (!admin) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
        title="Hanya admin yang dapat mengatur tautan unduhan"
        description="Minta admin PrevenTech bila tautan aplikasi mobile perlu diperbarui."
      />
    );
  }

  if (query.isPending) return <FormSkeleton />;
  if (query.isError) {
    return (
      <ErrorState
        title="Gagal memuat tautan unduhan"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }

  return <MobileAppForm current={query.data} />;
}
