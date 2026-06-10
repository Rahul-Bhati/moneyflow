import "server-only";
import { getSupabaseForUser } from "@/lib/supabaseServer";
import { computeEffectiveStatus, todayISO } from "@/lib/recurrence";
import type { Bill, BillStatus } from "@/lib/types";
import {
  billInputSchema,
  billUpdateSchema,
  idSchema,
  firstError,
  type BillInput,
  type BillUpdate,
} from "@/lib/validation";
import { fail, ok, type ServiceResult } from "./result";

const COLUMNS =
  "id, name, amount, due_on, status, recurrence, paid_on, created_at";

function shape(row: Record<string, unknown>): Bill {
  return {
    id: String(row.id),
    name: String(row.name),
    amount: Number(row.amount),
    due_on: String(row.due_on),
    status: row.status as BillStatus,
    recurrence: row.recurrence as Bill["recurrence"],
    paid_on: (row.paid_on as string | null) ?? null,
    created_at: String(row.created_at),
  };
}

export interface BillsGrouped {
  upcoming: Bill[];
  due_week: Bill[];
  paid: Bill[];
  overdue: Bill[];
}

/**
 * List bills, sorted by due-date ascending and (optionally) grouped by their
 * effective status — i.e. with the same read-side recategorization the Kanban
 * uses, so an overdue bill shows up under "overdue" even if its row still
 * says "upcoming".
 */
export async function listBills(): Promise<
  ServiceResult<{ bills: Bill[]; grouped: BillsGrouped; today: string }>
> {
  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const { data, error } = await ctx.supabase
    .from("bills")
    .select(COLUMNS)
    .order("due_on", { ascending: true })
    .limit(500);

  if (error) return fail(500, error.message);

  const bills = (data ?? []).map(shape);
  const today = todayISO();
  const grouped: BillsGrouped = {
    upcoming: [],
    due_week: [],
    paid: [],
    overdue: [],
  };
  for (const b of bills) grouped[computeEffectiveStatus(b, today)].push(b);

  grouped.paid.sort((a, b) =>
    (b.paid_on ?? "").localeCompare(a.paid_on ?? "")
  );
  return ok({ bills, grouped, today });
}

export async function createBill(
  input: BillInput
): Promise<ServiceResult<Bill>> {
  const parsed = billInputSchema.safeParse(input);
  if (!parsed.success) return fail(400, firstError(parsed.error));

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const { name, amount, due_on, recurrence } = parsed.data;

  const { data, error } = await ctx.supabase
    .from("bills")
    .insert({
      user_id: ctx.userId,
      name: name.slice(0, 60),
      amount: Math.round(amount * 100) / 100,
      due_on,
      status: "upcoming",
      recurrence,
    })
    .select(COLUMNS)
    .single();

  if (error) return fail(500, error.message);
  return ok(shape(data));
}

/**
 * Update a bill.
 *
 * The "transition to paid" case has special semantics — it must also mirror
 * the bill as a transaction and clone the next recurrence — so we delegate
 * it to `markBillPaidById` which wraps all three writes in an atomic
 * Postgres function (see 0004_mark_bill_paid_rpc.sql).
 *
 * Combo case (patch includes `status: "paid"` AND other fields): we apply
 * the non-status edits first, THEN trigger the atomic paid flow. The atomic
 * guarantee is preserved where it actually matters (the multi-write paid
 * flow); the single-row non-status update can't be torn.
 */
