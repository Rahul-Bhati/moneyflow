import { Pressable, Text, View } from "react-native";
import { CalendarClock, Repeat } from "lucide-react-native";
import { money, shortDate } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import type { Bill, BillStatus } from "@/lib/types";

const RECURRENCE_LABEL: Record<Bill["recurrence"], string> = {
  none: "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function BillCard({
  bill,
  effectiveStatus,
  daysFromToday,
  onLongPress,
}: {
  bill: Bill;
  effectiveStatus: BillStatus;
  daysFromToday: number;
  onLongPress: () => void;
}) {
  const { t } = useTheme();
  const accent: Record<BillStatus, string> = {
    upcoming: t.border,
    due_week: t.expenseSoft,
    paid: t.incomeSoft,
    overdue: t.expense,
  };
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={250}
      style={({ pressed }) => ({
        backgroundColor: t.surface,
        borderRadius: t.radiusLg,
        borderColor: accent[effectiveStatus],
        borderWidth: 1,
        padding: 14,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
            {bill.name}
          </Text>
          <Text
            style={{
              color: t.ink,
              fontWeight: "800",
              fontSize: 18,
              marginTop: 2,
            }}
          >
            {money(bill.amount)}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <CalendarClock color={t.muted} size={11} />
          <Text style={{ color: t.muted, fontSize: 11 }}>
            {shortDate(bill.due_on)}
            {effectiveStatus !== "paid" && (
              <Text>
                {"  "}
                {daysFromToday === 0
                  ? "today"
                  : daysFromToday > 0
                  ? `in ${daysFromToday}d`
                  : `${Math.abs(daysFromToday)}d late`}
              </Text>
            )}
          </Text>
        </View>
        {bill.recurrence !== "none" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Repeat color={t.muted} size={11} />
            <Text style={{ color: t.muted, fontSize: 11 }}>
              {RECURRENCE_LABEL[bill.recurrence]}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
