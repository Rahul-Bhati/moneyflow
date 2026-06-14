"use server";

import { revalidatePath } from "next/cache";
import {
  acceptInvite,
  addSharedExpense,
  createInvite,
  createSpace,
  recordSettlement,
  removeMember,
} from "@/lib/services/spaces";
import type {
  Settlement,
  SharedExpense,
  Space,
  SpaceMember,
} from "@/lib/types";
import type {
  SettlementInput,
  SharedExpenseInput,
  SpaceInput,
} from "@/lib/validation";

export interface SpaceActionResult {
  ok: boolean;
  error?: string;
  space?: Space;
  member?: SpaceMember;
  expense?: SharedExpense;
  settlement?: Settlement;
  token?: string;
}

export async function addSpace(input: SpaceInput): Promise<SpaceActionResult> {
  const res = await createSpace(input);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/groups");
  return { ok: true, space: res.data };
}

export async function inviteToSpace(
  spaceId: string
): Promise<SpaceActionResult> {
  const res = await createInvite(spaceId);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, token: res.data.token };
}

export async function joinSpace(token: string): Promise<SpaceActionResult> {
  const res = await acceptInvite(token);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/groups");
  return { ok: true, member: res.data };
}

export async function addExpense(
  spaceId: string,
  input: SharedExpenseInput
): Promise<SpaceActionResult> {
  const res = await addSharedExpense(spaceId, input);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/groups/${spaceId}`);
  revalidatePath("/groups");
  revalidatePath("/"); // payer's mirrored personal share
  return { ok: true, expense: res.data };
}

export async function settleUp(
  spaceId: string,
  input: SettlementInput
): Promise<SpaceActionResult> {
  const res = await recordSettlement(spaceId, input);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/groups/${spaceId}`);
  revalidatePath("/groups");
  return { ok: true, settlement: res.data };
}

export async function kickMember(
  spaceId: string,
  memberUserId: string
): Promise<SpaceActionResult> {
  const res = await removeMember(spaceId, memberUserId);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/groups/${spaceId}`);
  revalidatePath("/groups");
  return { ok: true };
}
