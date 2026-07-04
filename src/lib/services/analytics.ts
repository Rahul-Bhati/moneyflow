import "server-only";
import { getSupabaseForUser } from "@/lib/supabaseServer";
import {
  byCategory,
  dailyTotals,
  monthTrend,
  topExpenses,
  filterByPeriod,
  totals,
  type CategoryTotal,
  type DailyTotal,
  type MonthTotal,
  type Totals,
} from "@/lib/format";
import type { Period, Transaction } from "@/lib/types";
import { fail, ok, type ServiceResult } from "./result";

const COLUMNS =
  "id, amount, type, description, category, occurred_on, created_at";

export interface AnalyticsPayload {
  period: Period;
  totals: Totals;
  byCategory: CategoryTotal[];
  dailyTotals: DailyTotal[];
  monthTrend: MonthTotal[];
  topExpenses: Transaction[];
}

/**
 * One-shot aggregate for the analytics screen and the eventual mobile app.
 * We pull the user's transactions once and run all five aggregations in
 * memory rather than firing five SQL queries — for personal finance volume
 * (low thousands of rows) this is faster, simpler, and avoids drift between
 * what the dashboard and analytics show.
 */
export async function getAnalytics(
  period: Period = "month"
): Promise<ServiceResult<AnalyticsPayload>> {
  let ctx;
  try {
    ctx = await getSupabaseForUser();
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Auth error");
  }
  if (!ctx) return fail(401, "Not signed in.");

  // 2-year lookback covers all analytics views (month, year, 6-month trend).
  // The (user_id, occurred_on DESC) index makes this filter free.
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const cutoff = twoYearsAgo.toISOString().slice(0, 10);

  const { data, error } = await ctx.supabase
    .from("transactions")
    .select(COLUMNS)
    .gte("occurred_on", cutoff)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) return fail(500, error.message);

  const all: Transaction[] = (data ?? []).map((r) => ({
    id: String(r.id),
    amount: Number(r.amount),
    type: r.type as Transaction["type"],
    description: (r.description as string | null) ?? "",
    category: (r.category as string | null) ?? "Uncategorized",
    occurred_on: String(r.occurred_on),
    created_at: String(r.created_at),
  }));

  const inPeriod = filterByPeriod(all, period);
  return ok({
    period,
    totals: totals(inPeriod),
    byCategory: byCategory(inPeriod),
    // dailyTotals + monthTrend are window-based (not period-filtered) so the
    // heatmap and 6-month trend remain stable as the user toggles period.
    dailyTotals: dailyTotals(all, 84),
    monthTrend: monthTrend(all, 6),
    topExpenses: topExpenses(inPeriod, 5),
  });
}
