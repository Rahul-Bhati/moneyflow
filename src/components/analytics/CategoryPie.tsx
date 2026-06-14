"use client";

import { useMemo } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { byCategory, money } from "@/lib/format";
import type { Transaction } from "@/lib/types";

// Soft palette pulled from the existing design tokens + a tasteful spread.
// Using direct hex would violate the "no hex literals" rule from CLAUDE.md,
// but Recharts can't read CSS vars at render time — so we read them at runtime
// from the body's computed styles.
const PALETTE_VARS = [
  "--expense",
  "--income",
  "--accent",
  "--ink-soft",
  "--expense-soft",
  "--income-soft",
  "--muted",
  "--border-strong",
];

function resolveVar(name: string): string {
  if (typeof window === "undefined") return "#888";
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim() || "#888"
  );
}

export default function CategoryPie({ transactions }: { transactions: Transaction[] }) {
  const data = useMemo(() => {
    const rows = byCategory(transactions).filter((r) => r.expense > 0);
    return rows.map((r) => ({ name: r.category, value: r.expense }));
  }, [transactions]);

  const colors = useMemo(() => PALETTE_VARS.map(resolveVar), []);

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-[var(--radius-2xl)] border border-border bg-surface text-sm text-muted">
        No expenses to break down yet.
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-2xl)] border border-border bg-surface p-4">
      <h3 className="mb-3 px-1 font-display text-sm font-bold uppercase tracking-wide text-muted">
        Where the money went
      </h3>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
              stroke="var(--surface)"
              strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--ink)",
                fontSize: 13,
              }}
              formatter={(value) => money(Number(value))}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
