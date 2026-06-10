import "server-only";
import { NextResponse } from "next/server";
import type { ServiceResult } from "@/lib/services/result";

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
 * parse). Use it like: `export const GET = withErrors(async (req) => ...)`.
 */
export function withErrors<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      console.error("[api] unhandled:", err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
