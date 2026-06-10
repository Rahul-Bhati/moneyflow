-- M9-prep: make "mark bill paid" atomic.
--
-- Background: the JS flow was three sequential writes:
--   1. update bills set status='paid', paid_on=today where id=...
--   2. insert into transactions (...)            -- mirror as an expense
--   3. insert into bills (...)                   -- clone for next period
--
-- If step 2 or 3 failed, step 1 was already committed. The bill showed as
-- paid in the UI but the expense was missing and the recurrence chain broke.
-- We logged the failure and shipped a smile.
--
-- This function does all three in a single transaction. Either everything
-- lands or nothing does. `security invoker` (the default) is important:
-- it preserves the calling user's identity so RLS still enforces ownership
-- on every row touched. We do NOT use `security definer` here — that would
-- bypass RLS and we'd have to re-implement the auth check by hand.

create or replace function public.mark_bill_paid(p_bill_id uuid)
returns public.bills
language plpgsql
as $$
declare
  v_bill       public.bills;
  v_today      date := current_date;
  v_next_due   date;
begin
  -- Step 1: stamp the bill paid. RLS scopes this to the calling user; if
  -- they don't own this id (or it doesn't exist), the update returns 0 rows
  -- and we bail with a clean error.
  update public.bills
     set status  = 'paid',
         paid_on = v_today
   where id = p_bill_id
  returning * into v_bill;

  if not found then
    raise exception 'bill_not_found' using errcode = 'P0002';
  end if;

  -- Step 2: mirror as an expense transaction. The user_id is taken from the
  -- bill row (already RLS-checked), not from the JWT, to keep them in sync
  -- even if some future change tweaks the auth shape.
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

  -- Step 3: for recurring bills, schedule the next period. Month-end safety
  -- (Jan 31 → Feb 28/29) is handled by Postgres's interval math; for "none"
  -- recurrence we just skip.
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
      v_bill.user_id,
      v_bill.name,
      v_bill.amount,
      v_next_due,
      'upcoming',
      v_bill.recurrence
    );
  end if;

  return v_bill;
end;
$$;

-- Let signed-in users call it. RLS does the ownership work inside.
revoke all on function public.mark_bill_paid(uuid) from public;
grant execute on function public.mark_bill_paid(uuid) to authenticated;
