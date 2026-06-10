"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseForUser } from "@/lib/supabaseServer";
import type { Transaction } from "@/lib/types";
import {
  transactionInputSchema,
  idSchema,
  firstError,
  type TransactionInput,
} from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
  transaction?: Transaction;
}

export async function addTransaction(input: TransactionInput): Promise<ActionResult> {
  const parsed = transactionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const ctx = await getSupabaseForUser();
  if (!ctx) return { ok: false, error: "Not signed in." };

  const { amount, type, description, occurred_on } = parsed.data;

  const { data, error } = await ctx.supabase
    .from("transactions")
    .insert({
      user_id: ctx.userId,
      amount: Math.round(amount * 100) / 100,
      type,
      description: description.trim().slice(0, 140) || null,
      occurred_on,
    })
    .select("id, amount, type, description, occurred_on, created_at")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return {
    ok: true,
    transaction: {
      ...data,
      amount: Number(data.amount),
      description: data.description ?? "",
    } as Transaction,
  };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const ctx = await getSupabaseForUser();
  if (!ctx) return { ok: false, error: "Not signed in." };

  const { error } = await ctx.supabase
    .from("transactions")
    .delete()
    .eq("id", parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}
