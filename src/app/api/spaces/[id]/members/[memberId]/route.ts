import { type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { removeMember } from "@/lib/services/spaces";
import { respond, withApi } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

export const DELETE = withApi(async (_req: NextRequest, ctx: RouteContext) => {
  const { id, memberId } = await ctx.params;
  // memberId is the member's Clerk user_id (URL-encoded).
  const result = await removeMember(id, decodeURIComponent(memberId));
  if (result.ok) {
    revalidatePath(`/groups/${id}`);
    revalidatePath("/groups");
  }
  return respond(result);
});
