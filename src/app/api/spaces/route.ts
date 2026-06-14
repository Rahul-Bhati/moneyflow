import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createSpace, listSpaces } from "@/lib/services/spaces";
import { firstError, spaceInputSchema } from "@/lib/validation";
import { respond, withApi } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (_req: NextRequest) => {
  return respond(await listSpaces());
});

export const POST = withApi(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }
  const parsed = spaceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }
  const result = await createSpace(parsed.data);
  if (result.ok) revalidatePath("/groups");
  return respond(result, 201);
});
