"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseForUser } from "@/lib/supabaseServer";
import { nextDueDate, todayISO } from "@/lib/recurrence";
import type { Bill, BillStatus } from "@/lib/types";
import {
  billInputSchema,
  billStatusSchema,
  idSchema,
  firstError,
  type BillInput,
} from "@/lib/validation";

const BILL_COLUMNS = "id, name, amount, due_on, status, recurrence, paid_on, created_at";

export interface BillActionResult {
  ok: boolean;
  error?: string;
  bill?: Bill;
}

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

function invalidate() {
  revalidatePath("/bills");
  revalidatePath("/");
  revalidatePath("/analytics");
}

export async function addBill(input: BillInput): Promise<BillActionResult> {
  const parsed = billInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const ctx = await getSupabaseForUser();
  if (!ctx) return { ok: false, error: "Not signed in." };

  const { name, amount, due_on, recurrence } = parsed.data;

  const { data, error } = await ctx.supabase
    .from("bills")
    .insert({
      user_id: ctx.userId,
      name: name.slice(0, 60),
      amount: Math.round(amount * 100) / 100,
      due_on,
      // Insert as 'upcoming' — the read-side helper recategorizes on load.
      status: "upcoming",
      recurrence,
    })
    .select(BILL_COLUMNS)
    .single();

  if (error) return { ok: false, error: error.message };
  invalidate();
  return { ok: true, bill: shape(data) };
}

export async function updateBillStatus(
  id: string,
  status: BillStatus
): Promise<BillActionResult> {
  const idCheck = idSchema.safeParse(id);
  if (!idCheck.success) return { ok: false, error: firstError(idCheck.error) };
  const statusCheck = billStatusSchema.safeParse(status);
  if (!statusCheck.success) return { ok: false, error: firstError(statusCheck.error) };

  // Dragging into "Paid" has side-effects — funnel it through markBillPaid.
  if (statusCheck.data === "paid") {
    return markBillPaid(idCheck.data);
  }

  const ctx = await getSupabaseForUser();
  if (!ctx) return { ok: false, error: "Not signed in." };

  const { data, error } = await ctx.supabase
    .from("bills")
    .update({ status: statusCheck.data, paid_on: null })
    .eq("id", idCheck.data)
    .select(BILL_COLUMNS)
    .single();

  if (error) return { ok: false, error: error.message };
  invalidate();
  return { ok: true, bill: shape(data) };
}

/**
 * Marking a bill paid is the headline interaction. It atomically:
 *   1) marks the bill as paid (with today as `paid_on`),
 *   2) inserts a matching expense transaction (category "Bills"),
 *   3) for recurring bills, inserts a fresh "upcoming" bill at the next due
 *      date so the user never has to recreate it.
 *
 * Each step is best-effort: if step 2 or 3 fails we still return ok=true
 * (the bill IS paid) but log the secondary failure. That's the right trade —
 * the user expects the paid column to update; a missing follow-up tx is
 * recoverable, an inconsistent UI is not.
 */
export async function markBillPaid(id: string): Promise<BillActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const ctx = await getSupabaseForUser();
  if (!ctx) return { ok: false, error: "Not signed in." };

  const today = todayISO();

  const { data: paid, error: payError } = await ctx.supabase
    .from("bills")
    .update({ status: "paid", paid_on: today })
    .eq("id", parsed.data)
    .select(BILL_COLUMNS)
    .single();

  if (payError) return { ok: false, error: payError.message };
  const bill = shape(paid);

  // 2) Mirror as a transaction.
  const { error: txError } = await ctx.supabase.from("transactions").insert({
    user_id: ctx.userId,
    amount: Math.round(bill.amount * 100) / 100,
    type: "expense",
    description: `Paid: ${bill.name}`,
    category: "Bills",
    occurred_on: today,
  });
  if (txError) console.error("markBillPaid: tx insert failed:", txError.message);

  // 3) Recurrence: spawn the next occurrence.
  const next = nextDueDate(bill.due_on, bill.recurrence);
  if (next) {
    const { error: cloneError } = await ctx.supabase.from("bills").insert({
      user_id: ctx.userId,
      name: bill.name,
      amount: Math.round(bill.amount * 100) / 100,
      due_on: next,
      status: "upcoming",
      recurrence: bill.recurrence,
    });
    if (cloneError) console.error("markBillPaid: clone failed:", cloneError.message);
  }

  invalidate();
  return { ok: true, bill };
}

export async function deleteBill(id: string): Promise<BillActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const ctx = await getSupabaseForUser();
  if (!ctx) return { ok: false, error: "Not signed in." };

  const { error } = await ctx.supabase
    .from("bills")
    .delete()
    .eq("id", parsed.data);

  if (error) return { ok: false, error: error.message };
  invalidate();
  return { ok: true };
}
