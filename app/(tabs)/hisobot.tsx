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
type Tab = "umumiy" | "mijoz" | "kassa" | "kirim-chiqim";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "week",  label: "Hafta" },
  { key: "month", label: "Oy" },
  { key: "year",  label: "Yil" },
];
const PERIOD_UZ: Record<Period, string> = {
  today: "Bugun", week: "Bu hafta", month: "Bu oy", year: "Bu yil",
};
const MONTHS_UZ = [
  "Yanvar","Fevral","Mart","Aprel","May","Iyun",
  "Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr",
];

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

// ─── HTML builders ───────────────────────────────────────────────────────────

const CSS_BASE = `
  @page { size: A4; margin: 18mm 20mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a2e; }
  .hdr { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #4f46e5; padding-bottom:10px; margin-bottom:14px; }
  .brand { font-size:22px; font-weight:900; color:#4f46e5; letter-spacing:2px; }
  .brand-sub { font-size:10px; color:#64748b; margin-top:2px; }
  .hdr-right { text-align:right; font-size:11px; color:#475569; }
  .sec { margin-bottom:14px; }
  .stl { font-size:10px; font-weight:bold; color:#4f46e5; text-transform:uppercase; letter-spacing:.8px; margin-bottom:6px; border-bottom:2px solid #e2e8f0; padding-bottom:3px; }
  .row { display:flex; justify-content:space-between; align-items:center; padding:7px 12px; border-bottom:1px dashed #e2e8f0; }
  .row:last-child { border:none; }
  .lbl { color:#475569; font-size:12px; }
  .val { font-weight:700; font-size:12px; }
  .box { border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:8px; }
  .green { color:#10B981; } .red { color:#EF4444; } .blue { color:#3B82F6; } .purple { color:#7C3AED; }
  .grand { background:#4f46e5; color:white; border-radius:8px; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
  .grand .lbl { color:rgba(255,255,255,.8); font-size:12px; }
  .grand .val { font-size:20px; font-weight:900; color:white; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; }
  .kpi { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; }
  .kpi .num { font-size:18px; font-weight:900; color:#1e293b; margin-top:2px; }
  .kpi .lbl { font-size:9px; color:#94a3b8; text-transform:uppercase; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:#4f46e5; color:white; padding:6px 8px; text-align:left; font-size:10px; }
  td { border:1px solid #e2e8f0; padding:5px 8px; }
  tr:nth-child(even) td { background:#f8fafc; }
  .foot { border-top:1px solid #e2e8f0; margin-top:20px; padding-top:8px; text-align:center; color:#94a3b8; font-size:10px; }
`;

function buildGeneralHtml(gen: any, dash: any, period: Period, dateStr: string) {
  return `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><style>${CSS_BASE}</style></head><body>
<div class="hdr">
  <div><div class="brand">BLUEPOS</div><div class="brand-sub">Parda do'konlari uchun POS tizimi</div></div>
  <div class="hdr-right">Umumiy hisobot<br><strong>${PERIOD_UZ[period]} · ${dateStr}</strong></div>
</div>
<div class="sec">
  <div class="stl">Savdo ko'rsatkichlari</div>
  <div class="box">
    <div class="row"><span class="lbl">Jami buyurtmalar</span><span class="val">${gen?.totalOrders ?? 0} ta</span></div>
    <div class="row"><span class="lbl">Faol bitishuvlar</span><span class="val blue">${gen?.activeDeals ?? 0} ta</span></div>
    <div class="row"><span class="lbl">Yopilgan bitishuvlar</span><span class="val green">${gen?.closedDeals ?? 0} ta</span></div>
    <div class="row"><span class="lbl">Jami mijozlar</span><span class="val">${dash?.totalClients ?? 0} ta</span></div>
  </div>
</div>
<div class="sec">
  <div class="stl">Moliyaviy ko'rsatkichlar</div>
  <div class="grand"><span class="lbl">Olingan tovar jami</span><span class="val">${nfull(gen?.totalTovar)}</span></div>
  <div class="box">
    <div class="row"><span class="lbl">Jami to'langan (zaklat)</span><span class="val green">${nfull(gen?.totalZaklat)}</span></div>
    <div class="row"><span class="lbl">Qolgan qarz</span><span class="val red">${nfull(gen?.totalQarz)}</span></div>
    <div class="row"><span class="lbl">O'rnatish ishlari</span><span class="val">${nfull(gen?.totalOrnatish)}</span></div>
    <div class="row"><span class="lbl">Chevar haqi</span><span class="val">${nfull(gen?.totalChevar)}</span></div>
    <div class="row"><span class="lbl">Karniiz/aksessuarlar</span><span class="val">${nfull(gen?.totalKarniiz)}</span></div>
  </div>
</div>
<div class="sec">
  <div class="stl">Bugungi holat</div>
  <div class="box">
    <div class="row"><span class="lbl">Bugungi savdo</span><span class="val">${nfull(dash?.todaySales)}</span></div>
    <div class="row"><span class="lbl">Bugungi buyurtmalar</span><span class="val">${dash?.todayOrders ?? 0} ta</span></div>
  </div>
</div>
<div class="foot">BluePOS · ${dateStr}</div>
</body></html>`;
}

