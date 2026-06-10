-- M4 — Bills / Subscriptions Kanban.
-- A workflow board: Upcoming → Due This Week → Paid → Overdue.
-- "status" is a sticky override; the app also recomputes effective status
-- from `due_on` vs today on read so cards age correctly without writes.

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
