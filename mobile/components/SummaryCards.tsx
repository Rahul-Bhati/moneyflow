import { Text, View } from "react-native";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react-native";
import { money, PERIOD_WORD } from "@/lib/format";
import type { Period, Totals } from "@/lib/types";
import { useTheme } from "@/lib/theme";

export function SummaryCards({ totals, period }: { totals: Totals; period: Period }) {
  const { t } = useTheme();
  const positive = totals.net >= 0;

  return (
    <View style={{ gap: 12 }}>
      {/* Big card */}
      <View
        style={{
          backgroundColor: t.accent,
          borderRadius: t.radius2xl,
          paddingVertical: 26,
          paddingHorizontal: 24,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Wallet color={t.accentInk} size={15} />
          <Text style={{ color: t.accentInk, opacity: 0.7, fontSize: 13, fontWeight: "500" }}>
            Net balance {PERIOD_WORD[period]}
          </Text>
        </View>
        <Text
          style={{
            marginTop: 8,
            color: t.accentInk,
            fontSize: 38,
            fontWeight: "800",
            letterSpacing: -1,
          }}
        >
          {money(totals.net)}
        </Text>
        <Text style={{ marginTop: 10, color: t.accentInk, opacity: 0.6, fontSize: 13 }}>
          {totals.count === 0
            ? "No activity yet — add your first entry below."
            : `${totals.count} ${totals.count === 1 ? "entry" : "entries"} · ${
                positive ? "you're in the green" : "spending over earning"
              }`}
        </Text>
      </View>

      {/* Earned / Spent */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Stat label="Earned" value={totals.income} tone="income" Icon={ArrowDownLeft} />
        <Stat label="Spent" value={totals.expense} tone="expense" Icon={ArrowUpRight} />
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  tone,
  Icon,
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
  Icon: React.ComponentType<{ color: string; size: number }>;
}) {
  const { t } = useTheme();
  const color = tone === "income" ? t.income : t.expense;
  const bg = tone === "income" ? t.incomeSoft : t.expenseSoft;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.surface,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: t.radiusXl,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon color={color} size={14} />
        </View>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "500" }}>{label}</Text>
      </View>
      <Text style={{ marginTop: 10, color: t.ink, fontSize: 22, fontWeight: "700" }}>
        {money(value)}
      </Text>
    </View>
  );
}
