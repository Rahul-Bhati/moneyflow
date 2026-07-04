import { getSupabaseForUser, isConfigured } from "@/lib/supabaseServer";
import { logApiError } from "@/lib/api/logging";
import type { Transaction } from "@/lib/types";
import Dashboard from "@/components/Dashboard";
import SetupNotice from "@/components/SetupNotice";

// Always render fresh — this is a personal, frequently-updated dashboard.
export const dynamic = "force-dynamic";

async function getTransactions(): Promise<Transaction[]> {
  try {
    const ctx = await getSupabaseForUser();
    if (!ctx) return [];

    const { data, error } = await ctx.supabase
      .from("transactions")
      .select("id, amount, type, description, category, occurred_on, created_at")
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) {
      logApiError(new Error(`getTransactions: ${error.message}`));
      return [];
    }
    return (data ?? []).map((d) => ({
      ...d,
      amount: Number(d.amount),
      description: d.description ?? "",
      category: d.category ?? "Uncategorized",
    })) as Transaction[];
  } catch (e) {
    logApiError(e);
    return [];
  }
}

export default async function Home() {
  if (!isConfigured()) return <SetupNotice />;
  const transactions = await getTransactions();
  return <Dashboard initialTransactions={transactions} />;
}
