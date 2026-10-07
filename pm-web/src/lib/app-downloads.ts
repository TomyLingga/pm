import type { AppDownloadsPayload, AppDownloadsResponse } from "@/types/app-downloads";
import { api } from "./api";

/** Every signed-in user; `permissions.can_update` tells whether the caller may edit. */
export function getAppDownloads(signal?: AbortSignal): Promise<AppDownloadsResponse> {
  return api.get<AppDownloadsResponse>("/app-downloads", undefined, { signal });
}

/** Admin only (403 otherwise). Returns the saved data together with `permissions`. */
export function updateAppDownloads(payload: AppDownloadsPayload): Promise<AppDownloadsResponse> {
  return api.put<AppDownloadsResponse>("/app-downloads", payload);
}
