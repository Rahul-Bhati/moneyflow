import { ArrowDownLeft, ArrowUpRight, Check, X } from "lucide-react-native";
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
import { useStableToken } from "@/lib/useStableToken";
import { useTheme } from "@/lib/theme";
import { BUILT_IN_CATEGORIES, type Transaction, type TxType } from "@/lib/types";
import { DatePickerField } from "@/components/ui/DatePickerField";

/**
 * Bottom sheet for editing an existing transaction.
 * Pre-fills all fields from the transaction and calls PATCH /api/transactions/[id].
 */
export function EditTransactionSheet({
  tx,
  onClose,
  onSaved,
}: {
  tx: Transaction | null;
  onClose: () => void;
  onSaved: (updated: Transaction) => void;
}) {
  const { t } = useTheme();
  const getToken = useStableToken();
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food");
  const [customCategory, setCustomCategory] = useState("");
  const [date, setDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when the sheet opens for a different transaction.
  useEffect(() => {
    if (!tx) return;
    setType(tx.type);
    setAmount(String(tx.amount));
    setDescription(tx.description ?? "");
    const isBuiltIn = (BUILT_IN_CATEGORIES as readonly string[]).includes(tx.category);
    setCategory(isBuiltIn ? tx.category : "__custom__");
    setCustomCategory(isBuiltIn ? "" : tx.category);
    setDate(tx.occurred_on);
    setError(null);
  }, [tx]);

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
      const updated = await api.updateTransaction(getToken, tx!.id, {
        amount: value,
        type,
        description: description.trim(),
        category: finalCategory,
        occurred_on: date,
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const income = type === "income";

  return (
    <Modal
      animationType="slide"
      visible={tx !== null}
      transparent
      onRequestClose={() => !pending && onClose()}
    >
      <Pressable
        onPress={() => !pending && onClose()}
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
        <View
          style={{
            alignSelf: "center",
            width: 40,
            height: 5,
            backgroundColor: t.borderStrong,
            borderRadius: 3,
            marginBottom: 14,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "800", color: t.ink }}>
            Edit entry
          </Text>
          <Pressable
            onPress={() => !pending && onClose()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: t.surface2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X color={t.muted} size={18} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
          {/* type toggle */}
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              backgroundColor: t.surface2,
              borderRadius: 16,
              padding: 4,
              marginBottom: 18,
            }}
          >
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
                    <Text
                      style={{
                        color: active ? "#fff" : t.muted,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      {k === "income" ? "Earned" : "Spent"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* amount */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                fontSize: 28,
                fontWeight: "700",
                color: income ? t.income : t.expense,
              }}
            >
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
            placeholder="Description"
            placeholderTextColor={t.muted}
            style={{
              height: 48,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderCurve: "continuous",
              backgroundColor: t.surface,
              borderColor: t.border,
              borderWidth: 1,
              color: t.ink,
              fontSize: 14,
              marginBottom: 12,
            }}
          />

          <View style={{ marginBottom: 12 }}>
            <DatePickerField value={date} onChange={setDate} label="Date" />
          </View>

          {/* category chips */}
          <Text
            style={{
              fontSize: 11,
              color: t.muted,
              fontWeight: "600",
              letterSpacing: 0.6,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
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
            <Text
              style={{ color: t.expense, fontSize: 13, marginTop: 12, fontWeight: "500" }}
            >
              {error}
            </Text>
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
                  Save changes
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
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
