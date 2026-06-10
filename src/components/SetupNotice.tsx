import { Database, ArrowRight } from "lucide-react";

export default function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-[var(--radius-2xl)] border border-border bg-surface p-7 shadow-[var(--shadow-lg)]">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-ink">
          <Database size={22} strokeWidth={2.2} />
        </span>
        <h1 className="mt-5 font-display text-2xl font-extrabold">Almost there</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          MoneyFlow needs Supabase + Clerk credentials. Add these to a{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-ink">.env.local</code> file
          (or your Vercel project settings), then restart the dev server:
        </p>
        <pre className="tnum mt-4 overflow-x-auto rounded-xl bg-surface-2 p-4 text-[0.8rem] leading-relaxed text-ink-soft">
{`# Supabase (used with the Clerk JWT — RLS scopes data per user)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...`}
        </pre>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          The <code className="rounded bg-surface-2 px-1 py-0.5 text-ink">SUPABASE_ANON_KEY</code>{" "}
          replaces the old service-role key — the app now talks to Supabase as the signed-in user
          via a Clerk-issued JWT, which RLS evaluates per-row.
        </p>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink"
        >
          Open Supabase dashboard
          <ArrowRight size={15} strokeWidth={2.4} />
        </a>
        <p className="mt-4 text-xs text-muted">
          Full setup is in the project&apos;s <code className="rounded bg-surface-2 px-1 py-0.5 text-ink">.env.example</code> and README.md.
        </p>
      </div>
    </div>
  );
}
