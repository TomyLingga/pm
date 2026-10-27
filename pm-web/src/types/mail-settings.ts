import type { UserBrief } from "./auth";

export type MailEncryption = "tls" | "ssl";

/** `GET/PUT /settings/mail` (admin only): SMTP settings of the e-mail notification channel. */
export interface MailSettings {
  enabled: boolean;
  host: string | null;
  port: number | null;
  encryption: MailEncryption | null;
  username: string | null;
  /** The password itself never leaves the server. */
  password_set: boolean;
  from_address: string | null;
  from_name: string | null;
  /** `env` = values from the server's .env until an admin saves this page. */
  source: "env" | "database";
  updated_at: string | null;
  updated_by: UserBrief | null;
}

export interface MailSettingsResponse {
  data: MailSettings;
}

/** Body of `PUT /settings/mail`. `password` null/absent keeps the stored one; empty `username` drops it. */
export interface MailSettingsPayload {
  enabled: boolean;
  host: string | null;
  port: number | null;
  encryption: MailEncryption | null;
  username: string | null;
  password?: string | null;
  from_address: string | null;
  from_name: string | null;
}
