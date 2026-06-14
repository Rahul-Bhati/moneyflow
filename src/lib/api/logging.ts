import "server-only";
import { createHash } from "node:crypto";

/**
 * Privacy-respecting logging helpers.
 *
 * Clerk user IDs are stable, lifetime-long identifiers — logging them raw
 * would leak PII into log aggregators. We hash them with a per-deployment
 * pepper before logging, so logs can still be correlated (same hash = same
 * user) without exposing the actual id.
 *
 * The pepper comes from `LOG_PEPPER` env. If unset we fall back to a
 * deterministic-per-process random value — fine in dev, but in prod set
 * `LOG_PEPPER` to a long secret so rotating it invalidates old hashes.
 */

const PEPPER =
  process.env.LOG_PEPPER ??
  (process.env.NODE_ENV === "production"
    ? "UNSET_PEPPER_REPLACE_ME"
    : "dev-only-pepper");

if (PEPPER === "UNSET_PEPPER_REPLACE_ME" && process.env.NODE_ENV === "production") {
  console.warn(
    "[logging] LOG_PEPPER not set in production — hashed user IDs are predictable. Set this env."
  );
}

/** Hash any identifier (Clerk userId, email, IP) into a short opaque tag. */
export function hashId(raw: string): string {
  return createHash("sha256")
    .update(`${PEPPER}|${raw}`)
    .digest("hex")
    .slice(0, 12);
}

/**
 * Log a server-side error. In prod we deliberately log a short message + a
 * stack only if it's an Error; nothing sensitive (env vars, raw user data)
 * should ever land in `err.message`, but if it does we'd rather see it in
 * server logs than ship it to the client.
 */
export function logApiError(err: unknown): void {
  const tag = "[api]";
  if (err instanceof Error) {
    console.error(`${tag} ${err.name}: ${err.message}`);
    if (process.env.NODE_ENV !== "production" && err.stack) {
      console.error(err.stack);
    }
  } else {
    console.error(`${tag} non-error thrown:`, err);
  }
}
