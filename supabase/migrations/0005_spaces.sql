-- M9: Spaces — privacy-scoped shared expense splitting.
--
-- A Space is a roster of people you transact with. Every shared expense names
-- its participants, and an expense is visible ONLY to its payer + participants.
-- A member who is NOT in an expense can never see it — not even the Space
-- creator. This file defines the tables, indexes, RLS, and the two
-- SECURITY DEFINER helper functions the policies depend on. The atomic write
-- RPCs live in 0006_spaces_rpcs.sql.
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
