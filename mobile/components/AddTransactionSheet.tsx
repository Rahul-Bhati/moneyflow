import { useAuth } from "@clerk/clerk-expo";
import { ArrowDownLeft, ArrowUpRight, Check, Plus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
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
import { api, ApiError } from "@/lib/api";
import { currencySymbol } from "@/lib/format";
import { todayISO } from "@/lib/recurrence";
import { BUILT_IN_CATEGORIES, type Transaction, type TxType } from "@/lib/types";
import { useTheme } from "@/lib/theme";

/**
 * Bottom-sheet equivalent for RN. We use React Native's built-in `Modal`
 * with slide animation — close to the web Framer Motion sheet without the
 * complexity. Long-press to dismiss tap-outside, hardware back on Android.
 */
export function AddTransactionSheet({ onAdded }: { onAdded: (t: Transaction) => void }) {
  const { t } = useTheme();
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Food");
  const [customCategory, setCustomCategory] = useState("");
  const [date] = useState(todayISO()); // editable date is a polish for later
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (type === "income" && category !== "Income") setCategory("Income");
    if (type === "expense" && category === "Income") setCategory("Food");
  }, [type, category]);

  function reset() {
    setAmount("");
    setDescription("");
    setType("expense");
    setCategory("Food");
    setCustomCategory("");
    setError(null);
  }

  async function submit() {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    const finalCategory =
      category === "__custom__" ? customCategory.trim() || "Other" : category;
    setPending(true);
    setError(null);
    try {
      const tx = await api.createTransaction(getToken, {
        amount: value,
        type,
        description: description.trim(),
        category: finalCategory,
        occurred_on: date,
      });
      onAdded(tx);
      setOpen(false);
      reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const income = type === "income";

  return (
    <>
      {/* FAB */}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          position: "absolute",
          alignSelf: "center",
          bottom: 24,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: 56,
          paddingHorizontal: 22,
          borderRadius: 28,
          backgroundColor: t.accent,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 16,
          elevation: 8,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Plus color={t.accentInk} size={20} />
        <Text style={{ color: t.accentInk, fontWeight: "700", fontSize: 15 }}>Add entry</Text>
      </Pressable>

      <Modal
        animationType="slide"
        visible={open}
        transparent
        onRequestClose={() => !pending && setOpen(false)}
      >
        <Pressable
          onPress={() => !pending && setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: t.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 20,
            paddingBottom: 32,
            maxHeight: "92%",
          }}
        >
          <View style={{ alignSelf: "center", width: 40, height: 5, backgroundColor: t.borderStrong, borderRadius: 3, marginBottom: 14 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: t.ink }}>New entry</Text>
            <Pressable
              onPress={() => !pending && setOpen(false)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}
            >
              <X color={t.muted} size={18} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {/* type toggle */}
            <View style={{ flexDirection: "row", gap: 6, backgroundColor: t.surface2, borderRadius: 16, padding: 4, marginBottom: 18 }}>
              {(["expense", "income"] as TxType[]).map((k) => {
                const active = type === k;
                const tone = k === "income" ? t.income : t.expense;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setType(k)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: "center",
                      borderRadius: 12,
                      backgroundColor: active ? tone : "transparent",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {k === "income" ? (
                        <ArrowDownLeft color={active ? "#fff" : t.muted} size={15} />
                      ) : (
                        <ArrowUpRight color={active ? "#fff" : t.muted} size={15} />
                      )}
                      <Text style={{ color: active ? "#fff" : t.muted, fontWeight: "700", fontSize: 14 }}>
                        {k === "income" ? "Earned" : "Spent"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* amount */}
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 14 }}>
              <Text style={{ fontSize: 28, fontWeight: "700", color: income ? t.income : t.expense }}>
                {currencySymbol}
              </Text>
              <TextInput
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={t.borderStrong}
                style={{
                  fontSize: 48,
                  fontWeight: "800",
                  color: t.ink,
                  minWidth: 120,
                  textAlign: "center",
                  padding: 0,
                  marginLeft: 4,
                }}
              />
            </View>

            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={140}
              placeholder={income ? "What was it for? (e.g. Salary)" : "What did you spend on?"}
              placeholderTextColor={t.muted}
              style={{
                height: 48,
                paddingHorizontal: 14,
                borderRadius: 14,
                backgroundColor: t.surface,
                borderColor: t.border,
                borderWidth: 1,
                color: t.ink,
                fontSize: 14,
                marginBottom: 12,
              }}
            />

            {/* category chips */}
            <Text style={{ fontSize: 11, color: t.muted, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
              Category
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {BUILT_IN_CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <Chip key={c} label={c} active={active} onPress={() => setCategory(c)} />
                );
              })}
              <Chip
                label="Custom…"
                active={category === "__custom__"}
                onPress={() => setCategory("__custom__")}
              />
            </View>
            {category === "__custom__" && (
              <TextInput
                value={customCategory}
                onChangeText={setCustomCategory}
                maxLength={40}
                placeholder="Type a category"
                placeholderTextColor={t.muted}
                style={{
                  marginTop: 8,
                  height: 44,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  backgroundColor: t.surface,
                  borderColor: t.border,
                  borderWidth: 1,
                  color: t.ink,
                  fontSize: 14,
                }}
              />
            )}

            {error && (
              <Text style={{ color: t.expense, fontSize: 13, marginTop: 12, fontWeight: "500" }}>{error}</Text>
            )}

            <Pressable
              onPress={submit}
              disabled={pending}
              style={({ pressed }) => ({
                marginTop: 16,
                height: 54,
                borderRadius: 16,
                backgroundColor: t.accent,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                opacity: pressed || pending ? 0.7 : 1,
              })}
            >
              {pending ? (
                <ActivityIndicator color={t.accentInk} />
              ) : (
                <>
                  <Check color={t.accentInk} size={18} />
                  <Text style={{ color: t.accentInk, fontWeight: "800", fontSize: 15 }}>
                    Save {income ? "income" : "expense"}
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? "transparent" : t.border,
        backgroundColor: active ? t.accent : t.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: active ? t.accentInk : t.muted,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
