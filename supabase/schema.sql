-- MoneyFlow schema — run this in Supabase → SQL Editor → New query → Run.
-- For an existing DB, prefer the milestone migrations in supabase/migrations/.

-- `gen_random_uuid()` lives in pgcrypto. Supabase enables it by default, but
-- declare it so this file is portable to any Postgres.
create extension if not exists pgcrypto;

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


-- ----------------------------------------------------------------------------
-- mark_bill_paid(uuid) — atomic "drag-to-paid" flow.
-- Does the bill update, the expense mirror, and the next-period clone in one
-- transaction so partial failures can't leave bookkeeping out of sync.
-- See 0004_mark_bill_paid_rpc.sql for the full rationale.
-- ----------------------------------------------------------------------------
create or replace function public.mark_bill_paid(p_bill_id uuid)
returns public.bills
language plpgsql
as $$
declare
  v_bill       public.bills;
  v_today      date := current_date;
  v_next_due   date;
begin
  update public.bills
     set status  = 'paid',
         paid_on = v_today
   where id = p_bill_id
  returning * into v_bill;

  if not found then
    raise exception 'bill_not_found' using errcode = 'P0002';
  end if;

  insert into public.transactions (
    user_id, amount, type, description, category, occurred_on
  ) values (
    v_bill.user_id,
    round(v_bill.amount::numeric, 2),
    'expense',
    'Paid: ' || v_bill.name,
    'Bills',
    v_today
  );

  case v_bill.recurrence
    when 'weekly'  then v_next_due := v_bill.due_on + interval '7 days';
    when 'monthly' then v_next_due := (v_bill.due_on + interval '1 month')::date;
    when 'yearly'  then v_next_due := (v_bill.due_on + interval '1 year')::date;
    else                v_next_due := null;
  end case;

  if v_next_due is not null then
    insert into public.bills (
      user_id, name, amount, due_on, status, recurrence
    ) values (
      v_bill.user_id, v_bill.name, v_bill.amount, v_next_due, 'upcoming', v_bill.recurrence
    );
  end if;

  return v_bill;
end;
$$;

revoke all on function public.mark_bill_paid(uuid) from public;
grant execute on function public.mark_bill_paid(uuid) to authenticated;


-- ============================================================================
-- M9: Spaces — privacy-scoped shared expense splitting.
-- Mirror of supabase/migrations/0005_spaces.sql + 0006_spaces_rpcs.sql.
-- ============================================================================
--
-- All user ids are Clerk text ids (auth.jwt() ->> 'sub'), matching the existing
-- transactions/bills convention — there is no auth.users dependency.

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table if not exists public.spaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.space_members (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces(id) on delete cascade,
  user_id       text not null,
  display_name  text not null,
  role          text not null check (role in ('owner', 'member')) default 'member',
  created_at    timestamptz not null default now(),
  unique (space_id, user_id)
);

create table if not exists public.space_invites (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  token       text not null unique,
  email       text,
  invited_by  text not null,
  status      text not null check (status in ('pending', 'accepted', 'revoked')) default 'pending',
  created_at  timestamptz not null default now()
);

create table if not exists public.shared_expenses (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces(id) on delete cascade,
  payer_id     text not null,
  amount       numeric(12, 2) not null check (amount > 0),
  description  text not null,
  category     text not null default 'Other',
  occurred_on  date not null default current_date,
  created_at   timestamptz not null default now()
);

-- One row per participant. This table IS the visibility list: you can see an
-- expense iff you paid it or you have a row here for it.
create table if not exists public.expense_participants (
  id            uuid primary key default gen_random_uuid(),
  expense_id    uuid not null references public.shared_expenses(id) on delete cascade,
  user_id       text not null,
  share_amount  numeric(12, 2) not null check (share_amount >= 0),
  unique (expense_id, user_id)
);

