"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthTrend, money } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export default function TrendArea({ transactions }: { transactions: Transaction[] }) {
  const data = useMemo(() => monthTrend(transactions, 6), [transactions]);
  const hasAny = data.some((d) => d.income > 0 || d.expense > 0);

  return (
    <div className="rounded-[var(--radius-2xl)] border border-border bg-surface p-4">
      <h3 className="mb-3 px-1 font-display text-sm font-bold uppercase tracking-wide text-muted">
        6-month trend
      </h3>
      <div style={{ height: 220 }}>
        {!hasAny ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Not enough history yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="g-income" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--income)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--income)" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="g-expense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--expense)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--expense)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--ink)",
                  fontSize: 13,
                }}
                labelStyle={{ color: "var(--muted)", fontWeight: 600 }}
                formatter={(value) => money(Number(value))}
              />
              <Area
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="var(--income)"
                strokeWidth={2}
                fill="url(#g-income)"
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Expense"
                stroke="var(--expense)"
                strokeWidth={2}
                fill="url(#g-expense)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
