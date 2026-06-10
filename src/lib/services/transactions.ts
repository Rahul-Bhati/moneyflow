import "server-only";
import { getSupabaseForUser } from "@/lib/supabaseServer";
import { filterByPeriod, totals, type Totals } from "@/lib/format";
import type { Period, Transaction } from "@/lib/types";
import {
  transactionInputSchema,
  transactionUpdateSchema,
  idSchema,
  firstError,
  type TransactionInput,
  type TransactionUpdate,
} from "@/lib/validation";
import { fail, ok, type ServiceResult } from "./result";

const COLUMNS =
  "id, amount, type, description, category, occurred_on, created_at";

function shape(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    amount: Number(row.amount),
    type: row.type as Transaction["type"],
    description: (row.description as string | null) ?? "",
    category: (row.category as string | null) ?? "Uncategorized",
    occurred_on: String(row.occurred_on),
    created_at: String(row.created_at),
  };
}

export interface ListOptions {
  period?: Period;
  category?: string;
  limit?: number;
}

export interface ListResult {
  transactions: Transaction[];
  totals: Totals;
}

/**
 * List the current user's transactions. Period and category filters are
 * applied here (server-side) using the same helpers the UI consumes, so the
 * API and the dashboard stay consistent.
 */
export async function listTransactions(
  opts: ListOptions = {}
): Promise<ServiceResult<ListResult>> {
  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  let query = ctx.supabase
    .from("transactions")
    .select(COLUMNS)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 2000);

  if (opts.category) query = query.eq("category", opts.category);

  const { data, error } = await query;
  if (error) return fail(500, error.message);

  let txs = (data ?? []).map(shape);
  if (opts.period) txs = filterByPeriod(txs, opts.period);

  return ok({ transactions: txs, totals: totals(txs) });
}

export async function createTransaction(
  input: TransactionInput
): Promise<ServiceResult<Transaction>> {
  const parsed = transactionInputSchema.safeParse(input);
  if (!parsed.success) return fail(400, firstError(parsed.error));

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const { amount, type, description, category, occurred_on } = parsed.data;

  const { data, error } = await ctx.supabase
    .from("transactions")
    .insert({
      user_id: ctx.userId,
      amount: Math.round(amount * 100) / 100,
      type,
      description: description.trim().slice(0, 140) || null,
      category: category.trim(),
      occurred_on,
    })
    .select(COLUMNS)
    .single();

  if (error) return fail(500, error.message);
  return ok(shape(data));
}

export async function updateTransaction(
  rawId: string,
  patch: TransactionUpdate
): Promise<ServiceResult<Transaction>> {
  const idCheck = idSchema.safeParse(rawId);
  if (!idCheck.success) return fail(400, firstError(idCheck.error));

  const patchCheck = transactionUpdateSchema.safeParse(patch);
  if (!patchCheck.success) return fail(400, firstError(patchCheck.error));

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  // Build the update payload only from fields the caller actually sent.
  const update: Record<string, unknown> = {};
  const p = patchCheck.data;
  if (p.amount !== undefined) update.amount = Math.round(p.amount * 100) / 100;
  if (p.type !== undefined) update.type = p.type;
  if (p.description !== undefined)
    update.description = p.description.trim().slice(0, 140) || null;
  if (p.category !== undefined) update.category = p.category.trim();
  if (p.occurred_on !== undefined) update.occurred_on = p.occurred_on;

  const { data, error } = await ctx.supabase
    .from("transactions")
    .update(update)
    .eq("id", idCheck.data)
    .select(COLUMNS)
    .maybeSingle();

  if (error) return fail(500, error.message);
  if (!data) return fail(404, "Transaction not found.");
  return ok(shape(data));
}

export async function deleteTransactionById(
  rawId: string
): Promise<ServiceResult<{ id: string }>> {
  const idCheck = idSchema.safeParse(rawId);
  if (!idCheck.success) return fail(400, firstError(idCheck.error));

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const { error, count } = await ctx.supabase
    .from("transactions")
    .delete({ count: "exact" })
    .eq("id", idCheck.data);

  if (error) return fail(500, error.message);
  if (count === 0) return fail(404, "Transaction not found.");
  return ok({ id: idCheck.data });
}
