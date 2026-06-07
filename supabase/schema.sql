-- MoneyFlow schema — run this in Supabase → SQL Editor → New query → Run.

create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  amount       numeric(12, 2) not null check (amount > 0),
  type         text not null check (type in ('expense', 'income')),
  description  text,
  occurred_on  date not null default current_date,
  created_at   timestamptz not null default now()
);

-- Fast lookups by date (newest first).
create index if not exists transactions_occurred_on_idx
  on public.transactions (occurred_on desc, created_at desc);

-- Row Level Security is ON. The app talks to the database only from the
-- server using the SERVICE ROLE key, which bypasses RLS. No policies are
-- granted to the public/anon role, so the table is NOT readable with the
-- public anon key. This keeps your data private to the server.
alter table public.transactions enable row level security;
