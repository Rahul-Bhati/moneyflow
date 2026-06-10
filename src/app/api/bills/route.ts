import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createBill, listBills } from "@/lib/services/bills";
import { respond, withErrors } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrors(async () => {
  // Returns both the flat list (handy for clients that want to do their own
  // grouping) and the pre-grouped buckets (matches the PRD contract).
  const result = await listBills();
  return respond(result);
});

export const POST = withErrors(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }
  const result = await createBill(body as Parameters<typeof createBill>[0]);
  if (result.ok) {
    revalidatePath("/bills");
    revalidatePath("/");
  }
  return respond(result, 201);
});
