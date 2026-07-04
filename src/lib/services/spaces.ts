import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { getSupabaseForUser } from "@/lib/supabaseServer";
import type {
  Balance,
  Settlement,
  SharedExpense,
  Space,
  SpaceDetail,
  SpaceMember,
} from "@/lib/types";
import {
  firstError,
  idSchema,
  sharedExpenseInputSchema,
  settlementInputSchema,
  spaceInputSchema,
  type SettlementInput,
  type SharedExpenseInput,
  type SpaceInput,
} from "@/lib/validation";
import { fail, ok, type ServiceResult } from "./result";

const round2 = (n: number) => Math.round(n * 100) / 100;

const SPACE_COLS = "id, name, created_by, created_at";
const MEMBER_COLS = "id, space_id, user_id, display_name, role";
const EXPENSE_COLS =
  "id, space_id, payer_id, amount, description, category, occurred_on, created_at";
const SETTLEMENT_COLS =
  "id, space_id, from_user, to_user, amount, occurred_on, note";

function shapeSpace(row: Record<string, unknown>): Space {
  return {
    id: String(row.id),
    name: String(row.name),
    created_by: String(row.created_by),
    created_at: String(row.created_at),
  };
}

function shapeMember(row: Record<string, unknown>): SpaceMember {
  return {
    id: String(row.id),
    space_id: String(row.space_id),
    user_id: String(row.user_id),
    display_name: String(row.display_name),
    role: row.role as SpaceMember["role"],
  };
}

function shapeSettlement(row: Record<string, unknown>): Settlement {
  return {
    id: String(row.id),
    space_id: String(row.space_id),
    from_user: String(row.from_user),
    to_user: String(row.to_user),
    amount: Number(row.amount),
    occurred_on: String(row.occurred_on),
    note: (row.note as string | null) ?? null,
  };
}

function shapeBalances(rows: Record<string, unknown>[] | null): Balance[] {
  return (rows ?? []).map((r) => ({
    counterparty: String(r.counterparty),
    net: round2(Number(r.net)),
  }));
}

/** Best-effort current Clerk display name; falls back to the user id. */
async function currentDisplayName(fallback: string): Promise<string> {
  try {
    const u = await currentUser();
    return (
      u?.fullName ||
      u?.firstName ||
      u?.username ||
      u?.primaryEmailAddress?.emailAddress ||
      fallback
    );
  } catch {
    return fallback;
  }
}

/** Spaces the caller belongs to, each with the caller's net across it. */
export async function listSpaces(): Promise<ServiceResult<Space[]>> {
  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const { data, error } = await ctx.supabase
    .from("spaces")
    .select(SPACE_COLS)
    .order("created_at", { ascending: false });
  if (error) return fail(500, error.message);

  // Fire all balance RPCs in parallel rather than serially — O(1) wall-clock
  // regardless of how many spaces the user belongs to.
  const spaces = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: bals } = await ctx.supabase.rpc("my_balances", {
        p_space_id: row.id,
      });
      const myNet = round2(
        shapeBalances(bals).reduce((s, b) => s + b.net, 0)
      );
      return { ...shapeSpace(row), myNet };
    })
  );
  return ok(spaces);
}

