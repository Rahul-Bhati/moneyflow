"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check } from "lucide-react";
import { inviteToSpace } from "@/app/actions/spaces";

export default function InviteSheet({
  open,
  onClose,
  spaceId,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Mint a fresh invite token each time the sheet opens.
  useEffect(() => {
    if (!open) {
      setLink(null);
      setError(null);
      setCopied(false);
      return;
    }
    let cancelled = false;
    setPending(true);
    inviteToSpace(spaceId).then((res) => {
      if (cancelled) return;
      setPending(false);
      if (res.ok && res.token) {
        setLink(`${window.location.origin}/join/${res.token}`);
      } else {
        setError(res.error ?? "Couldn't create an invite.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, spaceId]);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the link is still selectable */
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
            onClick={onClose}
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
              <h2 className="font-display text-xl font-bold">Invite to space</h2>
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>
            <p className="mb-3 text-sm text-muted">
              Share this link. Whoever opens it and signs in joins this space.
            </p>

            {pending ? (
              <div className="h-14 animate-pulse rounded-2xl bg-surface-2" />
            ) : error ? (
              <p className="text-sm font-medium text-expense">{error}</p>
            ) : (
              <button
                type="button"
                onClick={copy}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition hover:border-border-strong"
              >
                <span className="tnum truncate text-sm text-ink">{link}</span>
                {copied ? (
                  <Check size={18} className="shrink-0 text-income" />
                ) : (
                  <Copy size={18} className="shrink-0 text-muted" />
                )}
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
