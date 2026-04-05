import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Share,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";

const C = Colors.light;

function fmt(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0)) + " so'm";
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "long", year: "numeric" });
}

type Period = "today" | "week" | "month";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "week", label: "7 kun" },
  { key: "month", label: "Bu oy" },
];

interface DealSummary {
  total: number;
  count: number;
  yangi: number;
  tikuvda: number;
  tayyor: number;
  yopildi: number;
  zaklatJami: number;
  qarzJami: number;
  deals: any[];
}

interface FinanceSummary {
  income: number;
  expense: number;
  balance: number;
}

export default function HisobotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>("today");
  const [exporting, setExporting] = useState(false);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: deals, isLoading: dealsLoading } = useQuery<DealSummary>({
    queryKey: ["deals-report", period],
    queryFn: async () => {
      const now = new Date();
      let from: Date;
      if (period === "today") {
        from = new Date(now); from.setHours(0, 0, 0, 0);
      } else if (period === "week") {
        from = new Date(now); from.setDate(from.getDate() - 7);
      } else {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      const res = await apiReq(`/client-deals?limit=500`) as any;
      const all: any[] = res.deals || res || [];
      const filtered = all.filter(d => {
        const dt = new Date(d.createdAt);
        return dt >= from && dt <= now;
      });
      const summary: DealSummary = {
        total: filtered.reduce((s: number, d: any) => s + (d.totalNarx || 0), 0),
        count: filtered.length,
        yangi: filtered.filter((d: any) => d.status === "yangi").length,
        tikuvda: filtered.filter((d: any) => d.status === "tikuvda").length,
        tayyor: filtered.filter((d: any) => d.status === "tayyor" || d.status === "ornatilmoqda").length,
        yopildi: filtered.filter((d: any) => d.status === "yopildi" || d.status === "yakunlangan").length,
        zaklatJami: filtered.reduce((s: number, d: any) => s + (d.zaklatSumma || 0), 0),
        qarzJami: filtered.reduce((s: number, d: any) => s + (d.qarzSumma || 0), 0),
        deals: filtered,
      };
      return summary;
    },
  });

  const { data: finance } = useQuery<FinanceSummary>({
    queryKey: ["finance-report", period],
    queryFn: async () => {
      const res = await apiReq(`/finance/summary?period=${period}`) as any;
      return {
        income: res.totalIncome || res.income || 0,
        expense: res.totalExpense || res.expense || 0,
        balance: (res.totalIncome || 0) - (res.totalExpense || 0),
      };
    },
  });

  const isLoading = dealsLoading;
  const profit = (finance?.income || 0) - (finance?.expense || 0);
  const periodLabel = PERIODS.find(p => p.key === period)?.label || "";

  async function exportPDF() {
    setExporting(true);
    try {
      const d = deals;
      const f = finance;
      const now = new Date();
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; }
    .header { background: #4F46E5; color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; margin-bottom: 4px; }
    .header p { font-size: 13px; opacity: 0.8; }
    .section { background: #F9FAFB; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
    .section h2 { font-size: 14px; font-weight: bold; margin-bottom: 12px; color: #4F46E5; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { background: white; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #E5E7EB; }
    .card .val { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
    .card .lbl { font-size: 11px; color: #6B7280; }
    .income { color: #059669; }
    .expense { color: #DC2626; }
    .primary { color: #4F46E5; }
    .warning { color: #D97706; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #F3F4F6; padding: 8px 10px; text-align: left; font-size: 11px; color: #6B7280; }
    td { padding: 8px 10px; border-bottom: 1px solid #F3F4F6; font-size: 12px; }
    .footer { text-align: center; color: #9CA3AF; font-size: 11px; margin-top: 20px; }
    .status { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: bold; }
    .yangi { background: #EEF2FF; color: #4F46E5; }
    .tikuvda { background: #FFF7ED; color: #D97706; }
    .tayyor { background: #ECFDF5; color: #059669; }
    .yopildi { background: #F0FDF4; color: #059669; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Blupos Hisoboti</h1>
    <p>Davr: ${periodLabel} — ${fmtDate(now)}</p>
  </div>

  <div class="section">
    <h2>💰 Moliyaviy ko'rsatkichlar</h2>
    <div class="grid">
      <div class="card">
        <div class="val income">${fmt(f?.income || 0)}</div>
        <div class="lbl">Kirim</div>
      </div>
      <div class="card">
        <div class="val expense">${fmt(f?.expense || 0)}</div>
        <div class="lbl">Chiqim</div>
      </div>
      <div class="card">
        <div class="val primary">${fmt(profit)}</div>
        <div class="lbl">Foyda</div>
      </div>
      <div class="card">
        <div class="val warning">${fmt(d?.qarzJami || 0)}</div>
        <div class="lbl">Umumiy qarz</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>📋 Bitimlar</h2>
    <div class="grid">
      <div class="card"><div class="val primary">${d?.count || 0}</div><div class="lbl">Jami bitim</div></div>
      <div class="card"><div class="val income">${d?.yopildi || 0}</div><div class="lbl">Yopildi</div></div>
      <div class="card"><div class="val income">${fmt(d?.zaklatJami || 0)}</div><div class="lbl">Zaklat jami</div></div>
      <div class="card"><div class="val">${fmt(d?.total || 0)}</div><div class="lbl">Savdo hajmi</div></div>
    </div>
  </div>

  ${(d?.deals?.length || 0) > 0 ? `
  <div class="section">
    <h2>🗒️ Bitimlar ro'yxati</h2>
    <table>
      <tr>
        <th>#</th><th>Mijoz</th><th>Summa</th><th>Zaklat</th><th>Status</th>
      </tr>
      ${d?.deals?.slice(0, 20).map((dl: any) => `
      <tr>
        <td>#${dl.id}</td>
        <td>${dl.mijozIsm || dl.mijozPhone || "—"}</td>
        <td>${fmt(dl.totalNarx || 0)}</td>
        <td>${fmt(dl.zaklatSumma || 0)}</td>
        <td><span class="status ${dl.status}">${dl.status}</span></td>
      </tr>`).join("") || ""}
    </table>
    ${(d?.deals?.length || 0) > 20 ? `<p style="color:#9CA3AF;font-size:11px;margin-top:8px">... va yana ${(d?.deals?.length || 0) - 20} ta bitim</p>` : ""}
  </div>` : ""}

  <div class="footer">
    Blupos — Parda do'konlari uchun POS tizimi<br>
    Hisobot yaratildi: ${now.toLocaleString("uz-UZ")}
  </div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Hisobot — ${periodLabel}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Muvaffaqiyatli", "PDF yaratildi: " + uri);
      }
    } catch (e: any) {
      Alert.alert("Xato", e.message || "PDF yaratishda xato");
    } finally {
      setExporting(false);
    }
  }

  async function shareText() {
    const d = deals;
    const f = finance;
    const text = [
      `📊 Blupos Hisoboti — ${periodLabel}`,
      `📅 ${fmtDate(new Date())}`,
      ``,
      `💰 Moliya:`,
      `  Kirim: ${fmt(f?.income || 0)}`,
      `  Chiqim: ${fmt(f?.expense || 0)}`,
      `  Foyda: ${fmt(profit)}`,
      ``,
      `📋 Bitimlar:`,
      `  Jami: ${d?.count || 0} ta`,
      `  Savdo: ${fmt(d?.total || 0)}`,
      `  Zaklat: ${fmt(d?.zaklatJami || 0)}`,
      `  Qarz: ${fmt(d?.qarzJami || 0)}`,
    ].join("\n");

    await Share.share({ message: text, title: `Blupos hisoboti — ${periodLabel}` });
  }

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: C.card }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: C.text }]}>Hisobot</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>{fmtDate(new Date())}</Text>
        </View>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.surface }]} onPress={shareText}>
          <Feather name="share" size={18} color={C.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: C.primary }]}
          onPress={exportPDF}
          disabled={exporting || isLoading}
        >
          {exporting ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="download" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>

      {/* Period selector */}
      <View style={[s.periodRow, { backgroundColor: C.surface }]}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[s.periodBtn, period === p.key && { backgroundColor: "#fff", borderRadius: 10 }]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[s.periodTxt, { color: period === p.key ? C.primary : C.textSecondary }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}>

          {/* Finance section */}
          <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={s.sectionHeader}>
              <Feather name="trending-up" size={16} color={C.primary} />
              <Text style={[s.sectionTitle, { color: C.text }]}>Moliyaviy ko'rsatkichlar</Text>
            </View>
            <View style={s.statsGrid}>
              <StatBox label="Kirim" value={fmt(finance?.income || 0)} color="#059669" bg="#F0FDF4" icon="arrow-down-left" />
              <StatBox label="Chiqim" value={fmt(finance?.expense || 0)} color="#DC2626" bg="#FEF2F2" icon="arrow-up-right" />
              <StatBox label="Foyda" value={fmt(profit)} color={profit >= 0 ? "#059669" : "#DC2626"} bg={profit >= 0 ? "#F0FDF4" : "#FEF2F2"} icon="activity" />
              <StatBox label="Zaklat" value={fmt(deals?.zaklatJami || 0)} color={C.primary} bg={C.surface} icon="check-square" />
            </View>
          </View>

          {/* Deals section */}
          <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={s.sectionHeader}>
              <Feather name="file-text" size={16} color={C.primary} />
              <Text style={[s.sectionTitle, { color: C.text }]}>Bitimlar</Text>
            </View>
            <View style={s.statsGrid}>
              <StatBox label="Jami" value={String(deals?.count || 0)} color={C.primary} bg={C.surface} icon="layers" />
              <StatBox label="Savdo" value={fmt(deals?.total || 0)} color="#7C3AED" bg="#F5F3FF" icon="dollar-sign" />
              <StatBox label="Qarz" value={fmt(deals?.qarzJami || 0)} color="#D97706" bg="#FFFBEB" icon="clock" />
              <StatBox label="Yopildi" value={String(deals?.yopildi || 0)} color="#059669" bg="#F0FDF4" icon="check-circle" />
            </View>
          </View>

          {/* Status breakdown */}
          <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={s.sectionHeader}>
              <Feather name="pie-chart" size={16} color={C.primary} />
              <Text style={[s.sectionTitle, { color: C.text }]}>Status bo'yicha</Text>
            </View>
            <View style={{ gap: 8 }}>
              <StatusBar label="Yangi" count={deals?.yangi || 0} total={deals?.count || 1} color="#4F46E5" />
              <StatusBar label="Tikuvda" count={deals?.tikuvda || 0} total={deals?.count || 1} color="#F59E0B" />
              <StatusBar label="Tayyor/O'rnatilmoqda" count={deals?.tayyor || 0} total={deals?.count || 1} color="#10B981" />
              <StatusBar label="Yopildi" count={deals?.yopildi || 0} total={deals?.count || 1} color="#059669" />
            </View>
          </View>

          {/* Export button */}
          <TouchableOpacity
            style={[s.exportBtn, { backgroundColor: C.primary }]}
            onPress={exportPDF}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="file" size={18} color="#fff" />
                <Text style={s.exportBtnTxt}>PDF eksport qilish</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function StatBox({ label, value, color, bg, icon }: { label: string; value: string; color: string; bg: string; icon: any }) {
  return (
    <View style={[sb.wrap, { backgroundColor: bg }]}>
      <Feather name={icon} size={16} color={color} />
      <Text style={[sb.val, { color }]}>{value}</Text>
      <Text style={sb.lbl}>{label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  wrap: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", gap: 4, minWidth: "45%" },
  val: { fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center" },
  lbl: { fontSize: 10, color: "#6B7280", fontFamily: "Inter_400Regular" },
});

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 12, color: Colors.light.text, fontFamily: "Inter_400Regular" }}>{label}</Text>
        <Text style={{ fontSize: 12, color: Colors.light.textSecondary, fontFamily: "Inter_400Regular" }}>{count} ta ({Math.round(pct)}%)</Text>
      </View>
      <View style={{ height: 6, backgroundColor: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
        <View style={{ width: `${pct}%` as any, height: 6, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  periodRow: { flexDirection: "row", marginHorizontal: 16, borderRadius: 14, padding: 4, marginBottom: 4 },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  periodTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  exportBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15, borderRadius: 16,
  },
  exportBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
