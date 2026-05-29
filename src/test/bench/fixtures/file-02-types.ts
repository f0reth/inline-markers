// NOTE: all IDs are opaque strings to allow future migration to UUIDs
export type ID = string;
export type Timestamp = number;

export interface Entity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface User extends Entity {
  name: string;
  email: string;
  role: UserRole;
}

export type UserRole = "admin" | "editor" | "viewer";

// NOTE: extend this union when adding new resource types
export type ResourceKind = "document" | "image" | "video" | "audio" | "archive";

export interface Resource extends Entity {
  kind: ResourceKind;
  name: string;
  size: number;
  mimeType: string;
  ownerId: ID;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type Result<T, E = ApiError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E = ApiError>(error: E): Result<never, E> {
  return { ok: false, error };
}

// NOTE: use this instead of throwing to keep error handling explicit
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

export interface SortOptions<T> {
  field: keyof T;
  direction: "asc" | "desc";
}

export interface FilterOptions<T> {
  field: keyof T;
  operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "contains";
  value: T[keyof T];
}

export interface QueryOptions<T> {
  filters?: FilterOptions<T>[];
  sort?: SortOptions<T>;
  pagination?: Pick<Pagination, "page" | "pageSize">;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;
