import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
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
  const { isLoaded, isSignedIn, getToken } = useAuth();
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

  // Dev-only sanity check: when the user is signed in, hit /api/whoami once
  // and log what the server sees. This makes Bearer-auth bugs visible
  // without needing a debugger — they just appear in the Metro terminal.
  //
  // NOTE: we deliberately depend only on `isLoaded` + `isSignedIn` here.
  // Clerk's `getToken` is a NEW function reference on every render — if it's
  // in the dep array the effect re-fires forever (which was hammering
  // /api/whoami in our logs).
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  useEffect(() => {
    if (!__DEV__ || !isLoaded || !isSignedIn) return;
    const base = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!base) return;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const res = await fetch(`${base}/api/whoami`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        const data = await res.json();
        console.log("[whoami]", res.status, JSON.stringify(data, null, 2));
        if (token) {
          // Log just the JWT header so we can verify the issuer matches
          // the server's Clerk instance.
          const [headerB64, payloadB64] = token.split(".");
          const decode = (b64: string) => {
            try {
              const padded = b64 + "===".slice((b64.length + 3) % 4);
              const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
              return JSON.parse(globalThis.atob(normalized));
            } catch {
              return null;
            }
          };
          console.log("[token.header]", decode(headerB64));
          const payload = decode(payloadB64);
          if (payload) {
            console.log("[token.payload]", {
              iss: payload.iss,
              aud: payload.aud,
              sub: payload.sub,
              exp: payload.exp,
              azp: payload.azp,
            });
          }
        }
      } catch (e) {
        console.warn("[whoami] failed:", e);
      }
    })();
    // Intentionally omit getToken — read via ref above. See comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

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
