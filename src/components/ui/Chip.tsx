"use client";

import { type ButtonHTMLAttributes } from "react";

/**
 * Chip primitive — used by the category picker on the AddTransactionSheet
 * and the recurrence picker on AddBillSheet. Two states (active / inactive),
 * one consistent look.
 */
export function Chip({
  active,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      className={[
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-transparent bg-accent text-accent-ink"
          : "border-border bg-surface text-muted hover:text-ink",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
