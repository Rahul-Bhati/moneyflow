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

// ---------------------------------------------------------------------------
// Spaces — privacy-scoped shared expense splitting (M9)
// ---------------------------------------------------------------------------
export type MemberRole = "owner" | "member";

export interface Space {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  // Filled by listSpaces(): the viewer's net across this space. Positive = you
  // will receive; negative = you will pay; 0 = settled.
  myNet?: number;
}

export interface SpaceMember {
  id: string;
  space_id: string;
  user_id: string;
  display_name: string;
  role: MemberRole;
}

export interface ExpenseParticipant {
  user_id: string;
  share_amount: number;
}

export interface SharedExpense {
  id: string;
  space_id: string;
  payer_id: string;
  amount: number;
  description: string;
  category: string;
  occurred_on: string; // "YYYY-MM-DD"
  created_at: string;
  participants: ExpenseParticipant[];
}

export interface Settlement {
  id: string;
  space_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  occurred_on: string;
  note: string | null;
}

/**
 * A net balance between the viewer and one counterparty, as returned by the
 * `my_balances` RPC. `net > 0` → the counterparty will pay you; `net < 0` →
 * you will pay them. Never zero (the RPC drops settled pairs).
 */
export interface Balance {
  counterparty: string; // member user_id
  net: number;
}

/** Full payload for the Space detail screen. */
export interface SpaceDetail {
  space: Space;
  members: SpaceMember[];
  expenses: SharedExpense[];
  balances: Balance[];
}
