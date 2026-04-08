import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, TextInput, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const C = Colors.light;

type Period = "today" | "week" | "month" | "year";
type KassaPeriod = "today" | "week" | "month";
type Tab = "umumiy" | "mijoz" | "kassa";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "week",  label: "Hafta" },
  { key: "month", label: "Oy" },
  { key: "year",  label: "Yil" },
];
const PERIOD_UZ: Record<Period, string> = {
  today: "Bugun", week: "Bu hafta", month: "Bu oy", year: "Bu yil",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Faol", yangi: "Yangi", tikuvda: "Tikuvda", tayyor: "Tayyor",
  ornatilmoqda: "O'rnatilmoqda", yopildi: "Yopildi", bekor: "Bekor",
};
const STATUS_COLORS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899"];

function n(v: number | null | undefined) {
  if (!v) return "0";
  return new Intl.NumberFormat("uz-UZ").format(Math.round(v));
}
function nfull(v: number | null | undefined) { return n(v) + " so'm"; }
function mln(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + " mln";
  if (v >= 1000) return (v / 1000).toFixed(0) + " ming";
  return v.toString();
}
function ago(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m} daq oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  return `${Math.floor(h / 24)} kun oldin`;
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(3, (value / max) * 100) : 0;
  return (
    <View style={{ height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
      <View style={{ height: 6, width: `${pct}%` as any, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

function StatRow({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: string }) {
  return (
    <View style={s.statRow}>
      {icon && (
        <View style={[s.statIcon, { backgroundColor: (color ?? "#6366F1") + "18" }]}>
          <Feather name={icon as any} size={14} color={color ?? "#6366F1"} />
        </View>
      )}
      <Text style={[s.statLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[s.statValue, { color: color ?? C.text }]}>{value}</Text>
    </View>
  );
}

async function shareHtml(html: string, title: string) {
  if (Platform.OS === "web") {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title}.html`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: title });
  } else {
    Alert.alert("Ulashish mumkin emas", "Qurilmangizda ulashish qo'llab-quvvatlanmaydi");
  }
}

function buildGeneralHtml(gen: any, dash: any, period: Period, dateStr: string) {
  return `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;padding:24px;color:#111;}
h1{color:#4F46E5;margin:0 0 4px;}h2{color:#374151;margin:0 0 20px;font-size:14px;}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;}
.title{font-size:13px;color:#6b7280;margin-bottom:12px;font-weight:600;text-transform:uppercase;}
.row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6;}
.row:last-child{border:none;}
.lbl{color:#6b7280;font-size:14px;}.val{font-weight:700;font-size:15px;color:#111;}
.green{color:#10B981;}.red{color:#EF4444;}.blue{color:#3B82F6;}
.footer{margin-top:24px;font-size:12px;color:#9ca3af;text-align:center;}
</style></head><body>
<h1>BluePOS Hisobot</h1>
<h2>${PERIOD_UZ[period]} · ${dateStr}</h2>
<div class="card">
  <div class="title">Savdo ko'rsatkichlari</div>
  <div class="row"><span class="lbl">Jami buyurtmalar</span><span class="val">${gen?.totalOrders ?? 0} ta</span></div>
  <div class="row"><span class="lbl">Faol bitishuvlar</span><span class="val blue">${gen?.activeDeals ?? 0} ta</span></div>
  <div class="row"><span class="lbl">Yopilgan bitishuvlar</span><span class="val green">${gen?.closedDeals ?? 0} ta</span></div>
</div>
<div class="card">
  <div class="title">Moliyaviy ko'rsatkichlar</div>
  <div class="row"><span class="lbl">Olingan tovar (jami)</span><span class="val">${nfull(gen?.totalTovar)}</span></div>
  <div class="row"><span class="lbl">Oldindan to'lov (zaklat)</span><span class="val green">${nfull(gen?.totalZaklat)}</span></div>
  <div class="row"><span class="lbl">Qolgan qarz</span><span class="val red">${nfull(gen?.totalQarz)}</span></div>
  <div class="row"><span class="lbl">O'rnatish ishlari</span><span class="val">${nfull(gen?.totalOrnatish)}</span></div>
  <div class="row"><span class="lbl">Karniiz/aksessuarlar</span><span class="val">${nfull(gen?.totalKarniiz)}</span></div>
</div>
<div class="card">
  <div class="title">Bugungi holat</div>
  <div class="row"><span class="lbl">Bugungi savdo</span><span class="val">${nfull(dash?.todaySales)}</span></div>
  <div class="row"><span class="lbl">Bugungi buyurtmalar</span><span class="val">${dash?.todayOrders ?? 0} ta</span></div>
  <div class="row"><span class="lbl">Jami mijozlar</span><span class="val">${dash?.totalClients ?? 0} ta</span></div>
</div>
<div class="footer">BluePOS · Parda do'konlari uchun POS tizimi</div>
</body></html>`;
}

function buildCustomerHtml(customer: any, deals: any[], summary: any, dateStr: string) {
  const dealsRows = deals.map(d => `
    <div class="deal">
      <div class="deal-date">${d.createdAt ? new Date(d.createdAt).toLocaleDateString("uz-UZ") : "—"} · ${STATUS_LABELS[d.status] ?? d.status}</div>
      <div class="deal-row"><span>Tovar narxi</span><span>${nfull(d.totalNarx)}</span></div>
      <div class="deal-row"><span>Zaklat</span><span style="color:#10B981">${nfull(d.zaklatSumma)}</span></div>
      <div class="deal-row ${(d.qarzSumma ?? 0) > 0 ? 'red' : ''}"><span>Qarz</span><span style="color:${(d.qarzSumma ?? 0) > 0 ? '#EF4444' : '#10B981'}">${nfull(d.qarzSumma)}</span></div>
      ${d.qaytarishMuddati ? `<div class="deal-row"><span>To'lov muddati</span><span>${d.qaytarishMuddati}</span></div>` : ""}
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;padding:24px;color:#111;}
h1{color:#4F46E5;margin:0 0 4px;}h2{color:#374151;margin:0 0 20px;font-size:14px;}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;}
.title{font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:12px;}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;}
.row:last-child{border:none;}.lbl{color:#6b7280;font-size:14px;}.val{font-weight:700;}
.deal{border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:12px;}
.deal-date{font-size:12px;color:#6b7280;margin-bottom:8px;font-weight:600;}
.deal-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;}
.summary-val{font-size:18px;font-weight:800;}
.green{color:#10B981;}.red{color:#EF4444;}
.footer{margin-top:24px;font-size:12px;color:#9ca3af;text-align:center;}
</style></head><body>
<h1>${customer.fullName} — Hisobot</h1>
<h2>${customer.phone}${customer.address ? " · " + customer.address : ""} · ${dateStr}</h2>
<div class="card">
  <div class="title">Umumiy ko'rsatkichlar</div>
  <div class="row"><span class="lbl">Jami bitishuvlar</span><span class="val">${summary.dealsCount} ta</span></div>
  <div class="row"><span class="lbl">Olingan tovar jami</span><span class="val summary-val">${nfull(summary.totalTovar)}</span></div>
  <div class="row"><span class="lbl">Jami to'langan</span><span class="val green">${nfull(summary.totalZaklat)}</span></div>
  <div class="row"><span class="lbl">Qolgan qarz</span><span class="val red">${nfull(summary.totalQarz)}</span></div>
  <div class="row"><span class="lbl">Faol bitishuvlar</span><span class="val">${summary.activeDeals} ta</span></div>
</div>
${deals.length > 0 ? `<div class="card"><div class="title">Bitishuvlar tarixi</div>${dealsRows}</div>` : ""}
<div class="footer">BluePOS · Parda do'konlari uchun POS tizimi</div>
</body></html>`;
}

export default function HisobotScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const [tab, setTab] = useState<Tab>("umumiy");
  const [sharing, setSharing] = useState(false);

  const [kassaPeriod, setKassaPeriod] = useState<KassaPeriod>("today");
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  const { data: sales, isLoading: salesLoading } = useQuery<any>({
    queryKey: ["reports-sales", period],
    queryFn: () => apiReq(`/reports/sales?period=${period}`),
    retry: false,
  });
  const { data: dash, isLoading: dashLoading } = useQuery<any>({
    queryKey: ["reports-dashboard"],
    queryFn: () => apiReq("/reports/dashboard"),
    retry: false,
  });
  const { data: gen, isLoading: genLoading } = useQuery<any>({
    queryKey: ["reports-general", period],
    queryFn: () => apiReq(`/reports/general?period=${period}`),
    retry: false,
  });
  const { data: customers = [], isFetching: custFetching } = useQuery<any[]>({
    queryKey: ["customers-search", search],
    queryFn: () => search.length > 1 ? apiReq(`/customers?search=${encodeURIComponent(search)}`) : Promise.resolve([]),
    retry: false,
    enabled: tab === "mijoz",
  });
  const { data: custReport, isLoading: custReportLoading } = useQuery<any>({
    queryKey: ["customer-report", selectedCustomer?.id],
    queryFn: () => apiReq(`/reports/customer/${selectedCustomer.id}`),
    enabled: !!selectedCustomer,
    retry: false,
  });
  const { data: kassaReport, isLoading: kassaLoading } = useQuery<any>({
    queryKey: ["kassa-report", kassaPeriod],
    queryFn: () => apiReq(`/kassa/report?period=${kassaPeriod}`),
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["reports-sales", period] });
    await qc.invalidateQueries({ queryKey: ["reports-dashboard"] });
    await qc.invalidateQueries({ queryKey: ["reports-general", period] });
    if (selectedCustomer) await qc.invalidateQueries({ queryKey: ["customer-report", selectedCustomer.id] });
    await qc.invalidateQueries({ queryKey: ["kassa-report", kassaPeriod] });
    setRefreshing(false);
  }, [qc, period, selectedCustomer, kassaPeriod]);

  const isLoadingMain = salesLoading || dashLoading || genLoading;

  const statusEntries = Object.entries(sales?.statusBreakdown ?? {}).sort((a: any, b: any) => b[1] - a[1]);
  const maxStatusCount = (statusEntries[0]?.[1] as number) ?? 1;
  const dailyData = sales?.dailyData ?? [];
  const maxDailySales = Math.max(...dailyData.map((d: any) => d.sales), 1);
  const dateStr = new Date().toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });

  async function handleShareUmumiy() {
    setSharing(true);
    try {
      const html = buildGeneralHtml(gen, dash, period, dateStr);
      await shareHtml(html, `BluePOS_Hisobot_${period}`);
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setSharing(false); }
  }

  async function handleShareMijoz() {
    if (!custReport) return;
    setSharing(true);
    try {
      const html = buildCustomerHtml(custReport.customer, custReport.deals, custReport.summary, dateStr);
      await shareHtml(html, `BluePOS_${custReport.customer.fullName}`);
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setSharing(false); }
  }

  async function handleShareKassa() {
    if (!kassaReport) return;
    setSharing(true);
    try {
      const periodUZ: Record<string, string> = { today: "Bugun", week: "Bu hafta", month: "Bu oy" };
      const html = `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;padding:24px;color:#111;}
h1{color:#4F46E5;margin:0 0 4px;}h2{color:#374151;margin:0 0 20px;font-size:14px;}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;}
.title{font-size:13px;color:#6b7280;margin-bottom:12px;font-weight:600;text-transform:uppercase;}
.row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6;}
.row:last-child{border:none;}.lbl{color:#6b7280;font-size:14px;}.val{font-weight:700;font-size:15px;}
.green{color:#10B981;}.red{color:#EF4444;}.blue{color:#3B82F6;}.purple{color:#7C3AED;}
.footer{margin-top:24px;font-size:12px;color:#9ca3af;text-align:center;}
</style></head><body>
<h1>Kassa Hisoboti</h1>
<h2>${periodUZ[kassaPeriod] ?? kassaPeriod} · ${dateStr}</h2>
<div class="card">
<div class="title">Kirimlar</div>
<div class="row"><span class="lbl">Naqd kirim</span><span class="val green">${nfull(kassaReport.totalNaqd)}</span></div>
<div class="row"><span class="lbl">Plastik kirim</span><span class="val blue">${nfull(kassaReport.totalPlastik)}</span></div>
<div class="row"><span class="lbl">Jami kirim</span><span class="val">${nfull(kassaReport.netKirim)}</span></div>
</div>
<div class="card">
<div class="title">Chiqimlar va balans</div>
<div class="row"><span class="lbl">Jami chiqim</span><span class="val red">${nfull(kassaReport.totalChiqim)}</span></div>
<div class="row"><span class="lbl">Net qoldiq</span><span class="val purple">${nfull(kassaReport.netQoldiq)}</span></div>
<div class="row"><span class="lbl">Smenalar soni</span><span class="val">${kassaReport.shiftsCount} ta</span></div>
</div>
<div class="footer">BluePOS · Parda do'konlari uchun POS tizimi</div>
</body></html>`;
      await shareHtml(html, `BluePOS_Kassa_${kassaPeriod}`);
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setSharing(false); }
  }

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPadding + 12 }]}>
        <View>
          <Text style={s.title}>Hisobot</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>Savdo tahlili</Text>
        </View>
        <TouchableOpacity
          style={[s.shareBtn, { backgroundColor: C.primary, opacity: sharing ? 0.6 : 1 }]}
          onPress={tab === "umumiy" ? handleShareUmumiy : tab === "kassa" ? handleShareKassa : handleShareMijoz}
          disabled={sharing || (tab === "mijoz" && !custReport) || (tab === "kassa" && !kassaReport)}
          activeOpacity={0.8}
        >
          {sharing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="share-2" size={16} color="#fff" />}
          <Text style={s.shareTxt}>{Platform.OS === "web" ? "Yuklash" : "Ulashish"}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {([["umumiy","Umumiy"], ["mijoz","Mijoz"], ["kassa","Kassa"]] as const).map(([key, lbl]) => (
          <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)}>
            <Text style={[s.tabTxt, { color: tab === key ? C.primary : C.textSecondary }]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "umumiy" && (
        <>
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
            {isLoadingMain && (
              <View style={s.center}>
                <ActivityIndicator color={C.primary} />
                <Text style={[s.loadTxt, { color: C.textSecondary }]}>Yuklanmoqda...</Text>
              </View>
            )}
            {!isLoadingMain && (
              <>
                {/* Moliyaviy jami */}
                <View style={[s.mainCard, { backgroundColor: C.primary }]}>
                  <Text style={s.mainLabel}>Olingan tovar jami · {PERIOD_UZ[period]}</Text>
                  <Text style={s.mainValue}>{nfull(gen?.totalTovar)}</Text>
                  <View style={s.kpiRow}>
                    <View style={s.kpiItem}>
                      <Text style={s.kpiNum}>{mln(gen?.totalZaklat ?? 0)}</Text>
                      <Text style={s.kpiLbl}>Zaklat</Text>
                    </View>
                    <View style={s.kpiDivider} />
                    <View style={s.kpiItem}>
                      <Text style={[s.kpiNum, { color: "#FCA5A5" }]}>{mln(gen?.totalQarz ?? 0)}</Text>
                      <Text style={s.kpiLbl}>Qolgan qarz</Text>
                    </View>
                    <View style={s.kpiDivider} />
                    <View style={s.kpiItem}>
                      <Text style={s.kpiNum}>{gen?.totalOrders ?? 0}</Text>
                      <Text style={s.kpiLbl}>Buyurtma</Text>
                    </View>
                  </View>
                </View>

                {/* Moliyaviy tafsilot */}
                <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={[s.sectionTitle, { color: C.text }]}>Moliyaviy tafsilot</Text>
                  <View style={{ gap: 0, marginTop: 8 }}>
                    <StatRow icon="shopping-bag" color="#4F46E5" label="Olingan tovar (jami)" value={nfull(gen?.totalTovar)} />
                    <StatRow icon="check-circle" color="#10B981" label="Jami to'langan (zaklat)" value={nfull(gen?.totalZaklat)} />
                    <StatRow icon="alert-circle" color="#EF4444" label="Qolgan qarz" value={nfull(gen?.totalQarz)} />
                    <StatRow icon="tool" color="#8B5CF6" label="O'rnatish ishlari" value={nfull(gen?.totalOrnatish)} />
                    <StatRow icon="layers" color="#F59E0B" label="Karniiz/aksessuarlar" value={nfull(gen?.totalKarniiz)} />
                  </View>
                </View>

                {/* Bitishuvlar */}
                <View style={s.gridRow}>
                  <View style={[s.gridCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                    <Feather name="activity" size={18} color="#3B82F6" />
                    <Text style={[s.gridNum, { color: "#1D4ED8" }]}>{gen?.activeDeals ?? 0}</Text>
                    <Text style={[s.gridLbl, { color: "#3B82F6" }]}>Faol</Text>
                  </View>
                  <View style={[s.gridCard, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                    <Feather name="check-circle" size={18} color="#10B981" />
                    <Text style={[s.gridNum, { color: "#059669" }]}>{gen?.closedDeals ?? 0}</Text>
                    <Text style={[s.gridLbl, { color: "#10B981" }]}>Yopildi</Text>
                  </View>
                  <View style={[s.gridCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Feather name="users" size={18} color="#6366F1" />
                    <Text style={[s.gridNum, { color: C.text }]}>{dash?.totalClients ?? "—"}</Text>
                    <Text style={[s.gridLbl, { color: C.textSecondary }]}>Mijozlar</Text>
                  </View>
                </View>

                {/* Kunlik grafik */}
                {dailyData.length > 0 && (
                  <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Text style={[s.sectionTitle, { color: C.text }]}>Kunlik savdo</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, paddingVertical: 8 }}>
                        {dailyData.slice(-14).map((d: any, i: number) => {
                          const pct = maxDailySales > 0 ? (d.sales / maxDailySales) : 0;
                          const barH = Math.max(4, Math.round(pct * 80));
                          return (
                            <View key={i} style={{ alignItems: "center", gap: 4, minWidth: 32 }}>
                              <Text style={{ fontSize: 9, color: C.textSecondary, fontFamily: "Inter_400Regular" }}>{mln(d.sales)}</Text>
                              <View style={{ width: 22, height: barH, backgroundColor: C.primary, borderRadius: 4 }} />
                              <Text style={{ fontSize: 10, color: C.textSecondary, fontFamily: "Inter_500Medium" }}>
                                {new Date(d.date).getDate()}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {/* Holatlar bo'yicha */}
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
                              {count as number} ta
                            </Text>
                          </View>
                          <MiniBar value={count as number} max={maxStatusCount} color={STATUS_COLORS[i % STATUS_COLORS.length]} />
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Bugun vs Oy */}
                <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={[s.sectionTitle, { color: C.text }]}>Bugun vs Oy</Text>
                  <View style={{ gap: 10, marginTop: 8 }}>
                    <View style={s.compareRow}>
                      <View style={[s.compareIcon, { backgroundColor: "#EDE9FE" }]}>
                        <Feather name="sun" size={14} color="#7C3AED" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.compareLabel, { color: C.textSecondary }]}>Bugungi savdo</Text>
                        <Text style={[s.compareValue, { color: C.text }]}>{nfull(dash?.todaySales)}</Text>
                      </View>
                      <Text style={[s.compareCount, { color: C.textSecondary }]}>{dash?.todayOrders ?? 0} ta</Text>
                    </View>
                    <View style={s.compareRow}>
                      <View style={[s.compareIcon, { backgroundColor: "#DBEAFE" }]}>
                        <Feather name="calendar" size={14} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.compareLabel, { color: C.textSecondary }]}>Bu oylik savdo</Text>
                        <Text style={[s.compareValue, { color: C.text }]}>{nfull(dash?.monthSales)}</Text>
                      </View>
                      <Text style={[s.compareCount, { color: C.textSecondary }]}>{dash?.monthOrders ?? 0} ta</Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </>
      )}

      {tab === "mijoz" && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search */}
          <View style={[s.searchWrap, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Feather name="search" size={16} color={C.textSecondary} />
            <TextInput
              style={[s.searchInput, { color: C.text }]}
              placeholder="Mijoz ismi yoki telefon..."
              placeholderTextColor={C.textSecondary}
              value={search}
              onChangeText={v => { setSearch(v); setSelectedCustomer(null); }}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(""); setSelectedCustomer(null); }}>
                <Feather name="x" size={16} color={C.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Customer list */}
          {custFetching && <ActivityIndicator color={C.primary} style={{ paddingVertical: 12 }} />}
          {!custFetching && search.length > 1 && !selectedCustomer && (
            (customers as any[]).length === 0
              ? <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Mijoz topilmadi</Text>
              : (customers as any[]).map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.custCard, { backgroundColor: C.card, borderColor: C.border }]}
                  onPress={() => { setSelectedCustomer(c); setSearch(c.fullName); }}
                  activeOpacity={0.75}
                >
                  <View style={[s.custAvatar, { backgroundColor: C.primary + "18" }]}>
                    <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: C.primary }}>
                      {c.fullName?.[0]?.toUpperCase() ?? "?"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.custName, { color: C.text }]}>{c.fullName}</Text>
                    <Text style={[s.custPhone, { color: C.textSecondary }]}>{c.phone}</Text>
                  </View>
                  {(c.totalDebt ?? 0) > 0 && (
                    <View style={[s.debtBadge, { backgroundColor: "#FEF2F2" }]}>
                      <Text style={{ fontSize: 11, color: "#EF4444", fontFamily: "Inter_600SemiBold" }}>
                        {mln(c.totalDebt)} qarz
                      </Text>
                    </View>
                  )}
                  <Feather name="chevron-right" size={16} color={C.textSecondary} />
                </TouchableOpacity>
              ))
          )}

          {/* Customer report */}
          {selectedCustomer && (
            custReportLoading
              ? <View style={s.center}><ActivityIndicator color={C.primary} /><Text style={{ color: C.textSecondary, fontFamily: "Inter_400Regular", fontSize: 13 }}>Yuklanmoqda...</Text></View>
              : custReport && (
                <>
                  {/* Summary card */}
                  <View style={[s.mainCard, { backgroundColor: C.primary }]}>
                    <Text style={s.mainLabel}>{custReport.customer.fullName} — Hisobot</Text>
                    <Text style={[s.mainValue, { fontSize: 22 }]}>{nfull(custReport.summary.totalTovar)}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12 }}>
                      {custReport.customer.phone} {custReport.customer.address ? "· " + custReport.customer.address : ""}
                    </Text>
                    <View style={s.kpiRow}>
                      <View style={s.kpiItem}>
                        <Text style={[s.kpiNum, { color: "#6EE7B7" }]}>{mln(custReport.summary.totalZaklat)}</Text>
                        <Text style={s.kpiLbl}>To'langan</Text>
                      </View>
                      <View style={s.kpiDivider} />
                      <View style={s.kpiItem}>
                        <Text style={[s.kpiNum, { color: "#FCA5A5" }]}>{mln(custReport.summary.totalQarz)}</Text>
                        <Text style={s.kpiLbl}>Qolgan qarz</Text>
                      </View>
                      <View style={s.kpiDivider} />
                      <View style={s.kpiItem}>
                        <Text style={s.kpiNum}>{custReport.summary.dealsCount}</Text>
                        <Text style={s.kpiLbl}>Bitishuv</Text>
                      </View>
                    </View>
                  </View>

                  {/* Deals list */}
                  {custReport.deals.length > 0 && (
                    <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                      <Text style={[s.sectionTitle, { color: C.text }]}>Bitishuvlar tarixi</Text>
                      <View style={{ gap: 10, marginTop: 8 }}>
                        {custReport.deals.map((d: any) => (
                          <View key={d.id} style={[s.dealCard, { backgroundColor: C.card, borderColor: C.border }]}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                              <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" }}>
                                {d.createdAt ? new Date(d.createdAt).toLocaleDateString("uz-UZ") : "—"}
                              </Text>
                              <View style={[s.badge, { backgroundColor: d.status === "yopildi" ? "#ECFDF5" : "#EFF6FF" }]}>
                                <Text style={{ fontSize: 11, color: d.status === "yopildi" ? "#10B981" : "#3B82F6", fontFamily: "Inter_600SemiBold" }}>
                                  {STATUS_LABELS[d.status] ?? d.status}
                                </Text>
                              </View>
                            </View>
                            <View style={{ gap: 3 }}>
                              <StatRow icon="shopping-bag" color="#4F46E5" label="Tovar narxi" value={nfull(d.totalNarx)} />
                              <StatRow icon="check-circle" color="#10B981" label="Zaklat (to'langan)" value={nfull(d.zaklatSumma)} />
                              {(d.qarzSumma ?? 0) > 0 && (
                                <StatRow icon="alert-circle" color="#EF4444" label="Qolgan qarz" value={nfull(d.qarzSumma)} />
                              )}
                              {d.qaytarishMuddati && (
                                <StatRow icon="calendar" color="#F59E0B" label="To'lov muddati" value={d.qaytarishMuddati} />
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {custReport.deals.length === 0 && (
                    <View style={[s.emptyBox, { backgroundColor: C.card, borderColor: C.border }]}>
                      <Feather name="inbox" size={28} color={C.textSecondary} />
                      <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Bu mijozda bitishuv yo'q</Text>
                    </View>
                  )}
                </>
              )
          )}

          {!selectedCustomer && search.length <= 1 && (
            <View style={[s.emptyBox, { backgroundColor: C.card, borderColor: C.border }]}>
              <Feather name="user-check" size={32} color={C.textSecondary} />
              <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Mijoz nomi yoki telefon kiriting</Text>
              <Text style={[{ fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
                Topilgan mijozni tanlang — uning barcha bitishuvlari va qarz holati ko'rsatiladi
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {tab === "kassa" && (
        <>
          <View style={s.periodBar}>
            {([["today","Bugun"],["week","Hafta"],["month","Oy"]] as const).map(([k, l]) => (
              <TouchableOpacity
                key={k}
                onPress={() => setKassaPeriod(k)}
                style={[s.periodBtn, kassaPeriod === k && { backgroundColor: C.primary, borderRadius: 10 }]}
              >
                <Text style={[s.periodTxt, { color: kassaPeriod === k ? "#fff" : C.textSecondary }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 12 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          >
            {kassaLoading && (
              <View style={s.center}>
                <ActivityIndicator color={C.primary} />
                <Text style={[s.loadTxt, { color: C.textSecondary }]}>Yuklanmoqda...</Text>
              </View>
            )}

            {!kassaLoading && kassaReport && (
              <>
                {/* Asosiy karta */}
                <View style={[s.mainCard, { backgroundColor: "#4F46E5" }]}>
                  <Text style={s.mainLabel}>Jami kirim · {kassaPeriod === "today" ? "Bugun" : kassaPeriod === "week" ? "Bu hafta" : "Bu oy"}</Text>
                  <Text style={s.mainValue}>{nfull(kassaReport.netKirim)}</Text>
                  <View style={s.kpiRow}>
                    <View style={s.kpiItem}>
                      <Text style={s.kpiNum}>{mln(kassaReport.totalNaqd)}</Text>
                      <Text style={s.kpiLbl}>Naqd</Text>
                    </View>
                    <View style={s.kpiDivider} />
                    <View style={s.kpiItem}>
                      <Text style={s.kpiNum}>{mln(kassaReport.totalPlastik)}</Text>
                      <Text style={s.kpiLbl}>Plastik</Text>
                    </View>
                    <View style={s.kpiDivider} />
                    <View style={s.kpiItem}>
                      <Text style={[s.kpiNum, { color: "#FCA5A5" }]}>{mln(kassaReport.totalChiqim)}</Text>
                      <Text style={s.kpiLbl}>Chiqim</Text>
                    </View>
                  </View>
                </View>

                {/* Tafsilot */}
                <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={[s.sectionTitle, { color: C.text }]}>Moliyaviy tafsilot</Text>
                  <View style={{ gap: 0, marginTop: 8 }}>
                    <StatRow icon="dollar-sign" color="#10B981" label="Naqd kirim" value={nfull(kassaReport.totalNaqd)} />
                    <StatRow icon="credit-card" color="#3B82F6" label="Plastik kirim" value={nfull(kassaReport.totalPlastik)} />
                    <StatRow icon="trending-up" color="#4F46E5" label="Jami kirim" value={nfull(kassaReport.netKirim)} />
                    <StatRow icon="trending-down" color="#EF4444" label="Jami chiqim" value={nfull(kassaReport.totalChiqim)} />
                    <StatRow icon="layers" color="#7C3AED" label="Net qoldiq" value={nfull(kassaReport.netQoldiq)} />
                  </View>
                </View>

                {/* Smenalar soni */}
                <View style={s.gridRow}>
                  <View style={[s.gridCard, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0", flex: 1 }]}>
                    <Feather name="unlock" size={18} color="#10B981" />
                    <Text style={[s.gridNum, { color: "#059669" }]}>{kassaReport.shiftsCount}</Text>
                    <Text style={[s.gridLbl, { color: "#10B981" }]}>Smenalar</Text>
                  </View>
                  <View style={[s.gridCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", flex: 2 }]}>
                    <Feather name="bar-chart-2" size={18} color="#3B82F6" />
                    <Text style={[s.gridNum, { color: "#1D4ED8", fontSize: 16 }]}>
                      {kassaReport.shiftsCount > 0 ? nfull(kassaReport.netKirim / kassaReport.shiftsCount) : "0 so'm"}
                    </Text>
                    <Text style={[s.gridLbl, { color: "#3B82F6" }]}>O'rtacha smena</Text>
                  </View>
                </View>

                {/* Smenalar tarixi */}
                {kassaReport.shifts?.length > 0 && (
                  <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Text style={[s.sectionTitle, { color: C.text }]}>Smenalar tarixi</Text>
                    <View style={{ gap: 10, marginTop: 12 }}>
                      {kassaReport.shifts.map((sh: any) => (
                        <View key={sh.id} style={[s.dealCard, { backgroundColor: C.card, borderColor: C.border }]}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <View>
                              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text }}>
                                {sh.ochilganSana ? new Date(sh.ochilganSana).toLocaleDateString("uz-UZ", { day: "numeric", month: "short" }) : "—"}
                              </Text>
                              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary }}>
                                {sh.ochilganSana ? new Date(sh.ochilganSana).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }) : ""}{sh.yopilganSana ? " – " + new Date(sh.yopilganSana).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }) : ""}
                              </Text>
                            </View>
                            <View style={[s.badge, { backgroundColor: sh.status === "ochiq" ? "#ECFDF5" : "#F1F5F9" }]}>
                              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: sh.status === "ochiq" ? "#10B981" : "#64748B" }}>
                                {sh.status === "ochiq" ? "Faol" : "Yopiq"}
                              </Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <View style={{ flex: 1, backgroundColor: "#ECFDF5", borderRadius: 8, padding: 8, alignItems: "center" }}>
                              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#10B981" }}>{mln(sh.naqdJami ?? 0)}</Text>
                              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#10B981" }}>Naqd</Text>
                            </View>
                            <View style={{ flex: 1, backgroundColor: "#EFF6FF", borderRadius: 8, padding: 8, alignItems: "center" }}>
                              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#3B82F6" }}>{mln(sh.plastikJami ?? 0)}</Text>
                              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#3B82F6" }}>Plastik</Text>
                            </View>
                            <View style={{ flex: 1, backgroundColor: "#FEF2F2", borderRadius: 8, padding: 8, alignItems: "center" }}>
                              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#EF4444" }}>{mln(sh.chiqimJami ?? 0)}</Text>
                              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#EF4444" }}>Chiqim</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {kassaReport.shifts?.length === 0 && (
                  <View style={[s.emptyBox, { backgroundColor: C.card, borderColor: C.border }]}>
                    <Feather name="inbox" size={32} color={C.textSecondary} />
                    <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Bu davrda smena yo'q</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: C.text },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  shareTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 8, borderRadius: 12, backgroundColor: "#F1F5F9", padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: "#fff" },
  tabTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  periodBar: { flexDirection: "row", marginHorizontal: 16, marginBottom: 8, backgroundColor: "#F1F5F9", borderRadius: 12, padding: 4 },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  periodTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  mainCard: { borderRadius: 20, padding: 20 },
  mainLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular" },
  mainValue: { fontSize: 26, color: "#fff", fontFamily: "Inter_700Bold", marginTop: 4, marginBottom: 4 },
  kpiRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  kpiItem: { flex: 1, alignItems: "center" },
  kpiNum: { fontSize: 17, color: "#fff", fontFamily: "Inter_700Bold" },
  kpiLbl: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" },
  kpiDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },
  gridRow: { flexDirection: "row", gap: 10 },
  gridCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: "center", gap: 4 },
  gridNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  gridLbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
  section: { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  statIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  statValue: { fontSize: 13, fontFamily: "Inter_700Bold" },
  compareRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  compareIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  compareLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  compareValue: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  compareCount: { fontSize: 12, fontFamily: "Inter_500Medium" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  custCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  custAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  custName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  custPhone: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  debtBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  dealCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  emptyBox: { borderWidth: 1, borderRadius: 16, borderStyle: "dashed", padding: 32, alignItems: "center", gap: 12 },
  emptyTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  loadTxt: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
