import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  deleteTransactionById,
  updateTransaction,
} from "@/lib/services/transactions";
import { firstError, transactionUpdateSchema } from "@/lib/validation";
import { respond, withApi } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function invalidate() {
  revalidatePath("/");
  revalidatePath("/analytics");
}

export const PATCH = withApi(
  async (req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Body must be valid JSON" },
        { status: 400 }
      );
    }
    const parsed = transactionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstError(parsed.error) },
        { status: 400 }
      );
    }
    const result = await updateTransaction(id, parsed.data);
    if (result.ok) invalidate();
    return respond(result);
  }
);

export const DELETE = withApi(
  async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    const result = await deleteTransactionById(id);
    if (result.ok) invalidate();
    return respond(result);
  }
);