/** Full detail for one space: roster, the expenses I can see, my balances. */
export async function getSpace(
  rawId: string
): Promise<ServiceResult<SpaceDetail>> {
  const idCheck = idSchema.safeParse(rawId);
  if (!idCheck.success) return fail(400, firstError(idCheck.error));
  const id = idCheck.data;

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const { data: spaceRow, error: spaceErr } = await ctx.supabase
    .from("spaces")
    .select(SPACE_COLS)
    .eq("id", id)
    .maybeSingle();
  if (spaceErr) return fail(500, spaceErr.message);
  if (!spaceRow) return fail(404, "Space not found.");

  const { data: memberRows, error: memErr } = await ctx.supabase
    .from("space_members")
    .select(MEMBER_COLS)
    .eq("space_id", id)
    .order("created_at", { ascending: true });
  if (memErr) return fail(500, memErr.message);

  // RLS scopes this to expenses I can see (payer or participant) — privacy is
  // enforced at the DB, not here.
  const { data: expenseRows, error: expErr } = await ctx.supabase
    .from("shared_expenses")
    .select(EXPENSE_COLS)
    .eq("space_id", id)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (expErr) return fail(500, expErr.message);

  const expenseIds = (expenseRows ?? []).map((e) => e.id as string);
  const partsByExpense = new Map<string, SharedExpense["participants"]>();
  if (expenseIds.length) {
    const { data: partRows, error: partErr } = await ctx.supabase
      .from("expense_participants")
      .select("expense_id, user_id, share_amount")
      .in("expense_id", expenseIds);
    if (partErr) return fail(500, partErr.message);
    for (const p of partRows ?? []) {
      const list = partsByExpense.get(p.expense_id as string) ?? [];
      list.push({
        user_id: String(p.user_id),
        share_amount: Number(p.share_amount),
      });
      partsByExpense.set(p.expense_id as string, list);
    }
  }

  const expenses: SharedExpense[] = (expenseRows ?? []).map((e) => ({
    id: String(e.id),
    space_id: String(e.space_id),
    payer_id: String(e.payer_id),
    amount: Number(e.amount),
    description: String(e.description),
    category: String(e.category),
    occurred_on: String(e.occurred_on),
    created_at: String(e.created_at),
    participants: partsByExpense.get(e.id as string) ?? [],
  }));

  const { data: bals, error: balErr } = await ctx.supabase.rpc("my_balances", {
    p_space_id: id,
  });
  if (balErr) return fail(500, balErr.message);

  return ok({
    space: shapeSpace(spaceRow),
    members: (memberRows ?? []).map(shapeMember),
    expenses,
    balances: shapeBalances(bals),
  });
}

