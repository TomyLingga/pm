/** Standard `{ data: ... }` envelope used by every pm-api JSON response. */
export interface ApiEnvelope<T> {
  data: T;
}

/** Laravel validation errors (`422`): field -> messages. Keys may be dotted, e.g. `materials.0.quantity`. */
export type ValidationErrors = Record<string, string[]>;

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface PaginationLinks {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
}

/** Laravel resource-collection pagination. */
export interface Paginated<T> {
  data: T[];
  links?: PaginationLinks;
  meta?: PaginationMeta;
}
