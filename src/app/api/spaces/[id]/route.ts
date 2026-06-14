import { type NextRequest } from "next/server";
import { getSpace } from "@/lib/services/spaces";
import { respond, withApi } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApi(async (_req: NextRequest, ctx: RouteContext) => {
  const { id } = await ctx.params;
  return respond(await getSpace(id));
});
