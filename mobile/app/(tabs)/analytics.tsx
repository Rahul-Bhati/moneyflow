import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { useStableToken } from "@/lib/useStableToken";
import { useTheme } from "@/lib/theme";
import type { AnalyticsResponse, Period } from "@/lib/types";
import { SegmentedFilter } from "@/components/ui/SegmentedFilter";

/**
 * Analytics screen.
 *
 * We chose lightweight, hand-rolled visualizations over a chart library
 * (victory-native pulls Skia + a lot of native code; for the volume of data
 * this app handles, pure RN Views are faster and themed perfectly). The
 * heatmap is a 12×7 grid using color-mix-like alpha. The trend is a
 * horizontal bar list. Category breakdown is a stacked bar.
 */
export default function AnalyticsScreen() {
  const { t } = useTheme();
  const { isSignedIn } = useAuth();
  // Stable getter — see lib/useStableToken.ts. Without this, Clerk's
  // re-created getToken on every render would loop the load effect.
  const getToken = useStableToken();
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: Period) => {
      if (!isSignedIn) return;
      setError(null);
      try {
        const a = await api.getAnalytics(getToken, p);
        setData(a);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load analytics.");
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, letterSpacing: -0.5 }}>
          Analytics
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 14 }}
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
          <Text style={{ color: t.expense }}>{error}</Text>
        ) : data ? (
          <>
            <StatsStrip data={data} />
            <CategoryBreakdown data={data} />
            <MonthTrend data={data} />
            <Heatmap data={data} />
            <TopExpenses data={data} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
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
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: t.muted,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function StatsStrip({ data }: { data: AnalyticsResponse }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Stat label="Earned" value={data.totals.income} color={t.income} />
      <Stat label="Spent" value={data.totals.expense} color={t.expense} />
      <Stat label="Net" value={data.totals.net} color={t.ink} />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const { t } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.surface,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: t.radiusLg,
        borderCurve: "continuous",
        padding: 10,
      }}
    >
      <Text style={{ color: t.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color, fontSize: 15, fontWeight: "700", marginTop: 4 }}>
        {money(value)}
      </Text>
    </View>
  );
}

function CategoryBreakdown({ data }: { data: AnalyticsResponse }) {
  const { t } = useTheme();
  const expenses = data.byCategory.filter((c) => c.expense > 0);
  if (expenses.length === 0) {
    return (
      <Panel title="Where the money went">
        <Text style={{ color: t.muted, textAlign: "center", paddingVertical: 18 }}>
          No expenses to break down yet.
        </Text>
      </Panel>
    );
  }
  const total = expenses.reduce((s, c) => s + c.expense, 0);
  return (
    <Panel title="Where the money went">
      <View style={{ gap: 10 }}>
        {expenses.slice(0, 8).map((c) => {
          const pct = (c.expense / total) * 100;
          return (
            <View key={c.category}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ color: t.ink, fontSize: 13, fontWeight: "600" }}>{c.category}</Text>
                <Text style={{ color: t.muted, fontSize: 12, fontWeight: "500" }}>
                  {money(c.expense)} · {pct.toFixed(0)}%
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: t.surface2, borderRadius: 3, overflow: "hidden" }}>
                <View
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    backgroundColor: t.expense,
                    borderRadius: 3,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}

function MonthTrend({ data }: { data: AnalyticsResponse }) {
  const { t } = useTheme();
  const max = Math.max(
    1,
    ...data.monthTrend.flatMap((m) => [m.income, m.expense])
  );
  const any = data.monthTrend.some((m) => m.income > 0 || m.expense > 0);
  return (
    <Panel title="6-month trend">
      {!any ? (
        <Text style={{ color: t.muted, textAlign: "center", paddingVertical: 18 }}>
          Not enough history yet.
        </Text>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 120 }}>
          {data.monthTrend.map((m) => (
            <View key={m.month} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <View style={{ flexDirection: "row", height: 100, gap: 2, alignItems: "flex-end" }}>
                <View
                  style={{
                    width: 8,
                    height: `${(m.income / max) * 100}%`,
                    backgroundColor: t.income,
                    borderRadius: 2,
                  }}
                />
                <View
                  style={{
                    width: 8,
                    height: `${(m.expense / max) * 100}%`,
                    backgroundColor: t.expense,
                    borderRadius: 2,
                  }}
                />
              </View>
              <Text style={{ color: t.muted, fontSize: 10, fontWeight: "600" }}>{m.label}</Text>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

function Heatmap({ data }: { data: AnalyticsResponse }) {
  const { t } = useTheme();
  // Take 84 days (12 weeks). Build columns of 7.
  const max = Math.max(1, ...data.dailyTotals.map((d) => d.expense));
  const cells = data.dailyTotals.slice(-84);
  // Pad to a multiple of 7 at the start
  const pad = (7 - (cells.length % 7)) % 7;
  const padded = [...Array(pad).fill(null), ...cells];
  const weeks: ((typeof cells)[number] | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  return (
    <Panel title="Daily spend (12 weeks)">
      <View style={{ flexDirection: "row", gap: 3 }}>
        {weeks.map((wk, i) => (
          <View key={i} style={{ flex: 1, gap: 3 }}>
            {wk.map((c, j) => {
              const intensity = c ? Math.min(1, c.expense / max) : 0;
              return (
                <View
                  key={j}
                  style={{
                    aspectRatio: 1,
                    borderRadius: 3,
                    backgroundColor: c
                      ? blend(t.surface2, t.expense, intensity)
                      : t.surface2,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </Panel>
  );
}

/**
 * Linear interpolate between two CSS-color strings (hex or rgba). Cheap and
 * good enough — no color-mix() in RN, so we hand-mix in sRGB.
 */
function blend(from: string, to: string, t: number): string {
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return from;
  const mix = (i: number) => Math.round(a[i] * (1 - t) + b[i] * t);
  return `rgba(${mix(0)}, ${mix(1)}, ${mix(2)}, 1)`;
}

function parseColor(c: string): [number, number, number] | null {
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    if (hex.length === 6)
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(",").map((s) => parseFloat(s.trim()));
    return [r, g, b];
  }
  return null;
}

function TopExpenses({ data }: { data: AnalyticsResponse }) {
  const { t } = useTheme();
  if (data.topExpenses.length === 0) {
    return (
      <Panel title="Top expenses">
        <Text style={{ color: t.muted, textAlign: "center", paddingVertical: 18 }}>
          Nothing big to call out (yet).
        </Text>
      </Panel>
    );
  }
  return (
    <Panel title="Top expenses">
      <View style={{ gap: 8 }}>
        {data.topExpenses.map((tx, i) => (
          <View
            key={tx.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 6,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: t.expenseSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: t.expense, fontSize: 11, fontWeight: "700" }}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
                {tx.description || tx.category}
              </Text>
              <Text style={{ color: t.muted, fontSize: 11 }}>
                {tx.category} · {tx.occurred_on}
              </Text>
            </View>
            <Text style={{ color: t.expense, fontWeight: "700", fontSize: 14 }}>
              {money(tx.amount)}
            </Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}
