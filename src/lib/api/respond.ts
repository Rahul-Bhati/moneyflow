import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { ServiceResult } from "@/lib/services/result";
import { enforceRateLimit } from "./rate-limit";
import { logApiError } from "./logging";

/**
 * Adapt a service Result into an HTTP response. Keeps every route handler a
 * one-liner over the service call, and ensures error shapes are uniform.
 *
 * Success bodies are wrapped at the service layer — we just spread/forward
 * them. Failure responses are always `{ error: string }`.
 */
export function respond<T>(
  result: ServiceResult<T>,
  successStatus = 200
): NextResponse {
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: successStatus });
}

/**
 * Wrap a route body so any thrown error becomes a clean 500 JSON response
 * rather than the framework's HTML error page (which a mobile client can't
 * parse). In production, stack traces are stripped — clients only see a
 * generic message, while the full error stays in the server logs.
 *
 * Use it like: `export const GET = withErrors(async (req) => ...)`.
 */
export function withErrors<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      logApiError(err);
      // Never leak stack traces or internals to the client in prod.
      const message =
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err instanceof Error
          ? err.message
          : "Internal error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

/**
 * Production-ready route wrapper. Composition is:
 *   1) Rate limit per user/IP — returns 429 early.
 *   2) Run the handler, with error envelope.
 *
 * Every API route should use this instead of `withErrors` directly.
 */
export function withApi<Args extends [NextRequest, ...unknown[]]>(
  fn: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return withErrors(async (...args: Args) => {
    const [req] = args;
    const limited = await enforceRateLimit(req);
    if (limited) return limited;
    return fn(...args);
  });
}
