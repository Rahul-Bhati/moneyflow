-- M2: Add user_id, per-user index, and Clerk-aware RLS policies.
-- Run this in Supabase → SQL Editor.

-- 1. Add the column. (Nullable for now so the migration succeeds on a populated table.)
alter table public.transactions add column if not exists user_id text;

-- 2. Backfill or wipe existing rows.
--    DEV: throw away pre-auth rows so the not-null switch can land.
delete from public.transactions where user_id is null;
--    PROD instead: update with the owner's Clerk user id, e.g.
--    update public.transactions set user_id = 'user_xxx' where user_id is null;

-- 3. Lock the column down.
alter table public.transactions alter column user_id set not null;

-- 4. Replace the old date-only index with a (user_id, occurred_on) index.
drop index if exists public.transactions_occurred_on_idx;
create index if not exists transactions_user_occurred_idx
  on public.transactions (user_id, occurred_on desc, created_at desc);

-- 5. Enforce RLS scoped by the Clerk-issued JWT.
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
