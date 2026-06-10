-- MoneyFlow schema — run this in Supabase → SQL Editor → New query → Run.
-- For an existing DB, prefer the milestone migrations in supabase/migrations/.

create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  amount       numeric(12, 2) not null check (amount > 0),
  type         text not null check (type in ('expense', 'income')),
  description  text,
  category     text not null default 'Uncategorized',
  occurred_on  date not null default current_date,
  created_at   timestamptz not null default now()
);

-- Fast per-user lookups by date (newest first).
create index if not exists transactions_user_occurred_idx
  on public.transactions (user_id, occurred_on desc, created_at desc);

-- Cheap lookup for category-grouped queries on a user.
create index if not exists transactions_user_category_idx
  on public.transactions (user_id, category);

-- Row Level Security: each user only ever sees their own rows.
-- The app no longer uses the SERVICE_ROLE key for user data — it uses the
-- ANON key together with a Clerk-issued JWT (Authorization: Bearer <token>),
-- and these policies enforce `auth.jwt() ->> 'sub' = user_id`.
alter table public.transactions enable row level security;

drop policy if exists "transactions_owner_select" on public.transactions;
drop policy if exists "transactions_owner_insert" on public.transactions;
drop policy if exists "transactions_owner_update" on public.transactions;
drop policy if exists "transactions_owner_delete" on public.transactions;

create policy "transactions_owner_select"
  on public.transactions for select
  to authenticated
  using (auth.jwt() ->> 'sub' = user_id);

create policy "transactions_owner_insert"
  on public.transactions for insert
  to authenticated
  with check (auth.jwt() ->> 'sub' = user_id);

create policy "transactions_owner_update"
  on public.transactions for update
  to authenticated
  using (auth.jwt() ->> 'sub' = user_id)
  with check (auth.jwt() ->> 'sub' = user_id);

create policy "transactions_owner_delete"
  on public.transactions for delete
  to authenticated
  using (auth.jwt() ->> 'sub' = user_id);


-- ----------------------------------------------------------------------------
-- Bills / Subscriptions (M4) — Kanban workflow board.
-- Columns: upcoming → due_week → paid → overdue.
-- `status` is the user's explicit choice (sticky); the app also recomputes
-- effective status from `due_on` vs today on read so cards age naturally.
-- ----------------------------------------------------------------------------
create table if not exists public.bills (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  name         text not null,
  amount       numeric(12, 2) not null check (amount > 0),
  due_on       date not null,
  status       text not null
                 check (status in ('upcoming', 'due_week', 'paid', 'overdue'))
                 default 'upcoming',
  recurrence   text not null
                 check (recurrence in ('none', 'weekly', 'monthly', 'yearly'))
                 default 'none',
  paid_on      date,
  created_at   timestamptz not null default now()
);

create index if not exists bills_user_due_idx
  on public.bills (user_id, due_on);

create index if not exists bills_user_status_idx
  on public.bills (user_id, status);

alter table public.bills enable row level security;

drop policy if exists "bills_owner_select" on public.bills;
drop policy if exists "bills_owner_insert" on public.bills;
drop policy if exists "bills_owner_update" on public.bills;
drop policy if exists "bills_owner_delete" on public.bills;

create policy "bills_owner_select"
  on public.bills for select
  to authenticated
  using (auth.jwt() ->> 'sub' = user_id);

create policy "bills_owner_insert"
  on public.bills for insert
  to authenticated
  with check (auth.jwt() ->> 'sub' = user_id);

create policy "bills_owner_update"
  on public.bills for update
  to authenticated
  using (auth.jwt() ->> 'sub' = user_id)
  with check (auth.jwt() ->> 'sub' = user_id);

create policy "bills_owner_delete"
  on public.bills for delete
  to authenticated
  using (auth.jwt() ->> 'sub' = user_id);
