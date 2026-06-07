"use client";

import { useState, useTransition, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { signInWithEmail, signUpWithEmail, signInWithOAuth } from "./actions";

type Mode = "signin" | "signup";

const EASE = [0.16, 1, 0.3, 1] as const;

// ── URL-based error banner (needs Suspense because it reads searchParams) ────
function UrlError() {
  const params = useSearchParams();
  const error = params.get("error");
  if (!error) return null;
  const msg: Record<string, string> = {
    auth_callback_failed: "Sign-in failed. Please try again.",
    confirmation_failed: "Email confirmation failed. Try signing up again.",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex items-start gap-2.5 rounded-xl border border-expense/20 bg-expense-soft px-3.5 py-3 text-sm text-expense"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{msg[error] ?? "Something went wrong. Please try again."}</span>
    </motion.div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [oauthProvider, setOauthProvider] = useState<"google" | "apple" | null>(null);
  const [isPending, startTransition] = useTransition();

  const isGoogleLoading = isPending && oauthProvider === "google";
  const isAppleLoading = isPending && oauthProvider === "apple";
  const isEmailLoading = isPending && oauthProvider === null;

  function switchMode(next: Mode) {
    setMode(next);
    setMsg(null);
  }

  function handleOAuth(provider: "google" | "apple") {
    setMsg(null);
    setOauthProvider(provider);
    startTransition(async () => {
      const result = await signInWithOAuth(provider);
      if (result?.error) {
        setMsg({ type: "error", text: result.error });
        setOauthProvider(null);
      }
    });
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setOauthProvider(null);
    const fd = new FormData();
    fd.set("email", email);
    fd.set("password", password);

    startTransition(async () => {
      if (mode === "signin") {
        const res = await signInWithEmail(fd);
        if (res?.error) setMsg({ type: "error", text: res.error });
      } else {
        const res = await signUpWithEmail(fd);
        if (res.error) setMsg({ type: "error", text: res.error });
        if (res.success) setMsg({ type: "success", text: res.success });
      }
    });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="w-full max-w-sm"
      >
        {/* Brand header */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-accent shadow-lg"
          >
            <TrendingUp className="size-7 text-accent-ink" />
          </motion.div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            MoneyFlow
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {mode === "signin"
              ? "Welcome back — let's see the numbers."
              : "Track every rupee, effortlessly."}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-[var(--radius-2xl)] border border-border bg-surface p-6"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <Suspense fallback={null}>
            <UrlError />
          </Suspense>

          {/* OAuth buttons */}
          <div className="flex flex-col gap-2.5">
            <OAuthButton
              onClick={() => handleOAuth("google")}
              loading={isGoogleLoading}
              disabled={isPending}
              icon={<GoogleIcon />}
              label="Continue with Google"
            />
            <OAuthButton
              onClick={() => handleOAuth("apple")}
              loading={isAppleLoading}
              disabled={isPending}
              icon={<AppleIcon />}
              label="Continue with Apple"
            />
          </div>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border-strong" />
            <span className="text-xs font-medium text-muted">or</span>
            <div className="h-px flex-1 bg-border-strong" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isPending}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-muted transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              disabled={isPending}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-muted transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
            />

            {/* Inline message */}
            <AnimatePresence mode="wait">
              {msg && (
                <motion.div
                  key={msg.text}
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-start gap-2.5 overflow-hidden rounded-xl px-3.5 py-3 text-sm ${
                    msg.type === "error"
                      ? "border border-expense/20 bg-expense-soft text-expense"
                      : "border border-income/20 bg-income-soft text-income"
                  }`}
                >
                  {msg.type === "error" ? (
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  )}
                  <span>{msg.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isPending}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-ink transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isEmailLoading && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {/* Mode toggle */}
          <p className="mt-4 text-center text-sm text-muted">
            {mode === "signin" ? "New to MoneyFlow? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-ink hover:underline"
            >
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function OAuthButton({
  onClick,
  loading,
  disabled,
  icon,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-border-strong bg-surface-2 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0 fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}
