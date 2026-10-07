/** `GET /users` (admin) — hak akses. */
export interface AccessUser {
  id: number;
  nrk: string | null;
  name: string;
  position: string | null;
  photo_url: string | null;
  email: string | null;
  grade_code: string | null;
  org_unit: { id: number; code: string; name: string; type: string } | null;
  is_admin: boolean;
  /** The signed-in admin (cannot revoke their own role). */
  is_me: boolean;
}

export interface AccessListParams {
  q?: string;
  role?: "admin" | "user";
  page?: number;
  per_page?: number;
}
