import { useAuth } from "@clerk/clerk-expo";
import { FlashList } from "@shopify/flash-list";
import { Trash2 } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "@/lib/api";
import { money, periodLabel } from "@/lib/format";
import { useStableToken } from "@/lib/useStableToken";
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
  const { isSignedIn } = useAuth();
  // Stable identity — Clerk's raw getToken would re-create `load` every
  // render and put us in a refetch loop. See lib/useStableToken.ts.
  const getToken = useStableToken();
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

  // Slice once per render rather than inside the JSX so identity is stable
  // (FlashList diffs the `data` array reference).
  const visibleTx = useMemo(
    () => data?.transactions.slice(0, 20) ?? [],
    [data?.transactions]
  );

  // Stable `keyExtractor` for FlashList — defined outside the JSX so it's
  // not allocated on every render.
  const keyExtractor = useCallback((tx: Transaction) => tx.id, []);

  // Stable `renderItem` — uses the captured `onDelete` which is itself a
  // useCallback, so identity flips only when transactions or token change.
  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <Row tx={item} onDelete={onDelete} />
    ),
    [onDelete]
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

      {loading && !data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={t.muted} />
        </View>
      ) : error ? (
        <View style={{ padding: 16 }}>
          <View
            style={{
              padding: 16,
              borderRadius: t.radiusXl,
              borderCurve: "continuous",
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
        </View>
      ) : (
        // FlashList is the OUTER scrollable. The page header (summary, chart,
        // history title) lives in `ListHeaderComponent` so the transaction
        // rows below virtualize properly. Mixing a ScrollView with an inner
        // FlatList/.map() rendered ALL transactions even when off-screen.
        <FlashList
          data={visibleTx}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
          ItemSeparatorComponent={ItemGap}
          ListHeaderComponent={
            <ListHeader
              period={period}
              setPeriod={setPeriod}
              totals={data?.totals}
              daily={daily}
              hasHistory={visibleTx.length > 0}
            />
          }
          ListEmptyComponent={<EmptyHistory />}
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
        />
      )}

      <AddTransactionSheet onAdded={onAdded} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components — extracted out of the render body so their identity is
// stable, and their styles can live in StyleSheet-compatible plain objects
// instead of being reallocated each render.
// ---------------------------------------------------------------------------

function ItemGap() {
  return <View style={GAP_8} />;
}
const GAP_8 = { height: 8 };

function ListHeader({
  period,
  setPeriod,
  totals,
  daily,
  hasHistory,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
  totals: ListTransactionsResponse["totals"] | undefined;
  daily: DailyTotal[];
  hasHistory: boolean;
}) {
  const { t } = useTheme();
  return (
    <View style={{ gap: 14, marginBottom: hasHistory ? 14 : 0 }}>
      <SegmentedFilter value={period} onChange={setPeriod} />
      {totals ? (
        <>
          <SummaryCards totals={totals} period={period} />
          <SpendChart buckets={daily} />
          {hasHistory ? (
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: t.muted,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginTop: 6,
              }}
            >
              History
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function EmptyHistory() {
  const { t } = useTheme();
  return (
    <View
      style={{
        padding: 18,
        borderRadius: t.radiusXl,
        borderCurve: "continuous",
        backgroundColor: t.surface,
        borderColor: t.border,
        borderWidth: 1,
      }}
    >
      <Text style={{ color: t.muted, textAlign: "center" }}>
        No entries yet — tap "Add entry" to get going.
      </Text>
    </View>
  );
}

// memo: when the parent re-renders for any reason (period change, new
// transaction added at the top), unchanged rows stay mounted and skip render.
const Row = memo(_Row);

function _Row({ tx, onDelete }: { tx: Transaction; onDelete: (id: string) => void }) {
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
        borderCurve: "continuous",
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
        // Dispatcher pattern (react-state-dispatcher rule): pass tx.id back
        // to the parent's stable onDelete instead of capturing a per-row
        // closure. Lets the parent's useCallback identity stay stable, which
        // is what makes `Row` memo-friendly.
        onPress={() => onDelete(tx.id)}
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
