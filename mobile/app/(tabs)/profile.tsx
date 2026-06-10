import { useAuth, useUser } from "@clerk/clerk-expo";
import { LogOut, Mail, User as UserIcon } from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiBaseUrl } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export default function ProfileScreen() {
  const { t } = useTheme();
  const { signOut } = useAuth();
  const { user } = useUser();

  const email = user?.primaryEmailAddress?.emailAddress ?? "—";
  const name = user?.fullName || user?.firstName || "Friend";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, letterSpacing: -0.5 }}>
          Profile
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        {/* Identity card */}
        <View
          style={{
            backgroundColor: t.surface,
            borderColor: t.border,
            borderWidth: 1,
            borderRadius: t.radiusXl,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          {user?.imageUrl ? (
            <Image
              source={{ uri: user.imageUrl }}
              style={{ width: 56, height: 56, borderRadius: 28 }}
            />
          ) : (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: t.surface2,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserIcon color={t.muted} size={24} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 16 }}>{name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Mail color={t.muted} size={12} />
              <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>
                {email}
              </Text>
            </View>
          </View>
        </View>

        {/* Info card */}
        <View
          style={{
            backgroundColor: t.surface,
            borderColor: t.border,
            borderWidth: 1,
            borderRadius: t.radiusXl,
            padding: 16,
          }}
        >
          <Row label="App" value="MoneyFlow Mobile" />
          <Row label="API endpoint" value={apiBaseUrl || "(not configured)"} mono />
        </View>

        {/* Sign out */}
        <Pressable
          onPress={() => signOut()}
          style={({ pressed }) => ({
            backgroundColor: t.surface,
            borderColor: t.expenseSoft,
            borderWidth: 1,
            borderRadius: t.radiusXl,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <LogOut color={t.expense} size={18} />
          <Text style={{ color: t.expense, fontWeight: "700", fontSize: 14 }}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const { t } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: "500" }}>{label}</Text>
      <Text
        style={{
          color: t.ink,
          fontSize: 13,
          fontWeight: "500",
          fontFamily: mono ? t.font.mono : t.font.display,
          maxWidth: "65%",
        }}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
    </View>
  );
}
