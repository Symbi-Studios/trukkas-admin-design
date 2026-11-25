// What every backend call gives back to the pages. No exceptions to catch: check `ok`.
export interface ApiError {
  /** HTTP status. 0 means the backend could not be reached. */
  status: number;
  /** The backend's error code, for example "DOCUMENTS_LOCKED". */
  code?: string;
  /** Safe to show to the admin as it is. */
  message: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };