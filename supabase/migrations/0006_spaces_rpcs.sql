-- M9: atomic RPCs for Spaces. Depends on 0005_spaces.sql.
--
-- Pattern follows mark_bill_paid (0004): each is one transaction, grants are
-- revoked from public + granted to authenticated. Mutating user ids are always
-- derived from auth.jwt() ->> 'sub' inside the function — never trusted from a
-- client parameter.

-- ----------------------------------------------------------------------------
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
