import { useAuth } from "@clerk/clerk-expo";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, Plus, Users, X } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { useStableToken } from "@/lib/useStableToken";
import { useTheme } from "@/lib/theme";
import type { Space } from "@/lib/types";

function netLabel(net: number | undefined) {
  const n = Math.round((net ?? 0) * 100) / 100;
  if (n === 0) return { text: "Settled", tone: "muted" as const };
  if (n > 0) return { text: `you'll get ${money(n)}`, tone: "income" as const };
  return { text: `you'll pay ${money(-n)}`, tone: "expense" as const };
}

export default function SpacesScreen() {
  const { t } = useTheme();
  const { isSignedIn } = useAuth();
  const getToken = useStableToken();
  const router = useRouter();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!isSignedIn) return;
    setError(null);
    try {
      setSpaces(await api.listSpaces(getToken));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load spaces.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, letterSpacing: -0.5 }}>
          Spaces
        </Text>
        <Text style={{ fontSize: 12, color: t.muted, marginTop: 2, fontWeight: "500" }}>
          Split expenses privately with friends
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={t.muted}
          />
        }
      >
        {loading && spaces.length === 0 ? (
          <View style={{ paddingVertical: 80, alignItems: "center" }}>
            <ActivityIndicator color={t.muted} />
          </View>
        ) : error ? (
          <View
            style={{
              padding: 16,
              borderRadius: t.radiusXl,
              borderCurve: "continuous",
              borderColor: t.expenseSoft,
              borderWidth: 1,
              backgroundColor: t.surface,
            }}
          >
            <Text style={{ color: t.expense, fontWeight: "600" }}>{error}</Text>
            <Pressable onPress={load} style={{ marginTop: 8 }}>
              <Text style={{ color: t.ink, fontWeight: "700" }}>Try again</Text>
            </Pressable>
          </View>
        ) : spaces.length === 0 ? (
          <View
            style={{
              marginTop: 40,
              alignItems: "center",
              gap: 10,
              padding: 28,
              borderRadius: t.radiusXl,
              borderCurve: "continuous",
              backgroundColor: t.surface,
              borderColor: t.border,
              borderWidth: 1,
            }}
          >
            <Users color={t.muted} size={28} />
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 16 }}>No spaces yet</Text>
            <Text style={{ color: t.muted, textAlign: "center", fontSize: 13 }}>
              Create one for your flat or trip, then invite people to split expenses.
            </Text>
          </View>
        ) : (
          spaces.map((s) => {
            const label = netLabel(s.myNet);
            return (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/spaces/${s.id}` as Href)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: t.surface,
                  borderColor: t.border,
                  borderWidth: 1,
                  borderRadius: t.radiusXl,
                  borderCurve: "continuous",
                  padding: 16,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontWeight: "600",
                      fontVariant: ["tabular-nums"],
                      color:
                        label.tone === "income"
                          ? t.income
                          : label.tone === "expense"
                            ? t.expense
                            : t.muted,
                    }}
                  >
                    {label.text}
                  </Text>
                </View>
                <ChevronRight color={t.muted} size={20} />
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* FAB row */}
      <View
        style={{
          position: "absolute",
          bottom: 28,
          alignSelf: "center",
          flexDirection: "row",
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => setJoining(true)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            height: 54,
            paddingLeft: 20,
            paddingRight: 24,
            borderRadius: 999,
            backgroundColor: t.surface,
            borderColor: t.border,
            borderWidth: 1,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>Join</Text>
        </Pressable>
        <Pressable
          onPress={() => setAdding(true)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            height: 54,
            paddingLeft: 20,
            paddingRight: 24,
            borderRadius: 999,
            backgroundColor: t.accent,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Plus color={t.accentInk} size={20} strokeWidth={2.6} />
          <Text style={{ color: t.accentInk, fontWeight: "700", fontSize: 15 }}>New space</Text>
        </Pressable>
      </View>

      <NewSpaceModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(s) => {
          setSpaces((prev) => [{ ...s, myNet: 0 }, ...prev]);
          setAdding(false);
        }}
      />
      <JoinSpaceModal
        open={joining}
        onClose={() => setJoining(false)}
        onJoined={(spaceId) => {
          setJoining(false);
          load();
          router.push(`/spaces/${spaceId}` as never);
        }}
      />
    </SafeAreaView>
  );
}

function NewSpaceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (s: Space) => void;
}) {
  const { t } = useTheme();
  const getToken = useStableToken();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("Give the space a name.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const space = await api.createSpace(getToken, { name: name.trim() });
      setName("");
      onCreated(space);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: t.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 20,
            paddingBottom: 36,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: t.ink, fontWeight: "800", fontSize: 18 }}>New space</Text>
            <Pressable onPress={onClose}>
              <X color={t.muted} size={20} />
            </Pressable>
          </View>
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            maxLength={60}
            placeholder="Space name (e.g. Flat, Goa Trip)"
            placeholderTextColor={t.muted}
            style={{
              borderWidth: 1,
              borderColor: t.border,
              borderRadius: t.radiusLg,
              borderCurve: "continuous",
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: t.ink,
              fontSize: 15,
            }}
          />
          {error && <Text style={{ color: t.expense, fontWeight: "600" }}>{error}</Text>}
          <Pressable
            onPress={submit}
            disabled={pending}
            style={{
              height: 52,
              borderRadius: t.radiusLg,
              borderCurve: "continuous",
              backgroundColor: t.accent,
              alignItems: "center",
              justifyContent: "center",
              opacity: pending ? 0.6 : 1,
            }}
          >
            {pending ? (
              <ActivityIndicator color={t.accentInk} />
            ) : (
              <Text style={{ color: t.accentInk, fontWeight: "800", fontSize: 15 }}>
                Create space
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function JoinSpaceModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined: (spaceId: string) => void;
}) {
  const { t } = useTheme();
  const getToken = useStableToken();
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const tok = token.trim();
    if (!tok) {
      setError("Paste the invite code from your friend.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const member = await api.joinSpace(getToken, tok);
      setToken("");
      onJoined(member.space_id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Invalid or expired code.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: t.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 20,
            paddingBottom: 36,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: t.ink, fontWeight: "800", fontSize: 18 }}>Join a space</Text>
            <Pressable onPress={onClose}>
              <X color={t.muted} size={20} />
            </Pressable>
          </View>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Paste the invite code your friend shared with you.
          </Text>
          <TextInput
            autoFocus
            value={token}
            onChangeText={setToken}
            placeholder="Invite code"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              borderWidth: 1,
              borderColor: t.border,
              borderRadius: t.radiusLg,
              borderCurve: "continuous",
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: t.ink,
              fontSize: 15,
              fontFamily: t.font.mono,
            }}
          />
          {error && <Text style={{ color: t.expense, fontWeight: "600" }}>{error}</Text>}
          <Pressable
            onPress={submit}
            disabled={pending}
            style={{
              height: 52,
              borderRadius: t.radiusLg,
              borderCurve: "continuous",
              backgroundColor: t.accent,
              alignItems: "center",
              justifyContent: "center",
              opacity: pending ? 0.6 : 1,
            }}
          >
            {pending ? (
              <ActivityIndicator color={t.accentInk} />
            ) : (
              <Text style={{ color: t.accentInk, fontWeight: "800", fontSize: 15 }}>
                Join space
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
