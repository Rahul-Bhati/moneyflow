import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

/**
 * Per-user sliding-window rate limit for the API surface.
 *
 *   - Cap: 10 requests / 10 seconds / user (PRD M7 spec).
 *   - Identifier: Clerk userId when signed in, else the request IP. Always
 *     hashed before logging (see `hashId` in ./logging.ts).
 *   - Storage: Upstash Redis. The credentials are PUBLIC-API-only — they
 *     can't read or write your Supabase data.
 *
 * Graceful degradation: if the Upstash env vars aren't set (typical dev
 * setup), `enforceRateLimit` is a no-op so local development isn't blocked.
 * In prod / CI, set both env vars and the limiter kicks in automatically.
 */

const HAS_UPSTASH = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

const limiter = HAS_UPSTASH
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      // The "@moneyflow/api" namespace keeps these counters from colliding
      // with any other project sharing the same Redis instance.
      prefix: "@moneyflow/api",
      analytics: true,
    })
  : null;

if (!HAS_UPSTASH && process.env.NODE_ENV === "production") {
  // Prod without Upstash configured is almost certainly a misconfiguration.
  // Don't crash — but make sure the operator notices.
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL / TOKEN not set — API rate limiting is DISABLED."
  );
}

/**
 * Run the rate limiter for the current request. Returns `null` when the
 * request is allowed; returns a ready-to-return `NextResponse` (HTTP 429)
 * when the user has tripped the limit. Designed for use at the top of an
 * API handler:
 *
 *   const limited = await enforceRateLimit(req);
 *   if (limited) return limited;
 */
export async function enforceRateLimit(req: Request): Promise<NextResponse | null> {
  if (!limiter) return null;

  const id = await identify(req);
  const { success, limit, reset, remaining } = await limiter.limit(id);
  const headers = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(reset),
  };
  if (success) {
    // Returning null tells the handler to proceed; the headers below would
    // be nice to attach to the eventual response, but adding them per route
    // is too invasive for v1. Skip for now.
    return null;
  }
  return NextResponse.json(
    { error: "Too many requests. Slow down and try again in a moment." },
    {
      status: 429,
      headers: {
        ...headers,
        "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
      },
    }
  );
}

async function identify(req: Request): Promise<string> {
  try {
    const { userId } = await auth();
    if (userId) return `user:${userId}`;
  } catch {
    // If Clerk fails (unauthenticated path, expired token, etc.), fall back
    // to IP-based identification so abusers can't bypass the limit by
    // logging out.
  }
  return `ip:${ipFrom(req)}`;
}

function ipFrom(req: Request): string {
  // Vercel / most reverse proxies set this.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "anon";
}
