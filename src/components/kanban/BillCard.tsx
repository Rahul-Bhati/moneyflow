"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { CalendarClock, Repeat, Trash2 } from "lucide-react";
import { money } from "@/lib/format";
import type { Bill, BillStatus } from "@/lib/types";

const TONE_BORDER: Record<BillStatus, string> = {
  upcoming: "var(--border)",
  due_week: "var(--expense-soft)",
  paid: "var(--income-soft)",
  overdue: "var(--expense)",
};

function fmtDue(iso: string): string {
  // "2026-06-15" → "Jun 15". Avoids Intl date timezone gotchas by parsing
  // the string directly rather than handing it to new Date().
  const [, m, d] = iso.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1] ?? ""} ${d}`;
}

const RECURRENCE_LABEL: Record<Bill["recurrence"], string> = {
  none: "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export default function BillCard({
  bill,
  effectiveStatus,
  onDelete,
  daysFromToday,
}: {
  bill: Bill;
  effectiveStatus: BillStatus;
  onDelete: (id: string) => void;
  daysFromToday: number;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: bill.id,
    data: { bill },
  });

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="group relative touch-none select-none rounded-[var(--radius-xl)] border bg-surface p-3 shadow-[var(--shadow)]"
      style={{
        borderColor: TONE_BORDER[effectiveStatus],
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{bill.name}</div>
          <div className="tnum mt-0.5 text-lg font-bold text-ink">
            {money(bill.amount)}
          </div>
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(bill.id);
          }}
          aria-label="Delete bill"
          className="grid size-7 place-items-center rounded-full text-muted opacity-0 transition hover:bg-surface-2 hover:text-expense group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3" />
          {fmtDue(bill.due_on)}
          {effectiveStatus !== "paid" && (
            <span className="ml-1 text-[10px]">
              {daysFromToday === 0
                ? "today"
                : daysFromToday > 0
                ? `in ${daysFromToday}d`
                : `${Math.abs(daysFromToday)}d late`}
            </span>
          )}
        </span>
        {bill.recurrence !== "none" && (
          <span className="inline-flex items-center gap-1">
            <Repeat className="size-3" />
            {RECURRENCE_LABEL[bill.recurrence]}
          </span>
        )}
      </div>
    </motion.div>
  );
}
