import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Linking, Platform,
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
  manzil: string | null;
  status: string;
  tayyorBolishKuni: string | null;
  ornatishJami: number | null;
  totalMaterial: number | null;
  totalNarx: number | null;
  measurementsJson: string | null;
  izoh: string | null;
  createdAt: string | null;
};

type HStats = {
  totalDeals: number;
  totalNarx: number;
  totalMaterial: number;
  todayDeals: number;
  todayNarx: number;
};

type PanelTab = "faol" | "yetkazilgan" | "statistika";
type Period = "today" | "week" | "month";
const PERIOD_LABELS: Record<Period, string> = { today: "Bugun", week: "Hafta", month: "Oy" };

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("uz-UZ");
}
function fmt(n?: number | null) {
  if (!n) return "—";
  return n.toLocaleString("uz-UZ") + " so'm";
}

export default function HaydovchiPanel() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { logout, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [changing, setChanging] = useState<number | null>(null);
  const [tab, setTab] = useState<PanelTab>("faol");
  const [period, setPeriod] = useState<Period>("month");

  const wid = user?.linkedWorkerId ? `?workerId=${user.linkedWorkerId}` : "";

  const { data: deals = [], refetch: refetchTasks, isLoading } = useQuery<Deal[]>({
    queryKey: ["haydovchi-tasks", user?.linkedWorkerId],
    queryFn: () => apiReq(`/worker-panel/haydovchi-tasks${wid}`),
  });

  const { data: history = [], refetch: refetchHistory, isLoading: historyLoading } = useQuery<Deal[]>({
    queryKey: ["haydovchi-history", user?.linkedWorkerId],
    queryFn: () => apiReq(`/worker-panel/haydovchi-history${wid}`),
    enabled: tab === "yetkazilgan",
  });

  const { data: stats, refetch: refetchStats, isLoading: statsLoading } = useQuery<HStats>({
    queryKey: ["haydovchi-stats", period, user?.linkedWorkerId],
    queryFn: () => apiReq(`/worker-panel/haydovchi-stats?period=${period}${user?.linkedWorkerId ? "&workerId=" + user.linkedWorkerId : ""}`),
    enabled: tab === "statistika",
  });

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refetchTasks(), refetchHistory(), refetchStats()]);
    setRefreshing(false);
  }

  async function changeStatus(dealId: number, status: "ornatilmoqda" | "yopildi") {
    setChanging(dealId);
    try {
      await apiReq(`/worker-panel/deals/${dealId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, role: "haydovchi" }),
      });
      await qc.invalidateQueries({ queryKey: ["haydovchi-tasks"] });
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

  function openMaps(deal: Deal) {
    if (deal.manzil) {
      Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(deal.manzil)}`);
    } else {
      Alert.alert("Manzil yo'q", "Buyurtmada manzil kiritilmagan");
    }
  }

  function callClient(deal: Deal) {
    if (deal.mijozPhone) Linking.openURL(`tel:${deal.mijozPhone}`);
  }

  const tayyor       = deals.filter(d => d.status === "tayyor");
  const ornatilmoqda = deals.filter(d => d.status === "ornatilmoqda");

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16, backgroundColor: "#059669" }]}>
        <View style={s.headerIcon}>
          <Feather name="truck" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Haydovchi paneli</Text>
          <Text style={s.headerSub}>
            {tab === "faol" ? `${deals.length} ta faol vazifa` :
             tab === "yetkazilgan" ? `${history.length} ta yetkazilgan` :
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
          { key: "faol",        label: "Faol",         icon: "truck" },
          { key: "yetkazilgan", label: "Yetkazilgan",  icon: "check-circle" },
          { key: "statistika",  label: "Statistika",   icon: "bar-chart-2" },
        ] as { key: PanelTab; label: string; icon: any }[]).map(t => (
          <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
            <Feather name={t.icon} size={15} color={tab === t.key ? "#059669" : C.textSecondary} />
            <Text style={[s.tabTxt, { color: tab === t.key ? "#059669" : C.textSecondary }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── FAOL TAB ─── */}
      {tab === "faol" && (
        isLoading ? <ActivityIndicator color="#059669" style={{ marginTop: 60 }} /> : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20, gap: 12 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
          >
            {deals.length === 0 && (
              <View style={s.empty}>
                <Feather name="check-circle" size={52} color={C.border} />
                <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hozircha vazifa yo'q</Text>
              </View>
            )}
            {tayyor.length > 0 && (
              <Text style={[s.section, { color: "#10B981" }]}>✅ O'rnatishga tayyor ({tayyor.length})</Text>
            )}
            {tayyor.map(d => <DelivCard key={d.id} deal={d} changing={changing} onStatus={changeStatus} onMaps={openMaps} onCall={callClient} />)}
            {ornatilmoqda.length > 0 && (
              <Text style={[s.section, { color: "#3B82F6" }]}>🚗 O'rnatilmoqda ({ornatilmoqda.length})</Text>
            )}
            {ornatilmoqda.map(d => <DelivCard key={d.id} deal={d} changing={changing} onStatus={changeStatus} onMaps={openMaps} onCall={callClient} />)}
          </ScrollView>
        )
      )}

      {/* ─── YETKAZILGAN TAB ─── */}
      {tab === "yetkazilgan" && (
        historyLoading ? <ActivityIndicator color="#059669" style={{ marginTop: 60 }} /> : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20, gap: 10 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
          >
            {history.length === 0 && (
              <View style={s.empty}>
                <Feather name="inbox" size={52} color={C.border} />
                <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hali yetkazilgan buyurtma yo'q</Text>
              </View>
            )}
            {history.map(d => (
              <View key={d.id} style={[hc.card, { backgroundColor: C.card, borderColor: "#A7F3D0" }]}>
                <View style={hc.row}>
                  <View style={[hc.checkWrap, { backgroundColor: "#D1FAE5" }]}>
                    <Feather name="check" size={16} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[hc.name, { color: C.text }]}>{d.mijozIsm || "Noma'lum"}</Text>
                    <Text style={[hc.sub, { color: C.textSecondary }]}>#{d.id} · {fmtDate(d.createdAt)}</Text>
                  </View>
                  {d.ornatishJami ? (
                    <Text style={{ color: "#059669", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                      {fmt(d.ornatishJami)}
                    </Text>
                  ) : null}
                </View>

                {d.manzil && (
                  <View style={[hc.addrRow, { backgroundColor: "#ECFDF5" }]}>
                    <Feather name="map-pin" size={13} color="#059669" />
                    <Text style={[hc.addrTxt, { color: "#065F46" }]} numberOfLines={1}>{d.manzil}</Text>
                  </View>
                )}

                <View style={hc.statsRow}>
                  {d.tayyorBolishKuni && (
                    <View style={[hc.tag, { backgroundColor: "#FEF9C3", borderColor: "#FDE047" }]}>
                      <Text style={{ fontSize: 11, color: "#713F12", fontFamily: "Inter_600SemiBold" }}>
                        📅 {fmtDate(d.tayyorBolishKuni)}
                      </Text>
                    </View>
                  )}
                  {d.totalMaterial ? (
                    <View style={[hc.tag, { backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" }]}>
                      <Text style={{ fontSize: 11, color: "#0369A1", fontFamily: "Inter_600SemiBold" }}>
                        📏 {d.totalMaterial.toFixed(2)} m²
                      </Text>
                    </View>
                  ) : null}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
        >
          {/* Period selector */}
          <View style={[s.periodRow, { backgroundColor: C.card, borderColor: C.border }]}>
            {(["today", "week", "month"] as Period[]).map(p => (
              <TouchableOpacity
                key={p}
                style={[s.periodBtn, period === p && { backgroundColor: "#059669" }]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[s.periodBtnTxt, { color: period === p ? "#fff" : C.textSecondary }]}>
                  {PERIOD_LABELS[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {statsLoading ? <ActivityIndicator color="#059669" /> : stats ? (
            <>
              <View style={s.statsGrid}>
                <View style={[s.statCard, { backgroundColor: "#059669" }]}>
                  <Feather name="truck" size={22} color="rgba(255,255,255,0.8)" />
                  <Text style={s.statCardVal}>{stats.totalDeals}</Text>
                  <Text style={s.statCardLbl}>Yetkazilgan buyurtmalar</Text>
                </View>
                <View style={[s.statCard, { backgroundColor: "#10B981" }]}>
                  <Feather name="dollar-sign" size={22} color="rgba(255,255,255,0.8)" />
                  <Text style={[s.statCardVal, { fontSize: 14 }]}>{fmt(stats.totalNarx)}</Text>
                  <Text style={s.statCardLbl}>O'rnatish daromadi</Text>
                </View>
              </View>

              <View style={s.statsGrid}>
                <View style={[s.statCard, { backgroundColor: "#0369A1" }]}>
                  <Feather name="layers" size={22} color="rgba(255,255,255,0.8)" />
                  <Text style={s.statCardVal}>{stats.totalMaterial?.toFixed(1)} m²</Text>
                  <Text style={s.statCardLbl}>Jami o'rnatilgan</Text>
                </View>
                <View style={[s.statCard, { backgroundColor: "#F59E0B" }]}>
                  <Feather name="sun" size={22} color="rgba(255,255,255,0.8)" />
                  <Text style={s.statCardVal}>{stats.todayDeals}</Text>
                  <Text style={s.statCardLbl}>Bugun yetkazilgan</Text>
                </View>
              </View>

              {/* Today highlight */}
              <View style={[s.todayCard, { backgroundColor: C.card, borderColor: "#D1FAE5" }]}>
                <View style={[s.todayIconWrap, { backgroundColor: "#ECFDF5" }]}>
                  <Feather name="clock" size={20} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.todayLbl, { color: C.textSecondary }]}>Bugungi daromad</Text>
                  <Text style={[s.todayVal, { color: "#059669" }]}>{fmt(stats.todayNarx)}</Text>
                </View>
                <View style={[s.todayBadge, { backgroundColor: "#D1FAE5" }]}>
                  <Text style={{ color: "#059669", fontFamily: "Inter_700Bold", fontSize: 18 }}>{stats.todayDeals} ta</Text>
                </View>
              </View>

              {/* Active tasks summary */}
              <View style={[s.activeCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={[s.activeTitle, { color: C.text }]}>Hozirgi holat</Text>
                <View style={s.activeRow}>
                  <View style={[s.activeItem, { borderColor: "#10B98120" }]}>
                    <Text style={[s.activeNum, { color: "#10B981" }]}>{tayyor.length}</Text>
                    <Text style={[s.activeLbl, { color: C.textSecondary }]}>Tayyor</Text>
                  </View>
                  <View style={[s.activeItem, { borderColor: "#3B82F620" }]}>
                    <Text style={[s.activeNum, { color: "#3B82F6" }]}>{ornatilmoqda.length}</Text>
                    <Text style={[s.activeLbl, { color: C.textSecondary }]}>O'rnatilmoqda</Text>
                  </View>
                  <View style={[s.activeItem, { borderColor: "#05996920" }]}>
                    <Text style={[s.activeNum, { color: "#059669" }]}>{history.length}</Text>
                    <Text style={[s.activeLbl, { color: C.textSecondary }]}>Jami yopildi</Text>
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

function DelivCard({ deal, changing, onStatus, onMaps, onCall }: {
  deal: Deal;
  changing: number | null;
  onStatus: (id: number, status: "ornatilmoqda" | "yopildi") => void;
  onMaps: (deal: Deal) => void;
  onCall: (deal: Deal) => void;
}) {
  const isChanging = changing === deal.id;
  const isLate = deal.tayyorBolishKuni && new Date(deal.tayyorBolishKuni) < new Date();

  return (
    <View style={[dc.card, { backgroundColor: Colors.light.card, borderColor: isLate ? "#FCA5A5" : Colors.light.border }]}>
      <View style={dc.top}>
        <View style={{ flex: 1 }}>
          <Text style={[dc.name, { color: Colors.light.text }]}>{deal.mijozIsm || "Noma'lum"}</Text>
          <Text style={[dc.sub, { color: Colors.light.textSecondary }]}>#{deal.id} · {fmtDate(deal.createdAt)}</Text>
        </View>
        {deal.ornatishJami ? (
          <Text style={{ color: "#059669", fontFamily: "Inter_700Bold", fontSize: 15 }}>
            {deal.ornatishJami.toLocaleString("uz-UZ")} so'm
          </Text>
        ) : null}
      </View>

      {/* O'rnatish kuni — eng muhim ma'lumot */}
      {deal.tayyorBolishKuni && (
        <View style={[dc.dateLine, { backgroundColor: isLate ? "#FEE2E2" : "#DBEAFE", borderColor: isLate ? "#FCA5A5" : "#BFDBFE" }]}>
          <Feather name="calendar" size={14} color={isLate ? "#DC2626" : "#3B82F6"} />
          <Text style={[dc.dateLbl, { color: isLate ? "#DC2626" : "#1D4ED8" }]}>
            {isLate ? "⚠️ Muddati o'tgan:" : "📅 O'rnatish kuni:"}
          </Text>
          <Text style={[dc.dateVal, { color: isLate ? "#DC2626" : "#1D4ED8" }]}>
            {fmtDate(deal.tayyorBolishKuni)}
          </Text>
        </View>
      )}

      {/* Manzil bloki */}
      <TouchableOpacity
        style={[dc.addressBlock, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}
        onPress={() => onMaps(deal)}
        activeOpacity={0.8}
      >
        <Feather name="map-pin" size={20} color="#059669" />
        <View style={{ flex: 1 }}>
          <Text style={[dc.addressTxt, { color: "#065F46" }]}>{deal.manzil || "Manzil kiritilmagan"}</Text>
          <Text style={[dc.tapTxt, { color: "#059669" }]}>Xaritada ko'rish →</Text>
        </View>
      </TouchableOpacity>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        {deal.totalMaterial ? (
          <View style={[dc.tag, { backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" }]}>
            <Text style={{ fontSize: 12, color: "#0369A1", fontFamily: "Inter_600SemiBold" }}>
              📏 {deal.totalMaterial.toFixed(2)} m²
            </Text>
          </View>
        ) : null}
        {deal.totalNarx ? (
          <View style={[dc.tag, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
            <Text style={{ fontSize: 12, color: "#166534", fontFamily: "Inter_600SemiBold" }}>
              💵 {deal.totalNarx.toLocaleString("uz-UZ")} so'm
            </Text>
          </View>
        ) : null}
      </View>

      {deal.izoh ? (
        <Text style={[dc.note, { color: Colors.light.textSecondary }]}>💬 {deal.izoh}</Text>
      ) : null}

      <View style={dc.btns}>
        {deal.mijozPhone && (
          <TouchableOpacity
            style={[dc.btn, { backgroundColor: "#D1FAE5", borderColor: "#10B981", flex: 0, paddingHorizontal: 14 }]}
            onPress={() => onCall(deal)}
          >
            <Feather name="phone" size={16} color="#059669" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[dc.btn, { backgroundColor: "#DBEAFE", borderColor: "#3B82F6" }]}
          onPress={() => onMaps(deal)}
        >
          <Feather name="navigation" size={15} color="#3B82F6" />
          <Text style={[dc.btnTxt, { color: "#3B82F6" }]}>Navigatsiya</Text>
        </TouchableOpacity>
        {deal.status === "tayyor" && (
          <TouchableOpacity
            style={[dc.btn, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}
            onPress={() => onStatus(deal.id, "ornatilmoqda")}
            disabled={isChanging}
          >
            {isChanging ? <ActivityIndicator size="small" color="#F59E0B" /> : (
              <><Feather name="tool" size={15} color="#F59E0B" />
                <Text style={[dc.btnTxt, { color: "#F59E0B" }]}>Boshlash</Text></>
            )}
          </TouchableOpacity>
        )}
        {deal.status === "ornatilmoqda" && (
          <TouchableOpacity
            style={[dc.btn, { backgroundColor: "#D1FAE5", borderColor: "#10B981" }]}
            onPress={() => onStatus(deal.id, "yopildi")}
            disabled={isChanging}
          >
            {isChanging ? <ActivityIndicator size="small" color="#10B981" /> : (
              <><Feather name="check-circle" size={15} color="#10B981" />
                <Text style={[dc.btnTxt, { color: "#10B981" }]}>Tugadi</Text></>
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
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 12,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#059669" },
  tabTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  section: { fontSize: 14, fontFamily: "Inter_700Bold", marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 80, gap: 14 },
  emptyTxt: { fontSize: 15, fontFamily: "Inter_400Regular" },
  periodRow: {
    flexDirection: "row", borderRadius: 12, borderWidth: 1, overflow: "hidden",
  },
  periodBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  periodBtnTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statsGrid: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1, borderRadius: 16, padding: 16, alignItems: "center", gap: 8,
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
  top: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  name: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  dateLine: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 10,
  },
  dateLbl: { fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 },
  dateVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  addressBlock: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 10,
  },
  addressTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tapTxt: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  note: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8, fontStyle: "italic" },
  btns: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
  },
  btnTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

const hc = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1.5, padding: 12, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, padding: 8 },
  addrTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1 },
});
