"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Users, ChevronRight, X, Check } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { addSpace } from "@/app/actions/spaces";
import { money } from "@/lib/format";
import type { Space } from "@/lib/types";
import ThemeToggle from "../ThemeToggle";

/** "you'll get ₹X" / "you'll pay ₹X" / "Settled" for a space's net. */
function netLabel(net: number | undefined): { text: string; tone: string } {
  const n = Math.round((net ?? 0) * 100) / 100;
  if (n === 0) return { text: "Settled", tone: "text-muted" };
  if (n > 0) return { text: `you'll get ${money(n)}`, tone: "text-income" };
  return { text: `you'll pay ${money(-n)}`, tone: "text-expense" };
}

export default function SpacesList({ initialSpaces }: { initialSpaces: Space[] }) {
  const [spaces, setSpaces] = useState<Space[]>(initialSpaces);
  const [adding, setAdding] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-32 md:max-w-3xl md:px-8">
      <header className="glass sticky top-0 z-30 -mx-4 mb-1 flex items-center justify-between border-b border-border px-4 py-3.5 md:-mx-8 md:px-8">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="Back to dashboard"
            className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="font-display text-lg font-extrabold tracking-tight">Spaces</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserButton appearance={{ elements: { avatarBox: "size-8" } }} />
        </div>
      </header>

      <main className="flex flex-col gap-3 pt-3">
        {spaces.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface px-6 py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted">
              <Users className="size-6" />
            </div>
            <p className="font-display text-base font-bold">No spaces yet</p>
            <p className="max-w-xs text-sm text-muted">
              Create a space for your flat, trip, or friend group, then invite people to
              split expenses privately.
            </p>
          </div>
        ) : (
          spaces.map((s) => {
            const label = netLabel(s.myNet);
            return (
              <Link key={s.id} href={`/groups/${s.id}`}>
                <motion.div
                  whileTap={{ scale: 0.99 }}
                  className="flex items-center justify-between rounded-3xl border border-border bg-surface px-5 py-4 shadow-[var(--shadow)] transition hover:border-border-strong"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-bold">{s.name}</p>
                    <p className={`tnum mt-0.5 text-sm font-semibold ${label.tone}`}>
                      {label.text}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted" />
                </motion.div>
              </Link>
            );
          })
        )}
      </main>

      <motion.button
        type="button"
        aria-label="New space"
        onClick={() => setAdding(true)}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 28, delay: 0.3 }}
        className="fixed bottom-[calc(1.4rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-2 rounded-full bg-accent pl-5 pr-6 font-semibold text-accent-ink shadow-[var(--shadow-lg)]"
      >
        <Plus size={20} strokeWidth={2.6} />
        New space
      </motion.button>

      <NewSpaceSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(s) => setSpaces((prev) => [{ ...s, myNet: 0 }, ...prev])}
      />
    </div>
  );
}

function NewSpaceSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (s: Space) => void;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("Give the space a name.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await addSpace({ name: name.trim() });
    setPending(false);
    if (res.ok && res.space) {
      onAdded(res.space);
      setName("");
      onClose();
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
            className="glass fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-[2rem] border-t border-border px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-lg)]"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border-strong" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">New space</h2>
              <button
                type="button"
                onClick={() => !pending && onClose()}
                className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              maxLength={60}
              placeholder="Space name (e.g. Flat, Goa Trip)"
              className="mb-3 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-[0.95rem] text-ink outline-none transition focus:border-border-strong focus:ring-4 focus:ring-[var(--ring)]"
            />
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
                  Create space
                </>
              )}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
