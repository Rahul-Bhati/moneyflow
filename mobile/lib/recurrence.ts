// Mirror of src/lib/recurrence.ts. Pure helpers; keep in sync with web.
import type { Bill, BillStatus, Recurrence } from "./types";

export function nextDueDate(from: string, recurrence: Recurrence): string | null {
  if (recurrence === "none") return null;
  const [y, m, d] = from.split("-").map(Number);
  if (!y || !m || !d) return null;

  if (recurrence === "weekly") {
    const base = new Date(Date.UTC(y, m - 1, d));
    base.setUTCDate(base.getUTCDate() + 7);
    return toISO(base);
  }
  if (recurrence === "monthly") return clampedMonthly(y, m, d, 1);
  if (recurrence === "yearly") return clampedMonthly(y, m, d, 12);
  return null;
}

function clampedMonthly(year: number, month: number, day: number, addMonths: number): string {
  const totalMonths = year * 12 + (month - 1) + addMonths;
  const ny = Math.floor(totalMonths / 12);
  const nm = (totalMonths % 12) + 1;
  const lastDay = daysInMonth(ny, nm);
  const nd = Math.min(day, lastDay);
  return `${ny}-${pad(nm)}-${pad(nd)}`;
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function daysUntil(due: string, today: string): number {
  const [dy, dm, dd] = due.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const dueUtc = Date.UTC(dy, dm - 1, dd);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((dueUtc - todayUtc) / 86_400_000);
}

export function computeEffectiveStatus(bill: Bill, today: string): BillStatus {
  if (bill.status === "paid") return "paid";
  const d = daysUntil(bill.due_on, today);
  if (d < 0) return "overdue";
  if (d <= 7) return "due_week";
  return "upcoming";
}
