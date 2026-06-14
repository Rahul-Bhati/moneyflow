"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { addExpense } from "@/app/actions/spaces";
import { currencySymbol, money } from "@/lib/format";
import { equalSplit } from "@/lib/splits";
import { BUILT_IN_CATEGORIES, type SpaceMember } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";

type SplitMode = "equal" | "custom";

export default function AddExpenseSheet({
  open,
  onClose,
  spaceId,
  members,
  meId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  members: SpaceMember[];
  meId: string;
  onAdded: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Food");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<SplitMode>("equal");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default: everyone is in the split.
  useEffect(() => {
    if (open) {
      setSelected(new Set(members.map((m) => m.user_id)));
    }
  }, [open, members]);

  const nameOf = (id: string) =>
    id === meId ? "You" : members.find((m) => m.user_id === id)?.display_name ?? "Someone";

  const total = parseFloat(amount) || 0;
  const selectedIds = useMemo(
    () => members.map((m) => m.user_id).filter((id) => selected.has(id)),
    [members, selected]
  );

  const equalPreview = useMemo(
    () => (mode === "equal" ? equalSplit(total, selectedIds) : []),
    [mode, total, selectedIds]
  );

  const customSum = selectedIds.reduce(
    (s, id) => s + (parseFloat(custom[id] ?? "") || 0),
    0
  );

  function reset() {
    setAmount("");
    setDescription("");
    setCategory("Food");
    setMode("equal");
    setCustom({});
    setError(null);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!description.trim()) {
      setError("Add a short description.");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Pick at least one person to split with.");
      return;
    }

    const participants =
      mode === "equal"
        ? equalSplit(value, selectedIds)
        : selectedIds.map((id) => ({
            user_id: id,
            share_amount: Math.round((parseFloat(custom[id] ?? "") || 0) * 100) / 100,
          }));

    if (mode === "custom" && Math.abs(customSum - value) > 0.005) {
      setError(
        `Shares add up to ${money(customSum)}, but the total is ${money(value)}.`
      );
      return;
    }

    setPending(true);
    setError(null);
    const res = await addExpense(spaceId, {
      amount: value,
      description: description.trim(),
      category,
      occurred_on: new Date().toISOString().slice(0, 10),
      participants,
    });
    setPending(false);
    if (res.ok) {
      reset();
      onClose();
      onAdded();
    } else {
      setError(res.error ?? "Something went wrong.");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !pending && onClose()}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            className="glass fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] border-t border-border px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-lg)]"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border-strong" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Split an expense</h2>
              <button
                type="button"
                onClick={() => !pending && onClose()}
                className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

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
                inputMode="decimal"
                placeholder="0"
                className="tnum w-[7ch] bg-transparent text-center text-5xl font-bold text-ink outline-none placeholder:text-border-strong"
              />
            </div>

            {/* description */}
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={140}
              placeholder="What was it? (e.g. Chai, Dinner)"
              className="mb-3 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-[0.95rem] text-ink outline-none transition focus:border-border-strong focus:ring-4 focus:ring-[var(--ring)]"
            />

            {/* category */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {BUILT_IN_CATEGORIES.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {c}
                </Chip>
              ))}
            </div>

            {/* participants */}
            <div className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted">
              Split between
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {members.map((m) => (
                <Chip
                  key={m.user_id}
                  active={selected.has(m.user_id)}
                  onClick={() => toggle(m.user_id)}
                >
                  {nameOf(m.user_id)}
                </Chip>
              ))}
            </div>

            {/* split mode */}
            <div className="mb-3 flex gap-1.5 rounded-2xl bg-surface-2 p-1">
              {(["equal", "custom"] as SplitMode[]).map((mo) => (
                <button
                  key={mo}
                  type="button"
                  onClick={() => setMode(mo)}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize transition ${
                    mode === mo ? "bg-surface text-ink shadow-[var(--shadow)]" : "text-muted"
                  }`}
                >
                  {mo === "equal" ? "Split equally" : "Custom"}
                </button>
              ))}
            </div>

            {/* preview / custom inputs */}
            {mode === "equal" ? (
              selectedIds.length > 0 &&
              total > 0 && (
                <div className="mb-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
                  {equalPreview.map((p) => (
                    <div key={p.user_id} className="flex justify-between py-0.5">
                      <span className="text-muted">{nameOf(p.user_id)}</span>
                      <span className="tnum font-semibold">{money(p.share_amount)}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="mb-3 flex flex-col gap-2">
                {selectedIds.map((id) => (
                  <label
                    key={id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium">{nameOf(id)}</span>
                    <span className="flex items-center gap-1">
                      <span className="tnum text-muted">{currencySymbol}</span>
                      <input
                        value={custom[id] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9.]/g, "");
                          if ((v.match(/\./g) ?? []).length <= 1)
                            setCustom((prev) => ({ ...prev, [id]: v }));
                        }}
                        inputMode="decimal"
                        placeholder="0"
                        className="tnum w-[6ch] bg-transparent text-right font-semibold text-ink outline-none placeholder:text-border-strong"
                      />
                    </span>
                  </label>
                ))}
                {total > 0 && (
                  <p
                    className={`tnum px-1 text-xs font-medium ${
                      Math.abs(customSum - total) <= 0.005 ? "text-muted" : "text-expense"
                    }`}
                  >
                    {money(customSum)} of {money(total)} assigned
                  </p>
                )}
              </div>
            )}

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
                  Add expense
                </>
              )}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
