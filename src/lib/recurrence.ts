import type { Bill, BillStatus, Recurrence } from "./types";

/**
 * Compute the next due-date for a recurring bill. Pure date math — no clock
 * reads, so this is safe to run on server or client. All dates are treated as
 * calendar dates ("YYYY-MM-DD"), never timestamps.
 *
 * Behaviour:
 *   - "none"    → returns null (no next occurrence).
 *   - "weekly"  → +7 days.
 *   - "monthly" → same day of next month. If that day doesn't exist (e.g.
 *                 31 → February), clamps to the last day of the target month.
 *   - "yearly"  → same month/day next year, with the same Feb-29 clamp.
 */
export function nextDueDate(
  from: string,
  recurrence: Recurrence
): string | null {
  if (recurrence === "none") return null;
  const [y, m, d] = from.split("-").map(Number);
  if (!y || !m || !d) return null;

  if (recurrence === "weekly") {
    // Use UTC arithmetic so DST never shifts the result.
    const base = new Date(Date.UTC(y, m - 1, d));
    base.setUTCDate(base.getUTCDate() + 7);
    return toISO(base);
  }

  if (recurrence === "monthly") {
    return clampedMonthly(y, m, d, 1);
  }

  if (recurrence === "yearly") {
    return clampedMonthly(y, m, d, 12);
  }

  return null;
}

function clampedMonthly(
  year: number,
  month: number,
  day: number,
  addMonths: number
): string {
  // month is 1-12; convert to 0-11 for Date.
  const totalMonths = (year * 12 + (month - 1)) + addMonths;
  const ny = Math.floor(totalMonths / 12);
  const nm = (totalMonths % 12) + 1; // back to 1-12
  const lastDay = daysInMonth(ny, nm);
  const nd = Math.min(day, lastDay);
  return `${ny}-${pad(nm)}-${pad(nd)}`;
}

function daysInMonth(year: number, month1to12: number): number {
  // Day 0 of next month == last day of current month.
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Today's calendar date in the runtime's local timezone, formatted as
 * "YYYY-MM-DD". Mirrors how transactions' `occurred_on` is treated.
 */
export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Days from `today` to `due`. Positive = future, 0 = today, negative = past.
 * Operates on the ISO date strings directly so timezone drift can't leak in.
 */
export function daysUntil(due: string, today: string): number {
  const [dy, dm, dd] = due.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const dueUtc = Date.UTC(dy, dm - 1, dd);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((dueUtc - todayUtc) / 86_400_000);
}

/**
 * Read-side status computation, shared between the Kanban UI and the API.
 *
 *   - A bill explicitly marked "paid" stays paid.
 *   - Anything else recategorizes from `due_on` vs today, so cards age across
 *     midnight without database writes.
 *
 * Manual drags between non-paid columns persist (sticky), but the next render
 * still recomputes if no human has touched the row since.
 */
export function computeEffectiveStatus(bill: Bill, today: string): BillStatus {
  if (bill.status === "paid") return "paid";
  const d = daysUntil(bill.due_on, today);
  if (d < 0) return "overdue";
  if (d <= 7) return "due_week";
  return "upcoming";
}
