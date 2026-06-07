"use client";

import { useState } from "react";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Trash2, Inbox } from "lucide-react";
import { type Transaction } from "@/lib/types";
import { money, groupByDay, dayHeading } from "@/lib/format";

export default function TransactionList({
  transactions,
  onDelete,
}: {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}) {
  const groups = groupByDay(transactions);

  if (transactions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-border-strong bg-surface/50 px-6 py-12 text-center"
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">
          <Inbox size={22} strokeWidth={2} />
        </span>
        <p className="text-sm font-medium text-ink-soft">No entries in this period</p>
        <p className="max-w-[15rem] text-sm text-muted">
          Tap the <span className="font-semibold text-ink">+</span> button to record what you spent
          or earned.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AnimatePresence initial={false}>
        {groups.map((group) => (
          <motion.section
            key={group.day}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[0.78rem] font-semibold uppercase tracking-wide text-muted">
                {dayHeading(group.day)}
              </h3>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-[var(--shadow)]">
              <AnimatePresence initial={false}>
                {group.items.map((t, idx) => (
                  <Row
                    key={t.id}
                    tx={t}
                    first={idx === 0}
                    onDelete={() => onDelete(t.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.section>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Row({
  tx,
  first,
  onDelete,
}: {
  tx: Transaction;
  first: boolean;
  onDelete: () => void;
}) {
  const x = useMotionValue(0);
  const [open, setOpen] = useState(false);
  const income = tx.type === "income";

  const settle = (toOpen: boolean) => {
    setOpen(toOpen);
    animate(x, toOpen ? -84 : 0, { type: "spring", stiffness: 500, damping: 40 });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}
      className={`relative ${first ? "" : "border-t border-border"}`}
    >
      {/* delete action revealed underneath */}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete entry"
        className="absolute inset-y-0 right-0 flex w-[84px] items-center justify-center bg-expense text-white"
      >
        <Trash2 size={18} strokeWidth={2.2} />
      </button>

      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -84, right: 0 }}
        dragElastic={0.06}
        onDragEnd={(_, info) => settle(info.offset.x < -40 || info.velocity.x < -300)}
        onClick={() => open && settle(false)}
        className="relative flex cursor-grab items-center gap-3 bg-surface px-4 py-3 active:cursor-grabbing"
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{
            background: income ? "var(--income-soft)" : "var(--expense-soft)",
            color: income ? "var(--income)" : "var(--expense)",
          }}
        >
          {income ? (
            <ArrowDownLeft size={17} strokeWidth={2.4} />
          ) : (
            <ArrowUpRight size={17} strokeWidth={2.4} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.95rem] font-medium text-ink">
            {tx.description || (income ? "Income" : "Expense")}
          </p>
          <p className="text-xs text-muted">{income ? "Earned" : "Spent"}</p>
        </div>
        <span
          className="tnum shrink-0 text-[0.98rem] font-semibold"
          style={{ color: income ? "var(--income)" : "var(--expense)" }}
        >
          {income ? "+" : "−"}
          {money(tx.amount, true)}
        </span>
      </motion.div>
    </motion.div>
  );
}
