"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import { deleteBill, updateBillStatus } from "@/app/actions/bills";
import { BILL_COLUMNS, type Bill, type BillStatus } from "@/lib/types";
import { daysUntil, todayISO } from "@/lib/recurrence";
import { money } from "@/lib/format";
import ThemeToggle from "../ThemeToggle";
import Column from "./Column";
import BillCard from "./BillCard";
import AddBillSheet from "./AddBillSheet";

/**
 * Read-side status computation. A bill explicitly marked "paid" stays paid.
 * Everything else recategorizes from `due_on` vs today — which lets cards age
 * across midnight without writes. Manual drags between non-paid columns DO
 * persist (sticky), but the next render will recompute if the row hasn't been
 * touched since.
 *
 * Today, "due this week" = any non-paid bill with 0 ≤ daysUntil ≤ 7.
 */
function computeEffectiveStatus(bill: Bill, today: string): BillStatus {
  if (bill.status === "paid") return "paid";
  const d = daysUntil(bill.due_on, today);
  if (d < 0) return "overdue";
  if (d <= 7) return "due_week";
  return "upcoming";
}

export default function BillsBoard({ initialBills }: { initialBills: Bill[] }) {
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [today, setToday] = useState<string>(""); // empty until mount — see below
  const [activeId, setActiveId] = useState<string | null>(null);

  // Gate everything date-dependent behind mount, same pattern as Dashboard:
  // server (UTC) and the user's phone can disagree on the calendar date.
  useEffect(() => setToday(todayISO()), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const effectiveOf = useMemo(() => {
    return (b: Bill) => (today ? computeEffectiveStatus(b, today) : b.status);
  }, [today]);

  const daysOf = useMemo(() => {
    return (b: Bill) => (today ? daysUntil(b.due_on, today) : 0);
  }, [today]);

  const grouped = useMemo(() => {
    const g: Record<BillStatus, Bill[]> = {
      upcoming: [],
      due_week: [],
      paid: [],
      overdue: [],
    };
    for (const b of bills) g[effectiveOf(b)].push(b);
    // Within a column, sort by due date asc (paid: by paid_on desc).
    g.paid.sort((a, b) => (b.paid_on ?? "").localeCompare(a.paid_on ?? ""));
    (["upcoming", "due_week", "overdue"] as BillStatus[]).forEach((k) => {
      g[k].sort((a, b) => a.due_on.localeCompare(b.due_on));
    });
    return g;
  }, [bills, effectiveOf]);

  const totalDue = useMemo(
    () =>
      grouped.due_week.reduce((s, b) => s + b.amount, 0) +
      grouped.overdue.reduce((s, b) => s + b.amount, 0),
    [grouped]
  );

  const activeBill = useMemo(
    () => (activeId ? bills.find((b) => b.id === activeId) ?? null : null),
    [activeId, bills]
  );

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const billId = String(e.active.id);
    const target = e.over?.id as BillStatus | undefined;
    if (!target) return;

    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;
    if (effectiveOf(bill) === target) return; // dropped on its own column

    const snapshot = bills;

    // Optimistic: write the new explicit status. For "paid", also stamp
    // paid_on locally so the card immediately satisfies computeEffectiveStatus.
    setBills((prev) =>
      prev.map((b) =>
        b.id === billId
          ? {
              ...b,
              status: target,
              paid_on: target === "paid" ? today : null,
            }
          : b
      )
    );

    const res = await updateBillStatus(billId, target);
    if (!res.ok) {
      setBills(snapshot); // rollback
      return;
    }
    if (res.bill) {
      // Reconcile with server truth — and if a recurring bill was paid, the
      // server also inserted a clone, so trigger a refresh via the action's
      // revalidatePath. We don't add the clone here optimistically; the next
      // page render fetches it.
      setBills((prev) => prev.map((b) => (b.id === billId ? res.bill! : b)));
    }
  }

  async function handleDeleteBill(id: string) {
    const snapshot = bills;
    setBills((prev) => prev.filter((b) => b.id !== id));
    const res = await deleteBill(id);
    if (!res.ok) setBills(snapshot);
  }

  function handleAdded(b: Bill) {
    setBills((prev) => [b, ...prev]);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-36">
      <header className="glass sticky top-0 z-30 -mx-4 mb-1 flex items-center justify-between border-b border-border px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="Back to dashboard"
            className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-display text-lg font-extrabold tracking-tight">Bills</h1>
            <p className="text-xs font-medium text-muted" suppressHydrationWarning>
              {today
                ? totalDue > 0
                  ? `${money(totalDue)} due or overdue`
                  : "Nothing pressing"
                : " "}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      <main className="pt-3">
        {!today ? (
          <BoardSkeleton />
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 [scrollbar-width:thin]"
            >
              {BILL_COLUMNS.map((col) => (
                <Column
                  key={col.key}
                  id={col.key}
                  label={col.label}
                  hint={col.hint}
                  tone={col.tone}
                  bills={grouped[col.key]}
                  effectiveStatusOf={effectiveOf}
                  daysUntilOf={daysOf}
                  onDeleteBill={handleDeleteBill}
                />
              ))}
            </motion.div>

            <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16,1,0.3,1)" }}>
              {activeBill ? (
                <div className="w-72 opacity-95">
                  <BillCard
                    bill={activeBill}
                    effectiveStatus={effectiveOf(activeBill)}
                    daysFromToday={daysOf(activeBill)}
                    onDelete={() => {}}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {today && bills.length === 0 && (
          <p className="mt-4 text-center text-sm text-muted">
            No bills yet. Tap <span className="font-semibold text-ink">Add bill</span> to track
            your first one.
          </p>
        )}
      </main>

      <AddBillSheet onAdded={handleAdded} />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="-mx-4 flex animate-pulse gap-3 overflow-hidden px-4 pb-4" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[280px] w-72 shrink-0 rounded-[var(--radius-2xl)] bg-surface"
        />
      ))}
    </div>
  );
}
