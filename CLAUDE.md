# CLAUDE.md — MoneyFlow

Personal money tracker. Log spend/earn, auto-rolls up by day/week/month/year, with
a Bills/Subscriptions Kanban and a full Expo mobile app.

Mobile-first (used mainly in mobile Chrome on web, plus the native iOS/Android app),
with dark + light themes throughout.

## Repo layout

```
.
├── src/                  # Next.js web app (App Router, RSC + server actions + API)
├── mobile/               # Expo SDK 56 React Native app — sibling project
├── supabase/             # SQL — canonical schema + numbered migrations
├── .github/workflows/    # CI: lint + build + typecheck on every PR
├── prd.md                # Roadmap, milestone tracker (✅ marks done)
└── CLAUDE.md             # This file
```

## Stack

**Web:**
- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4 (CSS-based config — there is NO `tailwind.config.js`)
- Framer Motion (all animation, easing `[0.16, 1, 0.3, 1]`)
- Recharts (analytics only, lazy-loaded via `next/dynamic`)
- @dnd-kit/core (Bills Kanban)
- Zod (validation at every API + server-action boundary)
- next-themes (light/dark)

**Mobile:**
- Expo SDK 56 · React Native 0.83 · React 19.2 · Expo Router 6
- @clerk/clerk-expo (with `useSSO()` and SecureStore token cache)
- New Architecture enabled by default
- Hand-rolled charts (no `victory-native` — pure `View`s outperform it at our data volume)

**Backend:**
- Supabase Postgres (DB only — no Supabase Auth)
- Clerk for authentication, with the **native Clerk-Supabase integration**
- Upstash Redis for rate limiting `/api/*` (optional in dev)

## Commands

```bash
# Web (run from repo root)
npm run dev      # local dev at http://localhost:3000
npm run build    # production build — ALSO the typecheck. Run this after changes.
npm start        # run the production build
npm run lint     # eslint

# Mobile (run from mobile/)
cd mobile
npm run start    # expo start
npm run ios      # iOS sim
npm run android  # Android emu / device
npm run doctor   # expo-doctor — verify dep versions match the SDK
```

After ANY web code change: `npm run build`. After ANY mobile change: `cd mobile &&
npx tsc --noEmit`. CI does both on every PR — see `.github/workflows/ci.yml`.

## How data flows (read before editing data logic)

### Web

- **`src/app/page.tsx`** — server component. Calls `getSupabaseForUser()` (which
  injects the current Clerk JWT) and passes the result to `<Dashboard>`.
  Marked `export const dynamic = "force-dynamic"`.
- **`src/app/actions.ts` + `src/app/actions/bills.ts`** — server actions. Thin
  wrappers around the **services layer**. They `revalidatePath` on success.
- **`src/lib/services/{transactions,bills,analytics}.ts`** — single source of
  truth for DB logic. Both server actions AND API routes call into these. Returns
  a `ServiceResult<T>` union (`{ok, data}` | `{ok: false, status, error}`).
- **`src/app/api/**`** — REST endpoints used by mobile + future 3rd parties.
  Every route is wrapped in `withApi` (rate limit + error envelope). Validated
  by Zod.
- **`src/components/Dashboard.tsx`** — client orchestrator. Holds the transaction
  list in React state, does optimistic add/delete, owns the period filter.
- **`src/components/kanban/BillsBoard.tsx`** — Bills Kanban; @dnd-kit drag
  context, hydration-gated `today`.
- **`src/lib/format.ts`** — ALL period math, totals, chart buckets, money formatting.
- **`src/lib/recurrence.ts`** — bills recurrence + `computeEffectiveStatus`.
  Shared between the Kanban UI and the API service.
- **`src/lib/supabaseServer.ts`** — the ONLY place the Supabase client is created.
  Issues a per-request client bound to the user's Clerk JWT (RLS scopes data).

### Mobile

- All data flows through the **Next.js API routes** via `mobile/lib/api.ts`,
  which attaches the Clerk JWT as `Authorization: Bearer <token>`.
- **No direct Supabase calls from mobile.** All RLS / auth happens server-side.
- `mobile/lib/recurrence.ts`, `mobile/lib/types.ts`, `mobile/lib/format.ts` are
  ports of the web equivalents — keep them in sync when changing data shape.

## Auth model (M1 + M2)

- **Clerk** handles all sign-in/up/sessions. The legacy `/login`, `/auth/*` routes
  and `src/lib/supabase/` SSR clients are gone.
- **Clerk-Supabase native integration** is required (configure once in BOTH
  dashboards: Clerk → Sessions → Supabase integration ON; Supabase → Authentication
  → Sign In / Providers → Clerk, with the Clerk Frontend API domain).
- The web uses cookie auth (`__session`); the mobile app uses `Authorization:
  Bearer <token>` — Clerk's `auth()` accepts both transparently.
- Supabase RLS policies enforce `auth.jwt() ->> 'sub' = user_id` on every table.

## Critical rules — do NOT break these

1. **Supabase is server-only.** The client is created exclusively in
   `src/lib/supabaseServer.ts`, which starts with `import "server-only"`. The
   `SUPABASE_ANON_KEY` (post-M2) replaces the old service role key — and even
   it must never reach a `"use client"` component. All DB access stays in
   server components, server actions, and API routes.

