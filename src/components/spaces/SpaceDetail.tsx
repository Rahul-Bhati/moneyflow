"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, UserPlus } from "lucide-react";
import { money } from "@/lib/format";
import { summarizeBalances } from "@/lib/splits";
import type { Balance, SpaceDetail as SpaceDetailData } from "@/lib/types";
import ThemeToggle from "../ThemeToggle";
import AddExpenseSheet from "./AddExpenseSheet";
import InviteSheet from "./InviteSheet";
import SettleSheet from "./SettleSheet";

export default function SpaceDetail({
  detail,
  meId,
}: {
  detail: SpaceDetailData;
  meId: string;
}) {
  const router = useRouter();
  const { space, members, expenses, balances } = detail;
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [settleWith, setSettleWith] = useState<Balance | null>(null);

  // user_id → label, with the viewer shown as "You".
  const nameOf = useMemo(() => {
    const m = new Map(members.map((x) => [x.user_id, x.display_name]));
    return (userId: string) =>
      userId === meId ? "You" : m.get(userId) ?? "Someone";
  }, [members, meId]);

  const summary = summarizeBalances(balances);

  function afterMutation() {
    // Balances + feed are computed server-side; re-pull instead of guessing.
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-32 md:max-w-3xl md:px-8">
      <header className="glass sticky top-0 z-30 -mx-4 mb-1 flex items-center justify-between border-b border-border px-4 py-3.5 md:-mx-8 md:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/groups"
            aria-label="Back to spaces"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-extrabold tracking-tight">
              {space.name}
            </h1>
            <p className="text-xs font-medium text-muted">
              {members.length} {members.length === 1 ? "member" : "members"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInviting(true)}
            aria-label="Invite people"
            className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95"
          >
            <UserPlus className="size-4" />
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-col gap-5 pt-3">
        {/* Headline net */}
        <div className="rounded-3xl border border-border bg-surface px-5 py-4 shadow-[var(--shadow)]">
          {summary.settled ? (
            <p className="text-center text-sm font-semibold text-muted">
              All settled up 🎉
            </p>
          ) : (
            <div className="flex items-center justify-around">
              <div className="text-center">
                <p className="text-xs font-medium text-muted">You&apos;ll get</p>
                <p className="tnum mt-1 text-xl font-extrabold text-income">
                  {money(summary.toReceive)}
                </p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-xs font-medium text-muted">You&apos;ll pay</p>
                <p className="tnum mt-1 text-xl font-extrabold text-expense">
                  {money(summary.toPay)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Per-person balances */}
        {balances.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted">
              Your balances
            </h2>
            <div className="flex flex-col gap-2">
              {balances.map((b) => {
                const positive = b.net > 0;
                return (
                  <div
                    key={b.counterparty}
                    className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold">{nameOf(b.counterparty)}</p>
                      <p
                        className={`tnum text-sm font-semibold ${
                          positive ? "text-income" : "text-expense"
                        }`}
                      >
                        {positive
                          ? `will pay you ${money(b.net)}`
                          : `you'll pay ${money(-b.net)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettleWith(b)}
                      className="rounded-full bg-surface-2 px-3.5 py-2 text-xs font-bold text-ink transition hover:bg-border active:scale-95"
                    >
                      Settle up
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Expense feed (only what I'm part of) */}
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted">
            Shared expenses
          </h2>
          {expenses.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
              Nothing split yet. Tap “Add expense” to start.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {expenses.map((e) => {
                const myShare = e.participants.find(
                  (p) => p.user_id === meId
                )?.share_amount;
                return (
                  <div
                    key={e.id}
                    className="rounded-2xl border border-border bg-surface px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{e.description}</p>
                        <p className="text-xs text-muted">
                          {nameOf(e.payer_id)} paid · {e.occurred_on} ·{" "}
                          {e.participants.length} way
                          {e.participants.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tnum font-bold">{money(e.amount)}</p>
                        {myShare != null && (
                          <p className="tnum text-xs text-muted">
                            your share {money(myShare)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <motion.button
        type="button"
        aria-label="Add expense"
        onClick={() => setAdding(true)}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 28, delay: 0.3 }}
        className="fixed bottom-[calc(1.4rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-2 rounded-full bg-accent pl-5 pr-6 font-semibold text-accent-ink shadow-[var(--shadow-lg)]"
      >
        <Plus size={20} strokeWidth={2.6} />
        Add expense
      </motion.button>

      <AddExpenseSheet
        open={adding}
        onClose={() => setAdding(false)}
        spaceId={space.id}
        members={members}
        meId={meId}
        onAdded={afterMutation}
      />
      <InviteSheet
        open={inviting}
        onClose={() => setInviting(false)}
        spaceId={space.id}
      />
      <SettleSheet
        balance={settleWith}
        spaceId={space.id}
        nameOf={nameOf}
        onClose={() => setSettleWith(null)}
        onSettled={afterMutation}
      />
    </div>
  );
}
