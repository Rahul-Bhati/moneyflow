"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { BarChart3, LayoutGrid } from "lucide-react";
import { deleteTransaction } from "@/app/actions";
import { type Transaction, type Period } from "@/lib/types";
import { filterByPeriod, totals, chartBuckets, periodLabel } from "@/lib/format";
import SegmentedFilter from "./SegmentedFilter";
import SummaryCards from "./SummaryCards";
import SpendChart from "./SpendChart";
import TransactionList from "./TransactionList";
import AddTransactionSheet from "./AddTransactionSheet";
import ThemeToggle from "./ThemeToggle";

export default function Dashboard({
  initialTransactions,
}: {
  initialTransactions: Transaction[];
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [period, setPeriod] = useState<Period>("month");
  // All date-relative math depends on "now", which differs between the server
  // (UTC) and the user's device (e.g. IST). Defer it to the client to avoid
  // hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const filtered = useMemo(
    () => filterByPeriod(transactions, period),
    [transactions, period]
  );
  const periodTotals = useMemo(() => totals(filtered), [filtered]);
  const buckets = useMemo(() => chartBuckets(transactions, period), [transactions, period]);
  const label = useMemo(() => periodLabel(period), [period]);

  function handleAdded(t: Transaction) {
    setTransactions((prev) => [t, ...prev]);
  }

  async function handleDelete(id: string) {
    const snapshot = transactions;
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    const res = await deleteTransaction(id);
    if (!res.ok) setTransactions(snapshot); // rollback on failure
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-36">
      <header className="glass sticky top-0 z-30 -mx-4 mb-1 flex items-center justify-between border-b border-border px-4 py-3.5">
        <div>
          <h1 className="font-display text-lg font-extrabold tracking-tight">MoneyFlow</h1>
          <p className="text-xs font-medium text-muted" suppressHydrationWarning>
            {mounted ? label : "\u00A0"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/bills"
            aria-label="Open bills board"
            className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95"
          >
            <LayoutGrid className="size-4" />
          </Link>
          <Link
            href="/analytics"
            aria-label="Open analytics"
            className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95"
          >
            <BarChart3 className="size-4" />
          </Link>
          <ThemeToggle />
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-8",
              },
            }}
          />
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
            <SummaryCards totals={periodTotals} period={period} transactions={transactions} />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
            >
              <SpendChart buckets={buckets} period={period} />
            </motion.div>
            <div className="mt-1">
              <h2 className="mb-2 px-1 font-display text-base font-bold">History</h2>
              <TransactionList transactions={filtered} onDelete={handleDelete} />
            </div>
          </>
        ) : (
          <Skeleton />
        )}
      </main>

      <AddTransactionSheet onAdded={handleAdded} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-hidden>
      <div className="h-[140px] rounded-[var(--radius-2xl)] bg-surface" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-[92px] rounded-[var(--radius-xl)] bg-surface" />
        <div className="h-[92px] rounded-[var(--radius-xl)] bg-surface" />
      </div>
      <div className="h-[180px] rounded-[var(--radius-xl)] bg-surface" />
    </div>
  );
}
