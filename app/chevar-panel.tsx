import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import { useAuth } from "@/context/auth";

const C = Colors.light;

type Deal = {
  id: number;
  mijozIsm: string | null;
  mijozPhone: string | null;
  totalMaterial: number | null;
  narxPerMetr: number | null;
  totalNarx: number | null;
  chevarJami: number | null;
  measurementsJson: string | null;
  status: string;
  tayyorBolishKuni: string | null;
  createdAt: string | null;
  izoh: string | null;
};

type Stats = {
  totalDeals: number;
  totalSum: number;
  totalMaterial: number;
  todayDeals: number;
  todaySum: number;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  yangi:         { label: "Yangi",         color: "#6366F1" },
  tikuvda:       { label: "Tikuvda",        color: "#F59E0B" },
  tayyor:        { label: "Tayyor ✓",       color: "#10B981" },
  ornatilmoqda:  { label: "O'rnatilmoqda",  color: "#3B82F6" },
  yopildi:       { label: "Yopildi ✓",      color: "#6B7280" },
};

type PanelTab = "faol" | "bajarilgan" | "statistika";
type Period = "today" | "week" | "month";

function fmt(n?: number | null) {
  if (!n) return "—";
  return n.toLocaleString("uz-UZ") + " so'm";
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("uz-UZ");
}

const PERIOD_LABELS: Record<Period, string> = { today: "Bugun", week: "Hafta", month: "Oy" };

