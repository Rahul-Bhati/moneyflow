export type TxType = "expense" | "income";

export interface Transaction {
  id: string;
  amount: number; // always stored as a positive number
  type: TxType;
  description: string;
  category: string;
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
 * Built-in categories. Users can also type a custom one — anything goes in the
 * `category` text column. Keep this list short; long lists overwhelm.
 */
export const BUILT_IN_CATEGORIES = [
  "Food",
  "Travel",
  "Bills",
  "Shopping",
  "Health",
  "Entertainment",
  "Income",
  "Other",
] as const;

export const UNCATEGORIZED = "Uncategorized";

/**
 * Currency for display. Defaults to Indian Rupee.
 * Change CURRENCY / LOCALE here to localise the whole app.
 */
export const CURRENCY = "INR";
export const LOCALE = "en-IN";

// ---------------------------------------------------------------------------
// Bills / Subscriptions (M4)
// ---------------------------------------------------------------------------
export type BillStatus = "upcoming" | "due_week" | "paid" | "overdue";

export type Recurrence = "none" | "weekly" | "monthly" | "yearly";

export interface Bill {
  id: string;
  name: string;
  amount: number; // always positive
  due_on: string; // "YYYY-MM-DD"
  status: BillStatus; // sticky override (write-side)
  recurrence: Recurrence;
  paid_on: string | null;
  created_at: string;
}

export const BILL_COLUMNS: {
  key: BillStatus;
  label: string;
  hint: string;
  tone: "neutral" | "warn" | "good" | "bad";
}[] = [
  { key: "upcoming", label: "Upcoming", hint: "More than a week away", tone: "neutral" },
  { key: "due_week", label: "Due This Week", hint: "Within 7 days", tone: "warn" },
  { key: "paid", label: "Paid", hint: "Settled", tone: "good" },
  { key: "overdue", label: "Overdue", hint: "Past the due date", tone: "bad" },
];

export const RECURRENCES: { key: Recurrence; label: string }[] = [
  { key: "none", label: "One-time" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];