function buildKirimChiqimHtml(data: any, year: number, month: number, dateStr: string) {
  const monthName = MONTHS_UZ[month - 1] ?? "";
  const kategoriyaRows = (data?.kategoriyalar ?? []).map((k: any) =>
    `<tr>
      <td>${k.kategoriya ?? "boshqa"}</td>
      <td>${k.tur === "kirim" ? "Kirim" : "Chiqim"}</td>
      <td style="text-align:right;font-weight:700;color:${k.tur === "kirim" ? "#10B981" : "#EF4444"}">${nfull(k.total)}</td>
    </tr>`
  ).join("");

  const dealRowsHtml = (data?.dealRows ?? []).map((d: any) =>
    `<tr>
      <td>${d.date ? new Date(d.date).toLocaleDateString("uz-UZ") : "—"}</td>
      <td style="text-align:right">${nfull(d.savdo)}</td>
      <td style="text-align:right;color:#10B981">${nfull(d.naqdKirim)}</td>
      <td style="text-align:right;color:#EF4444">${nfull(d.qarz)}</td>
    </tr>`
  ).join("");

  const s = data?.summary ?? {};
  const d = data?.deals ?? {};
  const sof = s.sof ?? 0;

  return `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><style>${CSS_BASE}</style></head><body>
<div class="hdr">
  <div><div class="brand">BLUEPOS</div><div class="brand-sub">Kirim-Chiqim hisoboti</div></div>
  <div class="hdr-right">${monthName} ${year}<br><strong>${dateStr}</strong></div>
</div>

<div class="sec">
  <div class="stl">Oy xulosasi — ${monthName} ${year}</div>
  <div class="grand" style="background:${sof >= 0 ? "#059669" : "#dc2626"}">
    <span class="lbl">SOF FOYDA / ZARAR</span>
    <span class="val">${sof >= 0 ? "+" : ""}${nfull(sof)}</span>
  </div>
  <div class="grid2">
    <div class="kpi"><div class="lbl">Jami kirim</div><div class="num" style="color:#10B981">${nfull(s.jamiKirim)}</div></div>
    <div class="kpi"><div class="lbl">Jami chiqim</div><div class="num" style="color:#EF4444">${nfull(s.jamiChiqim)}</div></div>
    <div class="kpi"><div class="lbl">Naqd kirim</div><div class="num">${nfull(s.naqdKirim)}</div></div>
    <div class="kpi"><div class="lbl">Plastik kirim</div><div class="num">${nfull(s.plastikKirim)}</div></div>
  </div>
</div>

<div class="sec">
  <div class="stl">Savdo natijalari</div>
  <div class="box">
    <div class="row"><span class="lbl">Yangi buyurtmalar</span><span class="val">${d.buyurtmalar ?? 0} ta</span></div>
    <div class="row"><span class="lbl">Savdo jami</span><span class="val">${nfull(d.savdoJami)}</span></div>
    <div class="row"><span class="lbl">Naqd to'lov</span><span class="val green">${nfull(d.naqdJami)}</span></div>
    <div class="row"><span class="lbl">Qarzga berilgan</span><span class="val red">${nfull(d.qarzJami)}</span></div>
    <div class="row"><span class="lbl">To'lov yig'ish foizi</span>
      <span class="val">${d.savdoJami > 0 ? ((d.naqdJami / d.savdoJami) * 100).toFixed(1) : 0}%</span></div>
  </div>
</div>

${kategoriyaRows ? `<div class="sec">
  <div class="stl">Kategoriyalar bo'yicha</div>
  <table><thead><tr><th>Kategoriya</th><th>Turi</th><th style="text-align:right">Summa</th></tr></thead>
  <tbody>${kategoriyaRows}</tbody></table>
</div>` : ""}

${dealRowsHtml ? `<div class="sec">
  <div class="stl">Kunlik savdo</div>
  <table><thead><tr><th>Sana</th><th style="text-align:right">Savdo</th><th style="text-align:right">Naqd</th><th style="text-align:right">Qarz</th></tr></thead>
  <tbody>${dealRowsHtml}</tbody></table>
</div>` : ""}

<div class="foot">BluePOS · ${dateStr} · Smenalar: ${s.smenalar ?? 0} ta</div>
</body></html>`;
}

