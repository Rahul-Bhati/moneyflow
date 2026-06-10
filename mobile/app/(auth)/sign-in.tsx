import { useSSO, useSignIn, useSignUp } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

/**
 * Minimal sign-in / sign-up screen.
 *
 * Two paths:
 *   - Google OAuth (one-tap via Clerk's `useOAuth` + Expo Linking).
 *   - Email + password — falls back to sign-up automatically if no account
 *     exists. (Magic links / email codes are a future polish.)
 *
 * We deliberately don't use Clerk's prebuilt RN components — they're
 * mid-development and the design doesn't match our tokens. Hand-rolling 60
 * lines of UI is cheaper than reskinning theirs.
 */
export default function SignInScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<null | "google" | "email">(null);
  const [error, setError] = useState<string | null>(null);

  const onGoogle = useCallback(async () => {
    try {
      setPending("google");
      setError(null);
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: Linking.createURL("/(tabs)", { scheme: "moneyflow" }),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (e) {
      setError(humanize(e));
    } finally {
      setPending(null);
    }
  }, [startSSOFlow, router]);

  const onEmail = useCallback(async () => {
    if (!signInLoaded || !signUpLoaded) return;
    if (!email.trim() || !password) {
      setError("Enter email and password.");
      return;
    }
    setPending("email");
    setError(null);
    try {
      // Try sign-in first.
      const attempt = await signIn.create({ identifier: email.trim(), password });
      if (attempt.status === "complete") {
        await setActiveSignIn({ session: attempt.createdSessionId });
        router.replace("/(tabs)");
        return;
      }
      // Multi-step flows (2FA etc) — out of scope for v1. Surface message.
      setError("Additional verification required. Use the web app for now.");
    } catch (signInErr) {
      // If the account doesn't exist, attempt sign-up automatically.
      const code = (signInErr as { errors?: { code?: string }[] }).errors?.[0]?.code;
      if (code === "form_identifier_not_found") {
        try {
          const result = await signUp.create({
            emailAddress: email.trim(),
            password,
          });
          if (result.status === "complete") {
            await setActiveSignUp({ session: result.createdSessionId });
            router.replace("/(tabs)");
            return;
          }
          // Email verification is the most common next step.
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setError(
            "Check your email for a verification code, then sign in on the web first to complete setup."
          );
        } catch (signUpErr) {
          setError(humanize(signUpErr));
        }
      } else {
        setError(humanize(signInErr));
      }
    } finally {
      setPending(null);
    }
  }, [
    email,
    password,
    signIn,
    signInLoaded,
    signUp,
    signUpLoaded,
    setActiveSignIn,
    setActiveSignUp,
    router,
  ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
          <Text
            style={{
              fontSize: 36,
              fontWeight: "800",
              color: t.ink,
              letterSpacing: -1,
            }}
          >
            MoneyFlow
          </Text>
          <Text style={{ marginTop: 6, fontSize: 15, color: t.muted }}>
            Sign in to track where it goes.
          </Text>

          {/* Google */}
          <Pressable
            onPress={onGoogle}
            disabled={pending !== null}
            style={({ pressed }) => ({
              marginTop: 32,
              height: 52,
              borderRadius: 16, borderCurve: "continuous",
              backgroundColor: t.surface,
              borderColor: t.borderStrong,
              borderWidth: 1,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed || pending === "google" ? 0.7 : 1,
            })}
          >
            {pending === "google" ? (
              <ActivityIndicator color={t.ink} />
            ) : (
              <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>
                Continue with Google
              </Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 22 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
            <Text style={{ marginHorizontal: 12, color: t.muted, fontSize: 12 }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
          </View>

          {/* Email + password */}
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={t.muted}
            style={{
              height: 50,
              paddingHorizontal: 16,
              borderRadius: 14, borderCurve: "continuous",
              backgroundColor: t.surface,
              borderColor: t.border,
              borderWidth: 1,
              color: t.ink,
              fontSize: 15,
            }}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor={t.muted}
            style={{
              marginTop: 10,
              height: 50,
              paddingHorizontal: 16,
              borderRadius: 14, borderCurve: "continuous",
              backgroundColor: t.surface,
              borderColor: t.border,
              borderWidth: 1,
              color: t.ink,
              fontSize: 15,
            }}
          />
          <Pressable
            onPress={onEmail}
            disabled={pending !== null}
            style={({ pressed }) => ({
              marginTop: 14,
              height: 52,
              borderRadius: 16, borderCurve: "continuous",
              backgroundColor: t.accent,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed || pending === "email" ? 0.85 : 1,
            })}
          >
            {pending === "email" ? (
              <ActivityIndicator color={t.accentInk} />
            ) : (
              <Text style={{ color: t.accentInk, fontWeight: "700", fontSize: 15 }}>
                Continue with email
              </Text>
            )}
          </Pressable>

          {error && (
            <Text style={{ marginTop: 14, color: t.expense, fontSize: 13 }}>{error}</Text>
          )}

          <Text style={{ marginTop: 28, color: t.muted, fontSize: 12, lineHeight: 18 }}>
            New accounts? We&apos;ll create one automatically the first time you sign in with this
            email + password.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function humanize(err: unknown): string {
  if (err && typeof err === "object" && "errors" in err) {
    const first = (err as { errors?: { message?: string }[] }).errors?.[0]?.message;
    if (first) return first;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
