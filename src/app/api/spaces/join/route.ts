import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { acceptInvite } from "@/lib/services/spaces";
import { firstError, joinSchema } from "@/lib/validation";
import { respond, withApi } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }
  const result = await acceptInvite(parsed.data.token);
  if (result.ok) revalidatePath("/groups");
  return respond(result, 201);
});
