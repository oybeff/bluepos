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

type Period = "today" | "week" | "month" | "year";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "week",  label: "Hafta" },
  { key: "month", label: "Oy" },
  { key: "year",  label: "Yil" },
];

interface SalesReport {
  totalSales: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  statusBreakdown: Record<string, number>;
  dailyData: { date: string; sales: number; orders: number }[];
}

interface DashboardReport {
  todaySales: number;
  todayOrders: number;
  monthSales: number;
  monthOrders: number;
  totalClients: number;
  lowStockItems: number;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Yangi", completed: "Bajarildi", cancelled: "Bekor",
  pending: "Kutmoqda", processing: "Jarayonda",
};

const STATUS_COLORS: string[] = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + " mln";
  if (n >= 1000) return (n / 1000).toFixed(0) + " ming";
  return n.toString();
}

function fmtMoneyFull(n: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(3, (value / max) * 100) : 0;
  return (
    <View style={{ height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
      <View style={{ height: 6, width: `${pct}%` as any, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export default function HisobotScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("month");

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  const { data: sales, isLoading: salesLoading } = useQuery<SalesReport>({
    queryKey: ["reports-sales", period],
    queryFn: () => apiReq(`/reports/sales?period=${period}`),
    refetchInterval: 120000,
  });

  const { data: dash, isLoading: dashLoading } = useQuery<DashboardReport>({
    queryKey: ["reports-dashboard"],
    queryFn: () => apiReq("/reports/dashboard"),
    refetchInterval: 120000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["reports-sales", period] });
    await qc.invalidateQueries({ queryKey: ["reports-dashboard"] });
    setRefreshing(false);
  }, [qc, period]);

  const isLoading = salesLoading || dashLoading;

  const statusEntries = Object.entries(sales?.statusBreakdown ?? {}).sort((a, b) => b[1] - a[1]);
  const maxStatusCount = statusEntries[0]?.[1] ?? 1;

  const dailyData = sales?.dailyData ?? [];
  const maxDailySales = Math.max(...dailyData.map(d => d.sales), 1);

  const completionRate = sales && sales.totalOrders > 0
    ? Math.round((sales.completedOrders / sales.totalOrders) * 100)
    : 0;

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: topPadding + 12 }]}>
        <Text style={s.title}>Hisobot</Text>
        <Text style={[s.subtitle, { color: C.textSecondary }]}>Savdo tahlili</Text>
      </View>

      {/* Period selector */}
      <View style={s.periodBar}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            onPress={() => setPeriod(p.key)}
            style={[s.periodBtn, period === p.key && { backgroundColor: C.primary, borderRadius: 10 }]}
          >
            <Text style={[s.periodTxt, { color: period === p.key ? "#fff" : C.textSecondary }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {isLoading && (
          <View style={s.center}>
            <ActivityIndicator color={C.primary} />
            <Text style={[s.loadTxt, { color: C.textSecondary }]}>Yuklanmoqda...</Text>
          </View>
        )}

        {!isLoading && (
          <>
            {/* Main KPI card */}
            <View style={[s.mainCard, { backgroundColor: C.primary }]}>
              <Text style={s.mainLabel}>Jami savdo ({PERIODS.find(p => p.key === period)?.label})</Text>
              <Text style={s.mainValue}>{fmtMoneyFull(sales?.totalSales ?? 0)}</Text>
              <View style={s.kpiRow}>
                <View style={s.kpiItem}>
                  <Text style={s.kpiNum}>{sales?.totalOrders ?? 0}</Text>
                  <Text style={s.kpiLbl}>Buyurtma</Text>
                </View>
                <View style={s.kpiDivider} />
                <View style={s.kpiItem}>
                  <Text style={s.kpiNum}>{sales?.completedOrders ?? 0}</Text>
                  <Text style={s.kpiLbl}>Bajarildi</Text>
                </View>
                <View style={s.kpiDivider} />
                <View style={s.kpiItem}>
                  <Text style={s.kpiNum}>{completionRate}%</Text>
                  <Text style={s.kpiLbl}>Bajarish %</Text>
                </View>
              </View>
            </View>

            {/* Quick stats from dashboard */}
            <View style={s.gridRow}>
              <View style={[s.gridCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Feather name="users" size={18} color="#3B82F6" />
                <Text style={[s.gridNum, { color: C.text }]}>{dash?.totalClients ?? "—"}</Text>
                <Text style={[s.gridLbl, { color: C.textSecondary }]}>Mijozlar</Text>
              </View>
              <View style={[s.gridCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Feather name="alert-triangle" size={18} color="#F59E0B" />
                <Text style={[s.gridNum, { color: C.text }]}>{dash?.lowStockItems ?? "—"}</Text>
                <Text style={[s.gridLbl, { color: C.textSecondary }]}>Kam qoldiq</Text>
              </View>
              <View style={[s.gridCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Feather name="x-circle" size={18} color="#EF4444" />
                <Text style={[s.gridNum, { color: C.text }]}>{sales?.cancelledOrders ?? 0}</Text>
                <Text style={[s.gridLbl, { color: C.textSecondary }]}>Bekor</Text>
              </View>
            </View>

            {/* Daily chart */}
            {dailyData.length > 0 && (
              <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[s.sectionTitle, { color: C.text }]}>Kunlik savdo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, paddingVertical: 8, minWidth: "100%" }}>
                    {dailyData.slice(-14).map((d, i) => {
                      const pct = maxDailySales > 0 ? (d.sales / maxDailySales) : 0;
                      const barH = Math.max(4, Math.round(pct * 80));
                      const dayLabel = new Date(d.date).getDate().toString();
                      return (
                        <View key={i} style={{ alignItems: "center", gap: 4, minWidth: 32 }}>
                          <Text style={{ fontSize: 9, color: C.textSecondary, fontFamily: "Inter_400Regular" }}>
                            {fmtMoney(d.sales)}
                          </Text>
                          <View style={{ width: 22, height: barH, backgroundColor: C.primary, borderRadius: 4 }} />
                          <Text style={{ fontSize: 10, color: C.textSecondary, fontFamily: "Inter_500Medium" }}>{dayLabel}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Status breakdown */}
            {statusEntries.length > 0 && (
              <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[s.sectionTitle, { color: C.text }]}>Buyurtma holatlari</Text>
                <View style={{ gap: 10, marginTop: 8 }}>
                  {statusEntries.map(([status, count], i) => (
                    <View key={status} style={{ gap: 4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: C.text }}>
                          {STATUS_LABELS[status] ?? status}
                        </Text>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: STATUS_COLORS[i % STATUS_COLORS.length] }}>
                          {count} ta
                        </Text>
                      </View>
                      <MiniBar value={count} max={maxStatusCount} color={STATUS_COLORS[i % STATUS_COLORS.length]} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Today vs Month */}
            <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[s.sectionTitle, { color: C.text }]}>Bugun vs Oy</Text>
              <View style={{ gap: 10, marginTop: 8 }}>
                <View style={s.compareRow}>
                  <View style={[s.compareIcon, { backgroundColor: "#EDE9FE" }]}>
                    <Feather name="sun" size={14} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.compareLabel, { color: C.textSecondary }]}>Bugungi savdo</Text>
                    <Text style={[s.compareValue, { color: C.text }]}>{fmtMoneyFull(dash?.todaySales ?? 0)}</Text>
                  </View>
                  <Text style={[s.compareCount, { color: C.textSecondary }]}>{dash?.todayOrders ?? 0} ta</Text>
                </View>
                <View style={s.compareRow}>
                  <View style={[s.compareIcon, { backgroundColor: "#DBEAFE" }]}>
                    <Feather name="calendar" size={14} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.compareLabel, { color: C.textSecondary }]}>Bu oylik savdo</Text>
                    <Text style={[s.compareValue, { color: C.text }]}>{fmtMoneyFull(dash?.monthSales ?? 0)}</Text>
                  </View>
                  <Text style={[s.compareCount, { color: C.textSecondary }]}>{dash?.monthOrders ?? 0} ta</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: C.text },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  periodBar: { flexDirection: "row", marginHorizontal: 16, marginBottom: 8, backgroundColor: "#F1F5F9", borderRadius: 12, padding: 4 },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  periodTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  mainCard: { borderRadius: 20, padding: 20 },
  mainLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular" },
  mainValue: { fontSize: 28, color: "#fff", fontFamily: "Inter_700Bold", marginTop: 4, marginBottom: 16 },
  kpiRow: { flexDirection: "row", alignItems: "center" },
  kpiItem: { flex: 1, alignItems: "center" },
  kpiNum: { fontSize: 18, color: "#fff", fontFamily: "Inter_700Bold" },
  kpiLbl: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" },
  kpiDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },
  gridRow: { flexDirection: "row", gap: 10 },
  gridCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: "center", gap: 4 },
  gridNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  gridLbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
  section: { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  compareRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  compareIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  compareLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  compareValue: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  compareCount: { fontSize: 12, fontFamily: "Inter_500Medium" },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  loadTxt: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
