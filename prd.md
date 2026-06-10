# MoneyFlow — Product Requirements Document

> A milestone-based build plan. Each milestone is self-contained: build it, test it, then move on. Nothing in M2 should require code that doesn't exist until M5.

---

## Vision

MoneyFlow is a calm, fast, mobile-first personal money tracker that helps people **see where their money goes** and **stay in control without spreadsheets**. Today it works as a single-user web app. We're evolving it into a **multi-user product** with:

- Real authentication (Clerk: Google, Apple, Email, SSO)
- Per-user data scoped via Supabase RLS
- Rich interactive analytics (pie, area trend, calendar heatmap)
- A **Kanban board for bills & subscriptions** (Upcoming → Due This Week → Paid → Overdue)
- A **React Native (Expo) mobile app** with full feature parity, talking to Next.js API routes
- Production hardening: responsive across all screen sizes, code splitting, lazy loading, reusable primitives, Zod validation at every input boundary

---

## Locked decisions

| Area | Decision |
|---|---|
| **Auth** | Fully replace Supabase Auth with Clerk. Existing `/login`, `/auth/callback`, `/auth/confirm` and the SSR auth helpers get deleted. |
| **Kanban concept** | Bills / Subscriptions workflow. Columns: Upcoming → Due This Week → Paid → Overdue. Marking Paid auto-creates a transaction. |
| **Mobile scope** | Full feature parity with web (Dashboard, Add/Edit/Delete, Analytics, Bills/Kanban). |
| **Charts** | Recharts for the new Analytics screen. Keep the existing custom Framer Motion bar chart on the Dashboard — it's a signature element. |
| **State** | Local React state for ephemeral UI. Zustand for cross-screen state (period filter, optimistic queues). |
| **Validation** | Zod at every server boundary (server actions, API routes, mobile client). |
| **Mobile app location** | Sibling folder `mobile/` at repo root. |

---

## Milestone format

Each milestone follows the same shape so you can scan quickly:

- **Why** — one-line rationale
- **Scope** — concrete deliverables
- **Acceptance test** — manual checks you can run before moving on
- **Schema / env changes** — anything outside source code

A milestone is "done" when:
1. `npm run build` passes (web).
2. All acceptance tests pass manually.
3. Any schema migration has been applied to Supabase.

---

## M0 — Foundation hygiene ✅ done

**Why:** Land Zod and tighten validation *before* multi-user code touches actions — defense in depth from day one.

**Scope:**
- Install `zod` and `@hookform/resolvers`.
- Create `src/lib/validation.ts` with `transactionInputSchema` (amount > 0, type in `["income","expense"]`, description ≤ 140, `occurred_on` ISO date).
- Refactor `addTransaction` / `deleteTransaction` in [src/app/actions.ts](src/app/actions.ts) to validate via Zod and return typed errors.
- Create `.env.example` listing **every** env var the rest of the PRD will introduce (Clerk keys, Supabase URL, JWT template name, Upstash keys, etc.).

**Acceptance test:**
- `npm run build` green.
- Submitting a transaction with `amount = -5` via the UI surfaces a typed validation error, not a Supabase 500.
- `.env.example` exists at repo root and is referenced from `CLAUDE.md`.

**Schema / env:** None.

---

## M1 — Clerk authentication (web) ✅ done

**Why:** Real auth that supports Google + Apple + Email + SSO out of the box, with a polished hosted UI.

**Scope:**
- `npm install @clerk/nextjs`.
- Wrap the app in `<ClerkProvider>` in [src/app/layout.tsx](src/app/layout.tsx) and pass theme tokens so Clerk's UI matches the design system.
- Create `src/middleware.ts` using `clerkMiddleware()`; protect `/`, `/analytics`, `/bills`, `/api/*`. Public routes: `/sign-in/*`, `/sign-up/*`.
- New routes: `src/app/sign-in/[[...sign-in]]/page.tsx` and `src/app/sign-up/[[...sign-up]]/page.tsx`, each rendering Clerk's prebuilt `<SignIn />` / `<SignUp />`.
- In Clerk Dashboard: enable **Google**, **Apple**, **Email/Password**, **Email Magic Link**, and configure SSO.
- Header in [src/components/Dashboard.tsx](src/components/Dashboard.tsx): replace the custom `LogOut` icon button with Clerk's `<UserButton />` (or wrap your icon and call `useClerk().signOut()`).
- **Delete:** `src/app/login/`, `src/app/auth/`, `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/disposableEmails.ts` (Clerk handles disposable emails).

