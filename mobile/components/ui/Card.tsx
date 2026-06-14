import { View, type ViewProps } from "react-native";
import { useTheme } from "@/lib/theme";

/** Surface card — the basic building block, same look as web's bg-surface card. */
export function Card({ style, children, ...props }: ViewProps) {
  const { t } = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: t.surface,
          borderColor: t.border,
          borderWidth: 1,
          borderRadius: t.radiusXl,
          // iOS-style smoothed corners. No-op on Android — but the rounded
          // look matters more on iOS where users notice the difference.
          borderCurve: "continuous",
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
