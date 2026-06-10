import { useAuth } from "@clerk/clerk-expo";
import { Check, Plus, X } from "lucide-react-native";
import { useState } from "react";
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
import { RECURRENCES, type Bill, type Recurrence } from "@/lib/types";
import { useTheme } from "@/lib/theme";

export function AddBillSheet({ onAdded }: { onAdded: (b: Bill) => void }) {
  const { t } = useTheme();
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState(todayISO());
  const [recurrence, setRecurrence] = useState<Recurrence>("monthly");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setAmount("");
    setDueOn(todayISO());
    setRecurrence("monthly");
    setError(null);
  }

  async function submit() {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!name.trim()) {
      setError("Give the bill a name.");
      return;
    }
    setPending(true);
    try {
      const bill = await api.createBill(getToken, {
        name: name.trim(),
        amount: value,
        due_on: dueOn,
        recurrence,
      });
      onAdded(bill);
      setOpen(false);
      reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
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
        <Text style={{ color: t.accentInk, fontWeight: "700", fontSize: 15 }}>Add bill</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
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
            <Text style={{ fontSize: 20, fontWeight: "800", color: t.ink }}>New bill</Text>
            <Pressable
              onPress={() => !pending && setOpen(false)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}
            >
              <X color={t.muted} size={18} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={60}
              placeholder="Bill name (e.g. Netflix, Rent)"
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

            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 14 }}>
              <Text style={{ fontSize: 28, fontWeight: "700", color: t.expense }}>{currencySymbol}</Text>
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

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                height: 50,
                paddingHorizontal: 14,
                borderRadius: 14,
                backgroundColor: t.surface,
                borderColor: t.border,
                borderWidth: 1,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: t.muted, fontSize: 13, fontWeight: "500" }}>Due date</Text>
              <TextInput
                value={dueOn}
                onChangeText={setDueOn}
                style={{ color: t.ink, fontSize: 14, fontWeight: "500", textAlign: "right", flex: 1, marginLeft: 12 }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={t.muted}
              />
            </View>

            <Text style={{ fontSize: 11, color: t.muted, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
              Recurrence
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {RECURRENCES.map((r) => {
                const active = recurrence === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setRecurrence(r.key)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? "transparent" : t.border,
                      backgroundColor: active ? t.accent : t.surface,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? t.accentInk : t.muted,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

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
                    Save bill
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
