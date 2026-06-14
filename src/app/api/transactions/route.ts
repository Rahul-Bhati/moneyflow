import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createTransaction,
  listTransactions,
} from "@/lib/services/transactions";
import {
  firstError,
  transactionInputSchema,
  txListQuerySchema,
} from "@/lib/validation";
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
  // Route-level parse: removes the `as` cast (which silently bypassed TS) and
  // means malformed payloads get a clean 400 here instead of relying on the
  // service to bounce. Service still re-parses for defense-in-depth — the
  // same schema is used in both places, so the cost is one extra microsecond.
  const parsed = transactionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstError(parsed.error) },
      { status: 400 }
    );
  }
  const result = await createTransaction(parsed.data);
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/analytics");
  }
  return respond(result, 201);
});
