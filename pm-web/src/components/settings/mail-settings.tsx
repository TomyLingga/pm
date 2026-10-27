"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Info, Send, ShieldCheck } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { ApiError, errorMessage } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getMailSettings, sendTestMail, updateMailSettings } from "@/lib/mail-settings";
import { queryKeys } from "@/lib/query-keys";
import { firstError, unmatchedValidationMessage } from "@/lib/validation";
import type { ValidationErrors } from "@/types/api";
import type { MailEncryption, MailSettings, MailSettingsPayload, MailSettingsResponse } from "@/types/mail-settings";

type TextKey = "host" | "port" | "username" | "password" | "from_address" | "from_name";
type FormState = Record<TextKey, string> & { enabled: boolean; encryption: MailEncryption | "" };
type FieldKey = keyof FormState;

const FIELD_KEYS: FieldKey[] = ["enabled", "host", "port", "encryption", "username", "password", "from_address", "from_name"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOST_PATTERN = /^[A-Za-z0-9.-]+$/;
/** Usual port per encryption, suggested when the admin switches encryption. */
const DEFAULT_PORTS: Record<MailEncryption | "", string> = { "": "25", tls: "587", ssl: "465" };

function formFrom(data: MailSettings): FormState {
  return {
    enabled: data.enabled,
    host: data.host ?? "",
    port: data.port != null ? String(data.port) : "",
    encryption: data.encryption ?? "",
    username: data.username ?? "",
    password: "",
    from_address: data.from_address ?? "",
    from_name: data.from_name ?? "",
  };
}

function toPayload(form: FormState): MailSettingsPayload {
  const value = (key: TextKey) => form[key].trim() || null;
  const username = value("username");
  return {
    enabled: form.enabled,
    host: value("host"),
    port: form.port.trim() ? Number(form.port) : null,
    encryption: form.encryption || null,
    username,
    // Only sent when typed; the server keeps the stored password otherwise.
    password: username && form.password ? form.password : null,
    from_address: value("from_address"),
    from_name: value("from_name"),
  };
}

function validate(form: FormState): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  const host = form.host.trim();
  const port = form.port.trim();
  const from = form.from_address.trim();
  if (form.enabled) {
    if (!host) errors.host = "Wajib diisi bila email notifikasi diaktifkan.";
    if (!port) errors.port = "Wajib diisi.";
    if (!from) errors.from_address = "Wajib diisi bila email notifikasi diaktifkan.";
  }
  if (host && !HOST_PATTERN.test(host)) errors.host = "Cukup nama server atau IP, tanpa http://, smtp://, atau port.";
  if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) errors.port = "Port 1–65535.";
  if (from && !EMAIL_PATTERN.test(from)) errors.from_address = "Alamat email tidak valid.";
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
        <Skeleton className="h-12 w-full sm:col-span-3" />
        <Skeleton className="h-16 w-full sm:col-span-2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full sm:col-span-2" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold tracking-tight sm:col-span-3">{children}</h3>;
}