function buildKassaHtml(kassaReport: any, kassaPeriod: KassaPeriod, dateStr: string) {
  const periodUZ: Record<string, string> = { today: "Bugun", week: "Bu hafta", month: "Bu oy" };
  return `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><style>${CSS_BASE}</style></head><body>
<div class="hdr">
  <div><div class="brand">BLUEPOS</div><div class="brand-sub">Kassa hisoboti</div></div>
  <div class="hdr-right">${periodUZ[kassaPeriod] ?? kassaPeriod}<br><strong>${dateStr}</strong></div>
</div>
<div class="sec">
  <div class="stl">Kirimlar</div>
  <div class="box">
    <div class="row"><span class="lbl">Naqd kirim</span><span class="val green">${nfull(kassaReport.totalNaqd)}</span></div>
    <div class="row"><span class="lbl">Plastik kirim</span><span class="val blue">${nfull(kassaReport.totalPlastik)}</span></div>
    <div class="row"><span class="lbl">Jami kirim</span><span class="val">${nfull(kassaReport.netKirim)}</span></div>
  </div>
</div>
<div class="sec">
  <div class="stl">Chiqimlar va balans</div>
  <div class="grand"><span class="lbl">Net qoldiq</span><span class="val">${nfull(kassaReport.netQoldiq)}</span></div>
  <div class="box">
    <div class="row"><span class="lbl">Jami chiqim</span><span class="val red">${nfull(kassaReport.totalChiqim)}</span></div>
    <div class="row"><span class="lbl">Smenalar soni</span><span class="val">${kassaReport.shiftsCount} ta</span></div>
  </div>
</div>
<div class="foot">BluePOS · ${dateStr}</div>
</body></html>`;
}

