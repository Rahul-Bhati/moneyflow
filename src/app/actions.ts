"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabaseServer";
import type { TxType } from "@/lib/types";

import type { Transaction } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  transaction?: Transaction;
}

export async function addTransaction(input: {
  amount: number;
  type: TxType;
  description: string;
  occurred_on: string;
}): Promise<ActionResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  if (input.type !== "income" && input.type !== "expense") {
    return { ok: false, error: "Invalid type." };
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      amount: Math.round(amount * 100) / 100,
      type: input.type,
      description: input.description.trim().slice(0, 140) || null,
      occurred_on: input.occurred_on,
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
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Database not configured." };

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}
