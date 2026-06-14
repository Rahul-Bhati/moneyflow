import { useMemo } from "react";
import { Text, View } from "react-native";
import type { DailyTotal } from "@/lib/types";
import { useTheme } from "@/lib/theme";

/**
 * Lightweight bar chart for the Home screen: takes the API's `dailyTotals`
 * window and renders one pair of bars (income + expense) per day.
 *
 * We deliberately don't pull a chart library — for 14–30 bars, View+flex is
 * faster, smaller, and the styling matches our tokens exactly.
 */
export function SpendChart({ buckets }: { buckets: DailyTotal[] }) {
  const { t } = useTheme();
  const max = useMemo(
    () => Math.max(1, ...buckets.map((b) => Math.max(b.expense, b.income))),
    [buckets]
  );

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
        Last {buckets.length} days
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 100, gap: 3 }}>
        {buckets.map((b) => {
          const ih = (b.income / max) * 100;
          const eh = (b.expense / max) * 100;
          return (
            <View key={b.date} style={{ flex: 1, height: "100%", justifyContent: "flex-end" }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 1, height: "100%" }}>
                <View
                  style={{
                    flex: 1,
                    height: `${ih}%`,
                    backgroundColor: t.income,
                    borderRadius: 2,
                    minHeight: ih > 0 ? 2 : 0,
                  }}
                />
                <View
                  style={{
                    flex: 1,
                    height: `${eh}%`,
                    backgroundColor: t.expense,
                    borderRadius: 2,
                    minHeight: eh > 0 ? 2 : 0,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ marginTop: 12, flexDirection: "row", gap: 14 }}>
        <Legend color={t.income} label="Earned" />
        <Legend color={t.expense} label="Spent" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: t.muted, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}
