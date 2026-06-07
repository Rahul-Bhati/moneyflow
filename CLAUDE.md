# CLAUDE.md — MoneyFlow

Personal money tracker. Log what you spend/earn; auto-rolls up by day/week/month/year.
Mobile-first (used mainly in mobile Chrome), with dark + light themes.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4 (CSS-based config — there is NO `tailwind.config.js`)
- Framer Motion for all animation
- Supabase (Postgres) as the backend
- next-themes for theming

## Commands

```bash
npm run dev      # local dev at http://localhost:3000
npm run build    # production build — ALSO the typecheck. Run this after changes.
npm start        # run the production build
npm run lint     # eslint
```

After ANY code change, run `npm run build`. It type-checks the whole project; a green
build means nothing is broken at the type level. Do this before saying a task is done.

## How data flows (read before editing data logic)

- `src/app/page.tsx` — **server component**. Fetches all transactions from Supabase
  and passes them to `<Dashboard>`. Marked `export const dynamic = "force-dynamic"`.
- `src/app/actions.ts` — **server actions** (`addTransaction`, `deleteTransaction`).
  All writes go through here. They call `revalidatePath("/")`.
- `src/components/Dashboard.tsx` — **client** orchestrator. Holds the transaction list
  in React state, does optimistic add/delete, owns the period filter.
- `src/lib/format.ts` — ALL period math, totals, chart buckets, and money formatting.
- `src/lib/supabaseServer.ts` — the ONLY place the Supabase client is created.

## Critical rules — do NOT break these

1. **Supabase is server-only.** The client is created exclusively in
   `src/lib/supabaseServer.ts`, which starts with `import "server-only"`. The
   `SUPABASE_SERVICE_ROLE_KEY` must NEVER be imported into, referenced by, or sent to
   any client component (`"use client"`). Doing so leaks a secret that bypasses all
   database security. All DB access stays in `page.tsx` (read) and `actions.ts` (write).

2. **No `NEXT_PUBLIC_` Supabase vars.** Env vars are `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix, on purpose).

3. **Hydration gate in Dashboard.** All "now"-relative math (which day is "today",
   what falls in "this week") runs only after mount via the `mounted` flag, because the
   server (UTC) and the user's phone (IST) can disagree on the date. Do not move
   date-dependent rendering above this gate or you'll reintroduce hydration mismatches.

4. **Currency lives in one place.** `CURRENCY` and `LOCALE` in `src/lib/types.ts`
   (default `INR` / `en-IN`). Don't hardcode `₹` or number formatting anywhere else —
   use the `money()` helper from `src/lib/format.ts`.

5. **Period logic is centralized.** Filtering, totals, and chart buckets all come from
   `src/lib/format.ts`. Add new period behavior there, not inline in components.

6. **Theme colors are tokens, not literals.** All colors are CSS variables defined in
   `src/app/globals.css` under `:root` (light) and `.dark` (dark), exposed to Tailwind
   via `@theme inline`. Use semantic classes (`bg-surface`, `text-ink`, `text-muted`,
   `bg-accent`, `text-income`, `text-expense`, etc.) or `var(--token)`. Never hardcode
   hex colors in components. When adding a color, add it to BOTH `:root` and `.dark`.

7. **Amounts are stored positive.** `type` (`"income"` | `"expense"`) carries the sign.
   Net = income − expense. The DB has a `check (amount > 0)` constraint.

## Conventions

- Animations: Framer Motion. Reuse the existing easing `[0.16, 1, 0.3, 1]` and the
  spring feel (`stiffness ~400, damping ~30`) for consistency.
- Money figures use the `.tnum` class (tabular mono digits).
- Keep components small and client/server boundaries clean; don't add `"use client"`
  to `page.tsx`, `actions.ts`, or anything under `src/lib/` that's server-only.
- New DB columns: update the SQL in `supabase/schema.sql`, the `Transaction` type in
  `src/lib/types.ts`, the `select(...)` in `page.tsx`, and the insert in `actions.ts`.

## When asked to add a feature

1. State which files you'll touch and why before editing.
2. Make the change.
3. Run `npm run build` and confirm it passes.
4. Note anything that needs a DB/schema or env change.
