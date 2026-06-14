"use server";

import { revalidatePath } from "next/cache";
import {
  createTransaction,
  deleteTransactionById,
} from "@/lib/services/transactions";
import type { Transaction } from "@/lib/types";
import type { TransactionInput } from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
  transaction?: Transaction;
}

function invalidate() {
  revalidatePath("/");
  revalidatePath("/analytics");
}

export async function addTransaction(
  input: TransactionInput
): Promise<ActionResult> {
  const res = await createTransaction(input);
  if (!res.ok) return { ok: false, error: res.error };
  invalidate();
  return { ok: true, transaction: res.data };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const res = await deleteTransactionById(id);
  if (!res.ok) return { ok: false, error: res.error };
  invalidate();
  return { ok: true };
}