**Acceptance test:**
- Sign up flow works with Google, Apple, and email — each lands on `/`.
- Sign out clears session; visiting `/` while signed out redirects to `/sign-in`.
- `<UserButton />` shows the user's avatar and offers a working "Manage account" + "Sign out".

**Schema / env:**
- New env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/`.

---

## M2 — Per-user data + Zod + RLS ✅ done

**Why:** Until this lands, all users would share one transactions table. This is the most important milestone for correctness and privacy.

**Scope:**
- **Schema migration** (run in Supabase SQL editor):
  ```sql
  alter table transactions add column user_id text not null default '';
  -- dev only: delete from transactions where user_id = '';
  alter table transactions alter column user_id drop default;
  create index transactions_user_idx on transactions(user_id, occurred_on desc);
  ```
- Configure the **Clerk → Supabase JWT template** ([docs](https://clerk.com/docs/integrations/databases/supabase)). Name it `supabase`.
- Update `src/lib/supabaseServer.ts`: export a `getSupabaseForUser()` that takes the Clerk session token and creates a per-request client with `Authorization: Bearer <token>` so RLS sees the user.
- RLS policies on `transactions`:
  ```sql
  alter table transactions enable row level security;
  create policy "owner read"   on transactions for select using (auth.jwt() ->> 'sub' = user_id);
  create policy "owner insert" on transactions for insert with check (auth.jwt() ->> 'sub' = user_id);
  create policy "owner update" on transactions for update using (auth.jwt() ->> 'sub' = user_id);
  create policy "owner delete" on transactions for delete using (auth.jwt() ->> 'sub' = user_id);
  ```
- Update [src/app/page.tsx](src/app/page.tsx) and [src/app/actions.ts](src/app/actions.ts) to:
  - Call `auth()` from `@clerk/nextjs/server` to get `userId` + session token.
  - Pass the token to `getSupabaseForUser`.
  - Insert `user_id` on `addTransaction`.
  - Validate input via Zod schemas from M0.

**Acceptance test:**
- Sign in as User A → add three transactions → sign out.
- Sign in as User B → see zero transactions.
- Direct DB query as service role shows `user_id` populated correctly on every row.
- Attempting a raw fetch to Supabase REST with User A's JWT cannot read User B's rows.

**Schema / env:**
- Migration above.
- New env var: `CLERK_JWT_TEMPLATE=supabase` (or hardcode the template name in code).

---

## M3 — Rich analytics page ✅ done

**Why:** "Where does my money go" deserves more than a single bar chart. This is the screen people show their friends.

**Scope:**
- Schema: `alter table transactions add column category text not null default 'Uncategorized';`
- Update `AddTransactionSheet.tsx` to include a category chip picker (Food, Travel, Bills, Income, Shopping, Health, Entertainment, Other + a custom field).
- Install `recharts`.
- New route `/analytics` containing:
  - **CategoryPie** — spending breakdown for the current period (Recharts `PieChart`).
  - **TrendArea** — last 6 months net trend (`AreaChart`, income vs expense stacked).
  - **HeatmapCalendar** — GitHub-style daily spend intensity for the last 12 weeks.
  - **TopExpenses** — top 5 expense transactions for the current period.
  - **Sparklines** on the existing `SummaryCards` (small inline trend lines).
- Extend [src/lib/format.ts](src/lib/format.ts) with `byCategory(txs)`, `dailyTotals(txs, range)`, `monthTrend(txs, n)`.
- Code-split: wrap each chart panel in `next/dynamic({ ssr: false, loading: <ChartSkeleton /> })`.
- Match the existing design tokens — colors come from CSS vars, never hex literals.

**Acceptance test:**
- Toggle period (day/week/month/year); each chart updates correctly.
- Filter by category; pie + trend respect it.
- Empty state (new account, zero transactions) renders cleanly with helpful copy, not error icons.
- Bundle analyzer shows Recharts in its own chunk, not in the initial `/` payload.

**Schema / env:**
- Migration: add `category` column.
- No new env.

---

## M4 — Kanban: Bills & Subscriptions board

**Why:** Recurring bills are where people leak money. Visualizing them as a workflow they can drag turns "I might owe something" into "here's the column".

**Scope:**
- **Schema:**
  ```sql
  create table bills (
    id           uuid primary key default gen_random_uuid(),
    user_id      text not null,
    name         text not null,
    amount       numeric(12, 2) not null check (amount > 0),
    due_on       date not null,
    status       text not null check (status in ('upcoming','due_week','paid','overdue')),
    recurrence   text check (recurrence in ('none','weekly','monthly','yearly')) default 'none',
    paid_on      date,
    created_at   timestamptz default now()
  );
  create index bills_user_due_idx on bills(user_id, due_on);
  alter table bills enable row level security;
  -- same four owner policies as transactions
  ```
- New route `/bills` rendering a 4-column Kanban via `@dnd-kit/core`.
- Status auto-computed from `due_on` vs today **on read**, but a manual drag overrides until the next refresh (write the chosen status to the row).
- **Drag → Paid** triggers `markBillPaid(billId)`:
  1. Updates the bill: `status='paid'`, `paid_on=today`.
  2. Inserts a `transactions` row: `type='expense'`, `amount=bill.amount`, `description="Paid: ${bill.name}"`, `category='Bills'`.
  3. If `recurrence !== 'none'`, inserts a new bill with `due_on` advanced by the recurrence interval.
- Optimistic UI on drag — server reconciles.
- New file `src/lib/recurrence.ts` with `nextDueDate(from: Date, recurrence: Recurrence): Date`.

**Acceptance test:**
- Create a recurring monthly bill due tomorrow → it appears in **Due This Week**.
- Drag to **Paid** → a transaction is created with category "Bills" and a new bill appears next month.
- Refreshing recomputes auto-statuses correctly (a bill 3 days overdue moves to **Overdue**).
- Two users' bills are fully isolated (RLS).

**Schema / env:**
- Migration above.
- No new env.

---

## M5 — REST API routes (for mobile + future 3rd-party)

**Why:** The mobile app needs an HTTP interface. Server Actions don't work cross-platform.

**Scope:**
- Refactor: move all DB logic out of server actions into `src/lib/services/{transactions,bills,analytics}.ts`. Server actions and API routes both call into these services. Single source of truth.
- New routes (all guarded by `auth().userId`, validated by Zod):

  | Method | Route | Purpose |
  |---|---|---|
  | GET | `/api/transactions` | List, paged, filtered by `?period=` and `?category=` |
  | POST | `/api/transactions` | Create |
  | PATCH | `/api/transactions/[id]` | Update |
  | DELETE | `/api/transactions/[id]` | Delete |
  | GET | `/api/bills` | List, with computed status |
  | POST | `/api/bills` | Create |
  | PATCH | `/api/bills/[id]` | Update / drag-to-column |
  | GET | `/api/analytics?period=` | Pre-aggregated category, trend, heatmap data |

- Document return shapes in this PRD's "API contract" appendix below so the mobile app team (you) builds against a stable spec.

**Acceptance test:**
- `curl` each endpoint with a Clerk session token — all return correct shapes.
- Cross-user access: User A's token cannot read User B's `/api/transactions/[id]` (returns 404 / empty list, never the row).
- Malformed payloads return 400 with a typed Zod error, not 500.

**Schema / env:** None.

### API contract (v1)

```ts
// GET /api/transactions?period=month&category=Food
type ListResponse = {
  transactions: Transaction[];
  totals: { income: number; expense: number; net: number; count: number };
};

