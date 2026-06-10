import { useAuth } from "@clerk/clerk-expo";
import { Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "@/lib/api";
import { money, periodLabel } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import type {
  DailyTotal,
  ListTransactionsResponse,
  Period,
  Transaction,
} from "@/lib/types";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { SegmentedFilter } from "@/components/ui/SegmentedFilter";
import { SpendChart } from "@/components/SpendChart";
import { SummaryCards } from "@/components/SummaryCards";

/**
 * Home / Dashboard.
 *
 * Two-call pattern:
 *   1) /api/transactions?period=X — list + totals for the selected period.
 *   2) /api/analytics?period=X — used solely for the 14-day sparkline-ish bar
 *      strip via `dailyTotals`. Cheap, single call, no extra round trip when
 *      switching periods (we cache the 84-day window since the server
 *      returns it regardless of period).
 */
export default function HomeScreen() {
  const { t } = useTheme();
  const { getToken, isSignedIn } = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<ListTransactionsResponse | null>(null);
  const [daily, setDaily] = useState<DailyTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: Period) => {
      if (!isSignedIn) return;
      setError(null);
      try {
        const [list, analytics] = await Promise.all([
          api.listTransactions(getToken, { period: p }),
          api.getAnalytics(getToken, p),
        ]);
        setData(list);
        // Take just the last 14 days for the home strip.
        setDaily(analytics.dailyTotals.slice(-14));
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Couldn't load data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getToken, isSignedIn]
  );

  useEffect(() => {
    setLoading(true);
    load(period);
  }, [period, load]);

  const onAdded = useCallback(
    (tx: Transaction) => {
      // Optimistic: prepend then re-pull (cheap).
      setData((prev) =>
        prev
          ? {
              transactions: [tx, ...prev.transactions],
              totals: prev.totals, // server will reconcile on next load
            }
          : prev
      );
      load(period);
    },
    [load, period]
  );

  const onDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete entry?", "This can't be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const snapshot = data;
            setData((prev) =>
              prev
                ? { ...prev, transactions: prev.transactions.filter((x) => x.id !== id) }
                : prev
            );
            try {
              await api.deleteTransaction(getToken, id);
              load(period);
            } catch {
              setData(snapshot);
            }
          },
        },
      ]);
    },
    [data, getToken, load, period]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, letterSpacing: -0.5 }}>
          MoneyFlow
        </Text>
        <Text style={{ fontSize: 12, color: t.muted, marginTop: 2, fontWeight: "500" }}>
          {periodLabel(period)}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 14 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(period);
            }}
            tintColor={t.muted}
          />
        }
      >
        <SegmentedFilter value={period} onChange={setPeriod} />

        {loading && !data ? (
          <View style={{ paddingVertical: 80, alignItems: "center" }}>
            <ActivityIndicator color={t.muted} />
          </View>
        ) : error ? (
          <View
            style={{
              padding: 16,
              borderRadius: t.radiusXl,
              borderColor: t.expenseSoft,
              borderWidth: 1,
              backgroundColor: t.surface,
            }}
          >
            <Text style={{ color: t.expense, fontWeight: "600" }}>{error}</Text>
            <Pressable onPress={() => load(period)} style={{ marginTop: 8 }}>
              <Text style={{ color: t.ink, fontWeight: "700" }}>Try again</Text>
            </Pressable>
          </View>
        ) : data ? (
          <>
            <SummaryCards totals={data.totals} period={period} />
            <SpendChart buckets={daily} />
            <History transactions={data.transactions.slice(0, 20)} onDelete={onDelete} />
          </>
        ) : null}
      </ScrollView>

      <AddTransactionSheet onAdded={onAdded} />
    </SafeAreaView>
  );
}

function History({
  transactions,
  onDelete,
}: {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}) {
  const { t } = useTheme();
  if (transactions.length === 0) {
    return (
      <View
        style={{
          padding: 18,
          borderRadius: t.radiusXl,
          backgroundColor: t.surface,
          borderColor: t.border,
          borderWidth: 1,
        }}
      >
        <Text style={{ color: t.muted, textAlign: "center" }}>
          No entries yet — tap “Add entry” to get going.
        </Text>
      </View>
    );
  }
  return (
    <View>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: t.muted,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        History
      </Text>
      <View style={{ gap: 8 }}>
        {transactions.map((tx) => (
          <Row key={tx.id} tx={tx} onDelete={() => onDelete(tx.id)} />
        ))}
      </View>
    </View>
  );
}

function Row({ tx, onDelete }: { tx: Transaction; onDelete: () => void }) {
  const { t } = useTheme();
  const income = tx.type === "income";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: t.surface,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: t.radiusLg,
        padding: 12,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.ink, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>
          {tx.description || tx.category}
        </Text>
        <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
          {tx.category} · {tx.occurred_on}
        </Text>
      </View>
      <Text
        style={{
          fontVariant: ["tabular-nums"],
          color: income ? t.income : t.expense,
          fontWeight: "700",
          fontSize: 15,
          marginLeft: 12,
        }}
      >
        {income ? "+" : "−"}
        {money(tx.amount)}
      </Text>
      <Pressable
        onPress={onDelete}
        hitSlop={8}
        style={({ pressed }) => ({
          marginLeft: 10,
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 0.4,
        })}
      >
        <Trash2 color={t.muted} size={15} />
      </Pressable>
    </View>
  );
}
