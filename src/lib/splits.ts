import type { Balance } from "./types";

/**
 * Pure split + balance helpers for Spaces (M9). No I/O, no React — safe to
 * unit-test directly and to share between web and mobile (mobile/lib/splits.ts
 * is a copy). Money is in major units (rupees) rounded to 2 dp.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Split `amount` equally across `memberIds`, allocating the rounding remainder
 * deterministically so the shares ALWAYS sum back to `amount` exactly.
 *
 * 100 / 3 → [33.34, 33.33, 33.33] (the first member absorbs the extra paisa),
 * not [33.33, 33.33, 33.33] which would lose a paisa. The DB's
 * `create_shared_expense` rejects shares that don't reconcile, so this exactness
 * matters.
 */
export function equalSplit(
  amount: number,
  memberIds: string[]
): { user_id: string; share_amount: number }[] {
  const n = memberIds.length;
  if (n === 0) return [];
  const totalPaise = Math.round(amount * 100);
  const base = Math.floor(totalPaise / n);
  let remainder = totalPaise - base * n; // 0..n-1 extra paise to distribute

  return memberIds.map((user_id) => {
    const paise = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return { user_id, share_amount: round2(paise / 100) };
  });
}

export interface BalanceSummary {
  /** Total you will receive across all counterparties (sum of positive nets). */
  toReceive: number;
  /** Total you will pay across all counterparties (sum of negative nets, as a positive number). */
  toPay: number;
  /** Net of the two: positive = up overall, negative = down overall, 0 = settled. */
  net: number;
  /** True when every counterparty is settled. */
  settled: boolean;
}

/**
 * Roll a list of per-counterparty net balances into headline totals.
 * `net > 0` means the counterparty will pay you; `net < 0` means you'll pay them.
 */
export function summarizeBalances(balances: Balance[]): BalanceSummary {
  let toReceive = 0;
  let toPay = 0;
  for (const b of balances) {
    if (b.net > 0) toReceive += b.net;
    else if (b.net < 0) toPay += -b.net;
  }
  toReceive = round2(toReceive);
  toPay = round2(toPay);
  return {
    toReceive,
    toPay,
    net: round2(toReceive - toPay),
    settled: balances.length === 0,
  };
}

/**
 * Human phrasing for a single counterparty balance, avoiding "owe"/"borrow".
 * `net > 0` → "name will pay you"; `net < 0` → "you'll pay name".
 */
export function balancePhrase(net: number, name: string): string {
  if (round2(net) === 0) return `Settled with ${name}`;
  return net > 0 ? `${name} will pay you` : `You'll pay ${name}`;
}
