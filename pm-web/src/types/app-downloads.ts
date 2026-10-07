import type { UserBrief } from "./auth";

/** `GET/PUT /app-downloads`: tautan unduhan aplikasi mobile yang tampil di Dashboard. */
export interface AppDownloads {
  android_url: string | null;
  ios_url: string | null;
  android_version: string | null;
  ios_version: string | null;
  notes: string | null;
  updated_at: string | null;
  updated_by: UserBrief | null;
}

export interface AppDownloadsResponse {
  data: AppDownloads;
  permissions: {
    /** Admin only. */
    can_update: boolean;
  };
}

/** Editable fields of `PUT /app-downloads`. Empty strings are stored as null by the server. */
export type AppDownloadsPayload = Pick<
  AppDownloads,
  "android_url" | "ios_url" | "android_version" | "ios_version" | "notes"
>;
