import type { MailSettingsPayload, MailSettingsResponse } from "@/types/mail-settings";
import { api } from "./api";

/** Admin only (403 otherwise). */
export function getMailSettings(signal?: AbortSignal): Promise<MailSettingsResponse> {
  return api.get<MailSettingsResponse>("/settings/mail", undefined, { signal });
}

/** Admin only. Returns the saved settings. */
export function updateMailSettings(payload: MailSettingsPayload): Promise<MailSettingsResponse> {
  return api.put<MailSettingsResponse>("/settings/mail", payload);
}

/** Sends a test e-mail right away with the saved settings; an SMTP failure is a 422 with `errors.smtp`. */
export function sendTestMail(to: string): Promise<{ message: string }> {
  return api.post<{ message: string }>("/settings/mail/test", { to });
}
