import type { ApiEnvelope, Paginated } from "@/types/api";
import type { AccessListParams, AccessUser } from "@/types/access";
import { api, unwrap } from "./api";

export interface AccessPage extends Paginated<AccessUser> {
  meta: Paginated<AccessUser>["meta"] & { admin_count: number };
}

export function listAccessUsers(params: AccessListParams, signal?: AbortSignal): Promise<AccessPage> {
  return api.get<AccessPage>("/users", { ...params, per_page: params.per_page ?? 20 }, { signal });
}

export function setAdmin(userId: number, isAdmin: boolean): Promise<AccessUser> {
  return unwrap(api.put<ApiEnvelope<AccessUser>>(`/users/${userId}/access`, { is_admin: isAdmin }));
}
