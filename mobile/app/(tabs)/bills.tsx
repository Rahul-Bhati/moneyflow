import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { computeEffectiveStatus, daysUntil, todayISO } from "@/lib/recurrence";
import { useTheme } from "@/lib/theme";
import { BILL_COLUMNS, type Bill, type BillStatus } from "@/lib/types";
import { AddBillSheet } from "@/components/bills/AddBillSheet";
import { BillCard } from "@/components/bills/BillCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COLUMN_WIDTH = SCREEN_WIDTH;

/**
 * Bills screen.
 *
 * On mobile, drag-across-columns is awkward — and `react-dnd` style libs
 * don't exist for RN out of the box. Per the M6 PRD, we use a paged
 * horizontal scroll (one column per screen) and **long-press a card → action
 * sheet** to move it between columns. The whole UX feels native and avoids
 * gesture conflict with the parent ScrollView.
 */
export default function BillsScreen() {
  const { t } = useTheme();
  const { getToken, isSignedIn } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [today, setToday] = useState<string>(todayISO());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<number>(1); // start on "Due This Week"
  const listRef = useRef<FlatList<(typeof BILL_COLUMNS)[number]>>(null);

  const load = useCallback(async () => {
    if (!isSignedIn) return;
    setError(null);
    try {
      const res = await api.listBills(getToken);
      setBills(res.bills);
      setToday(res.today);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load bills.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    load();
  }, [load]);

  // Pre-position to "Due This Week" once data is loaded.
  useEffect(() => {
    if (!loading) {
      // FlatList needs a tick to lay out.
      setTimeout(() => listRef.current?.scrollToIndex({ index: 1, animated: false }), 0);
    }
  }, [loading]);

  const grouped = useMemo(() => {
    const g: Record<BillStatus, Bill[]> = {
      upcoming: [],
      due_week: [],
      paid: [],
      overdue: [],
    };
    for (const b of bills) g[computeEffectiveStatus(b, today)].push(b);
    g.paid.sort((a, b) => (b.paid_on ?? "").localeCompare(a.paid_on ?? ""));
    (["upcoming", "due_week", "overdue"] as BillStatus[]).forEach((k) => {
      g[k].sort((a, b) => a.due_on.localeCompare(b.due_on));
    });
    return g;
  }, [bills, today]);

  const onLongPress = useCallback(
    (bill: Bill) => {
      const current = computeEffectiveStatus(bill, today);
      const options = ["Cancel", ...BILL_COLUMNS.map((c) => c.label), "Delete"];
      const cancelIndex = 0;
      const destructiveIndex = options.length - 1;

      const choose = async (i: number) => {
        if (i === cancelIndex) return;
        if (i === destructiveIndex) {
          confirmDelete(bill.id);
          return;
        }
        const target = BILL_COLUMNS[i - 1].key;
        if (target === current) return;

        const snapshot = bills;
        // Optimistic: write status locally so the user sees the card move.
        setBills((prev) =>
          prev.map((b) =>
            b.id === bill.id
              ? {
                  ...b,
                  status: target,
                  paid_on: target === "paid" ? today : null,
                }
              : b
          )
        );
        try {
          const updated = await api.updateBill(getToken, bill.id, { status: target });
          setBills((prev) => prev.map((b) => (b.id === bill.id ? updated : b)));
          // markPaid creates a recurrence clone server-side; pull fresh.
          if (target === "paid") load();
        } catch (e) {
          setBills(snapshot);
          Alert.alert("Couldn't move bill", e instanceof ApiError ? e.message : "Try again.");
        }
      };

      const confirmDelete = (id: string) => {
        Alert.alert("Delete bill?", "This can't be undone.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              const snapshot = bills;
              setBills((prev) => prev.filter((b) => b.id !== id));
              try {
                await api.deleteBill(getToken, id);
              } catch {
                setBills(snapshot);
              }
            },
          },
        ]);
      };

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: cancelIndex,
            destructiveButtonIndex: destructiveIndex,
            title: bill.name,
            message: `Currently in “${BILL_COLUMNS.find((c) => c.key === current)?.label}”`,
          },
          choose
        );
      } else {
        // Android fallback — Alert with the options as buttons.
        Alert.alert(
          bill.name,
          `Currently in “${BILL_COLUMNS.find((c) => c.key === current)?.label}”. Move to:`,
          [
            { text: "Cancel", style: "cancel" },
            ...BILL_COLUMNS.map((c, i) => ({
              text: c.label,
              onPress: () => choose(i + 1),
            })),
            {
              text: "Delete",
              style: "destructive" as const,
              onPress: () => choose(destructiveIndex),
            },
          ]
        );
      }
    },
    [bills, getToken, load, today]
  );

  const onAdded = useCallback((b: Bill) => {
    setBills((prev) => [b, ...prev]);
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / COLUMN_WIDTH);
      if (idx !== activeColumn) setActiveColumn(idx);
    },
    [activeColumn]
  );

  const totalDue = grouped.due_week.reduce((s, b) => s + b.amount, 0) +
    grouped.overdue.reduce((s, b) => s + b.amount, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, letterSpacing: -0.5 }}>
          Bills
        </Text>
        <Text style={{ fontSize: 12, color: t.muted, marginTop: 2, fontWeight: "500" }}>
          {totalDue > 0 ? `${money(totalDue)} due or overdue` : "Nothing pressing"}
        </Text>
      </View>

      {/* Pager tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: 12, gap: 6, marginBottom: 6 }}>
        {BILL_COLUMNS.map((col, i) => {
          const active = i === activeColumn;
          const count = grouped[col.key].length;
          return (
            <Pressable
              key={col.key}
              onPress={() => listRef.current?.scrollToIndex({ index: i, animated: true })}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: active ? t.accent : t.surface2,
                opacity: pressed ? 0.85 : 1,
                alignItems: "center",
              })}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: active ? t.accentInk : t.muted,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {col.label} · {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={t.muted} />
        </View>
      ) : error ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: t.expense, fontWeight: "600" }}>{error}</Text>
          <Pressable onPress={load} style={{ marginTop: 8 }}>
            <Text style={{ color: t.ink, fontWeight: "700" }}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={BILL_COLUMNS}
          keyExtractor={(c) => c.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          getItemLayout={(_, index) => ({
            length: COLUMN_WIDTH,
            offset: COLUMN_WIDTH * index,
            index,
          })}
          renderItem={({ item: col }) => {
            const list = grouped[col.key];
            return (
              <View style={{ width: COLUMN_WIDTH, paddingHorizontal: 16, paddingTop: 8 }}>
                <Text style={{ color: t.muted, fontSize: 11, marginBottom: 10, fontWeight: "600" }}>
                  {col.hint}
                </Text>
                <FlatList
                  data={list}
                  keyExtractor={(b) => b.id}
                  contentContainerStyle={{ paddingBottom: 120, gap: 8 }}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={() => {
                        setRefreshing(true);
                        load();
                      }}
                      tintColor={t.muted}
                    />
                  }
                  renderItem={({ item: bill }) => (
                    <BillCard
                      bill={bill}
                      effectiveStatus={col.key}
                      daysFromToday={daysUntil(bill.due_on, today)}
                      onLongPress={() => onLongPress(bill)}
                    />
                  )}
                  ListEmptyComponent={
                    <View
                      style={{
                        marginTop: 40,
                        padding: 24,
                        borderRadius: t.radiusXl,
                        borderColor: t.borderStrong,
                        borderStyle: "dashed",
                        borderWidth: 1,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: t.muted, fontSize: 13 }}>
                        {col.key === "paid"
                          ? "Long-press a card to move it here when paid."
                          : "Empty"}
                      </Text>
                    </View>
                  }
                />
              </View>
            );
          }}
        />
      )}

      <AddBillSheet onAdded={onAdded} />
    </SafeAreaView>
  );
}
