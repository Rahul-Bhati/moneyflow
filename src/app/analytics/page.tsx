import { getSupabaseForUser, isConfigured } from "@/lib/supabaseServer";
import type { Transaction } from "@/lib/types";
import AnalyticsView from "@/components/analytics/AnalyticsView";
import SetupNotice from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

async function getTransactions(): Promise<Transaction[]> {
  const ctx = await getSupabaseForUser();
  if (!ctx) return [];
  const { data, error } = await ctx.supabase
    .from("transactions")
    .select("id, amount, type, description, category, occurred_on, created_at")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("Supabase fetch error:", error.message);
    return [];
  }
  return (data ?? []).map((d) => ({
    ...d,
    amount: Number(d.amount),
    description: d.description ?? "",
    category: d.category ?? "Uncategorized",
  })) as Transaction[];
}

export default async function AnalyticsPage() {
  if (!isConfigured()) return <SetupNotice />;
  const transactions = await getTransactions();
  return <AnalyticsView initialTransactions={transactions} />;
}
