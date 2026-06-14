import { type NextRequest } from "next/server";
import { createInvite } from "@/lib/services/spaces";
import { respond, withApi } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withApi(async (_req: NextRequest, ctx: RouteContext) => {
  const { id } = await ctx.params;
  return respond(await createInvite(id), 201);
});
