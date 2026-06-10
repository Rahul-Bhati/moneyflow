"use client";

import { useMemo } from "react";
import { dailyTotals, money } from "@/lib/format";
import type { Transaction } from "@/lib/types";

const DAYS = 84; // 12 weeks
const CELL = 12;
const GAP = 3;

export default function HeatmapCalendar({ transactions }: { transactions: Transaction[] }) {
  const days = useMemo(() => dailyTotals(transactions, DAYS), [transactions]);
  const max = useMemo(
    () => Math.max(...days.map((d) => d.expense), 1),
    [days]
  );

  // Arrange oldest→newest, columns of 7 (Mon..Sun)
  const cols: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7));

  return (
    <div className="rounded-[var(--radius-2xl)] border border-border bg-surface p-4">
      <h3 className="mb-3 px-1 font-display text-sm font-bold uppercase tracking-wide text-muted">
        Last 12 weeks
      </h3>
      <div
        className="overflow-x-auto"
        role="img"
        aria-label="Daily spending intensity for the last 12 weeks"
      >
        <div className="inline-flex" style={{ gap: GAP }}>
          {cols.map((col, ci) => (
            <div key={ci} className="flex flex-col" style={{ gap: GAP }}>
              {col.map((d) => {
                const intensity = d.expense > 0 ? d.expense / max : 0;
                return (
                  <div
                    key={d.date}
                    title={`${d.date} · spent ${money(d.expense)} · earned ${money(d.income)}`}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 3,
                      background:
                        intensity === 0
                          ? "var(--surface-2)"
                          : `color-mix(in oklab, var(--expense) ${Math.round(
                              20 + intensity * 80
                            )}%, transparent)`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 px-1 text-[11px] font-medium text-muted">
        <span>Less</span>
        {[0.0, 0.25, 0.5, 0.75, 1].map((v) => (
          <span
            key={v}
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background:
                v === 0
                  ? "var(--surface-2)"
                  : `color-mix(in oklab, var(--expense) ${Math.round(20 + v * 80)}%, transparent)`,
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
