import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { shortDate } from "@/lib/format";
import { useTheme } from "@/lib/theme";

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * A tappable date field backed by the platform's native date picker.
 *
 * iOS  — opens a bottom-sheet modal containing a spinner-style DateTimePicker.
 * Android — opens the system date dialog directly when the field is tapped.
 *
 * Both paths call `onChange` with a YYYY-MM-DD ISO string in local time (no
 * UTC offset shift), which is what the server expects.
 */
export function DatePickerField({
  value,
  onChange,
  label = "Date",
  minDate,
  maxDate,
}: {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  minDate?: Date;
  maxDate?: Date;
}) {
  const { t } = useTheme();
  const [show, setShow] = useState(false);
  // draft holds the in-progress date on iOS (user hasn't pressed Done yet)
  const [draft, setDraft] = useState<Date>(() => isoToDate(value));

  function open() {
    setDraft(isoToDate(value));
    setShow(true);
  }

  function handleChange(_evt: DateTimePickerEvent, selected?: Date) {
    if (!selected) return;
    if (Platform.OS === "android") {
      // Android picker closes itself; emit immediately.
      setShow(false);
      onChange(dateToISO(selected));
    } else {
      // iOS spinner: update draft on every scroll tick, commit on Done.
      setDraft(selected);
    }
  }

  function done() {
    onChange(dateToISO(draft));
    setShow(false);
  }

  return (
    <>
      <Pressable
        onPress={open}
        style={({ pressed }) => ({
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          height: 50,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderCurve: "continuous",
          backgroundColor: t.surface,
          borderColor: t.border,
          borderWidth: 1,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "500" }}>
          {label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: t.ink, fontSize: 14, fontWeight: "600" }}>
            {shortDate(value)}
          </Text>
          <CalendarDays color={t.muted} size={15} />
        </View>
      </Pressable>

      {Platform.OS === "ios" ? (
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <Pressable
            onPress={() => setShow(false)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: t.surface,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingTop: 8,
                paddingBottom: 36,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                }}
              >
                <Pressable onPress={() => setShow(false)} style={{ padding: 4 }}>
                  <Text style={{ color: t.muted, fontSize: 15, fontWeight: "500" }}>
                    Cancel
                  </Text>
                </Pressable>
                <Text style={{ color: t.ink, fontWeight: "700", fontSize: 16 }}>
                  {label}
                </Text>
                <Pressable onPress={done} style={{ padding: 4 }}>
                  <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>
                    Done
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                onChange={handleChange}
                minimumDate={minDate}
                maximumDate={maxDate}
                style={{ backgroundColor: t.surface }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={draft}
            mode="date"
            display="default"
            onChange={handleChange}
            minimumDate={minDate}
            maximumDate={maxDate}
          />
        )
      )}
    </>
  );
}
