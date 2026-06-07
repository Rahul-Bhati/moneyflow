"use client";

import { motion } from "framer-motion";
import { PERIODS, type Period } from "@/lib/types";

export default function SegmentedFilter({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="relative flex rounded-full border border-border bg-surface-2 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
      {PERIODS.map((p) => {
        const active = p.key === value;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            className="relative flex-1 select-none rounded-full px-3 py-2 text-[0.92rem] font-semibold"
          >
            {active && (
              <motion.span
                layoutId="segment-pill"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
                className="absolute inset-0 rounded-full bg-accent shadow-[var(--shadow)]"
              />
            )}
            <span
              className={`relative z-10 transition-colors duration-200 ${
                active ? "text-accent-ink" : "text-muted"
              }`}
            >
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
