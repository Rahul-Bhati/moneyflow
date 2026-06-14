import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { recordSettlement } from "@/lib/services/spaces";
import { firstError, settlementInputSchema } from "@/lib/validation";
import { respond, withApi } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withApi(async (req: NextRequest, ctx: RouteContext) => {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }
  const parsed = settlementInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }
  const result = await recordSettlement(id, parsed.data);
  if (result.ok) {
    revalidatePath(`/groups/${id}`);
    revalidatePath("/groups");
  }
  return respond(result, 201);
});
