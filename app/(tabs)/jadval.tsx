import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";

const C = Colors.light;

interface ScheduleDeal {
  id: number;
  mijozIsm: string | null;
  mijozTelefon: string | null;
  manzil: string | null;
  status: string;
  ornatishSanasi: string | null;
  tayyorBolishKuni: string | null;
  effectiveDate: string | null;
  installerName: string | null;
  totalNarx: number | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  yangi:         { bg: "#DBEAFE", text: "#2563EB", label: "Yangi" },
  tikuvda:       { bg: "#EDE9FE", text: "#7C3AED", label: "Tikuvda" },
  tayyor:        { bg: "#D1FAE5", text: "#059669", label: "Tayyor" },
  ornatilmoqda:  { bg: "#FEF3C7", text: "#D97706", label: "O'rnatilmoqda" },
  yopildi:       { bg: "#F0FDF4", text: "#16A34A", label: "Yopildi" },
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("uz-UZ", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtShort(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" });
}

function daysLeft(d: string | null | undefined): number {
  if (!d) return 0;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function fmtMoney(n: number | null): string {
  if (!n) return "—";
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";
}

function getWeekDays(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: Date[] = [];
  for (let i = -1; i <= 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAY_NAMES = ["Ya", "Du", "Se", "Ch", "Pa", "Sh", "Ya"];

export default function JadvalScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  const weekDays = getWeekDays();

  const from = weekDays[0].toISOString().split("T")[0];
  const to = weekDays[weekDays.length - 1].toISOString().split("T")[0];

  const { data: deals = [], isLoading } = useQuery<ScheduleDeal[]>({
    queryKey: ["schedule", from, to],
    queryFn: () => apiReq(`/installer/schedule?from=${from}&to=${to}`),
    refetchInterval: 60000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["schedule"] });
    setRefreshing(false);
  }, [qc]);

  const dealsForDay = deals.filter(d => {
    const eff = d.effectiveDate || d.ornatishSanasi || d.tayyorBolishKuni;
    if (!eff) return false;
    return eff.startsWith(selectedDate);
  });

  const dealsCountByDay = (date: Date): number => {
    const ds = date.toISOString().split("T")[0];
    return deals.filter(d => {
      const eff = d.effectiveDate || d.ornatishSanasi || d.tayyorBolishKuni;
      return eff && eff.startsWith(ds);
    }).length;
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: topPadding + 12 }]}>
        <Text style={s.title}>Jadval</Text>
        <Text style={[s.subtitle, { color: C.textSecondary }]}>O'rnatish & tayyor bo'lish</Text>
      </View>

      {/* Week strip */}
      <View style={[s.weekStrip, { backgroundColor: C.surface, borderColor: C.border }]}>
        {weekDays.map((day, i) => {
          const ds = day.toISOString().split("T")[0];
          const isSelected = ds === selectedDate;
          const isToday = ds === today;
          const count = dealsCountByDay(day);
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedDate(ds)}
              style={[s.dayBtn, isSelected && { backgroundColor: C.primary, borderRadius: 12 }]}
            >
              <Text style={[s.dayName, { color: isSelected ? "#fff" : C.textSecondary }]}>
                {DAY_NAMES[day.getDay()]}
              </Text>
              <Text style={[s.dayNum, { color: isSelected ? "#fff" : isToday ? C.primary : C.text, fontFamily: isToday ? "Inter_700Bold" : "Inter_500Medium" }]}>
                {day.getDate()}
              </Text>
              {count > 0 && (
                <View style={[s.dot, { backgroundColor: isSelected ? "#fff" : C.primary }]} />
              )}
              {count === 0 && <View style={{ height: 5 }} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[s.dateLabel, { borderColor: C.border }]}>
        <Feather name="calendar" size={14} color={C.primary} />
        <Text style={[s.dateLabelTxt, { color: C.text }]}>{fmtDate(selectedDate)} — {dealsForDay.length} ta topshiriq</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {isLoading && (
          <View style={s.center}>
            <ActivityIndicator color={C.primary} />
          </View>
        )}

        {!isLoading && dealsForDay.length === 0 && (
          <View style={s.center}>
            <Feather name="calendar" size={48} color={C.textSecondary} />
            <Text style={s.emptyTxt}>Bu kun uchun topshiriq yo'q</Text>
          </View>
        )}

        {dealsForDay.map((deal) => {
          const sc = STATUS_COLORS[deal.status] ?? { bg: "#F1F5F9", text: "#64748B", label: deal.status };
          const dl = daysLeft(deal.ornatishSanasi);
          return (
            <View key={deal.id} style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.clientName, { color: C.text }]}>{deal.mijozIsm || "Mijoz"}</Text>
                  {deal.mijozTelefon && (
                    <Text style={[s.phone, { color: C.textSecondary }]}>{deal.mijozTelefon}</Text>
                  )}
                </View>
                <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[s.statusTxt, { color: sc.text }]}>{sc.label}</Text>
                </View>
              </View>

              <View style={[s.divider, { backgroundColor: C.border }]} />

              <View style={s.infoGrid}>
                {deal.manzil && (
                  <View style={s.infoRow}>
                    <Feather name="map-pin" size={13} color={C.textSecondary} />
                    <Text style={[s.infoTxt, { color: C.textSecondary }]}>{deal.manzil}</Text>
                  </View>
                )}
                {deal.ornatishSanasi && (
                  <View style={s.infoRow}>
                    <Feather name="tool" size={13} color={dl < 0 ? "#DC2626" : dl === 0 ? "#D97706" : C.primary} />
                    <Text style={[s.infoTxt, { color: dl < 0 ? "#DC2626" : C.textSecondary }]}>
                      O'rnatish: {fmtShort(deal.ornatishSanasi)} {dl < 0 ? `(${Math.abs(dl)} kun kechikdi)` : dl === 0 ? "(Bugun!)" : `(${dl} kun)`}
                    </Text>
                  </View>
                )}
                {deal.tayyorBolishKuni && (
                  <View style={s.infoRow}>
                    <Feather name="check-circle" size={13} color={C.textSecondary} />
                    <Text style={[s.infoTxt, { color: C.textSecondary }]}>Tayyor: {fmtShort(deal.tayyorBolishKuni)}</Text>
                  </View>
                )}
                {deal.installerName && (
                  <View style={s.infoRow}>
                    <Feather name="user" size={13} color={C.textSecondary} />
                    <Text style={[s.infoTxt, { color: C.textSecondary }]}>{deal.installerName}</Text>
                  </View>
                )}
                {deal.totalNarx && (
                  <View style={s.infoRow}>
                    <Feather name="dollar-sign" size={13} color={C.textSecondary} />
                    <Text style={[s.infoTxt, { color: C.textSecondary }]}>{fmtMoney(deal.totalNarx)}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: C.text },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  weekStrip: { flexDirection: "row", marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 6, marginBottom: 8 },
  dayBtn: { flex: 1, alignItems: "center", paddingVertical: 6, gap: 2 },
  dayName: { fontSize: 10, fontFamily: "Inter_500Medium" },
  dayNum: { fontSize: 16 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dateLabel: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginBottom: 4, paddingVertical: 8, borderBottomWidth: 1 },
  dateLabelTxt: { fontSize: 13, fontFamily: "Inter_500Medium" },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  clientName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  phone: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  divider: { height: 1 },
  infoGrid: { gap: 6 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoTxt: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: 16, fontFamily: "Inter_500Medium", color: C.textSecondary },
});
