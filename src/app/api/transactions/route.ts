import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createTransaction,
  listTransactions,
} from "@/lib/services/transactions";
import { firstError, txListQuerySchema } from "@/lib/validation";
import { respond, withApi } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req: NextRequest) => {
  const q = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = txListQuerySchema.safeParse(q);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstError(parsed.error) },
      { status: 400 }
    );
  }
  return respond(await listTransactions(parsed.data));
});

export const POST = withApi(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }
  const result = await createTransaction(body as Parameters<typeof createTransaction>[0]);
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/analytics");
  }
  return respond(result, 201);
});
