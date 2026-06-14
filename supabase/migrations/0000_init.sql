-- M0 baseline: create the transactions table.
--
-- Why this exists: subsequent migrations (0001+) ALTER `public.transactions`,
-- so a fresh database needs that table to exist before they can run. Before
-- this file, the only way to bring up a clean DB was to run schema.sql, then
-- back-fit by skipping 0001's "add column user_id" step (which would error).
-- Now: `for f in supabase/migrations/*.sql; do psql -f $f; done` just works.
--
-- This file recreates the pre-M2 shape — nullable user_id is added in 0001,
-- categories in 0002, bills in 0003.

create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  amount       numeric(12, 2) not null check (amount > 0),
  type         text not null check (type in ('expense', 'income')),
  description  text,
  occurred_on  date not null default current_date,
  created_at   timestamptz not null default now()
);

-- The original date-only index. 0001 replaces it with a (user_id, occurred_on)
-- composite once user_id exists.
create index if not exists transactions_occurred_on_idx
  on public.transactions (occurred_on desc, created_at desc);