create table if not exists public.settlements (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces(id) on delete cascade,
  from_user    text not null,
  to_user      text not null,
  amount       numeric(12, 2) not null check (amount > 0),
  occurred_on  date not null default current_date,
  note         text,
  created_at   timestamptz not null default now(),
  check (from_user <> to_user)
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists space_members_space_idx   on public.space_members (space_id);
create index if not exists space_members_user_idx     on public.space_members (user_id);
create index if not exists space_invites_space_idx     on public.space_invites (space_id);
create index if not exists shared_expenses_space_idx   on public.shared_expenses (space_id, occurred_on desc);
create index if not exists shared_expenses_payer_idx   on public.shared_expenses (payer_id);
create index if not exists expense_participants_exp_idx on public.expense_participants (expense_id);
create index if not exists expense_participants_user_idx on public.expense_participants (user_id);
create index if not exists settlements_space_idx        on public.settlements (space_id);
create index if not exists settlements_parties_idx      on public.settlements (from_user, to_user);

-- ----------------------------------------------------------------------------
-- SECURITY DEFINER helper functions
--
-- Membership / visibility checks must read the very tables their policies
-- guard, which would recurse if done inline. Running the check inside a
-- definer function breaks the cycle (RLS is not re-applied inside it).
--
-- Hardening (all mandatory for an owner-privileged function):
--   * language sql       — no dynamic execution, inlinable, minimal surface.
--   * stable             — same inputs → same result within a statement; lets
--                          the planner call it once instead of per-row.
--   * set search_path ='' — prevents a caller from shadowing public.* with a
--                          malicious table on their own search_path.
--   * every object fully schema-qualified (forced by the empty search_path).
-- The checked user is passed as a parameter (not read from auth.jwt() inside),
-- so the policy supplies auth.jwt()->>'sub' in invoker context.
-- ----------------------------------------------------------------------------
create or replace function public.is_space_member(p_space_id uuid, p_user text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = p_space_id and m.user_id = p_user
  );
$$;
revoke all on function public.is_space_member(uuid, text) from public;
grant execute on function public.is_space_member(uuid, text) to authenticated;

create or replace function public.can_see_expense(p_expense_id uuid, p_user text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shared_expenses e
    where e.id = p_expense_id and e.payer_id = p_user
  ) or exists (
    select 1 from public.expense_participants p
    where p.expense_id = p_expense_id and p.user_id = p_user
  );
$$;
revoke all on function public.can_see_expense(uuid, text) from public;
grant execute on function public.can_see_expense(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.spaces               enable row level security;
alter table public.space_members        enable row level security;
alter table public.space_invites        enable row level security;
alter table public.shared_expenses      enable row level security;
alter table public.expense_participants enable row level security;
alter table public.settlements          enable row level security;

-- spaces ---------------------------------------------------------------------
drop policy if exists "spaces_member_select" on public.spaces;
drop policy if exists "spaces_creator_insert" on public.spaces;
drop policy if exists "spaces_creator_update" on public.spaces;
drop policy if exists "spaces_creator_delete" on public.spaces;

create policy "spaces_member_select" on public.spaces for select to authenticated
  using (public.is_space_member(id, auth.jwt() ->> 'sub'));
create policy "spaces_creator_insert" on public.spaces for insert to authenticated
  with check (created_by = auth.jwt() ->> 'sub');
create policy "spaces_creator_update" on public.spaces for update to authenticated
  using (created_by = auth.jwt() ->> 'sub')
  with check (created_by = auth.jwt() ->> 'sub');
create policy "spaces_creator_delete" on public.spaces for delete to authenticated
  using (created_by = auth.jwt() ->> 'sub');

-- space_members --------------------------------------------------------------
-- Roster is visible to members (you must know who you can split with). No
-- direct INSERT: joining happens via the accept_invite RPC. Members can leave
-- (delete their own row); the owner can remove others.
drop policy if exists "members_select" on public.space_members;
drop policy if exists "members_self_delete" on public.space_members;
drop policy if exists "members_owner_delete" on public.space_members;

create policy "members_select" on public.space_members for select to authenticated
  using (public.is_space_member(space_id, auth.jwt() ->> 'sub'));
create policy "members_self_delete" on public.space_members for delete to authenticated
  using (user_id = auth.jwt() ->> 'sub');
create policy "members_owner_delete" on public.space_members for delete to authenticated
  using (exists (
    select 1 from public.spaces s
    where s.id = space_id and s.created_by = auth.jwt() ->> 'sub'
  ));

-- space_invites --------------------------------------------------------------
-- No SELECT for non-members (reads go through get_invite_by_token, which only
-- returns a row for the exact secret token). Owners/members of the space can
-- read + create invites for it.
drop policy if exists "invites_member_select" on public.space_invites;
drop policy if exists "invites_member_insert" on public.space_invites;
drop policy if exists "invites_member_update" on public.space_invites;

create policy "invites_member_select" on public.space_invites for select to authenticated
  using (public.is_space_member(space_id, auth.jwt() ->> 'sub'));
create policy "invites_member_insert" on public.space_invites for insert to authenticated
  with check (
    invited_by = auth.jwt() ->> 'sub'
    and public.is_space_member(space_id, auth.jwt() ->> 'sub')
  );
create policy "invites_member_update" on public.space_invites for update to authenticated
  using (public.is_space_member(space_id, auth.jwt() ->> 'sub'))
  with check (public.is_space_member(space_id, auth.jwt() ->> 'sub'));

-- shared_expenses ------------------------------------------------------------
-- THE PRIVACY CORE: visible only to payer + participants.
drop policy if exists "expenses_visible_select" on public.shared_expenses;
drop policy if exists "expenses_payer_insert" on public.shared_expenses;
drop policy if exists "expenses_payer_update" on public.shared_expenses;
drop policy if exists "expenses_payer_delete" on public.shared_expenses;

create policy "expenses_visible_select" on public.shared_expenses for select to authenticated
  using (public.can_see_expense(id, auth.jwt() ->> 'sub'));
create policy "expenses_payer_insert" on public.shared_expenses for insert to authenticated
  with check (
    payer_id = auth.jwt() ->> 'sub'
    and public.is_space_member(space_id, auth.jwt() ->> 'sub')
  );
create policy "expenses_payer_update" on public.shared_expenses for update to authenticated
  using (payer_id = auth.jwt() ->> 'sub')
  with check (payer_id = auth.jwt() ->> 'sub');
create policy "expenses_payer_delete" on public.shared_expenses for delete to authenticated
  using (payer_id = auth.jwt() ->> 'sub');

-- expense_participants -------------------------------------------------------
-- Same visibility as the parent expense. Insert only allowed by the expense's
-- payer (you split your own expense).
drop policy if exists "participants_visible_select" on public.expense_participants;
drop policy if exists "participants_payer_insert" on public.expense_participants;
drop policy if exists "participants_payer_delete" on public.expense_participants;

create policy "participants_visible_select" on public.expense_participants for select to authenticated
  using (public.can_see_expense(expense_id, auth.jwt() ->> 'sub'));
create policy "participants_payer_insert" on public.expense_participants for insert to authenticated
  with check (exists (
    select 1 from public.shared_expenses e
    where e.id = expense_id and e.payer_id = auth.jwt() ->> 'sub'
  ));
create policy "participants_payer_delete" on public.expense_participants for delete to authenticated
  using (exists (
    select 1 from public.shared_expenses e
    where e.id = expense_id and e.payer_id = auth.jwt() ->> 'sub'
  ));

-- settlements ----------------------------------------------------------------
-- Visible only to the two parties.
drop policy if exists "settlements_party_select" on public.settlements;
drop policy if exists "settlements_party_insert" on public.settlements;

create policy "settlements_party_select" on public.settlements for select to authenticated
  using (from_user = auth.jwt() ->> 'sub' or to_user = auth.jwt() ->> 'sub');
create policy "settlements_party_insert" on public.settlements for insert to authenticated
  with check (
    (from_user = auth.jwt() ->> 'sub' or to_user = auth.jwt() ->> 'sub')
    and public.is_space_member(space_id, auth.jwt() ->> 'sub')
  );

-- create_space — make a space and add the creator as its owner member, atomically.
--
-- security definer: the space_members table has no direct INSERT policy (joins
-- go through accept_invite), so the owner's first membership row is inserted
-- here under the function owner's rights. Safe because the inserted user_id is
-- derived from auth.jwt(), never from a parameter. p_display_name is the
-- creator's Clerk name, resolved at the edge.
-- ----------------------------------------------------------------------------
create or replace function public.create_space(p_name text, p_display_name text)
returns public.spaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   text := auth.jwt() ->> 'sub';
  v_space public.spaces;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  insert into public.spaces (name, created_by)
  values (p_name, v_uid)
  returning * into v_space;

  insert into public.space_members (space_id, user_id, display_name, role)
  values (v_space.id, v_uid, coalesce(nullif(p_display_name, ''), v_uid), 'owner');

  return v_space;
end;
$$;
revoke all on function public.create_space(text, text) from public;
grant execute on function public.create_space(text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- create_shared_expense — insert the expense + its participant rows + mirror
-- the PAYER's own share into their personal transactions, atomically.
--
-- security invoker (default): RLS applies, so the insert checks enforce that
-- the caller is a member and is the payer. p_participants is a JSON array of
-- { "user_id": "...", "share_amount": 12.34 }.
-- ----------------------------------------------------------------------------
create or replace function public.create_shared_expense(
  p_space_id     uuid,
  p_amount       numeric,
  p_description  text,
  p_category     text,
  p_occurred_on  date,
  p_participants jsonb
)
returns public.shared_expenses
language plpgsql
as $$
declare
  v_uid       text := auth.jwt() ->> 'sub';
  v_expense   public.shared_expenses;
  v_sum       numeric;
  v_my_share  numeric;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  -- Shares must reconcile to the total (allow a sub-cent rounding slack).
  select coalesce(sum((p->>'share_amount')::numeric), 0)
    into v_sum
    from jsonb_array_elements(p_participants) p;

  if abs(v_sum - p_amount) > 0.005 then
    raise exception 'shares_do_not_sum' using errcode = 'P0001';
  end if;

  -- Insert the expense. RLS insert check enforces payer = caller + membership.
  insert into public.shared_expenses (space_id, payer_id, amount, description, category, occurred_on)
  values (p_space_id, v_uid, round(p_amount, 2), p_description, coalesce(nullif(p_category, ''), 'Other'), coalesce(p_occurred_on, current_date))
  returning * into v_expense;

  -- Insert participant rows.
  insert into public.expense_participants (expense_id, user_id, share_amount)
  select v_expense.id, p->>'user_id', round((p->>'share_amount')::numeric, 2)
    from jsonb_array_elements(p_participants) p;

  -- Mirror the payer's OWN share into their personal ledger (if they're a
  -- participant). Keeps personal analytics accurate without double entry.
  -- We only ever write the caller's own user_id, so RLS on transactions is
  -- satisfied. Non-payer shares are intentionally not mirrored (see plan).
  select round((p->>'share_amount')::numeric, 2)
    into v_my_share
    from jsonb_array_elements(p_participants) p
   where p->>'user_id' = v_uid
   limit 1;

  if v_my_share is not null and v_my_share > 0 then
    insert into public.transactions (user_id, amount, type, description, category, occurred_on)
    values (v_uid, v_my_share, 'expense', 'Shared: ' || p_description, coalesce(nullif(p_category, ''), 'Other'), v_expense.occurred_on);
  end if;

  return v_expense;
end;
$$;
revoke all on function public.create_shared_expense(uuid, numeric, text, text, date, jsonb) from public;
grant execute on function public.create_shared_expense(uuid, numeric, text, text, date, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- my_balances — per-counterparty net for the calling user in a space.
--
-- security invoker so it can only sum rows the caller is allowed to see (RLS
-- filters every join) — leak-proof by construction. Positive net = the
-- counterparty will pay me; negative = I will pay them.
-- ----------------------------------------------------------------------------
create or replace function public.my_balances(p_space_id uuid)
returns table (counterparty text, net numeric)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  with me as (select auth.jwt() ->> 'sub' as uid),
  legs as (
    -- they owe me: I paid, they're a participant
    select p.user_id as cp, p.share_amount as amt
      from public.shared_expenses e
      join public.expense_participants p on p.expense_id = e.id
      cross join me
     where e.space_id = p_space_id and e.payer_id = me.uid and p.user_id <> me.uid
    union all
    -- I owe them: they paid, I'm a participant
    select e.payer_id as cp, -p.share_amount as amt
      from public.shared_expenses e
      join public.expense_participants p on p.expense_id = e.id
      cross join me
     where e.space_id = p_space_id and p.user_id = me.uid and e.payer_id <> me.uid
    union all
    -- settlements I paid out reduce what I owe (or push them into my credit)
    select s.to_user as cp, -s.amount as amt
      from public.settlements s cross join me
     where s.space_id = p_space_id and s.from_user = me.uid
    union all
    -- settlements paid to me
    select s.from_user as cp, s.amount as amt
      from public.settlements s cross join me
     where s.space_id = p_space_id and s.to_user = me.uid
  )
  select cp, sum(amt) as net
    from legs
   group by cp
  having round(sum(amt), 2) <> 0;
$$;
revoke all on function public.my_balances(uuid) from public;
grant execute on function public.my_balances(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- get_invite_by_token — preview an invite before joining. Definer so a
-- not-yet-member can read the single matching row; returns nothing without the
-- exact secret token (no enumeration).
-- ----------------------------------------------------------------------------
create or replace function public.get_invite_by_token(p_token text)
returns table (space_id uuid, space_name text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.space_id, s.name, i.status
    from public.space_invites i
    join public.spaces s on s.id = i.space_id
   where i.token = p_token;
$$;
revoke all on function public.get_invite_by_token(text) from public;
grant execute on function public.get_invite_by_token(text) to authenticated;

-- ----------------------------------------------------------------------------
-- accept_invite — how a non-member gets their first membership row. Definer so
-- it can insert into space_members on the caller's behalf after validating the
-- token. Idempotent (double-click / already-member both no-op).
-- ----------------------------------------------------------------------------
create or replace function public.accept_invite(p_token text, p_display_name text)
returns public.space_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     text := auth.jwt() ->> 'sub';
  v_inv     public.space_invites;
  v_member  public.space_members;
  v_name    text;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  select * into v_inv
    from public.space_invites
   where token = p_token and status = 'pending'
     for update;

  if not found then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;

  v_name := coalesce(nullif(p_display_name, ''), nullif(v_inv.email, ''), v_uid);

  insert into public.space_members (space_id, user_id, display_name, role)
  values (v_inv.space_id, v_uid, v_name, 'member')
  on conflict (space_id, user_id) do nothing
  returning * into v_member;

  -- Already a member → fetch the existing row so the return is well-defined.
  if v_member.id is null then
    select * into v_member
      from public.space_members
     where space_id = v_inv.space_id and user_id = v_uid;
  end if;

  update public.space_invites set status = 'accepted' where id = v_inv.id;
  return v_member;
end;
$$;
revoke all on function public.accept_invite(text, text) from public;
grant execute on function public.accept_invite(text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- record_settlement — log a payment between two members. The caller must be
-- one of the two parties (RLS on settlements also enforces this), both must be
-- members, and the parties must differ. Taking both from_user and to_user lets
-- the UI record "I paid them" OR "they paid me" with one function.
-- ----------------------------------------------------------------------------
create or replace function public.record_settlement(
  p_space_id    uuid,
  p_from_user   text,
  p_to_user     text,
  p_amount      numeric,
  p_occurred_on date,
  p_note        text
)
returns public.settlements
language plpgsql
as $$
declare
  v_uid        text := auth.jwt() ->> 'sub';
  v_settlement public.settlements;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if p_from_user = p_to_user then
    raise exception 'cannot_settle_with_self' using errcode = 'P0001';
  end if;
  if v_uid <> p_from_user and v_uid <> p_to_user then
    raise exception 'not_a_party' using errcode = 'P0001';
  end if;
  if not public.is_space_member(p_space_id, p_from_user)
     or not public.is_space_member(p_space_id, p_to_user) then
    raise exception 'not_both_members' using errcode = 'P0001';
  end if;

  insert into public.settlements (space_id, from_user, to_user, amount, occurred_on, note)
  values (p_space_id, p_from_user, p_to_user, round(p_amount, 2), coalesce(p_occurred_on, current_date), p_note)
  returning * into v_settlement;

  return v_settlement;
end;
$$;
revoke all on function public.record_settlement(uuid, text, text, numeric, date, text) from public;
grant execute on function public.record_settlement(uuid, text, text, numeric, date, text) to authenticated;