export async function updateBill(
  rawId: string,
  patch: BillUpdate
): Promise<ServiceResult<Bill>> {
  const idCheck = idSchema.safeParse(rawId);
  if (!idCheck.success) return fail(400, firstError(idCheck.error));
  const patchCheck = billUpdateSchema.safeParse(patch);
  if (!patchCheck.success) return fail(400, firstError(patchCheck.error));

  const p = patchCheck.data;

  // Split: non-status fields apply with a plain UPDATE; transitioning to
  // "paid" routes through the atomic RPC; transitioning to any other status
  // is a single-write field like everything else.
  const transitioningToPaid = p.status === "paid";
  const nonStatusFields = {
    name: p.name,
    amount: p.amount,
    due_on: p.due_on,
    recurrence: p.recurrence,
    // status is handled separately when it's "paid"; included here only when
    // it's some other transition (back to upcoming/due_week/overdue).
    status: transitioningToPaid ? undefined : p.status,
  };
  const hasNonStatusFields = Object.values(nonStatusFields).some(
    (v) => v !== undefined
  );

  // Plain edits first (if any).
  if (hasNonStatusFields) {
    const ctx = await getSupabaseForUser();
    if (!ctx) return fail(401, "Not signed in.");

    const update: Record<string, unknown> = {};
    if (nonStatusFields.name !== undefined)
      update.name = nonStatusFields.name.slice(0, 60);
    if (nonStatusFields.amount !== undefined)
      update.amount = Math.round(nonStatusFields.amount * 100) / 100;
    if (nonStatusFields.due_on !== undefined) update.due_on = nonStatusFields.due_on;
    if (nonStatusFields.recurrence !== undefined)
      update.recurrence = nonStatusFields.recurrence;
    if (nonStatusFields.status !== undefined) {
      update.status = nonStatusFields.status;
      // Clear paid_on when transitioning AWAY from paid. (Transitioning TO
      // paid goes through markBillPaidById below, which sets paid_on itself.)
      update.paid_on = null;
    }

    const { data, error } = await ctx.supabase
      .from("bills")
      .update(update)
      .eq("id", idCheck.data)
      .select(COLUMNS)
      .maybeSingle();

    if (error) return fail(500, error.message);
    if (!data) return fail(404, "Bill not found.");

    if (!transitioningToPaid) return ok(shape(data));
    // fall through to the paid transition
  }

  // Paid transition (covers both status-only and combo cases).
  if (transitioningToPaid) return markBillPaidById(idCheck.data);

  // Neither branch fired — empty patch (Zod's refine should have caught this
  // already, but be safe).
  return fail(400, "Send at least one field to update");
}

/**
 * Mark a bill as paid — atomic.
 *
 * Delegates to the `mark_bill_paid(uuid)` Postgres function (defined in
 * 0004_mark_bill_paid_rpc.sql) which wraps three writes in a single
 * transaction: stamp the bill paid, mirror as an expense transaction, and
 * for recurring bills schedule the next period.
 *
 * Why an RPC instead of a JS sequence: Supabase's JS client doesn't expose
 * multi-statement transactions. Without the function, a failure on the
 * transaction insert or clone insert would leave the bill stamped paid but
 * the bookkeeping out of sync — and we'd just `console.error` and pretend
 * everything was fine. Now it's all-or-nothing, enforced by Postgres.
 *
 * Security: the function uses `security invoker` (default), so RLS still
 * scopes every row to the caller. A user can only mark THEIR OWN bills paid;
 * the function's `update … where id = …` matches zero rows for someone
 * else's bill and we return 404.
 */
export async function markBillPaidById(
  rawId: string
): Promise<ServiceResult<Bill>> {
  const idCheck = idSchema.safeParse(rawId);
  if (!idCheck.success) return fail(400, firstError(idCheck.error));

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const { data, error } = await ctx.supabase.rpc("mark_bill_paid", {
    p_bill_id: idCheck.data,
  });

  if (error) {
    // The function raises `bill_not_found` (Postgres errcode P0002) when the
    // id is unknown or doesn't belong to the caller. Map that to 404.
    if (error.code === "P0002" || error.message?.includes("bill_not_found")) {
      return fail(404, "Bill not found.");
    }
    return fail(500, error.message);
  }
  if (!data) return fail(404, "Bill not found.");

  // `rpc` returning a `setof` / scalar record comes back as either a single
  // object or a 1-element array depending on the function signature. Our
  // function returns `public.bills` (a single row), so it's an object.
  const row = Array.isArray(data) ? data[0] : data;
  return ok(shape(row as Record<string, unknown>));
}

export async function deleteBillById(
  rawId: string
): Promise<ServiceResult<{ id: string }>> {
  const idCheck = idSchema.safeParse(rawId);
  if (!idCheck.success) return fail(400, firstError(idCheck.error));

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const { error, count } = await ctx.supabase
    .from("bills")
    .delete({ count: "exact" })
    .eq("id", idCheck.data);

  if (error) return fail(500, error.message);
  if (count === 0) return fail(404, "Bill not found.");
  return ok({ id: idCheck.data });
}
