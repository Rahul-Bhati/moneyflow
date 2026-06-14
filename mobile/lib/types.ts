// Mirror of src/lib/types.ts in the web app. Keep in sync. (M6 keeps it as a
// duplicate intentionally — a shared package is premature with one consumer.)

export type TxType = "expense" | "income";

export interface Transaction {
  id: string;
  amount: number;
  type: TxType;
  description: string;
  category: string;
  occurred_on: string;
  created_at: string;
}

export type Period = "day" | "week" | "month" | "year";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

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

export const CURRENCY = "INR";
export const LOCALE = "en-IN";

// ---------------------------------------------------------------------------
// Bills / Subscriptions
// ---------------------------------------------------------------------------
export type BillStatus = "upcoming" | "due_week" | "paid" | "overdue";

export type Recurrence = "none" | "weekly" | "monthly" | "yearly";

export interface Bill {
  id: string;
  name: string;
  amount: number;
  due_on: string;
  status: BillStatus;
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

// API response shapes (mirror what M5's API routes return)
export interface Totals {
  income: number;
  expense: number;
  net: number;
  count: number;
}

export interface ListTransactionsResponse {
  transactions: Transaction[];
  totals: Totals;
}

export interface CategoryTotal {
  category: string;
  expense: number;
  income: number;
  count: number;
}

export interface DailyTotal {
  date: string;
  expense: number;
  income: number;
}

export interface MonthTotal {
  month: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface AnalyticsResponse {
  period: Period;
  totals: Totals;
  byCategory: CategoryTotal[];
  dailyTotals: DailyTotal[];
  monthTrend: MonthTotal[];
  topExpenses: Transaction[];
}

export interface BillsResponse {
  bills: Bill[];
  grouped: {
    upcoming: Bill[];
    due_week: Bill[];
    paid: Bill[];
    overdue: Bill[];
  };
  today: string;
}

// ---------------------------------------------------------------------------
// Spaces — privacy-scoped shared expense splitting (M9). Mirror of web types.
// ---------------------------------------------------------------------------
export type MemberRole = "owner" | "member";

export interface Space {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
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
  occurred_on: string;
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

export interface Balance {
  counterparty: string;
  net: number;
}

export interface SpaceDetail {
  space: Space;
  members: SpaceMember[];
  expenses: SharedExpense[];
  balances: Balance[];
}
