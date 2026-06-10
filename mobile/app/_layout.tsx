import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { tokenCache } from "@/lib/token-cache";
import { useTheme } from "@/lib/theme";

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY && __DEV__) {
  console.warn(
    "[clerk] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is unset. Auth won't work — add it to mobile/.env.local."
  );
}

/**
 * Auth gate.
 *
 * Expo Router renders this every time the route segments or auth state
 * change. We push the user into `(auth)/sign-in` when they're signed out,
 * and bounce them back to `(tabs)` when they're signed in — exactly as the
 * Clerk Expo docs recommend.
 */
function AuthRouter() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { t } = useTheme();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isLoaded, isSignedIn, segments, router]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator color={t.muted} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}

export default function RootLayout() {
  const { scheme } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY ?? ""} tokenCache={tokenCache}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <AuthRouter />
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
