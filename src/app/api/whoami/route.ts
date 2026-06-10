import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint. Returns whatever Clerk thinks about the current
 * request without touching the database. Useful for debugging Bearer-token
 * issues from the mobile app:
 *
 *   curl -H "Authorization: Bearer <token>" http://192.168.0.12:3000/api/whoami
 *
 * In production this should be removed or locked down (it's harmless — only
 * exposes the requester's own auth state — but it adds surface area).
 */
export async function GET(req: NextRequest) {
  // Diagnostic-only: refuse to enumerate auth state in production. Leaving
  // this open isn't a critical leak (it only echoes the caller's own state)
  // but every extra endpoint is extra surface — kill it where we don't need
  // it.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const authHeader = req.headers.get("authorization");
  const cookieHeader = req.headers.get("cookie");

  let clerkAuth: Record<string, unknown> = {};
  try {
    const a = await auth();
    clerkAuth = {
      userId: a.userId ?? null,
      sessionId: a.sessionId ?? null,
      orgId: a.orgId ?? null,
      // Don't include the actual token, but show whether getToken works.
      hasGetToken: typeof a.getToken === "function",
    };
  } catch (e) {
    clerkAuth = {
      error: e instanceof Error ? e.message : "auth() threw",
    };
  }

  return NextResponse.json(
    {
      receivedAuthorizationHeader: authHeader
        ? `${authHeader.slice(0, 20)}... (${authHeader.length} chars)`
        : null,
      receivedCookieHeader: cookieHeader ? "(present)" : null,
      clerk: clerkAuth,
      // Public Clerk instance the SERVER uses. Compare to your mobile's
      // EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY — both pk_ values must share the
      // same Clerk instance prefix.
      serverClerkInstance: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        ? `${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.slice(0, 24)}...`
        : null,
    },
    { status: 200 }
  );
}
