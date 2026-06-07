# 💸 MoneyFlow

A calm, fast, mobile-first money tracker. Log what you **spend** and **earn**,
and see it roll up automatically by **day, week, month and year** — with a live
balance, an activity chart, and smooth Apple-style interactions. Dark & light
themes follow your phone automatically.

Built with **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
Framer Motion · Supabase (Postgres)**.

---

## Features

- ➕ One-tap **Add entry** sheet — amount, description, date, spent/earned toggle
- 📊 Auto totals for the selected period: **earned, spent, net balance**
- 🔀 **Day / Week / Month / Year** segmented filter
- 🗓️ History grouped by day, newest first, with **swipe-to-delete**
- 📈 Animated activity chart (in vs out)
- 🌗 Automatic **dark & light** mode
- 📱 Designed for mobile Chrome; installable as a home-screen app

---

## 1. Create the database (Supabase — free)

1. Go to <https://supabase.com> → **New project**. Pick a name and a strong
   database password, then wait ~1 min for it to provision.
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**.
3. Open **Project Settings → API** and copy two things:
   - **Project URL** → `SUPABASE_URL`
   - **`service_role` key** (under *Project API keys*) → `SUPABASE_SERVICE_ROLE_KEY`
     ⚠️ This is a secret. Keep it server-side only — never put it in client code.

## 2. Run it locally

```bash
npm install
cp .env.local.example .env.local   # then paste your two values in
npm run dev
```

Open <http://localhost:3000>.

## 3. Put it on your phone (deploy free with Vercel)

1. Push this folder to a GitHub repo.
2. Go to <https://vercel.com> → **Add New → Project** → import the repo.
3. In **Environment Variables**, add `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` (same values as your `.env.local`).
4. **Deploy**. Open the URL on your phone, then in Chrome use
   **⋮ → Add to Home screen** to use it like a native app.

---

## Make it yours

- **Currency / locale**: edit `CURRENCY` and `LOCALE` in `src/lib/types.ts`
  (defaults to `INR` / `en-IN` → ₹). Try `USD`/`en-US`, `EUR`/`de-DE`, etc.
- **Week start**: `WEEK_OPTS` in `src/lib/format.ts` (defaults to Monday).
- **Theme colours**: all design tokens live at the top of
  `src/app/globals.css` (`:root` for light, `.dark` for dark).

## A note on privacy

The app reads and writes the database **only from the server** using the
service-role key, so your data is never exposed through the browser. There's no
login, so anyone who knows your deployed URL could view the data — keep the URL
private, or add Supabase Auth if you want a password. The `transactions` table
has Row Level Security enabled with no public policies, so the public anon key
cannot read it.

## Project structure

```
src/
  app/
    layout.tsx        fonts, theme provider, metadata
    page.tsx          server component — fetches transactions
    actions.ts        server actions — add / delete
    globals.css       design tokens (light + dark)
  lib/
    types.ts          types + currency config
    format.ts         period math, totals, chart buckets, formatting
    supabaseServer.ts server-only Supabase client
  components/
    Dashboard.tsx        orchestrator (client)
    SegmentedFilter.tsx  day/week/month/year control
    SummaryCards.tsx     net / earned / spent
    AnimatedNumber.tsx   count-up money
    SpendChart.tsx       animated activity chart
    TransactionList.tsx  grouped history + swipe-to-delete
    AddTransactionSheet.tsx  FAB + bottom-sheet form
    ThemeToggle.tsx
    ThemeProvider.tsx
    SetupNotice.tsx
supabase/schema.sql
```
