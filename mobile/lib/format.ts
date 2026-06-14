import { CURRENCY, LOCALE, type Period } from "./types";

/**
 * Hermes (the JS engine RN ships with) only includes a minimal `Intl` polyfill
 * and is missing `formatToParts`, `DateTimeFormat` options like `weekday`,
 * etc. We can't rely on `Intl.NumberFormat({…}).formatToParts(0)` to extract
 * the currency symbol — that call throws with "undefined is not a function".
 *
 * Every helper in this file is therefore defensive: try the rich Intl path
 * first, fall back to a hand-rolled implementation that always works.
 */

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
};

export const currencySymbol: string = CURRENCY_SYMBOLS[CURRENCY] ?? CURRENCY;

// Try once at module load to construct two NumberFormatters. If Hermes balks
// (e.g. the locale/currency combo isn't supported), `formatters` stays null
// and we fall through to a hand-rolled implementation.
const formatters = (() => {
  try {
    return {
      compact: new Intl.NumberFormat(LOCALE, {
        style: "currency",
        currency: CURRENCY,
        maximumFractionDigits: 0,
      }),
      precise: new Intl.NumberFormat(LOCALE, {
        style: "currency",
        currency: CURRENCY,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    };
  } catch {
    return null;
  }
})();

export function money(n: number, precise = false): string {
  if (formatters) {
    try {
      return (precise ? formatters.precise : formatters.compact).format(n);
    } catch {
      // fall through
    }
  }
  return manualMoney(n, precise);
}

function manualMoney(n: number, precise: boolean): string {
  const negative = n < 0;
  const abs = Math.abs(n);
  const fixed = precise ? abs.toFixed(2) : Math.round(abs).toString();
  const [intPart, decPart] = fixed.split(".");

  // INR convention: lakh-style grouping (12,34,567). Everything else gets
  // standard thousands grouping.
  const groupedInt =
    LOCALE === "en-IN" ? groupIndian(intPart) : intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const body = decPart ? `${groupedInt}.${decPart}` : groupedInt;
  return `${negative ? "-" : ""}${currencySymbol}${body}`;
}

function groupIndian(s: string): string {
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS_LONG = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export const PERIOD_WORD: Record<Period, string> = {
  day: "today",
  week: "this week",
  month: "this month",
  year: "this year",
};

export function periodLabel(period: Period, ref: Date = new Date()): string {
  switch (period) {
    case "day":
      return `${WEEKDAYS_LONG[ref.getDay()]}, ${ref.getDate()} ${MONTHS_SHORT[ref.getMonth()]}`;
    case "week": {
      const start = startOfWeek(ref);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}` === `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]}`
        ? `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]}`
        : `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
    }
    case "month":
      return `${MONTHS_LONG[ref.getMonth()]} ${ref.getFullYear()}`;
    case "year":
      return String(ref.getFullYear());
  }
}

function startOfWeek(d: Date): Date {
  // Monday-start week, matching the web's WEEK_OPTS.
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Format an ISO date (YYYY-MM-DD) as e.g. "Jun 15". TZ-safe (parses parts directly). */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1] ?? ""} ${d}`;
}