export default function ChevarPanel() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { logout, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [changing, setChanging] = useState<number | null>(null);
  const [tab, setTab] = useState<PanelTab>("faol");
  const [period, setPeriod] = useState<Period>("month");

  const wid = user?.linkedWorkerId ? `?workerId=${user.linkedWorkerId}` : "";

  const { data: deals = [], refetch: refetchTasks, isLoading } = useQuery<Deal[]>({
    queryKey: ["chevar-tasks", user?.linkedWorkerId],
    queryFn: () => apiReq(`/worker-panel/chevar-tasks${wid}`),
  });

  const { data: history = [], refetch: refetchHistory, isLoading: historyLoading } = useQuery<Deal[]>({
    queryKey: ["chevar-history", user?.linkedWorkerId],
    queryFn: () => apiReq(`/worker-panel/chevar-history${wid}`),
    enabled: tab === "bajarilgan",
  });

  const { data: stats, refetch: refetchStats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["chevar-stats", period, user?.linkedWorkerId],
    queryFn: () => apiReq(`/worker-panel/chevar-stats?period=${period}${user?.linkedWorkerId ? "&workerId=" + user.linkedWorkerId : ""}`),
    enabled: tab === "statistika",
  });

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refetchTasks(), refetchHistory(), refetchStats()]);
    setRefreshing(false);
  }

  async function changeStatus(dealId: number, status: "tikuvda" | "tayyor") {
    setChanging(dealId);
    try {
      await apiReq(`/worker-panel/deals/${dealId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, role: "chevar" }),
      });
      await qc.invalidateQueries({ queryKey: ["chevar-tasks"] });
      refetchTasks();
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setChanging(null); }
  }

  function handleLogout() {
    if (Platform.OS === "web") { logout(); return; }
    Alert.alert("Chiqish", "Tizimdan chiqmoqchimisiz?", [
      { text: "Bekor", style: "cancel" },
      { text: "Chiqish", style: "destructive", onPress: () => logout() },
    ]);
  }

  const yangi   = deals.filter(d => d.status === "yangi");
  const tikuvda = deals.filter(d => d.status === "tikuvda");

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16, backgroundColor: "#8B5CF6" }]}>
        <View style={s.headerIcon}>
          <Feather name="scissors" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Chevar paneli</Text>
          <Text style={s.headerSub}>
            {tab === "faol" ? `${deals.length} ta faol buyurtma` :
             tab === "bajarilgan" ? `${history.length} ta bajarilgan` :
             "Daromad statistikasi"}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
          <Feather name="log-out" size={18} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[s.tabBar, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        {([
          { key: "faol",        label: "Faol",         icon: "scissors" },
          { key: "bajarilgan",  label: "Bajarilgan",   icon: "check-circle" },
          { key: "statistika",  label: "Statistika",   icon: "bar-chart-2" },
        ] as { key: PanelTab; label: string; icon: any }[]).map(t => (
          <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
            <Feather name={t.icon} size={15} color={tab === t.key ? "#8B5CF6" : C.textSecondary} />
            <Text style={[s.tabTxt, { color: tab === t.key ? "#8B5CF6" : C.textSecondary }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── FAOL TAB ─── */}
      {tab === "faol" && (
        isLoading ? <ActivityIndicator color="#8B5CF6" style={{ marginTop: 60 }} /> : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20, gap: 12 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          >
            {deals.length === 0 && (
              <View style={s.empty}>
                <Feather name="check-circle" size={52} color={C.border} />
                <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hozircha buyurtma yo'q</Text>
              </View>
            )}
            {yangi.length > 0 && (
              <Text style={[s.section, { color: "#6366F1" }]}>🆕 Yangi buyurtmalar ({yangi.length})</Text>
            )}
            {yangi.map(d => <DealCard key={d.id} deal={d} changing={changing} onStatus={changeStatus} />)}
            {tikuvda.length > 0 && (
              <Text style={[s.section, { color: "#F59E0B" }]}>🧵 Tikuvda ({tikuvda.length})</Text>
            )}
            {tikuvda.map(d => <DealCard key={d.id} deal={d} changing={changing} onStatus={changeStatus} />)}
          </ScrollView>
        )
      )}

      {/* ─── BAJARILGAN TAB ─── */}
      {tab === "bajarilgan" && (
        historyLoading ? <ActivityIndicator color="#8B5CF6" style={{ marginTop: 60 }} /> : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20, gap: 10 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          >
            {history.length === 0 && (
              <View style={s.empty}>
                <Feather name="inbox" size={52} color={C.border} />
                <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hali bajarilgan buyurtma yo'q</Text>
              </View>
            )}
            {history.map(d => (
              <View key={d.id} style={[hc.card, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={hc.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[hc.name, { color: C.text }]}>{d.mijozIsm || "Noma'lum"}</Text>
                    <Text style={[hc.sub, { color: C.textSecondary }]}>#{d.id} · {fmtDate(d.createdAt)}</Text>
                  </View>
                  <View style={[hc.badge, { backgroundColor: (STATUS_LABELS[d.status]?.color || "#6B7280") + "20" }]}>
                    <Text style={[hc.badgeTxt, { color: STATUS_LABELS[d.status]?.color || "#6B7280" }]}>
                      {STATUS_LABELS[d.status]?.label || d.status}
                    </Text>
                  </View>
                </View>
                <View style={[hc.infoRow, { backgroundColor: "#F5F3FF" }]}>
                  <View style={hc.infoItem}>
                    <Text style={[hc.infoLbl, { color: C.textSecondary }]}>Material</Text>
                    <Text style={[hc.infoVal, { color: "#8B5CF6" }]}>{d.totalMaterial?.toFixed(2) || "—"} m²</Text>
                  </View>
                  <View style={hc.divider} />
                  <View style={hc.infoItem}>
                    <Text style={[hc.infoLbl, { color: C.textSecondary }]}>Summa</Text>
                    <Text style={[hc.infoVal, { color: C.text }]}>{fmt(d.totalNarx)}</Text>
                  </View>
                  {d.tayyorBolishKuni && (
                    <>
                      <View style={hc.divider} />
                      <View style={hc.infoItem}>
                        <Text style={[hc.infoLbl, { color: C.textSecondary }]}>Muddat</Text>
                        <Text style={[hc.infoVal, { color: "#EF4444" }]}>{fmtDate(d.tayyorBolishKuni)}</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        )
      )}

      {/* ─── STATISTIKA TAB ─── */}
      {tab === "statistika" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
        >
          {/* Period selector */}
          <View style={[s.periodRow, { backgroundColor: C.card, borderColor: C.border }]}>
            {(["today", "week", "month"] as Period[]).map(p => (
              <TouchableOpacity
                key={p}
                style={[s.periodBtn, period === p && { backgroundColor: "#8B5CF6" }]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[s.periodBtnTxt, { color: period === p ? "#fff" : C.textSecondary }]}>
                  {PERIOD_LABELS[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {statsLoading ? <ActivityIndicator color="#8B5CF6" /> : stats ? (
            <>
              {/* Main stat cards */}
              <View style={s.statsGrid}>
                <View style={[s.statCard, { backgroundColor: "#8B5CF6" }]}>
                  <Feather name="scissors" size={22} color="rgba(255,255,255,0.8)" />
                  <Text style={s.statCardVal}>{stats.totalDeals}</Text>
                  <Text style={s.statCardLbl}>Bajarilgan ishlar</Text>
                </View>
                <View style={[s.statCard, { backgroundColor: "#10B981" }]}>
                  <Feather name="dollar-sign" size={22} color="rgba(255,255,255,0.8)" />
                  <Text style={[s.statCardVal, { fontSize: 14 }]}>{fmt(stats.totalSum)}</Text>
                  <Text style={s.statCardLbl}>Jami buyurtma qiymati</Text>
                </View>
              </View>

              <View style={s.statsGrid}>
                <View style={[s.statCard, { backgroundColor: "#6366F1" }]}>
                  <Feather name="layers" size={22} color="rgba(255,255,255,0.8)" />
                  <Text style={s.statCardVal}>{stats.totalMaterial?.toFixed(1)} m²</Text>
                  <Text style={s.statCardLbl}>Jami material</Text>
                </View>
                <View style={[s.statCard, { backgroundColor: "#F59E0B" }]}>
                  <Feather name="sun" size={22} color="rgba(255,255,255,0.8)" />
                  <Text style={s.statCardVal}>{stats.todayDeals}</Text>
                  <Text style={s.statCardLbl}>Bugun tayyor</Text>
                </View>
              </View>

              {/* Today highlight */}
              <View style={[s.todayCard, { backgroundColor: C.card, borderColor: "#8B5CF620" }]}>
                <View style={[s.todayIconWrap, { backgroundColor: "#F5F3FF" }]}>
                  <Feather name="clock" size={20} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.todayLbl, { color: C.textSecondary }]}>Bugungi daromad</Text>
                  <Text style={[s.todayVal, { color: "#8B5CF6" }]}>{fmt(stats.todaySum)}</Text>
                </View>
                <View style={[s.todayBadge, { backgroundColor: "#8B5CF620" }]}>
                  <Text style={{ color: "#8B5CF6", fontFamily: "Inter_700Bold", fontSize: 18 }}>{stats.todayDeals} ta</Text>
                </View>
              </View>

              {/* Active tasks summary */}
              <View style={[s.activeCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={[s.activeTitle, { color: C.text }]}>Hozirgi holat</Text>
                <View style={s.activeRow}>
                  <View style={[s.activeItem, { borderColor: "#6366F120" }]}>
                    <Text style={[s.activeNum, { color: "#6366F1" }]}>{yangi.length}</Text>
                    <Text style={[s.activeLbl, { color: C.textSecondary }]}>Yangi</Text>
                  </View>
                  <View style={[s.activeItem, { borderColor: "#F59E0B20" }]}>
                    <Text style={[s.activeNum, { color: "#F59E0B" }]}>{tikuvda.length}</Text>
                    <Text style={[s.activeLbl, { color: C.textSecondary }]}>Tikuvda</Text>
                  </View>
                  <View style={[s.activeItem, { borderColor: "#10B98120" }]}>
                    <Text style={[s.activeNum, { color: "#10B981" }]}>{history.length}</Text>
                    <Text style={[s.activeLbl, { color: C.textSecondary }]}>Jami tayyor</Text>
                  </View>
                </View>
              </View>
            </>
          ) : (
            <View style={s.empty}>
              <Feather name="bar-chart-2" size={40} color={C.border} />
              <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Ma'lumot yo'q</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function DealCard({ deal, changing, onStatus }: {
  deal: Deal;
  changing: number | null;
  onStatus: (id: number, status: "tikuvda" | "tayyor") => void;
}) {
  const st = STATUS_LABELS[deal.status];
  let meas: [string, any][] = [];
  if (deal.measurementsJson) {
    try { meas = Object.entries(JSON.parse(deal.measurementsJson)); } catch {}
  }

  return (
    <View style={[dc.card, { backgroundColor: Colors.light.card, borderColor: Colors.light.border }]}>
      <View style={dc.top}>
        <View style={{ flex: 1 }}>
          <Text style={[dc.name, { color: Colors.light.text }]}>{deal.mijozIsm || "Noma'lum"}</Text>
          <Text style={[dc.sub, { color: Colors.light.textSecondary }]}>#{deal.id} · {fmtDate(deal.createdAt)}</Text>
        </View>
        <View style={[dc.badge, { backgroundColor: st.color + "20" }]}>
          <Text style={[dc.badgeTxt, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      <View style={[dc.infoRow, { backgroundColor: "#F5F3FF", borderRadius: 10, padding: 10, marginTop: 8 }]}>
        <View style={dc.infoItem}>
          <Text style={[dc.infoLabel, { color: Colors.light.textSecondary }]}>Material</Text>
          <Text style={[dc.infoVal, { color: "#8B5CF6" }]}>{deal.totalMaterial?.toFixed(2) ?? "—"} m²</Text>
        </View>
        <View style={dc.infoDivider} />
        <View style={dc.infoItem}>
          <Text style={[dc.infoLabel, { color: Colors.light.textSecondary }]}>✂️ Haqi</Text>
          <Text style={[dc.infoVal, { color: "#10B981" }]}>{fmt(deal.chevarJami)}</Text>
        </View>
        {deal.tayyorBolishKuni && (
          <>
            <View style={dc.infoDivider} />
            <View style={dc.infoItem}>
              <Text style={[dc.infoLabel, { color: Colors.light.textSecondary }]}>⏰ Muddat</Text>
              <Text style={[dc.infoVal, { color: "#EF4444" }]}>{fmtDate(deal.tayyorBolishKuni)}</Text>
            </View>
          </>
        )}
      </View>

      {meas.length > 0 && (
        <View style={{ marginTop: 10, gap: 4 }}>
          <Text style={[dc.measTitle, { color: Colors.light.textSecondary }]}>📐 O'lchamlar:</Text>
          <View style={dc.measGrid}>
            {meas.map(([k, v]) => (
              <View key={k} style={[dc.measItem, { backgroundColor: Colors.light.surface, borderColor: Colors.light.border }]}>
                <Text style={[dc.measKey, { color: Colors.light.textSecondary }]}>{k}</Text>
                <Text style={[dc.measVal, { color: Colors.light.text }]}>{String(v)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {deal.izoh ? (
        <Text style={[dc.note, { color: Colors.light.textSecondary }]}>💬 {deal.izoh}</Text>
      ) : null}

      <View style={dc.btns}>
        {deal.status === "yangi" && (
          <TouchableOpacity
            style={[dc.btn, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}
            onPress={() => onStatus(deal.id, "tikuvda")}
            disabled={changing === deal.id}
          >
            {changing === deal.id ? <ActivityIndicator size="small" color="#F59E0B" /> : (
              <><Feather name="scissors" size={15} color="#F59E0B" />
                <Text style={[dc.btnTxt, { color: "#F59E0B" }]}>Tikuvga qabul qilish</Text></>
            )}
          </TouchableOpacity>
        )}
        {deal.status === "tikuvda" && (
          <TouchableOpacity
            style={[dc.btn, { backgroundColor: "#D1FAE5", borderColor: "#10B981" }]}
            onPress={() => onStatus(deal.id, "tayyor")}
            disabled={changing === deal.id}
          >
            {changing === deal.id ? <ActivityIndicator size="small" color="#10B981" /> : (
              <><Feather name="check-circle" size={15} color="#10B981" />
                <Text style={[dc.btnTxt, { color: "#10B981" }]}>Tayyor deb belgilash</Text></>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 16,
  },
  headerIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" },
  logoutBtn: { padding: 8 },
  tabBar: {
    flexDirection: "row", borderBottomWidth: 1,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 12,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#8B5CF6" },
  tabTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  section: { fontSize: 14, fontFamily: "Inter_700Bold", marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 80, gap: 14 },
  emptyTxt: { fontSize: 15, fontFamily: "Inter_400Regular" },
  periodRow: {
    flexDirection: "row", borderRadius: 12, borderWidth: 1,
    overflow: "hidden",
  },
  periodBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  periodBtnTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statsGrid: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1, borderRadius: 16, padding: 16,
    alignItems: "center", gap: 8,
  },
  statCardVal: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  statCardLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", textAlign: "center" },
  todayCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 16, borderWidth: 1.5, padding: 16,
  },
  todayIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  todayLbl: { fontSize: 12, fontFamily: "Inter_400Regular" },
  todayVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  todayBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  activeCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  activeTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  activeRow: { flexDirection: "row", gap: 10 },
  activeItem: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, gap: 4 },
  activeNum: { fontSize: 24, fontFamily: "Inter_700Bold" },
  activeLbl: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

const dc = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  top: { flexDirection: "row", alignItems: "flex-start" },
  name: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  infoRow: { flexDirection: "row", alignItems: "center" },
  infoItem: { flex: 1, alignItems: "center", gap: 3 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  infoVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  infoDivider: { width: 1, height: 28, backgroundColor: "#E8E5FF" },
  measTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  measGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  measItem: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  measKey: { fontSize: 10, fontFamily: "Inter_400Regular" },
  measVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  note: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8, fontStyle: "italic" },
  btns: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
  },
  btnTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

const hc = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 10 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  name: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  badgeTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  infoRow: { flexDirection: "row", borderRadius: 10, padding: 10 },
  infoItem: { flex: 1, alignItems: "center", gap: 2 },
  infoLbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
  infoVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  divider: { width: 1, height: 26, backgroundColor: "#E8E5FF" },
});