2. **The service layer is the single source of truth.** Don't put DB logic in
   API routes or actions — call into `src/lib/services/*`. Two callers, one
   implementation = two ways to do something wrong becomes zero.

3. **Every API route wraps with `withApi`** (from `src/lib/api/respond.ts`),
   NOT plain handlers and NOT `withErrors` directly. `withApi` composes rate
   limit + the error envelope + prod stack-trace stripping. Adding a new route
   without it leaves you unrate-limited.

4. **Hydration gate.** Any "now"-relative math (which day is "today", which
   bills are overdue, periodLabel) runs only after mount via a `mounted` flag,
   because the server (UTC) and the user's phone (e.g. IST) can disagree on
   the calendar date. Same pattern on `BillsBoard.tsx` (the `today` state).

5. **Currency lives in one place.** `CURRENCY` and `LOCALE` in
   `src/lib/types.ts` (default `INR` / `en-IN`). Mobile mirrors this in
   `mobile/lib/types.ts`. Don't hardcode `₹` or number formatting anywhere
   else — use `money()` from `src/lib/format.ts` (web) or `mobile/lib/format.ts`.
   The mobile `format.ts` is Hermes-safe (no `Intl.formatToParts`).

6. **Period & recurrence logic is centralized.** `src/lib/format.ts` owns
   filtering / totals / chart buckets / category aggregations. `src/lib/recurrence.ts`
   owns due-date math and `computeEffectiveStatus`. Add new logic THERE.

7. **Theme colors are tokens, not literals.** All colors are CSS variables in
   `src/app/globals.css` under `:root` (light) and `.dark` (dark), exposed to
   Tailwind via `@theme inline`. Use semantic classes (`bg-surface`, `text-ink`,
   `text-muted`, `bg-accent`, `text-income`, `text-expense`) or `var(--token)`.
   Mobile mirrors via `mobile/lib/theme.ts` (`useTheme()` returns light/dark
   objects). When adding a color, add it to BOTH `:root` and `.dark`, AND to
   both `LIGHT` and `DARK` in mobile.

8. **Amounts are stored positive.** `type` (`"income"` | `"expense"`) carries
   the sign. Net = income − expense. The DB has a `check (amount > 0)` constraint.

9. **No raw user IDs in logs.** Use `hashId()` from `src/lib/api/logging.ts`.
   `LOG_PEPPER` env should be set in prod for stable hashing.

10. **Security headers ship via `next.config.ts`.** When adding a new
    third-party origin (analytics, error reporting, image CDN), update the
    CSP `connect-src` / `img-src` / `script-src` directives there.

## Conventions

- **Animations:** Framer Motion. Reuse the existing easing `[0.16, 1, 0.3, 1]`
  and spring (`stiffness ~400, damping ~30`) for visual consistency.
- **Money figures:** use the `.tnum` class (tabular mono digits) on web. Mobile
  uses `fontVariant: ["tabular-nums"]`.
- **Client/server boundaries:** don't add `"use client"` to anything under
  `src/lib/services/`, `src/lib/api/`, or `src/lib/supabaseServer.ts` (all are
  `"server-only"`). The services layer is server-only on purpose.
- **UI primitives** live in `src/components/ui/` (web) and
  `mobile/components/ui/`. Prefer `<Button>`, `<Chip>`, `<Card>`,
  `<SegmentedFilter>` over hand-rolled buttons.
- **New DB columns:** update the SQL in `supabase/schema.sql` AND add a
  numbered migration in `supabase/migrations/`, then update `Transaction`/`Bill`
  in `src/lib/types.ts` (and `mobile/lib/types.ts`), the `select(...)` and
  `shape()` in the relevant service, the Zod schema in `src/lib/validation.ts`,
  and the AddSheet component.

## Env vars

See `.env.example` at root (web) and `mobile/.env.example` (mobile) for the
canonical list. Highlights:

- `SUPABASE_URL` + `SUPABASE_ANON_KEY` — used with the Clerk JWT.
  `SUPABASE_SERVICE_ROLE_KEY` is reserved for future admin/cron jobs only.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` — Clerk.
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — mobile. **MUST be the same key** as
  the web's publishable. Different = mobile tokens won't authenticate against
  the web's secret.
- `EXPO_PUBLIC_API_BASE_URL` — mobile. LAN IP of the dev server, NOT
  `localhost` (the phone can't see localhost).
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — rate limit. Optional
  in dev, required in prod.
- `LOG_PEPPER` — salt for hashing user IDs in logs. Optional in dev.

## When asked to add a feature

1. State which files you'll touch and why before editing. Cross the
   web/mobile boundary explicitly (e.g. "web service + API route + mobile API
   client + mobile screen").
2. Make the change.
3. Run `npm run build` (web) AND `cd mobile && npx tsc --noEmit`.
4. Note anything that needs a DB migration, Clerk dashboard setting, or env change.
5. Update `prd.md` if you've completed a milestone.

## When debugging

- **Auth failures (mobile):** hit `GET /api/whoami` with the user's token —
  it returns `{ userId, sessionId, ... }` without touching the DB, so you
  can isolate auth from data.
- **Supabase "No suitable key or wrong key type":** the Clerk-Supabase
  integration isn't enabled in one of the two dashboards. Re-verify both.
- **`column transactions.category does not exist`:** missed migration. Run
  every numbered file in `supabase/migrations/` in order.
- **CSP violation in browser:** add the new origin to `next.config.ts` →
  `buildCsp()`.