export async function createSpace(
  input: SpaceInput
): Promise<ServiceResult<Space>> {
  const parsed = spaceInputSchema.safeParse(input);
  if (!parsed.success) return fail(400, firstError(parsed.error));

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const displayName = await currentDisplayName(ctx.userId);
  const { data, error } = await ctx.supabase.rpc("create_space", {
    p_name: parsed.data.name,
    p_display_name: displayName,
  });
  if (error) return fail(500, error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return ok(shapeSpace(row as Record<string, unknown>));
}

/** Mint an invite token for a space. The caller must be a member. */
export async function createInvite(
  rawSpaceId: string
): Promise<ServiceResult<{ token: string }>> {
  const idCheck = idSchema.safeParse(rawSpaceId);
  if (!idCheck.success) return fail(400, firstError(idCheck.error));

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  // High-entropy unguessable token (two UUIDs, dashes stripped).
  const token = (
    crypto.randomUUID() + crypto.randomUUID()
  ).replace(/-/g, "");

  const { error } = await ctx.supabase.from("space_invites").insert({
    space_id: idCheck.data,
    token,
    invited_by: ctx.userId,
    status: "pending",
  });
  if (error) return fail(500, error.message);
  return ok({ token });
}

export async function acceptInvite(
  token: string
): Promise<ServiceResult<SpaceMember>> {
  if (!token || typeof token !== "string") return fail(400, "Missing invite token.");

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const displayName = await currentDisplayName(ctx.userId);
  const { data, error } = await ctx.supabase.rpc("accept_invite", {
    p_token: token,
    p_display_name: displayName,
  });
  if (error) {
    if (error.code === "P0002" || error.message?.includes("invite_invalid")) {
      return fail(404, "That invite is invalid or has already been used.");
    }
    return fail(500, error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return fail(404, "That invite is invalid or has already been used.");
  return ok(shapeMember(row as Record<string, unknown>));
}

export async function addSharedExpense(
  rawSpaceId: string,
  input: SharedExpenseInput
): Promise<ServiceResult<SharedExpense>> {
  const idCheck = idSchema.safeParse(rawSpaceId);
  if (!idCheck.success) return fail(400, firstError(idCheck.error));
  const parsed = sharedExpenseInputSchema.safeParse(input);
  if (!parsed.success) return fail(400, firstError(parsed.error));

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const { amount, description, category, occurred_on, participants } =
    parsed.data;

  const { data, error } = await ctx.supabase.rpc("create_shared_expense", {
    p_space_id: idCheck.data,
    p_amount: amount,
    p_description: description,
    p_category: category,
    p_occurred_on: occurred_on,
    p_participants: participants,
  });
  if (error) {
    if (error.code === "P0001" || error.message?.includes("shares_do_not_sum")) {
      return fail(400, "Shares must add up to the total amount.");
    }
    return fail(500, error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  // The RPC returns only the expense row; attach the participants we sent.
  return ok({
    id: String(row.id),
    space_id: String(row.space_id),
    payer_id: String(row.payer_id),
    amount: Number(row.amount),
    description: String(row.description),
    category: String(row.category),
    occurred_on: String(row.occurred_on),
    created_at: String(row.created_at),
    participants: participants.map((p) => ({
      user_id: p.user_id,
      share_amount: round2(p.share_amount),
    })),
  });
}

export async function recordSettlement(
  rawSpaceId: string,
  input: SettlementInput
): Promise<ServiceResult<Settlement>> {
  const idCheck = idSchema.safeParse(rawSpaceId);
  if (!idCheck.success) return fail(400, firstError(idCheck.error));
  const parsed = settlementInputSchema.safeParse(input);
  if (!parsed.success) return fail(400, firstError(parsed.error));

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const { counterparty, direction, amount, occurred_on, note } = parsed.data;
  // "paid" → money flows from me to them; "received" → from them to me.
  const from_user = direction === "paid" ? ctx.userId : counterparty;
  const to_user = direction === "paid" ? counterparty : ctx.userId;
  const { data, error } = await ctx.supabase.rpc("record_settlement", {
    p_space_id: idCheck.data,
    p_from_user: from_user,
    p_to_user: to_user,
    p_amount: amount,
    p_occurred_on: occurred_on,
    p_note: note ?? null,
  });
  if (error) {
    if (error.code === "P0001") {
      return fail(400, "Both people must be members and can't be the same.");
    }
    return fail(500, error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return ok(shapeSettlement(row as Record<string, unknown>));
}

/**
 * Remove a member from a space (or leave it yourself). RLS allows the space
 * owner to remove anyone and any member to remove themselves. We add a soft
 * guard: the caller can't remove someone they still have a non-zero balance
 * with — settle up first. (We can only see the caller's own balances, by
 * design; a fuller cross-member guard would require leaking others' balances.)
 */
export async function removeMember(
  rawSpaceId: string,
  memberUserId: string
): Promise<ServiceResult<{ removed: string }>> {
  const idCheck = idSchema.safeParse(rawSpaceId);
  if (!idCheck.success) return fail(400, firstError(idCheck.error));
  if (!memberUserId) return fail(400, "Missing member.");

  const ctx = await getSupabaseForUser();
  if (!ctx) return fail(401, "Not signed in.");

  const { data: bals } = await ctx.supabase.rpc("my_balances", {
    p_space_id: idCheck.data,
  });
  const withThem = shapeBalances(bals).find(
    (b) => b.counterparty === memberUserId
  );
  if (withThem && round2(withThem.net) !== 0) {
    return fail(400, "Settle up with this person before removing them.");
  }

  const { error } = await ctx.supabase
    .from("space_members")
    .delete()
    .eq("space_id", idCheck.data)
    .eq("user_id", memberUserId);
  if (error) return fail(500, error.message);
  return ok({ removed: memberUserId });
}
