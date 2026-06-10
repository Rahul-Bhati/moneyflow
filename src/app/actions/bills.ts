"use server";

import { revalidatePath } from "next/cache";
import {
  createBill,
  deleteBillById,
  markBillPaidById,
  updateBill,
} from "@/lib/services/bills";
import type { Bill, BillStatus } from "@/lib/types";
import type { BillInput } from "@/lib/validation";

export interface BillActionResult {
  ok: boolean;
  error?: string;
  bill?: Bill;
}

function invalidate() {
  revalidatePath("/bills");
  revalidatePath("/");
  revalidatePath("/analytics");
}

export async function addBill(input: BillInput): Promise<BillActionResult> {
  const res = await createBill(input);
  if (!res.ok) return { ok: false, error: res.error };
  invalidate();
  return { ok: true, bill: res.data };
}

export async function updateBillStatus(
  id: string,
  status: BillStatus
): Promise<BillActionResult> {
  const res = await updateBill(id, { status });
  if (!res.ok) return { ok: false, error: res.error };
  invalidate();
  return { ok: true, bill: res.data };
}

export async function markBillPaid(id: string): Promise<BillActionResult> {
  const res = await markBillPaidById(id);
  if (!res.ok) return { ok: false, error: res.error };
  invalidate();
  return { ok: true, bill: res.data };
}

export async function deleteBill(id: string): Promise<BillActionResult> {
  const res = await deleteBillById(id);
  if (!res.ok) return { ok: false, error: res.error };
  invalidate();
  return { ok: true };
}
