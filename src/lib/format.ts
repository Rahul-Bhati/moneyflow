import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachMonthOfInterval,
  isWithinInterval,
  parseISO,
  format,
} from "date-fns";
import { CURRENCY, LOCALE, type Period, type Transaction } from "./types";

const WEEK_OPTS = { weekStartsOn: 1 as const }; // Monday

export function periodRange(period: Period, ref: Date = new Date()) {
  switch (period) {
    case "day":
      return { start: startOfDay(ref), end: endOfDay(ref) };
    case "week":
      return { start: startOfWeek(ref, WEEK_OPTS), end: endOfWeek(ref, WEEK_OPTS) };
    case "month":
      return { start: startOfMonth(ref), end: endOfMonth(ref) };
    case "year":
      return { start: startOfYear(ref), end: endOfYear(ref) };
  }
}

export function periodLabel(period: Period, ref: Date = new Date()): string {
  switch (period) {
    case "day":
      return format(ref, "EEEE, d MMM");
    case "week": {
      const { start, end } = periodRange("week", ref);
      return `${format(start, "d MMM")} – ${format(end, "d MMM")}`;
    }
    case "month":
      return format(ref, "MMMM yyyy");
    case "year":
      return format(ref, "yyyy");
  }
}

export function txDate(t: Transaction): Date {
  // occurred_on is a plain date; anchor to local noon to avoid tz drift
  return parseISO(`${t.occurred_on}T12:00:00`);
}

export function filterByPeriod(
  txs: Transaction[],
  period: Period,
  ref: Date = new Date()
): Transaction[] {
  const { start, end } = periodRange(period, ref);
  return txs.filter((t) => isWithinInterval(txDate(t), { start, end }));
}

export interface Totals {
  income: number;
  expense: number;
  net: number;
  count: number;
}

export function totals(txs: Transaction[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense, count: txs.length };
}

/** Buckets used by the chart for each period view. */
export interface Bucket {
  label: string;
  expense: number;
  income: number;
}

export function chartBuckets(
  txs: Transaction[],
  period: Period,
  ref: Date = new Date()
): Bucket[] {
  const { start, end } = periodRange(period, ref);

  if (period === "year") {
    const months = eachMonthOfInterval({ start, end });
    return months.map((m) => {
      const inMonth = txs.filter((t) => {
        const d = txDate(t);
        return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
      });
      const tt = totals(inMonth);
      return { label: format(m, "MMM")[0], expense: tt.expense, income: tt.income };
    });
  }

  if (period === "day") {
    // single bar comparing the day's spend vs earn
    const tt = totals(filterByPeriod(txs, "day", ref));
    return [{ label: "Today", expense: tt.expense, income: tt.income }];
  }

  // week + month → one bar per day
  const days = eachDayOfInterval({ start, end });
  const compact = days.length > 16; // month view: show date number only sometimes
  return days.map((d, i) => {
    const inDay = txs.filter((t) => {
      const td = txDate(t);
      return (
        td.getFullYear() === d.getFullYear() &&
        td.getMonth() === d.getMonth() &&
        td.getDate() === d.getDate()
      );
    });
    const tt = totals(inDay);
    const label =
      period === "week"
        ? format(d, "EEEEE") // single letter weekday
        : compact && i % 2 !== 0
          ? ""
          : format(d, "d");
    return { label, expense: tt.expense, income: tt.income };
  });
}

const fmt = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});
const fmtPrecise = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(n: number, precise = false): string {
  return (precise ? fmtPrecise : fmt).format(n);
}

export const currencySymbol = (() => {
  const parts = fmt.formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? "₹";
})();

export function groupByDay(txs: Transaction[]): { day: string; items: Transaction[] }[] {
  const sorted = [...txs].sort((a, b) => {
    const d = txDate(b).getTime() - txDate(a).getTime();
    if (d !== 0) return d;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const map = new Map<string, Transaction[]>();
  for (const t of sorted) {
    const key = t.occurred_on;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return [...map.entries()].map(([day, items]) => ({ day, items }));
}

export function dayHeading(iso: string): string {
  const d = parseISO(`${iso}T12:00:00`);
  const today = startOfDay(new Date());
  const that = startOfDay(d);
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return format(d, "EEEE, d MMMM");
}
