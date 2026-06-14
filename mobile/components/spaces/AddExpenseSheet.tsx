import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { currencySymbol, money } from "@/lib/format";
import { equalSplit } from "@/lib/splits";
import { useStableToken } from "@/lib/useStableToken";
import { useTheme } from "@/lib/theme";
import { BUILT_IN_CATEGORIES, type SpaceMember } from "@/lib/types";

type SplitMode = "equal" | "custom";

export function AddExpenseSheet({
  open,
  onClose,
  spaceId,
  members,
  meId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  members: SpaceMember[];
  meId: string;
  onAdded: () => void;
}) {
  const { t } = useTheme();
  const getToken = useStableToken();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<SplitMode>("equal");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelected(new Set(members.map((m) => m.user_id)));
  }, [open, members]);

  const nameOf = (id: string) =>
    id === meId ? "You" : members.find((m) => m.user_id === id)?.display_name ?? "Someone";

  const total = parseFloat(amount) || 0;
  const selectedIds = useMemo(
    () => members.map((m) => m.user_id).filter((id) => selected.has(id)),
    [members, selected]
  );
  const equalPreview = useMemo(
    () => (mode === "equal" ? equalSplit(total, selectedIds) : []),
    [mode, total, selectedIds]
  );
  const customSum = selectedIds.reduce(
    (s, id) => s + (parseFloat(custom[id] ?? "") || 0),
    0
  );

  function reset() {
    setAmount("");
    setDescription("");
    setCategory("Food");
    setMode("equal");
    setCustom({});
    setError(null);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function sanitize(v: string) {
    const cleaned = v.replace(/[^0-9.]/g, "");
    return (cleaned.match(/\./g) ?? []).length <= 1 ? cleaned : undefined;
  }

  async function submit() {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!description.trim()) {
      setError("Add a short description.");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Pick at least one person.");
      return;
    }
    const participants =
      mode === "equal"
        ? equalSplit(value, selectedIds)
        : selectedIds.map((id) => ({
            user_id: id,
            share_amount: Math.round((parseFloat(custom[id] ?? "") || 0) * 100) / 100,
          }));
    if (mode === "custom" && Math.abs(customSum - value) > 0.005) {
      setError(`Shares add up to ${money(customSum)}, total is ${money(value)}.`);
      return;
    }

    setPending(true);
    setError(null);
    try {
      await api.addSharedExpense(getToken, spaceId, {
        amount: value,
        description: description.trim(),
        category,
        occurred_on: new Date().toISOString().slice(0, 10),
        participants,
      });
      reset();
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const pill = (active: boolean) => ({
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: active ? t.accent : t.border,
    backgroundColor: active ? t.accent : t.surface,
  });

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: t.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 20,
              paddingTop: 14,
              paddingBottom: 32,
              maxHeight: "90%",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: t.ink, fontWeight: "800", fontSize: 18 }}>Split an expense</Text>
              <Pressable onPress={onClose}>
                <X color={t.muted} size={20} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* amount */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 14 }}>
                <Text style={{ color: t.expense, fontSize: 26, fontWeight: "600" }}>{currencySymbol}</Text>
                <TextInput
                  value={amount}
                  onChangeText={(v) => {
                    const s = sanitize(v);
                    if (s !== undefined) setAmount(s);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={t.borderStrong}
                  style={{ color: t.ink, fontSize: 44, fontWeight: "800", minWidth: 90, textAlign: "center", fontVariant: ["tabular-nums"] }}
                />
              </View>

              <TextInput
                value={description}
                onChangeText={setDescription}
                maxLength={140}
                placeholder="What was it? (e.g. Chai, Dinner)"
                placeholderTextColor={t.muted}
                style={{ borderWidth: 1, borderColor: t.border, borderRadius: t.radiusLg, borderCurve: "continuous", paddingHorizontal: 14, paddingVertical: 11, color: t.ink, fontSize: 15, marginBottom: 12 }}
              />

              {/* category */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {BUILT_IN_CATEGORIES.map((c) => (
                  <Pressable key={c} onPress={() => setCategory(c)} style={pill(category === c)}>
                    <Text style={{ color: category === c ? t.accentInk : t.muted, fontWeight: "700", fontSize: 12 }}>{c}</Text>
                  </Pressable>
                ))}
              </View>

              {/* participants */}
              <Text style={{ color: t.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 8 }}>Split between</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {members.map((m) => {
                  const on = selected.has(m.user_id);
                  return (
                    <Pressable key={m.user_id} onPress={() => toggle(m.user_id)} style={pill(on)}>
                      <Text style={{ color: on ? t.accentInk : t.muted, fontWeight: "700", fontSize: 12 }}>{nameOf(m.user_id)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* mode toggle */}
              <View style={{ flexDirection: "row", gap: 6, backgroundColor: t.surface2, borderRadius: t.radiusLg, borderCurve: "continuous", padding: 4, marginBottom: 12 }}>
                {(["equal", "custom"] as SplitMode[]).map((mo) => (
                  <Pressable
                    key={mo}
                    onPress={() => setMode(mo)}
                    style={{ flex: 1, paddingVertical: 9, borderRadius: 12, borderCurve: "continuous", alignItems: "center", backgroundColor: mode === mo ? t.surface : "transparent" }}
                  >
                    <Text style={{ color: mode === mo ? t.ink : t.muted, fontWeight: "700", fontSize: 13 }}>
                      {mo === "equal" ? "Split equally" : "Custom"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {mode === "equal"
                ? selectedIds.length > 0 && total > 0 && (
                    <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: t.radiusLg, borderCurve: "continuous", padding: 12, marginBottom: 12 }}>
                      {equalPreview.map((p) => (
                        <View key={p.user_id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
                          <Text style={{ color: t.muted }}>{nameOf(p.user_id)}</Text>
                          <Text style={{ color: t.ink, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{money(p.share_amount)}</Text>
                        </View>
                      ))}
                    </View>
                  )
                : (
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    {selectedIds.map((id) => (
                      <View key={id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: t.border, borderRadius: t.radiusLg, borderCurve: "continuous", paddingHorizontal: 14, paddingVertical: 8 }}>
                        <Text style={{ color: t.ink, fontWeight: "600" }}>{nameOf(id)}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text style={{ color: t.muted }}>{currencySymbol}</Text>
                          <TextInput
                            value={custom[id] ?? ""}
                            onChangeText={(v) => {
                              const s = sanitize(v);
                              if (s !== undefined) setCustom((prev) => ({ ...prev, [id]: s }));
                            }}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={t.borderStrong}
                            style={{ color: t.ink, fontWeight: "700", minWidth: 56, textAlign: "right", fontVariant: ["tabular-nums"] }}
                          />
                        </View>
                      </View>
                    ))}
                    {total > 0 && (
                      <Text style={{ color: Math.abs(customSum - total) <= 0.005 ? t.muted : t.expense, fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                        {money(customSum)} of {money(total)} assigned
                      </Text>
                    )}
                  </View>
                )}

              {error && <Text style={{ color: t.expense, fontWeight: "600", marginBottom: 8 }}>{error}</Text>}

              <Pressable
                onPress={submit}
                disabled={pending}
                style={{ height: 52, borderRadius: t.radiusLg, borderCurve: "continuous", backgroundColor: t.accent, alignItems: "center", justifyContent: "center", opacity: pending ? 0.6 : 1 }}
              >
                {pending ? (
                  <ActivityIndicator color={t.accentInk} />
                ) : (
                  <Text style={{ color: t.accentInk, fontWeight: "800", fontSize: 15 }}>Add expense</Text>
                )}
              </Pressable>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
