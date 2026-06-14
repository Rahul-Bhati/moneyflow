import Constants from "expo-constants";
import type {
  AnalyticsResponse,
  Bill,
  BillsResponse,
  BillStatus,
  ExpenseParticipant,
  ListTransactionsResponse,
  Period,
  Recurrence,
  Settlement,
  SharedExpense,
  Space,
  SpaceDetail,
  SpaceMember,
  Transaction,
} from "./types";

/**
 * The mobile app speaks ONLY to the Next.js API routes from M5 — never
 * directly to Supabase. Every call attaches the current Clerk session token
 * as a Bearer header; the server's middleware reads that, resolves the user
 * via Clerk, and Supabase RLS scopes the query.
 *
 * Pattern: components grab `getToken` from `useAuth()` and pass it into the
 * `client(getToken)` factory below. We avoid importing Clerk inside this
 * module to keep it framework-agnostic and trivially testable.
 */

type GetToken = () => Promise<string | null>;

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  Constants.expoConfig?.extra?.apiBaseUrl ??
  "";

if (!BASE_URL && __DEV__) {
  // Fail loudly in dev — silent 404s are a nightmare to debug.
  console.warn(
    "[api] EXPO_PUBLIC_API_BASE_URL is unset. The mobile app cannot reach the Next.js backend. " +
      "Add it to mobile/.env.local — it must be your computer's LAN IP, NOT localhost."
  );
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  getToken: GetToken,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError(
      0,
      "EXPO_PUBLIC_API_BASE_URL is empty — set it in mobile/.env.local and restart with -c."
    );
  }

  let token: string | null;
  try {
    token = await getToken();
  } catch (e) {
    throw new ApiError(401, `Token error: ${e instanceof Error ? e.message : "unknown"}`);
  }
  if (!token) throw new ApiError(401, "Not signed in.");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const url = `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    // Network errors (DNS, unreachable, certificate) land here.
    const reason = e instanceof Error ? e.message : "Network request failed";
    throw new ApiError(
      0,
      `Can't reach ${BASE_URL}. ${reason}. Confirm phone+laptop are on the same Wi-Fi and the laptop's Next dev server is up.`
    );
  }

  // Handle empty bodies (DELETE may, but our API always returns JSON).
  const text = await res.text();
  const data: unknown = text ? safeParse(text) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------
// Endpoint surface — one function per (verb, route), matched to the M5 API.
// ---------------------------------------------------------------------------
export const api = {
  listTransactions(
    getToken: GetToken,
    opts: { period?: Period; category?: string } = {}
  ): Promise<ListTransactionsResponse> {
    const q = new URLSearchParams();
    if (opts.period) q.set("period", opts.period);
    if (opts.category) q.set("category", opts.category);
    const qs = q.toString();
    return request(getToken, `/api/transactions${qs ? `?${qs}` : ""}`);
  },

  createTransaction(
    getToken: GetToken,
    body: {
      amount: number;
      type: "income" | "expense";
      description: string;
      category: string;
      occurred_on: string;
    }
  ): Promise<Transaction> {
    return request(getToken, "/api/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  deleteTransaction(getToken: GetToken, id: string): Promise<{ id: string }> {
    return request(getToken, `/api/transactions/${id}`, { method: "DELETE" });
  },

  getAnalytics(getToken: GetToken, period: Period = "month"): Promise<AnalyticsResponse> {
    return request(getToken, `/api/analytics?period=${period}`);
  },

  listBills(getToken: GetToken): Promise<BillsResponse> {
    return request(getToken, "/api/bills");
  },

  createBill(
    getToken: GetToken,
    body: { name: string; amount: number; due_on: string; recurrence: Recurrence }
  ): Promise<Bill> {
    return request(getToken, "/api/bills", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateBill(
    getToken: GetToken,
    id: string,
    patch: Partial<{
      name: string;
      amount: number;
      due_on: string;
      recurrence: Recurrence;
      status: BillStatus;
    }>
  ): Promise<Bill> {
    return request(getToken, `/api/bills/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  deleteBill(getToken: GetToken, id: string): Promise<{ id: string }> {
    return request(getToken, `/api/bills/${id}`, { method: "DELETE" });
  },

  // --- Spaces (M9) ---------------------------------------------------------
  listSpaces(getToken: GetToken): Promise<Space[]> {
    return request(getToken, "/api/spaces");
  },

  getSpace(getToken: GetToken, id: string): Promise<SpaceDetail> {
    return request(getToken, `/api/spaces/${id}`);
  },

  createSpace(getToken: GetToken, body: { name: string }): Promise<Space> {
    return request(getToken, "/api/spaces", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  createInvite(getToken: GetToken, spaceId: string): Promise<{ token: string }> {
    return request(getToken, `/api/spaces/${spaceId}/invites`, { method: "POST" });
  },

  joinSpace(getToken: GetToken, token: string): Promise<SpaceMember> {
    return request(getToken, "/api/spaces/join", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  addSharedExpense(
    getToken: GetToken,
    spaceId: string,
    body: {
      amount: number;
      description: string;
      category: string;
      occurred_on: string;
      participants: ExpenseParticipant[];
    }
  ): Promise<SharedExpense> {
    return request(getToken, `/api/spaces/${spaceId}/expenses`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  recordSettlement(
    getToken: GetToken,
    spaceId: string,
    body: {
      counterparty: string;
      direction: "paid" | "received";
      amount: number;
      occurred_on: string;
      note?: string;
    }
  ): Promise<Settlement> {
    return request(getToken, `/api/spaces/${spaceId}/settlements`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

export const apiBaseUrl = BASE_URL;
