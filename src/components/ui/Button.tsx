"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

/**
 * Button primitive. One component, three sizes, three variants — covers every
 * button shape this codebase uses (FAB, sheet "Save", icon-only header
 * buttons, destructive confirms). Theme tokens, not hex.
 *
 * Built on `motion.button` so callers can pass `whileTap`, `whileHover`, etc.
 * without wrapping again.
 */

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref">,
    Pick<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled"> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:opacity-90 active:opacity-80",
  ghost: "bg-surface-2 text-ink hover:bg-border hover:text-ink",
  danger:
    "bg-[var(--expense-soft)] text-expense hover:bg-[var(--expense)] hover:text-white",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-xl gap-1.5",
  md: "h-12 px-5 text-[0.95rem] rounded-2xl gap-2",
  lg: "h-14 px-6 text-base rounded-2xl gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth = false,
    className = "",
    children,
    disabled,
    ...rest
  },
  ref
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center font-semibold shadow-[var(--shadow)] transition disabled:opacity-60 disabled:pointer-events-none",
        VARIANT[variant],
        SIZE[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
