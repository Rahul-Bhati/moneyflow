"use client";

import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import AnimatedNumber from "./AnimatedNumber";
import { type Totals } from "@/lib/format";
import { type Period } from "@/lib/types";

const PERIOD_WORD: Record<Period, string> = {
  day: "today",
  week: "this week",
  month: "this month",
  year: "this year",
};

export default function SummaryCards({
  totals,
  period,
}: {
  totals: Totals;
  period: Period;
}) {
  const positive = totals.net >= 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Hero — net balance for the period */}
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

      {/* Earned / Spent */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Earned"
          value={totals.income}
          tone="income"
          icon={<ArrowDownLeft size={16} strokeWidth={2.4} />}
        />
        <StatCard
          label="Spent"
          value={totals.expense}
          tone="expense"
          icon={<ArrowUpRight size={16} strokeWidth={2.4} />}
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
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
  icon: React.ReactNode;
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
    </motion.div>
  );
}
