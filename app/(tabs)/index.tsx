import React, { useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, Platform, ActivityIndicator, TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";

const C = Colors.light;

interface FinanceTxn {
  id: number; type: string; amount: number;
  description: string; category: string; createdAt: string;
}
interface Deal {
  id: number; mijozIsm: string | null; mijozPhone: string | null;
  totalNarx: number | null; status: string; createdAt: string;
}

function n(v: number) { return new Intl.NumberFormat("uz-UZ").format(Math.round(v)); }
function todayStr() {
  return new Date().toLocaleDateString("uz-UZ", { weekday: "long", day: "numeric", month: "long" });
}
function ago(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1)  return "Hozir";
  if (m < 60) return `${m} daq oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  return `${Math.floor(h / 24)} kun oldin`;
}

const STATUS_CFG: Record<string, { l: string; c: string; bg: string }> = {
  yangi:        { l: "Yangi",        c: "#3B82F6", bg: "#EFF6FF" },
  tikuvda:      { l: "Tikuvda",      c: "#8B5CF6", bg: "#F5F3FF" },
  tayyor:       { l: "Tayyor",       c: "#10B981", bg: "#ECFDF5" },
  ornatilmoqda: { l: "O'rnatilmoqda",c: "#F59E0B", bg: "#FFFBEB" },
  yopildi:      { l: "Yopildi",      c: "#64748B", bg: "#F1F5F9" },
};

export default function StatistikaScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 90);
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: monthTxns = [], isLoading } = useQuery<FinanceTxn[]>({
    queryKey: ["finance-month"],
    queryFn: () => apiReq<FinanceTxn[]>("/finance/transactions?period=month"),
    retry: false,
  });
  const { data: todayTxns = [] } = useQuery<FinanceTxn[]>({
    queryKey: ["finance-today"],
    queryFn: () => apiReq<FinanceTxn[]>("/finance/transactions?period=today"),
    retry: false,
  });
  const { data: dealsRaw } = useQuery({
    queryKey: ["deals-recent"],
    queryFn: () => apiReq<any>("/client-deals?limit=10"),
    retry: false,
  });
  const deals: Deal[] = Array.isArray(dealsRaw) ? dealsRaw : (dealsRaw as any)?.deals ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["finance-month"] }),
      qc.invalidateQueries({ queryKey: ["finance-today"] }),
      qc.invalidateQueries({ queryKey: ["deals-recent"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const monthIncome  = monthTxns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTxns.filter(t => t.type === "expense" || t.type === "salary").reduce((s, t) => s + t.amount, 0);
  const todayIncome  = todayTxns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const todayExpense = todayTxns.filter(t => t.type !== "income").reduce((s, t) => s + t.amount, 0);
  const activeDeals  = deals.filter(d => d.status !== "yopildi").length;
  const closedDeals  = deals.filter(d => d.status === "yopildi").length;

  return (
    <View style={[st.root, { backgroundColor: C.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Hero ─────────────────────────────────────────────── */}
        <View style={[st.hero, { paddingTop: topPadding }]}>
          <View>
            <Text style={st.heroTitle}>Blupos</Text>
            <Text style={st.heroDate}>{todayStr()}</Text>
          </View>
          <View style={st.heroBadge}>
            <Feather name="activity" size={20} color="#fff" />
          </View>
        </View>

        {/* ─── Bugungi savdo ────────────────────────────────────── */}
        <View style={[st.todayCard, { backgroundColor: C.card }]}>
          <Text style={[st.sec, { color: C.textSecondary }]}>Bugun</Text>
          <View style={st.todayRow}>
            <View style={st.todayCol}>
              <Text style={[st.bigNum, { color: "#10B981" }]}>{n(todayIncome)}</Text>
              <Text style={[st.smallLbl, { color: C.textSecondary }]}>so'm kirim</Text>
            </View>
            <View style={[st.sep, { backgroundColor: C.border }]} />
            <View style={st.todayCol}>
              <Text style={[st.bigNum, { color: "#EF4444" }]}>{n(todayExpense)}</Text>
              <Text style={[st.smallLbl, { color: C.textSecondary }]}>so'm chiqim</Text>
            </View>
          </View>
        </View>

        {/* ─── Tez harakatlar ───────────────────────────────────── */}
        <View style={st.statSection}>
          <Text style={[st.sec, { color: C.textSecondary }]}>Tez harakatlar</Text>
          {/* Row 1 */}
          <View style={st.quickRow}>
            <TouchableOpacity style={[st.quickCard, { backgroundColor: "#EEF2FF" }]} onPress={() => router.push("/new-deal" as any)}>
              <View style={[st.quickIcon, { backgroundColor: "#4F46E5" }]}>
                <Feather name="plus-circle" size={18} color="#fff" />
              </View>
              <Text style={[st.quickLabel, { color: "#4F46E5" }]}>Buyurtma</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.quickCard, { backgroundColor: "#F0FDF4" }]} onPress={() => router.push("/scanner" as any)}>
              <View style={[st.quickIcon, { backgroundColor: "#059669" }]}>
                <Feather name="maximize" size={18} color="#fff" />
              </View>
              <Text style={[st.quickLabel, { color: "#059669" }]}>Skaner</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FFF7ED" }]} onPress={() => router.push("/(tabs)/kassa")}>
              <View style={[st.quickIcon, { backgroundColor: "#F59E0B" }]}>
                <Feather name="unlock" size={18} color="#fff" />
              </View>
              <Text style={[st.quickLabel, { color: "#F59E0B" }]}>Kassa</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.quickCard, { backgroundColor: "#F5F3FF" }]} onPress={() => router.push("/(tabs)/ombor-harakati")}>
              <View style={[st.quickIcon, { backgroundColor: "#7C3AED" }]}>
                <Feather name="package" size={18} color="#fff" />
              </View>
              <Text style={[st.quickLabel, { color: "#7C3AED" }]}>Ombor</Text>
            </TouchableOpacity>
          </View>
          {/* Row 2 */}
          <View style={[st.quickRow, { marginTop: 8 }]}>
            <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FDF4FF" }]} onPress={() => router.push("/hisobot" as any)}>
              <View style={[st.quickIcon, { backgroundColor: "#A855F7" }]}>
                <Feather name="bar-chart-2" size={18} color="#fff" />
              </View>
              <Text style={[st.quickLabel, { color: "#A855F7" }]}>Hisobot</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FFF1F2" }]} onPress={() => router.push("/katalog" as any)}>
              <View style={[st.quickIcon, { backgroundColor: "#F43F5E" }]}>
                <Feather name="grid" size={18} color="#fff" />
              </View>
              <Text style={[st.quickLabel, { color: "#F43F5E" }]}>Katalog</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FFF7ED" }]} onPress={() => router.push("/low-stock" as any)}>
              <View style={[st.quickIcon, { backgroundColor: "#EA580C" }]}>
                <Feather name="alert-triangle" size={18} color="#fff" />
              </View>
              <Text style={[st.quickLabel, { color: "#EA580C" }]}>Kam qoldiq</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.quickCard, { backgroundColor: "#ECFDF5" }]} onPress={() => router.push("/supplier-order" as any)}>
              <View style={[st.quickIcon, { backgroundColor: "#059669" }]}>
                <Feather name="truck" size={18} color="#fff" />
              </View>
              <Text style={[st.quickLabel, { color: "#059669" }]}>Kirim</Text>
            </TouchableOpacity>
          </View>
          {/* Row 3 */}
          <View style={[st.quickRow, { marginTop: 8 }]}>
            <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FFF7ED" }]} onPress={() => router.push("/(tabs)/invoice")}>
              <View style={[st.quickIcon, { backgroundColor: "#F59E0B" }]}>
                <Feather name="file-text" size={18} color="#fff" />
              </View>
              <Text style={[st.quickLabel, { color: "#F59E0B" }]}>Faktura</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FFF1F2" }]} onPress={() => router.push("/(tabs)/calculator")}>
              <View style={[st.quickIcon, { backgroundColor: "#F43F5E" }]}>
                <Feather name="hash" size={18} color="#fff" />
              </View>
              <Text style={[st.quickLabel, { color: "#F43F5E" }]}>Hisob</Text>
            </TouchableOpacity>
            <View style={[st.quickCard, { backgroundColor: "transparent" }]} />
            <View style={[st.quickCard, { backgroundColor: "transparent" }]} />
          </View>
        </View>

        {/* ─── Bu oy ────────────────────────────────────────────── */}
        <View style={st.statSection}>
          <Text style={[st.sec, { color: C.textSecondary }]}>Bu oy</Text>
          <View style={st.row}>
            <SC icon="arrow-down-left" ic="#10B981" bg="#ECFDF5" lbl="Kirim"    val={n(monthIncome)}  />
            <SC icon="arrow-up-right"  ic="#EF4444" bg="#FEF2F2" lbl="Chiqim"   val={n(monthExpense)} />
            <SC icon="activity"        ic="#8B5CF6" bg="#F5F3FF" lbl="Faol bitishuv" val={String(activeDeals)} />
            <SC icon="check-circle"    ic="#F59E0B" bg="#FFFBEB" lbl="Yopildi"  val={String(closedDeals)} />
          </View>
        </View>

        {/* ─── So'nggi bitishuvlar ───────────────────────────────── */}
        <View style={st.statSection}>
          <Text style={[st.sec, { color: C.textSecondary }]}>So'nggi bitishuvlar</Text>
          {isLoading && <ActivityIndicator color={C.primary} style={{ paddingVertical: 20 }} />}
          {!isLoading && deals.length === 0 && (
            <View style={[st.emptyBox, { backgroundColor: C.card, borderColor: C.border }]}>
              <Feather name="inbox" size={32} color={C.textSecondary} />
              <Text style={[st.emptyTxt, { color: C.textSecondary }]}>Hali bitishuv yo'q</Text>
            </View>
          )}
          <View style={{ gap: 8 }}>
            {deals.slice(0, 6).map(d => {
              const cfg = STATUS_CFG[d.status] ?? STATUS_CFG.yangi;
              return (
                <TouchableOpacity
                  key={d.id}
                  activeOpacity={0.75}
                  style={[st.dealCard, { backgroundColor: C.card, borderColor: C.border }]}
                  onPress={() => router.push(`/deal/${d.id}` as any)}
                >
                  <View style={[st.dealIcon, { backgroundColor: cfg.bg }]}>
                    <Feather name="clipboard" size={16} color={cfg.c} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[st.dealName, { color: C.text }]} numberOfLines={1}>
                      {d.mijozIsm || d.mijozPhone || "Noma'lum mijoz"}
                    </Text>
                    <Text style={[st.dealSub, { color: C.textSecondary }]}>{ago(d.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    {d.totalNarx ? <Text style={[st.dealPrice, { color: C.text }]}>{n(d.totalNarx)}</Text> : null}
                    <View style={[st.badge, { backgroundColor: cfg.bg }]}>
                      <Text style={[st.badgeTxt, { color: cfg.c }]}>{cfg.l}</Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color={C.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ─── Bugungi tranzaksiyalar ────────────────────────────── */}
        {todayTxns.length > 0 && (
          <View style={st.statSection}>
            <Text style={[st.sec, { color: C.textSecondary }]}>Bugungi tranzaksiyalar</Text>
            <View style={{ gap: 6 }}>
              {todayTxns.slice(0, 6).map(t => (
                <View key={t.id} style={[st.txnRow, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={[st.txnDot, { backgroundColor: t.type === "income" ? "#ECFDF5" : "#FEF2F2" }]}>
                    <Feather
                      name={t.type === "income" ? "arrow-down-left" : "arrow-up-right"}
                      size={13} color={t.type === "income" ? "#10B981" : "#EF4444"}
                    />
                  </View>
                  <Text style={[st.txnDesc, { color: C.text }]} numberOfLines={1}>{t.description}</Text>
                  <Text style={[st.txnAmt, { color: t.type === "income" ? "#10B981" : "#EF4444" }]}>
                    {t.type === "income" ? "+" : "-"}{n(t.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SC({ icon, ic, bg, lbl, val }: { icon: any; ic: string; bg: string; lbl: string; val: string }) {
  return (
    <View style={[st.sc, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={[st.scIcon, { backgroundColor: bg }]}>
        <Feather name={icon} size={16} color={ic} />
      </View>
      <Text style={[st.scVal, { color: C.text }]}>{val}</Text>
      <Text style={[st.scLbl, { color: C.textSecondary }]} numberOfLines={2}>{lbl}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root:    { flex: 1 },
  hero:    { backgroundColor: "#4F46E5", paddingHorizontal: 20, paddingBottom: 32, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  heroTitle:{ fontSize: 26, fontFamily: "Inter_700Bold", color: "#fff" },
  heroDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.72)", marginTop: 3 },
  heroBadge:{ width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },

  todayCard:{ marginHorizontal: 16, marginTop: -20, borderRadius: 20, padding: 18, shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
  todayRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  todayCol: { flex: 1, alignItems: "center" },
  bigNum:   { fontSize: 20, fontFamily: "Inter_700Bold" },
  smallLbl: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  sep:      { width: 1, height: 36 },
  sec:      { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },

  statSection:{ paddingHorizontal: 16, marginTop: 20 },
  row:      { flexDirection: "row", gap: 8 },
  sc:       { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12, gap: 3, alignItems: "center" },
  scIcon:   { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  scVal:    { fontSize: 18, fontFamily: "Inter_700Bold" },
  scLbl:    { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center" },

  dealCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  dealIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  dealName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dealSub:  { fontSize: 11, fontFamily: "Inter_400Regular" },
  dealPrice:{ fontSize: 12, fontFamily: "Inter_700Bold" },
  badge:    { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  txnRow:   { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 12 },
  txnDot:   { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  txnDesc:  { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  txnAmt:   { fontSize: 13, fontFamily: "Inter_700Bold" },

  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 28, alignItems: "center", gap: 8 },
  emptyTxt: { fontSize: 14, fontFamily: "Inter_400Regular" },

  quickRow:   { flexDirection: "row", gap: 10 },
  quickCard:  { flex: 1, borderRadius: 16, padding: 14, alignItems: "center", gap: 8 },
  quickIcon:  { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
