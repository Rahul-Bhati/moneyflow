import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Plus, UserPlus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError, apiBaseUrl } from "@/lib/api";
import { money } from "@/lib/format";
import { todayISO } from "@/lib/recurrence";
import { summarizeBalances } from "@/lib/splits";
import { useStableToken } from "@/lib/useStableToken";
import { useTheme } from "@/lib/theme";
import type { Balance, SpaceDetail } from "@/lib/types";
import { AddExpenseSheet } from "@/components/spaces/AddExpenseSheet";

export default function SpaceDetailScreen() {
  const { t } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isSignedIn, userId } = useAuth();
  const meId = userId ?? "";
  const getToken = useStableToken();
  const router = useRouter();

  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<SpaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!isSignedIn || !id) return;
    setError(null);
    try {
      setDetail(await api.getSpace(getToken, id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this space.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, isSignedIn, id]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = useMemo(() => {
    const m = new Map((detail?.members ?? []).map((x) => [x.user_id, x.display_name]));
    return (uid: string) => (uid === meId ? "You" : m.get(uid) ?? "Someone");
  }, [detail?.members, meId]);

  const summary = detail ? summarizeBalances(detail.balances) : null;

  async function invite() {
    if (!id) return;
    try {
      const { token } = await api.createInvite(getToken, id);
      const link = `${apiBaseUrl}/join/${token}`;
      await Share.share({ message: `Join my MoneyFlow space: ${link}` });
    } catch (e) {
      Alert.alert("Couldn't create invite", e instanceof ApiError ? e.message : "Try again.");
    }
  }

  function settle(b: Balance) {
    const paying = b.net < 0;
    const name = nameOf(b.counterparty);
    Alert.alert(
      "Settle up",
      paying
        ? `Record that you paid ${name} ${money(-b.net)}?`
        : `Record that ${name} paid you ${money(b.net)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Record",
          onPress: async () => {
            try {
              await api.recordSettlement(getToken, id!, {
                counterparty: b.counterparty,
                direction: paying ? "paid" : "received",
                amount: Math.abs(b.net),
                occurred_on: todayISO(),
              });
              load();
            } catch (e) {
              Alert.alert("Failed", e instanceof ApiError ? e.message : "Try again.");
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      {/* header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 6 }}>
          <ArrowLeft color={t.ink} size={22} />
        </Pressable>
        <Text style={{ flex: 1, color: t.ink, fontWeight: "800", fontSize: 17 }} numberOfLines={1}>
          {detail?.space.name ?? "Space"}
        </Text>
        <Pressable onPress={invite} hitSlop={8} style={{ padding: 6 }}>
          <UserPlus color={t.ink} size={20} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 16 }}
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
      >
        {loading && !detail ? (
          <View style={{ paddingVertical: 80, alignItems: "center" }}>
            <ActivityIndicator color={t.muted} />
          </View>
        ) : error ? (
          <View style={{ padding: 16, borderRadius: t.radiusXl, borderCurve: "continuous", borderColor: t.expenseSoft, borderWidth: 1, backgroundColor: t.surface }}>
            <Text style={{ color: t.expense, fontWeight: "600" }}>{error}</Text>
            <Pressable onPress={load} style={{ marginTop: 8 }}>
              <Text style={{ color: t.ink, fontWeight: "700" }}>Try again</Text>
            </Pressable>
          </View>
        ) : detail && summary ? (
          <>
            {/* net summary */}
            <View
              style={{
                backgroundColor: t.surface,
                borderColor: t.border,
                borderWidth: 1,
                borderRadius: t.radiusXl,
                borderCurve: "continuous",
                padding: 16,
              }}
            >
              {summary.settled ? (
                <Text style={{ textAlign: "center", color: t.muted, fontWeight: "600" }}>
                  All settled up 🎉
                </Text>
              ) : (
                <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: t.muted, fontSize: 12 }}>You&apos;ll get</Text>
                    <Text style={{ color: t.income, fontWeight: "800", fontSize: 20, fontVariant: ["tabular-nums"], marginTop: 2 }}>
                      {money(summary.toReceive)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: t.muted, fontSize: 12 }}>You&apos;ll pay</Text>
                    <Text style={{ color: t.expense, fontWeight: "800", fontSize: 20, fontVariant: ["tabular-nums"], marginTop: 2 }}>
                      {money(summary.toPay)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* balances */}
            {detail.balances.length > 0 && (
              <View>
                <Text style={{ color: t.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 8 }}>
                  Your balances
                </Text>
                <View style={{ gap: 8 }}>
                  {detail.balances.map((b) => {
                    const positive = b.net > 0;
                    return (
                      <View
                        key={b.counterparty}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: t.surface,
                          borderColor: t.border,
                          borderWidth: 1,
                          borderRadius: t.radiusLg,
                          borderCurve: "continuous",
                          padding: 12,
                        }}
                      >
                        <View>
                          <Text style={{ color: t.ink, fontWeight: "700" }}>{nameOf(b.counterparty)}</Text>
                          <Text style={{ color: positive ? t.income : t.expense, fontWeight: "600", fontVariant: ["tabular-nums"], fontSize: 13, marginTop: 2 }}>
                            {positive ? `will pay you ${money(b.net)}` : `you'll pay ${money(-b.net)}`}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => settle(b)}
                          style={{ backgroundColor: t.surface2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}
                        >
                          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 12 }}>Settle up</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* expense feed */}
            <View>
              <Text style={{ color: t.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 8 }}>
                Shared expenses
              </Text>
              {detail.expenses.length === 0 ? (
                <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: t.radiusLg, borderCurve: "continuous", padding: 18 }}>
                  <Text style={{ color: t.muted, textAlign: "center" }}>
                    Nothing split yet. Tap “Add expense”.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {detail.expenses.map((e) => {
                    const myShare = e.participants.find((p) => p.user_id === meId)?.share_amount;
                    return (
                      <View
                        key={e.id}
                        style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: t.radiusLg, borderCurve: "continuous", padding: 12, flexDirection: "row", justifyContent: "space-between", gap: 10 }}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: t.ink, fontWeight: "600" }} numberOfLines={1}>{e.description}</Text>
                          <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
                            {nameOf(e.payer_id)} paid · {e.occurred_on} · {e.participants.length} way{e.participants.length === 1 ? "" : "s"}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ color: t.ink, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{money(e.amount)}</Text>
                          {myShare != null && (
                            <Text style={{ color: t.muted, fontSize: 11, fontVariant: ["tabular-nums"], marginTop: 2 }}>
                              your share {money(myShare)}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      {detail && (
        <Pressable
          onPress={() => setAdding(true)}
          style={{
            position: "absolute",
            bottom: Math.max(insets.bottom + 16, 28),
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            height: 54,
            paddingLeft: 20,
            paddingRight: 24,
            borderRadius: 999,
            backgroundColor: t.accent,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Plus color={t.accentInk} size={20} strokeWidth={2.6} />
          <Text style={{ color: t.accentInk, fontWeight: "700", fontSize: 15 }}>Add expense</Text>
        </Pressable>
      )}

      {detail && (
        <AddExpenseSheet
          open={adding}
          onClose={() => setAdding(false)}
          spaceId={id!}
          members={detail.members}
          meId={meId}
          onAdded={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </SafeAreaView>
  );
}
