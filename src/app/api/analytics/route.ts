import { NextResponse, type NextRequest } from "next/server";
import { getAnalytics } from "@/lib/services/analytics";
import { analyticsQuerySchema, firstError } from "@/lib/validation";
import { respond, withApi } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req: NextRequest) => {
  const q = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = analyticsQuerySchema.safeParse(q);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstError(parsed.error) },
      { status: 400 }
    );
  }
  return respond(await getAnalytics(parsed.data.period));
});
