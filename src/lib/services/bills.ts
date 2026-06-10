import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseForUser } from "@/lib/supabaseServer";
import { computeEffectiveStatus, nextDueDate, todayISO } from "@/lib/recurrence";
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
 * Update a bill. If the patch transitions the bill into "paid", we run the
 * markPaid side-effects (insert a transaction + clone the next occurrence)
 * — anything else is a simple update.
 */
export async function updateBill(
  rawId: string,
  patch: BillUpdate
): Promise<ServiceResult<Bill>> {
  const idCheck = idSchema.safeParse(rawId);
  if (!idCheck.success) return fail(400, firstError(idCheck.error));
  const patchCheck = billUpdateSchema.safeParse(patch);
  if (!patchCheck.success) return fail(400, firstError(patchCheck.error));

  // Status-only transition to "paid" → headline flow.
  const isPayingOnly =
    Object.keys(patchCheck.data).length === 1 && patchCheck.data.status === "paid";
  if (isPayingOnly) return markBillPaidById(idCheck.data);

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const update: Record<string, unknown> = {};
  const p = patchCheck.data;
  if (p.name !== undefined) update.name = p.name.slice(0, 60);
  if (p.amount !== undefined) update.amount = Math.round(p.amount * 100) / 100;
  if (p.due_on !== undefined) update.due_on = p.due_on;
  if (p.recurrence !== undefined) update.recurrence = p.recurrence;
  if (p.status !== undefined) {
    update.status = p.status;
    update.paid_on = p.status === "paid" ? todayISO() : null;
  }

  const { data, error } = await ctx.supabase
    .from("bills")
    .update(update)
    .eq("id", idCheck.data)
    .select(COLUMNS)
    .maybeSingle();

  if (error) return fail(500, error.message);
  if (!data) return fail(404, "Bill not found.");

  // If this update is a paid-and-edit combo, we still need to clone the
  // recurrence and insert the mirror transaction.
  if (p.status === "paid") {
    await postPaidSideEffects(ctx.supabase, ctx.userId, shape(data));
  }

  return ok(shape(data));
}

export async function markBillPaidById(
  rawId: string
): Promise<ServiceResult<Bill>> {
  const idCheck = idSchema.safeParse(rawId);
  if (!idCheck.success) return fail(400, firstError(idCheck.error));

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const today = todayISO();
  const { data, error } = await ctx.supabase
    .from("bills")
    .update({ status: "paid", paid_on: today })
    .eq("id", idCheck.data)
    .select(COLUMNS)
    .maybeSingle();

  if (error) return fail(500, error.message);
  if (!data) return fail(404, "Bill not found.");

  const bill = shape(data);
  await postPaidSideEffects(ctx.supabase, ctx.userId, bill);
  return ok(bill);
}

/**
 * Idempotent-friendly side-effects of a bill becoming paid:
 *   1) Mirror it as an expense transaction (category "Bills").
 *   2) For recurring bills, insert a fresh "upcoming" bill at the next due
 *      date so the user never has to recreate it.
 *
 * Failures here are logged but don't unwind the paid stamp — UI consistency
 * matters more than perfect bookkeeping on the side-effects.
 */
async function postPaidSideEffects(
  supabase: SupabaseClient,
  userId: string,
  bill: Bill
): Promise<void> {
  const today = todayISO();

  const { error: txError } = await supabase.from("transactions").insert({
    user_id: userId,
    amount: Math.round(bill.amount * 100) / 100,
    type: "expense",
    description: `Paid: ${bill.name}`,
    category: "Bills",
    occurred_on: today,
  });
  if (txError) console.error("markBillPaid: tx insert failed:", txError.message);

  const next = nextDueDate(bill.due_on, bill.recurrence);
  if (next) {
    const { error: cloneError } = await supabase.from("bills").insert({
      user_id: userId,
      name: bill.name,
      amount: Math.round(bill.amount * 100) / 100,
      due_on: next,
      status: "upcoming",
      recurrence: bill.recurrence,
    });
    if (cloneError)
      console.error("markBillPaid: clone failed:", cloneError.message);
  }
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
