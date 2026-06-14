import { getSupabaseForUser, isConfigured } from "@/lib/supabaseServer";
import type { Bill } from "@/lib/types";
import BillsBoard from "@/components/kanban/BillsBoard";
import SetupNotice from "@/components/SetupNotice";

// Bills update frequently and need a fresh status calc on load.
export const dynamic = "force-dynamic";

async function getBills(): Promise<Bill[]> {
  const ctx = await getSupabaseForUser();
  if (!ctx) return [];

  const { data, error } = await ctx.supabase
    .from("bills")
    .select("id, name, amount, due_on, status, recurrence, paid_on, created_at")
    .order("due_on", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Supabase bills fetch error:", error.message);
    return [];
  }
  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    amount: Number(b.amount),
    due_on: b.due_on,
    status: b.status,
    recurrence: b.recurrence,
    paid_on: b.paid_on ?? null,
    created_at: b.created_at,
  })) as Bill[];
}

export default async function BillsPage() {
  if (!isConfigured()) return <SetupNotice />;
  const bills = await getBills();
  return <BillsBoard initialBills={bills} />;
}
