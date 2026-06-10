"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, ArrowDownLeft, ArrowUpRight, Check } from "lucide-react";
import { format } from "date-fns";
import { addTransaction } from "@/app/actions";
import { currencySymbol } from "@/lib/format";
import { BUILT_IN_CATEGORIES, type Transaction, type TxType } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";

export default function AddTransactionSheet({
  onAdded,
}: {
  onAdded: (t: Transaction) => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Food");
  const [customCategory, setCustomCategory] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // lock background scroll + autofocus amount when sheet opens
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const id = setTimeout(() => amountRef.current?.focus(), 280);
      return () => {
        clearTimeout(id);
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Sensible category default when toggling between income and expense.
  useEffect(() => {
    if (type === "income" && category !== "Income") setCategory("Income");
    if (type === "expense" && category === "Income") setCategory("Food");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  function reset() {
    setAmount("");
    setDescription("");
    setType("expense");
    setCategory("Food");
    setCustomCategory("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setError(null);
  }

  async function submit() {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      amountRef.current?.focus();
      return;
    }
    const finalCategory =
      category === "__custom__"
        ? customCategory.trim() || "Other"
        : category;
    setPending(true);
    setError(null);
    const res = await addTransaction({
      amount: value,
      type,
      description,
      category: finalCategory,
      occurred_on: date,
    });
    setPending(false);
    if (res.ok && res.transaction) {
      onAdded(res.transaction);
      setOpen(false);
      reset();
    } else {
      setError(res.error ?? "Something went wrong.");
    }
  }

  const income = type === "income";

  return (
    <>
      {/* Floating action button */}
      <motion.button
        type="button"
        aria-label="Add entry"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 28, delay: 0.4 }}
        className="fixed bottom-[calc(1.4rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-2 rounded-full bg-accent pl-5 pr-6 font-semibold text-accent-ink shadow-[var(--shadow-lg)]"
      >
        <Plus size={20} strokeWidth={2.6} />
        Add entry
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
                <h2 className="font-display text-xl font-bold">New entry</h2>
                <button
                  type="button"
                  onClick={() => !pending && setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted"
                >
                  <X size={18} strokeWidth={2.4} />
                </button>
              </div>

              {/* type toggle */}
              <div className="relative mb-5 grid grid-cols-2 rounded-2xl bg-surface-2 p-1">
                {(["expense", "income"] as TxType[]).map((t) => {
                  const active = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className="relative z-10 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
                    >
                      {active && (
                        <motion.span
                          layoutId="type-pill"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                          className="absolute inset-0 rounded-xl"
                          style={{
                            background: t === "income" ? "var(--income)" : "var(--expense)",
                          }}
                        />
                      )}
                      <span
                        className={`relative z-10 flex items-center gap-1.5 transition-colors ${
                          active ? "text-white" : "text-muted"
                        }`}
                      >
                        {t === "income" ? (
                          <ArrowDownLeft size={16} strokeWidth={2.6} />
                        ) : (
                          <ArrowUpRight size={16} strokeWidth={2.6} />
                        )}
                        {t === "income" ? "Earned" : "Spent"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* amount */}
              <div className="mb-4 flex items-center justify-center gap-1">
                <span
                  className="tnum text-3xl font-semibold"
                  style={{ color: income ? "var(--income)" : "var(--expense)" }}
                >
                  {currencySymbol}
                </span>
                <input
                  ref={amountRef}
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

              {/* description */}
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                maxLength={140}
                placeholder={income ? "What was it for? (e.g. Salary)" : "What did you spend on?"}
                className="mb-3 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-[0.95rem] text-ink outline-none transition focus:border-border-strong focus:ring-4 focus:ring-[var(--ring)]"
              />

              {/* category chips */}
              <div className="mb-3">
                <div className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted">
                  Category
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BUILT_IN_CATEGORIES.map((c) => (
                    <Chip
                      key={c}
                      active={category === c}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </Chip>
                  ))}
                  <Chip
                    active={category === "__custom__"}
                    onClick={() => setCategory("__custom__")}
                  >
                    Custom…
                  </Chip>
                </div>
                <AnimatePresence>
                  {category === "__custom__" && (
                    <motion.input
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      maxLength={40}
                      placeholder="Type a category"
                      className="w-full rounded-2xl border border-border bg-surface px-4 py-2.5 text-[0.9rem] text-ink outline-none transition focus:border-border-strong focus:ring-4 focus:ring-[var(--ring)]"
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* date */}
              <label className="mb-2 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
                <span className="font-medium text-muted">Date</span>
                <input
                  type="date"
                  value={date}
                  max={format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => setDate(e.target.value)}
                  className="tnum bg-transparent text-right font-medium text-ink outline-none"
                />
              </label>

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
                    Save {income ? "income" : "expense"}
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