function MailSettingsForm({ current, onDirtyChange }: { current: MailSettingsResponse; onDirtyChange: (dirty: boolean) => void }) {
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
  React.useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const update = <K extends FieldKey>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setClientErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };
  const changeEncryption = (encryption: MailEncryption | "") => {
    setForm((prev) => {
      const usualPort = Object.values(DEFAULT_PORTS).includes(prev.port.trim()) || !prev.port.trim();
      return { ...prev, encryption, port: usualPort ? DEFAULT_PORTS[encryption] : prev.port };
    });
    setDirty(true);
  };
  const errorFor = (key: FieldKey) => clientErrors[key] ?? firstError(serverErrors, key);

  const mutation = useMutation({
    mutationFn: (payload: MailSettingsPayload) => updateMailSettings(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.mailSettings, saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences });
      setForm(formFrom(saved.data));
      setDirty(false);
      setServerErrors({});
      setFormError(null);
      toast.success(saved.data.enabled ? "Pengaturan email disimpan, notifikasi email aktif." : "Pengaturan email disimpan.");
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
  const { source, password_set: passwordSet, updated_at: updatedAt, updated_by: updatedBy } = current.data;
  const hasUsername = !!form.username.trim();

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>Server email (SMTP)</CardTitle>
          <CardDescription>
            Notifikasi WO, Form Request, dan PM dikirim juga ke email pengguna lewat server ini. Setiap pengguna tetap bisa
            mematikannya di Pengaturan &gt; Notifikasi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4 sm:pt-5">
          {formError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger-foreground"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{formError}</span>
            </div>
          ) : null}
          {source === "env" ? (
            <div className="flex items-start gap-2 rounded-md border bg-surface-2/60 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Saat ini memakai nilai dari file <code className="font-mono text-xs">.env</code> server. Setelah disimpan di
                sini, pengaturan halaman ini yang dipakai.
              </span>
            </div>
          ) : null}

          <div className="flex items-center gap-3 rounded-md border p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium" id="mail-enabled-label">
                Kirim notifikasi lewat email
              </p>
              <p className="text-xs text-muted-foreground">
                {form.enabled ? "Aktif: email dikirim ke pengguna yang punya alamat email di Portal." : "Nonaktif: hanya notifikasi di aplikasi dan push ke HP."}
              </p>
              {errorFor("enabled") ? <p className="mt-1 text-xs font-medium text-destructive">{errorFor("enabled")}</p> : null}
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(next) => update("enabled", next)}
              disabled={submitting}
              aria-labelledby="mail-enabled-label"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <SectionTitle>Server</SectionTitle>
            <Field
              label="Host SMTP"
              htmlFor="mail-host"
              required={form.enabled}
              error={errorFor("host")}
              hint="Contoh: smtp.office365.com atau 192.168.1.10"
              className="sm:col-span-2"
            >
              <Input
                id="mail-host"
                autoComplete="off"
                spellCheck={false}
                value={form.host}
                onChange={(event) => update("host", event.target.value)}
                placeholder="smtp.inl.co.id"
                maxLength={255}
                disabled={submitting}
                invalid={!!errorFor("host")}
              />
            </Field>
            <Field label="Port" htmlFor="mail-port" required={form.enabled} error={errorFor("port")}>
              <Input
                id="mail-port"
                inputMode="numeric"
                autoComplete="off"
                value={form.port}
                onChange={(event) => update("port", event.target.value.replace(/\D/g, ""))}
                placeholder="587"
                maxLength={5}
                disabled={submitting}
                invalid={!!errorFor("port")}
              />
            </Field>
            <Field
              label="Enkripsi"
              htmlFor="mail-encryption"
              error={errorFor("encryption")}
              hint="TLS untuk port 587, SSL untuk port 465."
              className="sm:col-span-3"
            >
              <Select
                id="mail-encryption"
                value={form.encryption}
                onChange={(event) => changeEncryption(event.target.value as MailEncryption | "")}
                disabled={submitting}
                invalid={!!errorFor("encryption")}
              >
                <option value="">Tanpa enkripsi</option>
                <option value="tls">TLS (STARTTLS)</option>
                <option value="ssl">SSL</option>
              </Select>
            </Field>

            <SectionTitle>Login SMTP</SectionTitle>
            <Field
              label="Username"
              htmlFor="mail-username"
              error={errorFor("username")}
              hint="Kosongkan bila server tidak memerlukan login."
              className="sm:col-span-3 lg:col-span-1"
            >
              <Input
                id="mail-username"
                autoComplete="off"
                spellCheck={false}
                value={form.username}
                onChange={(event) => update("username", event.target.value)}
                placeholder="notifikasi@inl.co.id"
                maxLength={255}
                disabled={submitting}
                invalid={!!errorFor("username")}
              />
            </Field>
            <Field
              label="Password"
              htmlFor="mail-password"
              error={errorFor("password")}
              hint={
                !hasUsername
                  ? "Isi username dulu bila server memerlukan login."
                  : passwordSet
                    ? "Password tersimpan. Kosongkan bila tidak diubah."
                    : "Disimpan terenkripsi dan tidak pernah ditampilkan lagi."
              }
              className="sm:col-span-3 lg:col-span-2"
            >
              <Input
                id="mail-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
                placeholder={hasUsername && passwordSet ? "•••••••• (tersimpan)" : ""}
                maxLength={255}
                disabled={submitting || !hasUsername}
                invalid={!!errorFor("password")}
              />
            </Field>

            <SectionTitle>Pengirim</SectionTitle>
            <Field
              label="Alamat pengirim"
              htmlFor="mail-from-address"
              required={form.enabled}
              error={errorFor("from_address")}
              hint="Biasanya sama dengan username SMTP."
              className="sm:col-span-2"
            >
              <Input
                id="mail-from-address"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={form.from_address}
                onChange={(event) => update("from_address", event.target.value)}
                placeholder="notifikasi@inl.co.id"
                maxLength={255}
                disabled={submitting}
                invalid={!!errorFor("from_address")}
              />
            </Field>
            <Field label="Nama pengirim" htmlFor="mail-from-name" error={errorFor("from_name")}>
              <Input
                id="mail-from-name"
                autoComplete="off"
                value={form.from_name}
                onChange={(event) => update("from_name", event.target.value)}
                placeholder="PrevenTech"
                maxLength={100}
                disabled={submitting}
                invalid={!!errorFor("from_name")}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {updatedAt
                ? updatedBy
                  ? `Terakhir diubah oleh ${updatedBy.name} · ${formatDateTime(updatedAt)}`
                  : `Terakhir diubah ${formatDateTime(updatedAt)}`
                : "Belum pernah diatur di halaman ini."}
            </p>
            <div className="flex flex-wrap gap-2">
              {dirty ? (
                <Button type="button" variant="ghost" onClick={reset} disabled={submitting}>
                  Batalkan perubahan
                </Button>
              ) : null}
              <Button type="submit" loading={submitting}>
                Simpan Pengaturan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

