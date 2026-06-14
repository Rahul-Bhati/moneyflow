"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import AnimatedNumber from "./AnimatedNumber";
import { dailyTotals, type Totals } from "@/lib/format";
import { type Period, type Transaction } from "@/lib/types";

// Sparkline pulls in Recharts — code-split so it doesn't bloat the dashboard.
const Sparkline = dynamic(() => import("./analytics/Sparkline"), {
  ssr: false,
  loading: () => <div className="h-8" />,
});

const PERIOD_WORD: Record<Period, string> = {
  day: "today",
  week: "this week",
  month: "this month",
  year: "this year",
};

export default function SummaryCards({
  totals,
  period,
  transactions,
}: {
  totals: Totals;
  period: Period;
  transactions: Transaction[];
}) {
  const positive = totals.net >= 0;

  // 14-day sparkline data, derived from the full transaction list (not the
  // period-filtered slice) so the trend stays continuous as the user toggles.
  const last14 = useMemo(() => dailyTotals(transactions, 14), [transactions]);
  const incomeSeries = useMemo(() => last14.map((d) => d.income), [last14]);
  const expenseSeries = useMemo(() => last14.map((d) => d.expense), [last14]);

  return (
    <div className="flex flex-col gap-3">
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[var(--radius-2xl)] bg-accent px-6 py-7 text-accent-ink shadow-[var(--shadow-lg)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full opacity-[0.14]"
          style={{ background: positive ? "var(--income)" : "var(--expense)", filter: "blur(8px)" }}
        />
        <div className="relative flex items-center gap-2 text-sm font-medium opacity-70">
          <Wallet size={15} strokeWidth={2.2} />
          <span>Net balance {PERIOD_WORD[period]}</span>
        </div>
        <div className="relative mt-2 flex items-baseline gap-2">
          <AnimatedNumber
            value={totals.net}
            className="tnum text-[2.7rem] font-bold leading-none sm:text-5xl"
          />
        </div>
        <p className="relative mt-3 text-sm opacity-60">
          {totals.count === 0
            ? "No activity yet — add your first entry below."
            : `${totals.count} ${totals.count === 1 ? "entry" : "entries"} · ${
                positive ? "you're in the green" : "spending over earning"
              }`}
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Earned"
          value={totals.income}
          tone="income"
          icon={<ArrowDownLeft size={16} strokeWidth={2.4} />}
          spark={<Sparkline values={incomeSeries} tone="income" />}
        />
        <StatCard
          label="Spent"
          value={totals.expense}
          tone="expense"
          icon={<ArrowUpRight size={16} strokeWidth={2.4} />}
          spark={<Sparkline values={expenseSeries} tone="expense" />}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
  spark,
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
  icon: React.ReactNode;
  spark: React.ReactNode;
}) {
  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="rounded-[var(--radius-xl)] border border-border bg-surface p-4 shadow-[var(--shadow)]"
    >
      <div className="flex items-center gap-2">
        <span
          className="grid h-7 w-7 place-items-center rounded-full"
          style={{
            background: tone === "income" ? "var(--income-soft)" : "var(--expense-soft)",
            color: tone === "income" ? "var(--income)" : "var(--expense)",
          }}
        >
          {icon}
        </span>
        <span className="text-sm font-medium text-muted">{label}</span>
      </div>
      <AnimatedNumber
        value={value}
        className="tnum mt-3 block text-2xl font-bold"
      />
      <div className="mt-1 h-8">{spark}</div>
    </motion.div>
  );
}
