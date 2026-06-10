"use client";

import { useMemo } from "react";
import { topExpenses, money, dayHeading } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export default function TopExpenses({ transactions }: { transactions: Transaction[] }) {
  const top = useMemo(() => topExpenses(transactions, 5), [transactions]);

  return (
    <div className="rounded-[var(--radius-2xl)] border border-border bg-surface p-4">
      <h3 className="mb-3 px-1 font-display text-sm font-bold uppercase tracking-wide text-muted">
        Top 5 expenses
      </h3>
      {top.length === 0 ? (
        <p className="px-1 py-3 text-sm text-muted">No expenses in this period.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {top.map((t, i) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-xs font-bold text-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {t.description || t.category}
                </p>
                <p className="text-xs text-muted">
                  {t.category} · {dayHeading(t.occurred_on)}
                </p>
              </div>
              <span className="tnum text-sm font-bold text-expense">
                {money(t.amount)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
