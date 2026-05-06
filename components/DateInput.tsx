import React, { useRef } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;

interface DateInputProps {
  label?: string;
  day: string;
  month: string;
  year: string;
  onChangeDay: (v: string) => void;
  onChangeMonth: (v: string) => void;
  onChangeYear: (v: string) => void;
}

export default function DateInput({ label, day, month, year, onChangeDay, onChangeMonth, onChangeYear }: DateInputProps) {
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const hiddenDateRef = useRef<HTMLInputElement | null>(null);

  function handleCalendarPress() {
    if (Platform.OS === "web" && hiddenDateRef.current) {
      hiddenDateRef.current.showPicker?.();
      hiddenDateRef.current.click();
    }
  }

  function handleNativeDateChange(dateStr: string) {
    if (!dateStr) return;
    const [y, m, d] = dateStr.split("-");
    if (d) onChangeDay(d);
    if (m) onChangeMonth(m);
    if (y) onChangeYear(y);
  }

  return (
    <View style={{ gap: 4 }}>
      {!!label && <Text style={[ds.label, { color: C.textSecondary }]}>{label}</Text>}
      <View style={[ds.row, { borderColor: C.border, backgroundColor: C.surface }]}>
        <TouchableOpacity onPress={handleCalendarPress} activeOpacity={0.6}>
          <Feather name="calendar" size={15} color={C.primary} />
        </TouchableOpacity>
        <TextInput
          style={[ds.cell, { color: C.text }]}
          value={day}
          onChangeText={v => {
            const n = v.replace(/\D/g, "").slice(0, 2);
            onChangeDay(n);
            if (n.length === 2) monthRef.current?.focus();
          }}
          placeholder="KK"
          placeholderTextColor={C.textSecondary}
          keyboardType="number-pad"
          maxLength={2}
          textAlign="center"
        />
        <Text style={[ds.sep, { color: C.textSecondary }]}>/</Text>
        <TextInput
          ref={monthRef}
          style={[ds.cell, { color: C.text }]}
          value={month}
          onChangeText={v => {
            const n = v.replace(/\D/g, "").slice(0, 2);
            onChangeMonth(n);
            if (n.length === 2) yearRef.current?.focus();
          }}
          placeholder="OO"
          placeholderTextColor={C.textSecondary}
          keyboardType="number-pad"
          maxLength={2}
          textAlign="center"
        />
        <Text style={[ds.sep, { color: C.textSecondary }]}>/</Text>
        <TextInput
          ref={yearRef}
          style={[ds.cellYear, { color: C.text }]}
          value={year}
          onChangeText={v => {
            const n = v.replace(/\D/g, "").slice(0, 4);
            onChangeYear(n);
          }}
          placeholder="YYYY"
          placeholderTextColor={C.textSecondary}
          keyboardType="number-pad"
          maxLength={4}
          textAlign="center"
        />
        {Platform.OS === "web" && (
          <input
            ref={hiddenDateRef as any}
            type="date"
            style={{
              position: "absolute",
              opacity: 0,
              width: 1,
              height: 1,
              left: 12,
              top: "50%",
              pointerEvents: "none",
            }}
            value={buildDateStr(day, month, year)}
            onChange={e => handleNativeDateChange(e.target.value)}
          />
        )}
      </View>
    </View>
  );
}

/** Helper: собирает DD/MM/YYYY в ISO строку или null */
export function buildDateISO(day: string, month: string, year: string): string | null {
  if (!day || !month || !year || year.length < 4) return null;
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2020) return null;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Helper: собирает DD/MM/YYYY в строку YYYY-MM-DD или "" */
export function buildDateStr(day: string, month: string, year: string): string {
  if (!day || !month || !year || year.length < 4) return "";
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2020) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const ds = StyleSheet.create({
  label: { fontSize: 11, fontFamily: "Inter_500Medium", marginLeft: 2 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  cell: { width: 30, fontSize: 13, fontFamily: "Inter_400Regular", paddingVertical: 2 },
  cellYear: { width: 42, fontSize: 13, fontFamily: "Inter_400Regular", paddingVertical: 2 },
  sep: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
