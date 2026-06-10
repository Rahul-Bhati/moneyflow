"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import SegmentedFilter from "@/components/SegmentedFilter";
import ChartSkeleton from "./ChartSkeleton";
import { filterByPeriod, totals, money, periodLabel } from "@/lib/format";
import type { Period, Transaction } from "@/lib/types";

// Heavy chart panels are code-split. The home page never ships Recharts.
const CategoryPie = dynamic(() => import("./CategoryPie"), {
  ssr: false,
  loading: () => <ChartSkeleton height={300} />,
});
const TrendArea = dynamic(() => import("./TrendArea"), {
  ssr: false,
  loading: () => <ChartSkeleton height={264} />,
});
const HeatmapCalendar = dynamic(() => import("./HeatmapCalendar"), {
  ssr: false,
  loading: () => <ChartSkeleton height={170} />,
});
const TopExpenses = dynamic(() => import("./TopExpenses"), {
  loading: () => <ChartSkeleton height={260} />,
});

export default function AnalyticsView({
  initialTransactions,
}: {
  initialTransactions: Transaction[];
}) {
  const [period, setPeriod] = useState<Period>("month");
  // Hydration gate — periodLabel() depends on the user's local clock.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const filtered = useMemo(
    () => filterByPeriod(initialTransactions, period),
    [initialTransactions, period]
  );
  const t = useMemo(() => totals(filtered), [filtered]);
  const label = useMemo(() => periodLabel(period), [period]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-24 md:max-w-5xl md:px-8 lg:max-w-6xl">
      <header className="glass sticky top-0 z-30 -mx-4 mb-1 flex items-center justify-between border-b border-border px-4 py-3.5 md:-mx-8 md:px-8">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-display text-lg font-extrabold tracking-tight">Analytics</h1>
            <p className="text-xs font-medium text-muted" suppressHydrationWarning>
              {mounted ? label : " "}
            </p>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-4 pt-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <SegmentedFilter value={period} onChange={setPeriod} />
        </motion.div>

        {mounted ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Income" value={money(t.income)} tone="income" />
              <Stat label="Expense" value={money(t.expense)} tone="expense" />
              <Stat
                label="Net"
                value={money(t.net)}
                tone={t.net >= 0 ? "income" : "expense"}
              />
            </div>

            {/* Charts go single-column on mobile, two-up on md+, three-up on lg+.
                TopExpenses is intentionally last so it visually anchors the bottom-right
                on wide layouts. */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <CategoryPie transactions={filtered} />
              <TrendArea transactions={initialTransactions} />
              <HeatmapCalendar transactions={initialTransactions} />
              <div className="md:col-span-2 lg:col-span-3">
                <TopExpenses transactions={filtered} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <ChartSkeleton height={88} />
            <ChartSkeleton height={300} />
            <ChartSkeleton height={264} />
            <ChartSkeleton height={170} />
            <ChartSkeleton height={260} />
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "income" | "expense";
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p
        className="tnum mt-1 truncate text-base font-extrabold"
        style={{ color: tone === "income" ? "var(--income)" : "var(--expense)" }}
      >
        {value}
      </p>
    </div>
  );
}
