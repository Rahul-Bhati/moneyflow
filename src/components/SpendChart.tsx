"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { type Bucket } from "@/lib/format";
import { money } from "@/lib/format";
import { type Period } from "@/lib/types";

export default function SpendChart({
  buckets,
  period,
}: {
  buckets: Bucket[];
  period: Period;
}) {
  const [active, setActive] = useState<number | null>(null);

  const max = useMemo(
    () => Math.max(1, ...buckets.map((b) => Math.max(b.expense, b.income))),
    [buckets]
  );

  const hasData = buckets.some((b) => b.expense > 0 || b.income > 0);

  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-4 shadow-[var(--shadow)]">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink-soft">Activity</span>
        <div className="flex items-center gap-3 text-[0.7rem] font-medium text-muted">
          <Legend color="var(--income)" label="In" />
          <Legend color="var(--expense)" label="Out" />
        </div>
      </div>

      {!hasData ? (
        <div className="flex h-28 items-center justify-center text-sm text-muted">
          Nothing to chart yet.
        </div>
      ) : (
        <div
          className="flex h-32 items-end gap-[3px]"
          onMouseLeave={() => setActive(null)}
        >
          {buckets.map((b, i) => {
            const eH = (b.expense / max) * 100;
            const iH = (b.income / max) * 100;
            const isActive = active === i;
            const single = buckets.length === 1;
            return (
              <button
                key={i}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => setActive(isActive ? null : i)}
                className="group relative flex h-full flex-1 flex-col justify-end"
              >
                {isActive && (b.expense > 0 || b.income > 0) && (
                  <div className="pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-accent px-2.5 py-1.5 text-[0.7rem] font-medium text-accent-ink shadow-[var(--shadow-lg)]">
                    <div className="tnum text-income">+{money(b.income)}</div>
                    <div className="tnum text-expense">-{money(b.expense)}</div>
                  </div>
                )}
                <div
                  className={`flex h-full items-end justify-center gap-[2px] ${
                    single ? "px-10" : ""
                  }`}
                >
                  <Bar height={iH} color="var(--income)" delay={i * 0.012} active={isActive} />
                  <Bar height={eH} color="var(--expense)" delay={i * 0.012 + 0.04} active={isActive} />
                </div>
                <span className="mt-1.5 block h-3 text-center text-[0.6rem] font-medium text-muted">
                  {b.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Bar({
  height,
  color,
  delay,
  active,
}: {
  height: number;
  color: string;
  delay: number;
  active: boolean;
}) {
  return (
    <motion.span
      className="w-full max-w-[10px] rounded-full"
      style={{ background: color, opacity: active ? 1 : 0.85, minHeight: height > 0 ? 4 : 0 }}
      initial={{ height: 0 }}
      animate={{ height: `${height}%` }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