// POST /api/transactions
type CreateBody = {
  amount: number;
  type: "income" | "expense";
  description: string;
  occurred_on: string;   // "YYYY-MM-DD"
  category: string;
};

// GET /api/analytics?period=month
type AnalyticsResponse = {
  byCategory: { category: string; expense: number; income: number }[];
  dailyTotals: { date: string; expense: number; income: number }[];
  monthTrend: { month: string; expense: number; income: number; net: number }[];
  topExpenses: Transaction[]; // length ≤ 5
};

// GET /api/bills
type BillsResponse = {
  upcoming: Bill[];
  due_week: Bill[];
  paid: Bill[];
  overdue: Bill[];
};
```

---

## M6 — Expo mobile app (full parity)

**Why:** Mobile-first is in our DNA, but a real native app beats mobile web for daily logging, biometrics, push, and widgets later.

**Scope:**
- Bootstrap a sibling folder `mobile/` with `npx create-expo-app -t expo-template-blank-typescript`. Add Expo Router.
- Install:
  - `@clerk/clerk-expo`
  - `react-native-svg`
  - `victory-native` (Recharts isn't RN-compatible — Victory gives equivalent pie/area/bar primitives)
  - `@react-native-async-storage/async-storage` (Clerk token cache)
  - `zustand`, `zod`
- **Navigation (Expo Router tabs):**
  - **Home** — Dashboard equivalent (summary cards + custom bar chart, ported)
  - **Analytics** — Victory charts
  - **Bills** — Kanban, but horizontally-paged columns (drag across columns is awkward on small screens; instead **long-press a card → action sheet** with destination columns)
  - **Profile** — Clerk `<UserProfile />`
- Use the M5 API routes for all data. No direct Supabase calls.
- Shared types: copy `src/lib/types.ts` to `mobile/types.ts` for v1. A real shared package is premature with only one consumer.
- Clerk Expo wraps `_layout.tsx` with `<ClerkProvider tokenCache={...}>`. Sign-in screen uses Clerk's prebuilt UI with OAuth (Google, Apple) + email magic link.
- Port design tokens from `globals.css` into `mobile/theme.ts` (light/dark objects). Build a `useTheme()` hook that respects system theme.

**Acceptance test:**
- Sign in on Expo Go with the same Clerk account as web → see identical data.
- Add a transaction on mobile → refresh web → it appears.
- Drag-equivalent (long-press → "Mark as Paid") on a bill triggers the same server-side flow.
- Sign out on mobile → web session unaffected (Clerk handles per-device sessions).

**Schema / env:**
- New file `mobile/.env` with `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_BASE_URL` (pointing at deployed Next.js URL, or your laptop IP in dev).

---

## M7 — Responsive, performance, security pass

**Why:** Production hardening. Everything that's been built so far should now work great on a 360px phone *and* a 1440px desktop, load fast, and reject malformed input gracefully.

**Scope:**

**Responsive:**
- Dashboard breaks out of the `max-w-md` jail at `md:` (2-col: summary + chart side-by-side) and `lg:` (3-col with history beside).
- Analytics and Bills get desktop layouts — sidebar filters on `lg+`, multi-column grid for charts.
- Touch targets ≥ 44×44px on mobile (audit existing icon buttons).

**Code splitting / lazy:**
- All Recharts panels, the Kanban board, and `AddTransactionSheet` use `next/dynamic({ ssr: false, loading: <Skeleton /> })`.
- Mobile uses `React.lazy` + `Suspense` for heavy screens (Analytics, Bills).

**Reusable primitives:**
- Extract `Button`, `Card`, `Sheet`, `Field`, `Chip`, `Segmented` into `src/components/ui/` (web) and `mobile/components/ui/` (RN).
- One API per primitive across platforms wherever possible (`<Button variant="primary" size="md" />`).

**State:**
- Introduce **Zustand** for: current period filter, optimistic transaction queue, optimistic bill drag state.
- Keep local `useState` for sheet open/close and form drafts.

**Performance:**
- Memoize chart data builders (most are already in [src/lib/format.ts](src/lib/format.ts) — verify).
- Run `@next/bundle-analyzer`; target LCP < 1.5s on a mid-range mobile device.
- Compress images / fonts (`next/font` already in use).

**Security:**
- Zod at every API boundary (M0 + M5 covered most — verify all routes).
- Rate-limit `/api/*` with `@upstash/ratelimit` (10 req / 10s / user).
- Add a strict CSP header in `next.config.ts`.
- Never log raw user IDs — hash them.
- Strip stack traces from error responses in production.

**Acceptance test:**
- Lighthouse on a deployed preview: all four scores ≥ 90 on mobile + desktop.
- Bundle analyzer: Recharts is in its own chunk, not initial bundle.
- Try a malformed payload at every API route — all return 400 with a typed Zod error.
- Hammer an endpoint 50 times in a second — get 429.

**Schema / env:**
- New env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

---

## M8 — Documentation + CI

**Why:** Keep CLAUDE.md (and future contributors) accurate, prevent regressions on PRs.

**Scope:**
- Update `CLAUDE.md` to reflect new architecture: Clerk replaces Supabase Auth, per-user RLS, API routes, mobile app.
- New `mobile/README.md` with: prereqs, `npm install`, `npx expo start`, env setup, testing on real device.
- GitHub Actions workflow `.github/workflows/ci.yml`: on every PR, run `npm run lint`, `npm run build`, and the same for `mobile/` (`npx expo lint` + `tsc --noEmit`).

**Acceptance test:**
- Open a PR with a deliberate type error → CI fails red.
- Fix the error → CI goes green.

**Schema / env:** None.

---

## Verification — how to know the whole thing works

After each milestone:
1. `npm run build` (web) — must be green.
2. The milestone's **Acceptance test** block passes manually.
3. For DB-touching milestones: re-run the SQL in the Supabase SQL editor, confirm schema with `\d transactions` / `\d bills`.
4. For mobile milestones: `npx expo start` and verify on Expo Go on a real phone — web responsive mode is not a substitute.
5. After M5: run the `curl` suite from the API contract section.
6. After M7: Lighthouse run on a deployed preview (Vercel) — all four scores ≥ 90 on mobile.

---

## M9+ — Stickiness & revenue — pick what excites you

These are **not committed scope**. They're a menu for after M0–M8 ship. Order roughly by ROI per hour of work.

### Daily-habit loops (free, increase retention)

1. **Streak counter.** Consecutive days the user logged at least one transaction. Subtle flame icon in the header that grows. **Streak freeze** (1/week) so a missed day doesn't sting. Cheap to build; massively sticky.
2. **End-of-day "Money Minute"** push notification at user's chosen time: *"30 seconds — log today's spend?"* Tapping opens directly into the Add sheet. Mobile-only.
3. **Confetti micro-rewards.** Framer Motion confetti when crossing weekly/monthly savings goals. Trivial to build, deeply satisfying.
4. **Personal records.** *"Lowest spend week ever"*, *"First month under budget"*, surfaced as banner cards.
5. **AI insights nudge.** *"You're 18% over your usual coffee spend this month. Want to set a cap?"* One LLM call against anonymized category totals.

### Gamification with substance (not gimmicky)

6. **Money personality + level system.** XP for: logging on time (+10/day), staying under category budgets (+50), hitting savings goals (+200). Level titles ("Frugal Apprentice → Budget Sensei → Money Monk") that feel earned, not corny.
7. **Achievement badges.** *No-spend day*, *Logged 7 days straight*, *Saved ₹10k in a month*, *Logged a transaction in every category*. Badges live on a profile page; tapping shows the date earned.
8. **Themed challenges.** *Coffee-free week*, *₹100/day challenge*, *No-eat-out month*. Opt-in, with a progress bar on the dashboard.
9. **Money garden / pet.** A tiny ambient avatar that thrives when you log + stay under budget, wilts when you overspend. Think Forest app, but for money. Lives in the header. This is the kind of thing that makes the app feel alive.

### Social / accountability (network effect)

10. **Anonymous benchmarks.** *"You spent less on food than 73% of people in your city this month."* Aggregated only, never per-user.
11. **Couples / household mode.** Shared wallet view, split bills, who paid what. Many money apps under-serve this and people *pay* for it.
12. **Accountability buddy.** Opt-in: pair with a friend who sees only your *streak* and *savings goal progress*, not amounts.

### Power features people pay for (the monetization tier)

13. **Auto-import via bank statement / SMS / email parsing.** Paste a bank PDF or upload, parse with an LLM, propose transactions to confirm. **This alone is worth a subscription in India.** Build it as the headline of M9.
14. **Recurring detection.** Algorithm finds recurring outflows (Netflix, gym, EMIs) automatically and creates Bills.
15. **Forecasting.** *"At this rate you'll end the month ₹4,200 short of your savings goal."* Simple linear projection from `chartBuckets` data.
16. **Custom categories + tags + multi-currency.** Power users love this. Multi-currency is essential for travelers and freelancers.
17. **Export to CSV / PDF + tax-ready reports.** Annual report with cute charts, shareable image card for socials.
18. **Cloud receipts.** Attach a photo to a transaction; OCR-extracts amount + merchant.
19. **Widgets + Apple Watch + Wear OS complication.** The "30-second logger" on your wrist. Massive engagement multiplier on mobile.
20. **Family plan / shared household.** Premium tier, multiple users on one space.

### Suggested pricing shape (a thought, not a commitment)

| Tier | Price | What's in it |
|---|---|---|
| **Free** | ₹0 | Unlimited transactions, basic analytics, 1 active bill recurrence, 1-month history |
| **Pro** | ~₹199/mo or ₹1,499/yr | Bank-statement import, unlimited recurrence, forecasting, multi-currency, exports, receipts, watch widget |
| **Family** | ~₹349/mo | Pro + up to 4 shared members + couples mode |

The **wedge feature** — the one that flips people from "this is a nice tracker" to "I'll pay for this" — is almost certainly **#13 (auto-import)**. Build it as the headline of M9.

---

## Out of scope (for v1 of this PRD)

- Native iOS/Android via Swift/Kotlin (Expo covers both).
- A web extension or browser autofill.
- Crypto / investment tracking.
- Multi-language / i18n beyond English (the existing `LOCALE` constant handles INR formatting cleanly).
- A public REST API for 3rd-party developers (M5 routes exist, but no public docs, keys, or rate-limit tiers yet).

---

## Open questions to revisit later

- Do we want a **web onboarding flow** between sign-up and the dashboard? (e.g. "set your monthly budget, pick a savings goal")
- How long do we keep transactions on Free tier? 1 month is suggested above — could be 6 months to reduce buyer's-remorse churn.
- Should the **Money Minute** notification ship as part of M6 (mobile) or M9 (engagement)?
