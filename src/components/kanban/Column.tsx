"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence } from "framer-motion";
import { money } from "@/lib/format";
import type { Bill, BillStatus } from "@/lib/types";
import BillCard from "./BillCard";

const TONE_BG: Record<"neutral" | "warn" | "good" | "bad", string> = {
  neutral: "var(--surface)",
  warn: "color-mix(in oklab, var(--expense) 6%, var(--surface))",
  good: "color-mix(in oklab, var(--income) 6%, var(--surface))",
  bad: "color-mix(in oklab, var(--expense) 14%, var(--surface))",
};

const TONE_DOT: Record<"neutral" | "warn" | "good" | "bad", string> = {
  neutral: "var(--muted)",
  warn: "var(--expense)",
  good: "var(--income)",
  bad: "var(--expense)",
};

interface ColumnProps {
  id: BillStatus;
  label: string;
  hint: string;
  tone: "neutral" | "warn" | "good" | "bad";
  bills: Bill[];
  effectiveStatusOf: (b: Bill) => BillStatus;
  daysUntilOf: (b: Bill) => number;
  onDeleteBill: (id: string) => void;
}

export default function Column({
  id,
  label,
  hint,
  tone,
  bills,
  effectiveStatusOf,
  daysUntilOf,
  onDeleteBill,
}: ColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const total = bills.reduce((s, b) => s + b.amount, 0);

  return (
    <div
      ref={setNodeRef}
      className="flex w-72 shrink-0 flex-col rounded-[var(--radius-2xl)] border border-border p-3 transition"
      style={{
        background: TONE_BG[tone],
        outline: isOver ? "2px solid var(--ring)" : "none",
        outlineOffset: -2,
      }}
    >
      <div className="mb-3 flex items-baseline justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-2 rounded-full"
            style={{ background: TONE_DOT[tone] }}
          />
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
            {label}
          </h2>
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            {bills.length}
          </span>
        </div>
        <span className="tnum text-xs font-semibold text-muted">{money(total)}</span>
      </div>
      <p className="mb-2 px-1 text-[11px] text-muted">{hint}</p>

      <div className="flex min-h-[200px] flex-1 flex-col gap-2">
        <AnimatePresence initial={false}>
          {bills.map((b) => (
            <BillCard
              key={b.id}
              bill={b}
              effectiveStatus={effectiveStatusOf(b)}
              daysFromToday={daysUntilOf(b)}
              onDelete={onDeleteBill}
            />
          ))}
        </AnimatePresence>
        {bills.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border-strong/30 text-xs text-muted">
            {id === "paid" ? "Drag here when paid" : "Empty"}
          </div>
        )}
      </div>
    </div>
  );
}
