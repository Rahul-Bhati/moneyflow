import "server-only";

/**
 * Shared service result shape. The `status` field is the HTTP status the API
 * layer should use; server actions ignore it and surface `error` to the UI.
 *
 *   ok=true   → success, `data` is the payload.
 *   ok=false  → failure, `error` is a human-readable message and `status` is
 *               the suggested HTTP code (400 invalid, 401 unauth, 404 missing,
 *               500 unexpected, etc.).
 */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export const fail = (status: number, error: string): ServiceResult<never> => ({
  ok: false,
  status,
  error,
});

export const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
