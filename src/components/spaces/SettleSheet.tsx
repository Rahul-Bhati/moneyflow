"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { settleUp } from "@/app/actions/spaces";
import { currencySymbol, money } from "@/lib/format";
import type { Balance } from "@/lib/types";

export default function SettleSheet({
  balance,
  spaceId,
  nameOf,
  onClose,
  onSettled,
}: {
  balance: Balance | null;
  spaceId: string;
  nameOf: (userId: string) => string;
  onClose: () => void;
  onSettled: () => void;
}) {
  const open = balance !== null;
  // net < 0 → I owe them → I'm paying. net > 0 → they owe me → I'm receiving.
  const direction: "paid" | "received" =
    balance && balance.net < 0 ? "paid" : "received";
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (balance) {
      setAmount(String(Math.abs(balance.net)));
      setError(null);
    }
  }, [balance]);

  if (!balance) return null;
  const name = nameOf(balance.counterparty);
  const verb = direction === "paid" ? `You paid ${name}` : `${name} paid you`;

  async function submit() {
    if (!balance) return;
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await settleUp(spaceId, {
      counterparty: balance.counterparty,
      direction,
      amount: value,
      occurred_on: new Date().toISOString().slice(0, 10),
    });
    setPending(false);
    if (res.ok) {
      onClose();
      onSettled();
    } else {
      setError(res.error ?? "Something went wrong.");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !pending && onClose()}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            className="glass fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-[2rem] border-t border-border px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-lg)]"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border-strong" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Settle up</h2>
              <button
                type="button"
                onClick={() => !pending && onClose()}
                className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <p className="mb-4 text-sm font-medium text-muted">{verb}</p>

            <div className="mb-4 flex items-center justify-center gap-1">
              <span className="tnum text-3xl font-semibold text-ink">{currencySymbol}</span>
              <input
                value={amount}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, "");
                  if ((v.match(/\./g) ?? []).length <= 1) setAmount(v);
                }}
                inputMode="decimal"
                placeholder="0"
                className="tnum w-[7ch] bg-transparent text-center text-5xl font-bold text-ink outline-none placeholder:text-border-strong"
              />
            </div>

            <p className="mb-3 text-center text-xs text-muted">
              Current balance: {money(Math.abs(balance.net))}
            </p>

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
                  Record payment
                </>
              )}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
