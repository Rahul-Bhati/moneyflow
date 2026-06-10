import { Pressable, Text, View } from "react-native";
import { PERIODS, type Period } from "@/lib/types";
import { useTheme } from "@/lib/theme";

/** Pill-row period selector. Same UX as the web SegmentedFilter. */
export function SegmentedFilter({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const { t } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.surface2,
        borderRadius: 999,
        padding: 4,
      }}
    >
      {PERIODS.map((p) => {
        const active = p.key === value;
        return (
          <Pressable
            key={p.key}
            onPress={() => onChange(p.key)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 9,
              alignItems: "center",
              borderRadius: 999,
              backgroundColor: active ? t.accent : "transparent",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: active ? t.accentInk : t.muted,
              }}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