function buildCustomerHtml(customer: any, deals: any[], summary: any, dateStr: string) {
  const dealsRows = deals.map((d: any) => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:10px;">
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;font-weight:600;">
        ${d.created_at ? new Date(d.created_at).toLocaleDateString("uz-UZ") : "—"} · ${STATUS_LABELS[d.status] ?? d.status}
      </div>
      <div class="row"><span class="lbl">Tovar narxi</span><span class="val">${nfull(parseFloat(d.total_narx ?? d.totalNarx ?? "0"))}</span></div>
      <div class="row"><span class="lbl">Naqd to'lov</span><span class="val green">${nfull(parseFloat(d.naqd_tolov ?? d.naqdTolov ?? "0"))}</span></div>
      <div class="row"><span class="lbl">Qarz</span><span class="val red">${nfull(parseFloat(d.qarz_summa ?? d.qarzSumma ?? "0"))}</span></div>
      ${d.tayyor_bolish_kuni || d.tayyorBolishKuni ? `<div class="row"><span class="lbl">Tayyor sanasi</span><span class="val">${d.tayyor_bolish_kuni ?? d.tayyorBolishKuni}</span></div>` : ""}
    </div>`
  ).join("");

  return `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><style>${CSS_BASE}</style></head><body>
<div class="hdr">
  <div><div class="brand">BLUEPOS</div><div class="brand-sub">Mijoz hisoboti</div></div>
  <div class="hdr-right">${dateStr}</div>
</div>
<div class="sec">
  <div class="stl">Mijoz</div>
  <div class="box">
    <div class="row"><span class="lbl">Ism</span><span class="val">${customer.fullName ?? customer.mijoz_ism ?? "—"}</span></div>
    <div class="row"><span class="lbl">Telefon</span><span class="val">${customer.phone ?? customer.mijoz_phone ?? "—"}</span></div>
    ${customer.address ? `<div class="row"><span class="lbl">Manzil</span><span class="val">${customer.address}</span></div>` : ""}
  </div>
</div>
<div class="sec">
  <div class="stl">Umumiy ko'rsatkichlar</div>
  <div class="grand"><span class="lbl">Olingan tovar jami</span><span class="val">${nfull(summary.totalTovar)}</span></div>
  <div class="box">
    <div class="row"><span class="lbl">Jami bitishuvlar</span><span class="val">${summary.dealsCount} ta</span></div>
    <div class="row"><span class="lbl">Jami to'langan</span><span class="val green">${nfull(summary.totalZaklat)}</span></div>
    <div class="row"><span class="lbl">Qolgan qarz</span><span class="val red">${nfull(summary.totalQarz)}</span></div>
    <div class="row"><span class="lbl">Faol bitishuvlar</span><span class="val blue">${summary.activeDeals} ta</span></div>
  </div>
</div>
${deals.length > 0 ? `<div class="sec"><div class="stl">Bitishuvlar tarixi</div>${dealsRows}</div>` : ""}
<div class="foot">BluePOS · ${dateStr}</div>
</body></html>`;
}

// ─── Share / Print ─────────────────────────────────────────────────────────────

async function printHtml(html: string) {
  if (Platform.OS === "web") {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
    return;
  }
  await Print.printAsync({ html });
}

async function shareAsPdf(html: string, title: string) {
  if (Platform.OS === "web") {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title}.html`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: title });
  } else {
    Alert.alert("PDF tayyor", uri);
  }
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function HisobotScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const [tab, setTab] = useState<Tab>("umumiy");
  const [printing, setPrinting] = useState(false);

  const [kassaPeriod, setKassaPeriod] = useState<KassaPeriod>("month");
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const now = new Date();
  const [kcYear, setKcYear]   = useState(now.getFullYear());
  const [kcMonth, setKcMonth] = useState(now.getMonth() + 1);

  const topPadding    = insets.top + (Platform.OS === "web" ? 67 : 0);
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
  const { data: kcData, isLoading: kcLoading } = useQuery<any>({
    queryKey: ["kirim-chiqim", kcYear, kcMonth],
    queryFn: () => apiReq(`/reports/kirim-chiqim?year=${kcYear}&month=${kcMonth}`),
    retry: false,
    enabled: tab === "kirim-chiqim",
  });
  const { data: qarzStats } = useQuery<{ olindiJami: number; berildiJami: number; ochiq: number; yopildi: number }>({
    queryKey: ["qarz-daftar-stats"],
    queryFn: () => apiReq("/qarz-daftar/stats"),
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["reports-sales"] });
    await qc.invalidateQueries({ queryKey: ["reports-dashboard"] });
    await qc.invalidateQueries({ queryKey: ["reports-general"] });
    await qc.invalidateQueries({ queryKey: ["customer-report"] });
    await qc.invalidateQueries({ queryKey: ["kassa-report"] });
    await qc.invalidateQueries({ queryKey: ["kirim-chiqim"] });
    await qc.invalidateQueries({ queryKey: ["qarz-daftar-stats"] });
    setRefreshing(false);
  }, [qc]);

  const isLoadingMain = salesLoading || dashLoading || genLoading;
  const statusEntries = Object.entries(sales?.statusBreakdown ?? {}).sort((a: any, b: any) => b[1] - a[1]);
  const maxStatusCount = (statusEntries[0]?.[1] as number) ?? 1;
  const dailyData = sales?.dailyData ?? [];
  const maxDailySales = Math.max(...dailyData.map((d: any) => d.sales), 1);
  const dateStr = new Date().toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });

  const getHtmlForTab = () => {
    if (tab === "umumiy")       return buildGeneralHtml(gen, dash, period, dateStr);
    if (tab === "kassa")        return kassaReport ? buildKassaHtml(kassaReport, kassaPeriod, dateStr) : null;
    if (tab === "kirim-chiqim") return kcData ? buildKirimChiqimHtml(kcData, kcYear, kcMonth, dateStr) : null;
    if (tab === "mijoz")        return custReport ? buildCustomerHtml(custReport.customer, custReport.deals, custReport.summary, dateStr) : null;
    return null;
  };

  const getTitleForTab = () => {
    if (tab === "umumiy")       return `BluePOS_Hisobot_${period}`;
    if (tab === "kassa")        return `BluePOS_Kassa_${kassaPeriod}`;
    if (tab === "kirim-chiqim") return `BluePOS_KirimChiqim_${kcYear}_${kcMonth}`;
    if (tab === "mijoz")        return `BluePOS_Mijoz`;
    return "BluePOS";
  };

  async function handlePrint() {
    const html = getHtmlForTab();
    if (!html) { Alert.alert("Ma'lumot yo'q", "Avval ma'lumotlarni yuklang"); return; }
    setPrinting(true);
    try { await printHtml(html); }
    catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setPrinting(false); }
  }

  async function handleShare() {
    const html = getHtmlForTab();
    if (!html) { Alert.alert("Ma'lumot yo'q", "Avval ma'lumotlarni yuklang"); return; }
    setPrinting(true);
    try { await shareAsPdf(html, getTitleForTab()); }
    catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setPrinting(false); }
  }

  const kcS = kcData?.summary ?? {};
  const kcD = kcData?.deals ?? {};

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPadding + 12 }]}>
        <View>
          <Text style={s.title}>Hisobot</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>Savdo tahlili</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {/* Chop etish */}
          <TouchableOpacity
            style={[s.printBtn, { backgroundColor: "#F0FDF4", borderColor: "#86EFAC", opacity: printing ? 0.6 : 1 }]}
            onPress={handlePrint}
            disabled={printing}
            activeOpacity={0.8}
          >
            {printing
              ? <ActivityIndicator size="small" color="#16a34a" />
              : <Feather name="printer" size={16} color="#16a34a" />}
            <Text style={[s.printTxt, { color: "#15803d" }]}>Chop etish</Text>
          </TouchableOpacity>
          {/* Ulashish */}
          <TouchableOpacity
            style={[s.shareBtn, { backgroundColor: C.primary, opacity: printing ? 0.6 : 1 }]}
            onPress={handleShare}
            disabled={printing}
            activeOpacity={0.8}
          >
            {printing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="share-2" size={16} color="#fff" />}
            <Text style={s.shareTxt}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsContent}>
        {([
          ["umumiy", "Umumiy", "bar-chart-2"],
          ["mijoz", "Mijoz", "users"],
          ["kassa", "Kassa", "credit-card"],
          ["kirim-chiqim", "Kirim-Chiqim", "trending-up"],
        ] as const).map(([key, lbl, icon]) => (
          <TouchableOpacity key={key} style={[s.tab, tab === key && { backgroundColor: C.primary, borderRadius: 20 }]} onPress={() => setTab(key)}>
            <Feather name={icon as any} size={14} color={tab === key ? "#fff" : C.textSecondary} />
            <Text style={[s.tabTxt, { color: tab === key ? "#fff" : C.textSecondary }]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ═══ UMUMIY TAB ════════════════════════════════════════════════════════ */}
      {tab === "umumiy" && (
        <>
          <View style={s.periodBar}>
            {PERIODS.map(p => (
              <TouchableOpacity key={p.key} onPress={() => setPeriod(p.key)}
                style={[s.periodBtn, period === p.key && { backgroundColor: C.primary, borderRadius: 10 }]}>
                <Text style={[s.periodTxt, { color: period === p.key ? "#fff" : C.textSecondary }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 12 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}>
            {isLoadingMain && <View style={s.center}><ActivityIndicator color={C.primary} /></View>}
            {!isLoadingMain && (
              <>
                <View style={[s.mainCard, { backgroundColor: C.primary }]}>
                  <Text style={s.mainLabel}>Olingan tovar jami · {PERIOD_UZ[period]}</Text>
                  <Text style={s.mainValue}>{nfull(gen?.totalTovar)}</Text>
                  <View style={s.kpiRow}>
                    <View style={s.kpiItem}><Text style={s.kpiNum}>{mln(gen?.totalZaklat ?? 0)}</Text><Text style={s.kpiLbl}>Zaklat</Text></View>
                    <View style={s.kpiDivider} />
                    <View style={s.kpiItem}><Text style={[s.kpiNum, { color: "#FCA5A5" }]}>{mln((gen?.totalQarz ?? 0) || (qarzStats?.berildiJami ?? 0))}</Text><Text style={s.kpiLbl}>Qarz</Text></View>
                    <View style={s.kpiDivider} />
                    <View style={s.kpiItem}><Text style={s.kpiNum}>{gen?.totalOrders ?? 0}</Text><Text style={s.kpiLbl}>Buyurtma</Text></View>
                  </View>
                </View>

                <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={[s.sectionTitle, { color: C.text }]}>Moliyaviy tafsilot</Text>
                  <View style={{ gap: 0, marginTop: 8 }}>
                    <StatRow icon="shopping-bag" color="#4F46E5" label="Olingan tovar (jami)"   value={nfull(gen?.totalTovar)} />
                    <StatRow icon="check-circle" color="#10B981" label="Jami to'langan (zaklat)" value={nfull(gen?.totalZaklat)} />
                    <StatRow icon="alert-circle" color="#EF4444" label="Qolgan qarz"             value={nfull((gen?.totalQarz ?? 0) || (qarzStats?.berildiJami ?? 0))} />
                    <StatRow icon="arrow-down-left" color="#10B981" label="Qarz olindi"          value={nfull(qarzStats?.olindiJami)} />
                    <StatRow icon="arrow-up-right"  color="#F43F5E" label="Qarz berildi"         value={nfull(qarzStats?.berildiJami)} />
                    <StatRow icon="tool"         color="#8B5CF6" label="O'rnatish ishlari"       value={nfull(gen?.totalOrnatish)} />
                    <StatRow icon="scissors"     color="#F59E0B" label="Chevar haqi"             value={nfull(gen?.totalChevar)} />
                    <StatRow icon="layers"       color="#06B6D4" label="Karniiz/aksessuarlar"    value={nfull(gen?.totalKarniiz)} />
                  </View>
                </View>

                <View style={s.gridRow}>
                  <View style={[s.gridCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                    <Feather name="activity"    size={18} color="#3B82F6" />
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
                              <Text style={{ fontSize: 9, color: C.textSecondary }}>{mln(d.sales)}</Text>
                              <View style={{ width: 22, height: barH, backgroundColor: C.primary, borderRadius: 4 }} />
                              <Text style={{ fontSize: 10, color: C.textSecondary }}>{new Date(d.date).getDate()}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {statusEntries.length > 0 && (
                  <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Text style={[s.sectionTitle, { color: C.text }]}>Buyurtma holatlari</Text>
                    <View style={{ gap: 10, marginTop: 8 }}>
                      {statusEntries.map(([status, count], i) => (
                        <View key={status} style={{ gap: 4 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ fontSize: 13, color: C.text }}>{STATUS_LABELS[status] ?? status}</Text>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: STATUS_COLORS[i % STATUS_COLORS.length] }}>{count as number} ta</Text>
                          </View>
                          <MiniBar value={count as number} max={maxStatusCount} color={STATUS_COLORS[i % STATUS_COLORS.length]} />
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* ═══ KASSA TAB ════════════════════════════════════════════════════════ */}
      {tab === "kassa" && (
        <>
          <View style={s.periodBar}>
            {(["today","week","month"] as KassaPeriod[]).map(pk => (
              <TouchableOpacity key={pk} onPress={() => setKassaPeriod(pk)}
                style={[s.periodBtn, kassaPeriod === pk && { backgroundColor: C.primary, borderRadius: 10 }]}>
                <Text style={[s.periodTxt, { color: kassaPeriod === pk ? "#fff" : C.textSecondary }]}>
                  {pk === "today" ? "Bugun" : pk === "week" ? "Hafta" : "Oy"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 12 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}>
            {kassaLoading && <View style={s.center}><ActivityIndicator color={C.primary} /></View>}
            {!kassaLoading && kassaReport && (
              <>
                <View style={[s.mainCard, { backgroundColor: (kassaReport.netQoldiq ?? 0) >= 0 ? "#059669" : "#DC2626" }]}>
                  <Text style={s.mainLabel}>Net qoldiq</Text>
                  <Text style={s.mainValue}>{nfull(kassaReport.netQoldiq)}</Text>
                  <View style={s.kpiRow}>
                    <View style={s.kpiItem}><Text style={s.kpiNum}>{mln(kassaReport.netKirim ?? 0)}</Text><Text style={s.kpiLbl}>Kirim</Text></View>
                    <View style={s.kpiDivider} />
                    <View style={s.kpiItem}><Text style={[s.kpiNum, { color: "#FCA5A5" }]}>{mln(kassaReport.totalChiqim ?? 0)}</Text><Text style={s.kpiLbl}>Chiqim</Text></View>
                    <View style={s.kpiDivider} />
                    <View style={s.kpiItem}><Text style={s.kpiNum}>{kassaReport.shiftsCount ?? 0}</Text><Text style={s.kpiLbl}>Smena</Text></View>
                  </View>
                </View>

                <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={[s.sectionTitle, { color: C.text }]}>Kirimlar</Text>
                  <StatRow icon="dollar-sign" color="#10B981" label="Naqd kirim"    value={nfull(kassaReport.totalNaqd)} />
                  <StatRow icon="credit-card" color="#3B82F6" label="Plastik kirim" value={nfull(kassaReport.totalPlastik)} />
                  <StatRow icon="arrow-up-circle" color="#6366F1" label="Jami kirim" value={nfull(kassaReport.netKirim)} />
                </View>
                <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={[s.sectionTitle, { color: C.text }]}>Chiqimlar</Text>
                  <StatRow icon="arrow-down-circle" color="#EF4444" label="Jami chiqim" value={nfull(kassaReport.totalChiqim)} />
                </View>
              </>
            )}
            {!kassaLoading && !kassaReport && (
              <View style={s.center}><Text style={{ color: C.textSecondary }}>Kassa ma'lumotlari yo'q</Text></View>
            )}
          </ScrollView>
        </>
      )}

      {/* ═══ KIRIM-CHIQIM TAB ════════════════════════════════════════════════ */}
      {tab === "kirim-chiqim" && (
        <>
          {/* Oy/Yil tanlash */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", gap: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <TouchableOpacity onPress={() => {
              if (kcMonth === 1) { setKcMonth(12); setKcYear(y => y - 1); }
              else setKcMonth(m => m - 1);
            }} style={[s.navBtn, { borderColor: C.border, backgroundColor: C.card }]}>
              <Feather name="chevron-left" size={18} color={C.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.primary + "15", borderRadius: 10, paddingVertical: 6 }}>
              <Text style={{ fontWeight: "700", fontSize: 14, color: C.primary }}>
                {MONTHS_UZ[kcMonth - 1]} {kcYear}
              </Text>
            </View>
            <TouchableOpacity onPress={() => {
              if (kcMonth === 12) { setKcMonth(1); setKcYear(y => y + 1); }
              else setKcMonth(m => m + 1);
            }} style={[s.navBtn, { borderColor: C.border, backgroundColor: C.card }]}>
              <Feather name="chevron-right" size={18} color={C.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 12 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}>
            {kcLoading && <View style={s.center}><ActivityIndicator color={C.primary} /></View>}
            {!kcLoading && kcData && (
              <>
                {/* Sof foyda karta */}
                <View style={[s.mainCard, { backgroundColor: (kcS.sof ?? 0) >= 0 ? "#059669" : "#DC2626" }]}>
                  <Text style={s.mainLabel}>Sof foyda / zarar — {MONTHS_UZ[kcMonth - 1]} {kcYear}</Text>
                  <Text style={s.mainValue}>
                    {(kcS.sof ?? 0) >= 0 ? "+" : ""}{nfull(kcS.sof)}
                  </Text>
                  <View style={s.kpiRow}>
                    <View style={s.kpiItem}><Text style={s.kpiNum}>{mln(kcS.jamiKirim ?? 0)}</Text><Text style={s.kpiLbl}>Kirim</Text></View>
                    <View style={s.kpiDivider} />
                    <View style={s.kpiItem}><Text style={[s.kpiNum, { color: "#FCA5A5" }]}>{mln(kcS.jamiChiqim ?? 0)}</Text><Text style={s.kpiLbl}>Chiqim</Text></View>
                    <View style={s.kpiDivider} />
                    <View style={s.kpiItem}><Text style={s.kpiNum}>{kcS.smenalar ?? 0}</Text><Text style={s.kpiLbl}>Smena</Text></View>
                  </View>
                </View>

                {/* Savdo */}
                <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={[s.sectionTitle, { color: C.text }]}>Savdo natijalari</Text>
                  <StatRow icon="shopping-bag" color="#4F46E5" label="Buyurtmalar"      value={`${kcD.buyurtmalar ?? 0} ta`} />
                  <StatRow icon="trending-up"  color="#10B981" label="Savdo jami"       value={nfull(kcD.savdoJami)} />
                  <StatRow icon="dollar-sign"  color="#16a34a" label="Naqd to'lov"      value={nfull(kcD.naqdJami)} />
                  <StatRow icon="clock"        color="#EF4444" label="Qarzga berilgan"  value={nfull(kcD.qarzJami)} />
                  <View style={{ marginTop: 8, backgroundColor: "#F0FDF4", borderRadius: 8, padding: 10 }}>
                    <Text style={{ fontSize: 11, color: "#15803d", fontWeight: "600" }}>
                      To'lov yig'ish: {kcD.savdoJami > 0 ? (((kcD.naqdJami ?? 0) / kcD.savdoJami) * 100).toFixed(1) : 0}%
                    </Text>
                  </View>
                </View>

                {/* Kirim-chiqim */}
                <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={[s.sectionTitle, { color: C.text }]}>Kassa kirim-chiqim</Text>
                  <StatRow icon="arrow-up-circle"   color="#10B981" label="Jami kirim"     value={nfull(kcS.jamiKirim)} />
                  <StatRow icon="dollar-sign"       color="#16a34a" label="Naqd kirim"     value={nfull(kcS.naqdKirim)} />
                  <StatRow icon="credit-card"       color="#3B82F6" label="Plastik kirim"  value={nfull(kcS.plastikKirim)} />
                  <StatRow icon="arrow-down-circle" color="#EF4444" label="Jami chiqim"    value={nfull(kcS.jamiChiqim)} />
                </View>

                {/* Kategoriyalar */}
                {(kcData.kategoriyalar ?? []).length > 0 && (
                  <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Text style={[s.sectionTitle, { color: C.text }]}>Kategoriyalar</Text>
                    {kcData.kategoriyalar.map((k: any, i: number) => (
                      <View key={i} style={s.statRow}>
                        <View style={[s.statIcon, { backgroundColor: (k.tur === "kirim" ? "#10B981" : "#EF4444") + "18" }]}>
                          <Feather name={k.tur === "kirim" ? "arrow-up" : "arrow-down"} size={13} color={k.tur === "kirim" ? "#10B981" : "#EF4444"} />
                        </View>
                        <Text style={[s.statLabel, { color: C.textSecondary }]}>{k.kategoriya ?? "boshqa"}</Text>
                        <Text style={[s.statValue, { color: k.tur === "kirim" ? "#10B981" : "#EF4444" }]}>{nfull(k.total)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Kunlik jadval */}
                {(kcData.dealRows ?? []).length > 0 && (
                  <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Text style={[s.sectionTitle, { color: C.text }]}>Kunlik savdo</Text>
                    {kcData.dealRows.map((d: any, i: number) => (
                      <View key={i} style={[s.statRow, { paddingVertical: 8 }]}>
                        <Text style={{ fontSize: 12, color: C.textSecondary, width: 70 }}>
                          {d.date ? new Date(d.date).toLocaleDateString("uz-UZ", { day: "numeric", month: "short" }) : "—"}
                        </Text>
                        <Text style={{ fontSize: 12, color: C.text, flex: 1 }}>{nfull(d.savdo)}</Text>
                        <Text style={{ fontSize: 12, color: "#10B981", marginRight: 8 }}>+{mln(d.naqdKirim ?? 0)}</Text>
                        {(d.qarz ?? 0) > 0 && <Text style={{ fontSize: 12, color: "#EF4444" }}>-{mln(d.qarz)}</Text>}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
            {!kcLoading && !kcData && (
              <View style={s.center}><Text style={{ color: C.textSecondary }}>Ma'lumot yo'q</Text></View>
            )}
          </ScrollView>
        </>
      )}

      {/* ═══ MIJOZ TAB ════════════════════════════════════════════════════════ */}
      {tab === "mijoz" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}>
          <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border, gap: 8 }]}>
            <TextInput
              style={[s.searchInput, { borderColor: C.border, backgroundColor: C.card, color: C.text }]}
              value={search} onChangeText={setSearch}
              placeholder="Mijoz ismi yoki telefoni..." placeholderTextColor={C.textSecondary}
            />
            {custFetching && <ActivityIndicator color={C.primary} />}
            {customers.map((c: any) => (
              <TouchableOpacity key={c.id}
                style={[s.customerRow, { borderColor: selectedCustomer?.id === c.id ? C.primary : C.border, backgroundColor: selectedCustomer?.id === c.id ? C.primary + "10" : C.card }]}
                onPress={() => setSelectedCustomer(c)}>
                <View style={s.custIcon}><Feather name="user" size={16} color={C.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>{c.fullName ?? "—"}</Text>
                  <Text style={{ fontSize: 12, color: C.textSecondary }}>{c.phone ?? ""}</Text>
                </View>
                {selectedCustomer?.id === c.id && <Feather name="check-circle" size={16} color={C.primary} />}
              </TouchableOpacity>
            ))}
          </View>

          {custReportLoading && <ActivityIndicator color={C.primary} />}
          {custReport && (
            <>
              <View style={[s.mainCard, { backgroundColor: C.primary }]}>
                <Text style={s.mainLabel}>{custReport.customer?.fullName ?? "Mijoz"}</Text>
                <Text style={s.mainValue}>{nfull(custReport.summary?.totalTovar)}</Text>
                <View style={s.kpiRow}>
                  <View style={s.kpiItem}><Text style={s.kpiNum}>{custReport.summary?.dealsCount ?? 0}</Text><Text style={s.kpiLbl}>Bitishuv</Text></View>
                  <View style={s.kpiDivider} />
                  <View style={s.kpiItem}><Text style={s.kpiNum}>{mln(custReport.summary?.totalZaklat ?? 0)}</Text><Text style={s.kpiLbl}>To'landi</Text></View>
                  <View style={s.kpiDivider} />
                  <View style={s.kpiItem}><Text style={[s.kpiNum, { color: "#FCA5A5" }]}>{mln(custReport.summary?.totalQarz ?? 0)}</Text><Text style={s.kpiLbl}>Qarz</Text></View>
                </View>
              </View>
              <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[s.sectionTitle, { color: C.text }]}>Umumiy</Text>
                <StatRow icon="shopping-bag" color="#4F46E5" label="Jami bitishuvlar"  value={`${custReport.summary?.dealsCount} ta`} />
                <StatRow icon="check-circle" color="#10B981" label="Jami to'langan"   value={nfull(custReport.summary?.totalZaklat)} />
                <StatRow icon="alert-circle" color="#EF4444" label="Qolgan qarz"      value={nfull(custReport.summary?.totalQarz)} />
                <StatRow icon="activity"     color="#3B82F6" label="Faol bitishuvlar" value={`${custReport.summary?.activeDeals} ta`} />
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 22, fontWeight: "900", color: C.text, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  printBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  printTxt: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  shareBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  shareTxt: { fontSize: 13, fontWeight: "600", color: "#fff", fontFamily: "Inter_600SemiBold" },
  tabsScroll: { borderBottomWidth: 1, borderBottomColor: C.border, maxHeight: 50 },
  tabsContent: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 6 },
  tabTxt: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  periodBar: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  periodBtn: { flex: 1, alignItems: "center", paddingVertical: 5 },
  periodTxt: { fontSize: 13, fontFamily: "Inter_500Medium" },
  mainCard: {
    borderRadius: 16, padding: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  mainLabel: { fontSize: 12, color: "rgba(255,255,255,.8)", fontFamily: "Inter_400Regular", marginBottom: 4 },
  mainValue: { fontSize: 28, fontWeight: "900", color: "#fff", fontFamily: "Inter_700Bold", marginBottom: 12 },
  kpiRow: { flexDirection: "row", alignItems: "center" },
  kpiItem: { flex: 1, alignItems: "center" },
  kpiNum: { fontSize: 16, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  kpiLbl: { fontSize: 10, color: "rgba(255,255,255,.7)", fontFamily: "Inter_400Regular", marginTop: 2 },
  kpiDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,.2)" },
  section: { borderRadius: 14, borderWidth: 1, padding: 14 },
  sectionTitle: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 4 },
  gridRow: { flexDirection: "row", gap: 8 },
  gridCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  gridNum: { fontSize: 22, fontWeight: "900", fontFamily: "Inter_700Bold" },
  gridLbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border + "80" },
  statIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", marginRight: 8 },
  statLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  statValue: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  searchInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  customerRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 10, padding: 10, gap: 10 },
  custIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.primary + "15", alignItems: "center", justifyContent: "center" },
  navBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border },
  compareRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  compareIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
