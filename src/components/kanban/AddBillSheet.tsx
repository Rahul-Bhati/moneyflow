"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Check } from "lucide-react";
import { format } from "date-fns";
import { addBill } from "@/app/actions/bills";
import { currencySymbol } from "@/lib/format";
import { RECURRENCES, type Bill, type Recurrence } from "@/lib/types";

export default function AddBillSheet({
  onAdded,
}: {
  onAdded: (b: Bill) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [recurrence, setRecurrence] = useState<Recurrence>("monthly");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const id = setTimeout(() => nameRef.current?.focus(), 280);
      return () => {
        clearTimeout(id);
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  function reset() {
    setName("");
    setAmount("");
    setDueOn(format(new Date(), "yyyy-MM-dd"));
    setRecurrence("monthly");
    setError(null);
  }

  async function submit() {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!name.trim()) {
      setError("Give the bill a name.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await addBill({
      name: name.trim(),
      amount: value,
      due_on: dueOn,
      recurrence,
    });
    setPending(false);
    if (res.ok && res.bill) {
      onAdded(res.bill);
      setOpen(false);
      reset();
    } else {
      setError(res.error ?? "Something went wrong.");
    }
  }

  return (
    <>
      <motion.button
        type="button"
        aria-label="Add bill"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 28, delay: 0.4 }}
        className="fixed bottom-[calc(1.4rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-2 rounded-full bg-accent pl-5 pr-6 font-semibold text-accent-ink shadow-[var(--shadow-lg)]"
      >
        <Plus size={20} strokeWidth={2.6} />
        Add bill
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !pending && setOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (!pending && info.offset.y > 120) setOpen(false);
              }}
              className="glass fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-[2rem] border-t border-border px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-lg)]"
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border-strong" />

              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">New bill</h2>
                <button
                  type="button"
                  onClick={() => !pending && setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted"
                >
                  <X size={18} strokeWidth={2.4} />
                </button>
              </div>

              {/* name */}
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                maxLength={60}
                placeholder="Bill name (e.g. Netflix, Rent)"
                className="mb-3 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-[0.95rem] text-ink outline-none transition focus:border-border-strong focus:ring-4 focus:ring-[var(--ring)]"
              />

              {/* amount */}
              <div className="mb-4 flex items-center justify-center gap-1">
                <span
                  className="tnum text-3xl font-semibold"
                  style={{ color: "var(--expense)" }}
                >
                  {currencySymbol}
                </span>
                <input
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "");
                    if ((v.match(/\./g) ?? []).length <= 1) setAmount(v);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  inputMode="decimal"
                  placeholder="0"
                  className="tnum w-[7ch] bg-transparent text-center text-5xl font-bold text-ink outline-none placeholder:text-border-strong"
                />
              </div>

              {/* due date */}
              <label className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
                <span className="font-medium text-muted">Due date</span>
                <input
                  type="date"
                  value={dueOn}
                  onChange={(e) => setDueOn(e.target.value)}
                  className="tnum bg-transparent text-right font-medium text-ink outline-none"
                />
              </label>

              {/* recurrence */}
              <div className="mb-3">
                <div className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted">
                  Recurrence
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {RECURRENCES.map((r) => {
                    const active = recurrence === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setRecurrence(r.key)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "border-transparent bg-accent text-accent-ink"
                            : "border-border bg-surface text-muted hover:text-ink"
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-1 py-1.5 text-sm font-medium text-expense"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                type="button"
                onClick={submit}
                disabled={pending}
                whileTap={{ scale: 0.97 }}
                className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-base font-bold text-accent-ink shadow-[var(--shadow)] disabled:opacity-60"
              >
                {pending ? (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    className="h-5 w-5 rounded-full border-2 border-accent-ink/30 border-t-accent-ink"
                  />
                ) : (
                  <>
                    <Check size={20} strokeWidth={2.6} />
                    Save bill
                  </>
                )}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
