import React, { useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, Platform, ActivityIndicator, TouchableOpacity, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { fmtDateWeekday, fmtNum } from "../../lib/date-utils";

const C = Colors.light;

interface FinanceTxn {
  id: number; type: string; amount: number;
  description: string; category: string; createdAt: string;
}
interface Deal {
  id: number; mijozIsm: string | null; mijozPhone: string | null;
  totalNarx: number | null; status: string; createdAt: string;
}

function n(v: number) { return fmtNum(Math.round(v)); }
function todayStr() {
  return fmtDateWeekday(new Date());
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
  bekor:        { l: "Bekor",        c: "#DC2626", bg: "#FEE2E2" },
};

export default function StatistikaScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { logout, user } = useAuth();
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 90);
  const [refreshing, setRefreshing] = React.useState(false);

  const handleLogout = () => {
    if (Platform.OS === "web") {
      logout();
      return;
    }
    Alert.alert("Chiqish", "Tizimdan chiqmoqchimisiz?", [
      { text: "Bekor", style: "cancel" },
      { text: "Chiqish", style: "destructive", onPress: () => logout() },
    ]);
  };

  const { data: notifCount } = useQuery<{ total: number; high: number }>({
    queryKey: ["notif-count"],
    queryFn: () => apiReq("/notifications/count"),
    refetchInterval: 120_000,
    retry: false,
  });

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
  const { data: qarzStats } = useQuery<{ olindiJami: number; berildiJami: number }>({
    queryKey: ["qarz-daftar-stats"],
    queryFn: () => apiReq("/qarz-daftar/stats"),
    retry: false,
  });
  const { data: expensesData } = useQuery({
    queryKey: ["worker-expenses-summary"],
    queryFn: () => apiReq<{ kassaDeductions: number; totalShaxsiy: number; netRemaining: number }>("/worker-panel/expenses/summary"),
    retry: false,
  });
  const deals: Deal[] = Array.isArray(dealsRaw) ? dealsRaw : (dealsRaw as any)?.deals ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["finance-month"] }),
      qc.invalidateQueries({ queryKey: ["finance-today"] }),
      qc.invalidateQueries({ queryKey: ["deals-recent"] }),
      qc.invalidateQueries({ queryKey: ["qarz-daftar-stats"] }),
      qc.invalidateQueries({ queryKey: ["worker-expenses-summary"] }),
      qc.invalidateQueries({ queryKey: ["notif-count"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const isSeller = user?.role === "seller";
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
          <View style={{ flex: 1 }}>
            <Text style={st.heroGreeting}>
              {new Date().getHours() < 12 ? "Xayrli tong" : new Date().getHours() < 18 ? "Xayrli kun" : "Xayrli kech"} 👋
            </Text>
            <Text style={st.heroTitle}>{user?.fullName || "Bluepos"}</Text>
            <Text style={st.heroDate}>{todayStr()}</Text>
          </View>
          <View style={{ gap: 8, alignItems: "center" }}>
            <TouchableOpacity
              style={[st.heroBadge, { backgroundColor: "rgba(255,255,255,0.18)" }]}
              onPress={() => router.push("/(tabs)/profile")}
              activeOpacity={0.7}
            >
              <View style={st.heroAvatar}>
                <Text style={st.heroAvatarTxt}>{(user?.fullName || "U").charAt(0).toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.heroBadge, { backgroundColor: "rgba(255,255,255,0.15)" }]}
              onPress={() => router.push("/(tabs)/xabarnomalar" as any)}
              activeOpacity={0.7}
            >
              <Feather name="bell" size={18} color="rgba(255,255,255,0.85)" />
              {(notifCount?.high ?? 0) > 0 && (
                <View style={st.bellBadge}>
                  <Text style={st.bellBadgeTxt}>{notifCount!.high > 9 ? "9+" : notifCount!.high}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.heroBadge, { backgroundColor: "rgba(255,255,255,0.15)" }]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Feather name="log-out" size={18} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Bugungi savdo ────────────────────────────────────── */}
        <View style={[st.todayCard, { backgroundColor: C.card }]}>
          <Text style={[st.sec, { color: C.textSecondary }]}>Bugun</Text>
          {isSeller ? (
            <View style={st.todayRow}>
              <View style={st.todayCol}>
                <Text style={[st.bigNum, { color: "#4F46E5" }]}>{n(todayIncome)}</Text>
                <Text style={[st.smallLbl, { color: C.textSecondary }]}>bugungi savdo</Text>
              </View>
            </View>
          ) : (
            <>
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
              {(qarzStats?.olindiJami || qarzStats?.berildiJami) ? (
                <View style={[st.todayRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }]}>
                  <View style={st.todayCol}>
                    <Text style={[st.bigNum, { color: "#10B981", fontSize: 16 }]}>+{n(qarzStats?.olindiJami ?? 0)}</Text>
                    <Text style={[st.smallLbl, { color: C.textSecondary }]}>so'm olindi</Text>
                  </View>
                  <View style={[st.sep, { backgroundColor: C.border }]} />
                  <View style={st.todayCol}>
                    <Text style={[st.bigNum, { color: "#EF4444", fontSize: 16 }]}>-{n(qarzStats?.berildiJami ?? 0)}</Text>
                    <Text style={[st.smallLbl, { color: C.textSecondary }]}>so'm berildi</Text>
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* ─── Tez harakatlar ───────────────────────────────────── */}
        <View style={st.statSection}>
          <Text style={[st.sec, { color: C.textSecondary }]}>Tez harakatlar</Text>
          {isSeller ? (
            <>
              <View style={st.quickRow}>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FFF0F0" }]} onPress={() => router.push("/(tabs)/sotuv" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#EF4444" }]}>
                    <Feather name="shopping-cart" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#EF4444" }]}>Sotuv</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#F0FDF4" }]} onPress={() => router.push("/scanner" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#059669" }]}>
                    <Feather name="maximize" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#059669" }]}>Skaner</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#EEF2FF" }]} onPress={() => router.push("/new-deal" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#4F46E5" }]}>
                    <Feather name="plus-circle" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#4F46E5" }]}>Buyurtma</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#F0F9FF" }]} onPress={() => router.push("/(tabs)/mahsulotlar" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#0EA5E9" }]}>
                    <Feather name="box" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#0EA5E9" }]}>Mahsulotlar</Text>
                </TouchableOpacity>
              </View>
              <View style={[st.quickRow, { marginTop: 8 }]}>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#ECFDF5" }]} onPress={() => router.push("/(tabs)/davomat" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#10B981" }]}>
                    <Feather name="user-check" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#10B981" }]}>Davomat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#EFF6FF" }]} onPress={() => router.push("/(tabs)/mijozlar")}>
                  <View style={[st.quickIcon, { backgroundColor: "#3B82F6" }]}>
                    <Feather name="users" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#3B82F6" }]}>Mijozlar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FFF1F2" }]} onPress={() => router.push("/(tabs)/calculator")}>
                  <View style={[st.quickIcon, { backgroundColor: "#F43F5E" }]}>
                    <Feather name="hash" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#F43F5E" }]}>Hisob</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <>
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
              <View style={[st.quickRow, { marginTop: 8 }]}>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FFF0F0" }]} onPress={() => router.push("/(tabs)/sotuv" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#EF4444" }]}>
                    <Feather name="shopping-cart" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#EF4444" }]}>Sotuv</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FEF2F2" }]} onPress={() => router.push("/(tabs)/shaxsiy-xarajatlar" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#DC2626" }]}>
                    <Feather name="trending-down" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#DC2626" }]}>Rasxodlar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#F0F9FF" }]} onPress={() => router.push("/(tabs)/mahsulotlar" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#0EA5E9" }]}>
                    <Feather name="box" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#0EA5E9" }]}>Mahsulotlar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#ECFDF5" }]} onPress={() => router.push("/(tabs)/davomat" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#10B981" }]}>
                    <Feather name="user-check" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#10B981" }]}>Davomat</Text>
                </TouchableOpacity>
              </View>
              <View style={[st.quickRow, { marginTop: 8 }]}>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FDF4FF" }]} onPress={() => router.push("/(tabs)/hisobot" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#A855F7" }]}>
                    <Feather name="bar-chart-2" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#A855F7" }]}>Hisobot</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#ECFDF5" }]} onPress={() => router.push("/(tabs)/kanban" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#059669" }]}>
                    <Feather name="trello" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#059669" }]}>Kanban</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FFF7ED" }]} onPress={() => router.push("/(tabs)/jadval" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#EA580C" }]}>
                    <Feather name="calendar" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#EA580C" }]}>Jadval</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FFF1F2" }]} onPress={() => router.push("/(tabs)/qarz-daftar" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#F43F5E" }]}>
                    <Feather name="book" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#F43F5E" }]}>Qarz daftar</Text>
                </TouchableOpacity>
              </View>
              <View style={[st.quickRow, { marginTop: 8 }]}>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FFF7ED" }]} onPress={() => router.push("/(tabs)/invoice")}>
                  <View style={[st.quickIcon, { backgroundColor: "#F59E0B" }]}>
                    <Feather name="file-text" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#F59E0B" }]}>Faktura</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FDF2F8" }]} onPress={() => router.push("/(tabs)/lidlar" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#EC4899" }]}>
                    <Feather name="heart" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#EC4899" }]}>Lidlar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#EFF6FF" }]} onPress={() => router.push("/(tabs)/mijozlar")}>
                  <View style={[st.quickIcon, { backgroundColor: "#3B82F6" }]}>
                    <Feather name="users" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#3B82F6" }]}>Mijozlar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#F5F3FF" }]} onPress={() => router.push("/(tabs)/xodimlar" as any)}>
                  <View style={[st.quickIcon, { backgroundColor: "#8B5CF6" }]}>
                    <Feather name="user-check" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#8B5CF6" }]}>Xodimlar</Text>
                </TouchableOpacity>
              </View>
              <View style={[st.quickRow, { marginTop: 8 }]}>
                <TouchableOpacity style={[st.quickCard, { backgroundColor: "#FFF1F2" }]} onPress={() => router.push("/(tabs)/calculator")}>
                  <View style={[st.quickIcon, { backgroundColor: "#F43F5E" }]}>
                    <Feather name="hash" size={18} color="#fff" />
                  </View>
                  <Text style={[st.quickLabel, { color: "#F43F5E" }]}>Hisob</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <View style={{ flex: 1 }} />
                <View style={{ flex: 1 }} />
              </View>
            </>
          )}
        </View>

        {/* ─── Bu oy ────────────────────────────────────────────── */}
        {!isSeller && (
          <View style={st.statSection}>
            <Text style={[st.sec, { color: C.textSecondary }]}>Bu oy</Text>
            <View style={st.row}>
              <SC icon="arrow-down-left" ic="#10B981" bg="#ECFDF5" lbl="Kirim"    val={n(monthIncome)}  />
              <SC icon="arrow-up-right"  ic="#EF4444" bg="#FEF2F2" lbl="Chiqim"   val={n(monthExpense)} />
              <SC icon="activity"        ic="#8B5CF6" bg="#F5F3FF" lbl="Faol bitishuv" val={String(activeDeals)} />
              <SC icon="check-circle"    ic="#F59E0B" bg="#FFFBEB" lbl="Yopildi"  val={String(closedDeals)} />
            </View>
            <View style={[st.row, { marginTop: 8 }]}>
              <SC icon="credit-card"     ic="#EA580C" bg="#FFF7ED" lbl="Kassadan"  val={n(expensesData?.kassaDeductions || 0)} />
              <SC icon="trending-down"   ic="#F59E0B" bg="#FFFBEB" lbl="Shaxsiy"  val={n(expensesData?.totalShaxsiy || 0)} />
            </View>
          </View>
        )}

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
        {!isSeller && todayTxns.length > 0 && (
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
  hero:    { backgroundColor: "#4F46E5", paddingHorizontal: 20, paddingBottom: 36, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  heroGreeting: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.80)", marginBottom: 4 },
  heroTitle:{ fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  heroDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 4 },
  heroBadge:{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  heroAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  heroAvatarTxt: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#4F46E5" },
  bellBadge: { position: "absolute", top: 2, right: 2, backgroundColor: "#EF4444", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1, borderColor: "#fff" },
  bellBadgeTxt: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" },

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
