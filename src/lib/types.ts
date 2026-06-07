export type TxType = "expense" | "income";

export interface Transaction {
  id: string;
  amount: number; // always stored as a positive number
  type: TxType;
  description: string;
  occurred_on: string; // ISO date string: "YYYY-MM-DD"
  created_at: string; // ISO timestamp
}

export type Period = "day" | "week" | "month" | "year";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

/**
 * Currency for display. Defaults to Indian Rupee.
 * Change CURRENCY / LOCALE here to localise the whole app.
 */
export const CURRENCY = "INR";
export const LOCALE = "en-IN";
