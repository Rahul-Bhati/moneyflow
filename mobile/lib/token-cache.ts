import * as SecureStore from "expo-secure-store";
import type { TokenCache } from "@clerk/clerk-expo";
import { Platform } from "react-native";

/**
 * Persistent Clerk token cache, native-only.
 *
 * SecureStore is iOS Keychain / Android EncryptedSharedPreferences — the right
 * place for a session token. Without this, Clerk re-prompts for sign-in on
 * every cold start of the app.
 *
 * On web (Expo's `--web` mode) SecureStore isn't available, so we return
 * `undefined` and let Clerk fall back to its in-memory store. (For prod web,
 * the user lives on the Next.js site, not the Expo-web build, so this is
 * fine.)
 */
export const tokenCache: TokenCache | undefined =
  Platform.OS === "web"
    ? undefined
    : {
        async getToken(key: string) {
          try {
            return await SecureStore.getItemAsync(key);
          } catch (err) {
            console.warn("tokenCache.getToken failed:", err);
            await SecureStore.deleteItemAsync(key);
            return null;
          }
        },
        async saveToken(key: string, token: string) {
          try {
            await SecureStore.setItemAsync(key, token);
          } catch (err) {
            console.warn("tokenCache.saveToken failed:", err);
          }
        },
        // Clerk calls this on sign-out. Without it, the JWT stays on disk
        // until SecureStore eventually overwrites the key on next sign-in —
        // a stale token sitting in the keychain after logout is a smell we
        // shouldn't ship.
        async clearToken(key: string) {
          try {
            await SecureStore.deleteItemAsync(key);
          } catch (err) {
            console.warn("tokenCache.clearToken failed:", err);
          }
        },
      };
