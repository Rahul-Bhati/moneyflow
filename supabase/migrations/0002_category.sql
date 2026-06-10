-- M3: add a category column to transactions for analytics breakdowns.
-- Run after 0001_user_id_rls.sql.

alter table public.transactions
  add column if not exists category text not null default 'Uncategorized';

-- Cheap lookup for category-grouped queries on a user.
create index if not exists transactions_user_category_idx
  on public.transactions (user_id, category);