/** Sends one e-mail right away with the saved settings, so the admin sees SMTP errors immediately. */
function TestMailCard({ defaultTo, blocked }: { defaultTo: string; blocked: boolean }) {
  const [to, setTo] = React.useState(defaultTo);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (address: string) => sendTestMail(address),
    onSuccess: (response) => {
      setError(null);
      setResult(response.message);
      toast.success(response.message);
    },
    onError: (err) => {
      setResult(null);
      setError(err instanceof ApiError && err.status === 422 ? firstError(err.errors, "to", "smtp") ?? err.message : errorMessage(err));
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const address = to.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setResult(null);
      setError("Alamat email tidak valid.");
      return;
    }
    mutation.mutate(address);
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Kirim email uji</CardTitle>
          <CardDescription>Memakai pengaturan yang sudah disimpan, meski notifikasi email belum diaktifkan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 sm:pt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Field
              label="Kirim ke"
              htmlFor="mail-test-to"
              error={error}
              hint={blocked ? "Simpan perubahan dulu agar email uji memakai pengaturan terbaru." : undefined}
              className="flex-1"
            >
              <Input
                id="mail-test-to"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setError(null);
                }}
                placeholder="nama@inl.co.id"
                maxLength={255}
                disabled={mutation.isPending}
                invalid={!!error}
              />
            </Field>
            <Button type="submit" variant="outline" loading={mutation.isPending} disabled={blocked} className="sm:mt-[1.625rem]">
              <Send aria-hidden />
              Kirim Email Uji
            </Button>
          </div>
          {result ? (
            <p role="status" className="text-sm text-success-foreground">
              {result} Periksa kotak masuk (dan folder spam).
            </p>
          ) : null}
        </CardContent>
      </Card>
    </form>
  );
}

/** Admin page: SMTP server and on/off switch of the e-mail notification channel. */
export function MailSettingsPanel() {
  const me = useCurrentUser();
  const admin = isAdmin(me);
  const [dirty, setDirty] = React.useState(false);

  const query = useQuery({
    queryKey: queryKeys.mailSettings,
    queryFn: ({ signal }) => getMailSettings(signal),
    enabled: admin,
  });

  if (!admin) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
        title="Hanya admin yang dapat mengatur email notifikasi"
        description="Minta admin PrevenTech bila pengiriman notifikasi lewat email perlu diubah."
      />
    );
  }

  if (query.isPending) return <FormSkeleton />;
  if (query.isError) {
    return (
      <ErrorState
        title="Gagal memuat pengaturan email"
        message={errorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <MailSettingsForm current={query.data} onDirtyChange={setDirty} />
      <TestMailCard defaultTo={me.email ?? ""} blocked={dirty} />
    </div>
  );
}
