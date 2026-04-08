import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Alert, Platform, RefreshControl,
  Modal, TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const C = Colors.light;

const STATUSES = [
  { key: "yangi",        label: "Yangi",         color: "#3B82F6", icon: "plus-circle" as const },
  { key: "tikuvda",      label: "Tikuvda",        color: "#8B5CF6", icon: "scissors" as const },
  { key: "tayyor",       label: "Tayyor",         color: "#10B981", icon: "check-circle" as const },
  { key: "ornatilmoqda", label: "O'rnatilmoqda",  color: "#F59E0B", icon: "tool" as const },
  { key: "yopildi",      label: "Yopildi",        color: "#22C55E", icon: "flag" as const },
];

function fmt(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0)) + " so'm";
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

interface Worker { id: number; fullName: string; role: string; }
interface Deal {
  id: number;
  mijozIsm: string | null;
  mijozPhone: string | null;
  manzil: string | null;
  status: string;
  totalMaterial: number;
  narxPerMetr: number;
  totalNarx: number;
  ornatishTuri: string | null;
  ornatishNarx: number;
  chevarHaqiPerMetr: number;
  chevarJami: number;
  zaklatSumma: number;
  qarzSumma: number;
  qarzKaytarishKuni: string | null;
  tayyorBolishKuni: string | null;
  ornatishSanasi: string | null;
  tailorWorkerId: number | null;
  installerWorkerId: number | null;
  measurements: Record<string, unknown> | null;
  izoh: string | null;
  smsYuborildi: string | null;
  createdAt: string;
}

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paySum, setPaySum] = useState("");
  const [payTur, setPayTur] = useState<"naqd"|"plastik">("naqd");
  const [payLoading, setPayLoading] = useState(false);
  const [sharingChek, setSharingChek] = useState(false);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);

  const { data: deal, isLoading, refetch } = useQuery<Deal>({
    queryKey: ["deal", id],
    queryFn: () => apiReq(`/client-deals/${id}`),
    enabled: !!id,
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["workers"],
    queryFn: () => apiReq("/workers"),
  });

  const { data: photos = [] } = useQuery<{ id: number; url: string; createdAt: string }[]>({
    queryKey: ["deal-photos", id],
    queryFn: () => apiReq(`/client-deals/${id}/photos`),
    enabled: !!id,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  async function changeStatus(newStatus: string) {
    if (!deal) return;
    setChangingStatus(true);
    try {
      await apiReq(`/kanban/${deal.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["deal", id] }),
        qc.invalidateQueries({ queryKey: ["client-deals"] }),
        qc.invalidateQueries({ queryKey: ["deals-recent"] }),
      ]);
      refetch();
    } catch {
      Alert.alert("Xato", "Holat o'zgarmadi");
    } finally {
      setChangingStatus(false);
    }
  }

  const statusInfo = STATUSES.find(s => s.key === (deal?.status || "yangi")) || STATUSES[0];
  const tailor = workers.find(w => w.id === deal?.tailorWorkerId);
  const installer = workers.find(w => w.id === deal?.installerWorkerId);
  const grandTotal = (deal?.totalNarx || 0) + (deal?.ornatishNarx || 0) + (deal?.chevarJami || 0);
  const tolov = deal ? grandTotal - (deal.qarzSumma || 0) : 0;

  async function handlePayment() {
    const sum = parseFloat(paySum.replace(/\s/g, ""));
    if (!sum || sum <= 0) { Alert.alert("Summa kiriting"); return; }
    if (!deal) return;
    setPayLoading(true);
    try {
      const result = await apiReq<any>("/payments", {
        method: "POST",
        body: JSON.stringify({ dealId: Number(id), summa: sum, tolovTuri: payTur }),
      });
      Alert.alert("✅ To'lov qabul qilindi!", `Qolgan qarz: ${fmt(result.newQarzSumma)}`);
      setShowPayModal(false); setPaySum("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["deal", id] }),
        qc.invalidateQueries({ queryKey: ["deals-recent"] }),
      ]);
      refetch();
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setPayLoading(false); }
  }

  async function handleTaklifnoma() {
    if (!deal) return;
    setSharingChek(true);
    try {
      const meas = deal.measurements ? Object.entries(deal.measurements) : [];
      const measRows = meas.map(([k, v]) => `<tr><td>${k}</td><td style="font-weight:600">${v}</td></tr>`).join("");

      const html = `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;padding:32px;color:#1e293b;}
.header{background:#4F46E5;color:#fff;padding:24px 28px;border-radius:12px;margin-bottom:28px;}
.company{font-size:22px;font-weight:900;letter-spacing:1px;}
.tagline{font-size:12px;opacity:0.8;margin-top:4px;}
.badge{background:rgba(255,255,255,0.15);display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;margin-top:8px;}
h3{font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;margin:20px 0 10px;}
.card{border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px;}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;}
.row:last-child{border-bottom:none;}
.label{color:#64748b;}
.val{font-weight:600;color:#1e293b;}
table{width:100%;border-collapse:collapse;font-size:13px;}
th{background:#f8fafc;padding:8px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;}
td{padding:8px 12px;border-bottom:1px solid #f1f5f9;}
.total-card{background:#EEF2FF;border:1px solid #C7D2FE;border-radius:10px;padding:16px 20px;}
.total-row{display:flex;justify-content:space-between;padding:5px 0;}
.grand{font-size:20px;font-weight:900;color:#4F46E5;margin-top:8px;}
.footer{text-align:center;font-size:11px;color:#94a3b8;margin-top:24px;padding-top:12px;border-top:1px solid #f1f5f9;}
</style></head><body>
<div class="header">
  <div class="company">BluePOS</div>
  <div class="tagline">Parda do'konlari uchun professional xizmat</div>
  <div class="badge">📋 TAKLIFNOMA · #${deal.id}</div>
</div>

<h3>Mijoz ma'lumotlari</h3>
<div class="card">
  <div class="row"><span class="label">Ism</span><span class="val">${deal.mijozIsm || "—"}</span></div>
  <div class="row"><span class="label">Telefon</span><span class="val">${deal.mijozPhone || "—"}</span></div>
  <div class="row"><span class="label">Manzil</span><span class="val">${deal.manzil || "—"}</span></div>
  <div class="row"><span class="label">Taklif sanasi</span><span class="val">${new Date().toLocaleDateString("uz-UZ")}</span></div>
  ${deal.tayyorBolishKuni ? `<div class="row"><span class="label">Tayyor bo'lish kuni</span><span class="val">${fmtDate(deal.tayyorBolishKuni)}</span></div>` : ""}
</div>

${meas.length > 0 ? `<h3>O'lchamlar</h3>
<div class="card">
<table><thead><tr><th>Xona/joy</th><th>O'lchov</th></tr></thead><tbody>${measRows}</tbody></table>
</div>` : ""}

<h3>Narxlar</h3>
<div class="card">
  <div class="row"><span class="label">Jami material</span><span class="val">${deal.totalMaterial?.toFixed(2)} m²</span></div>
  <div class="row"><span class="label">Narx (1 metr)</span><span class="val">${fmt(deal.narxPerMetr)}</span></div>
  <div class="row"><span class="label">Parda summasi</span><span class="val">${fmt(deal.totalNarx)}</span></div>
  ${(deal.ornatishNarx || 0) > 0 ? `<div class="row"><span class="label">O'rnatish xizmati</span><span class="val">${fmt(deal.ornatishNarx)}</span></div>` : ""}
  ${(deal.chevarJami || 0) > 0 ? `<div class="row"><span class="label">Tikuvchi haqi</span><span class="val">${fmt(deal.chevarJami)}</span></div>` : ""}
</div>

<div class="total-card">
  <div class="total-row"><span style="color:#6366f1;font-weight:600">Zaklat (oldindan to'lov)</span><span style="font-weight:700">${fmt(deal.zaklatSumma)}</span></div>
  <div class="total-row"><span style="color:#64748b">Qolgan qism</span><span style="font-weight:700;color:#EF4444">${fmt(deal.qarzSumma)}</span></div>
  <div class="total-row grand"><span>JAMI SUMMA</span><span>${fmt(grandTotal)}</span></div>
</div>

<div class="footer">Ushbu taklifnoma BluePOS tizimi orqali yaratildi · ${new Date().toLocaleDateString("uz-UZ")}</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Taklifnomani ulashish" });
      else Alert.alert("PDF yaratildi", `Fayl: ${uri}`);
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setSharingChek(false); }
  }

  async function handleChek() {
    if (!deal) return;
    setSharingChek(true);
    try {
      const html = `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;padding:20px;max-width:400px;margin:0 auto;}
h2{text-align:center;color:#4F46E5;margin-bottom:4px;}
.sub{text-align:center;color:#6b7280;font-size:12px;margin-bottom:20px;}
hr{border:1px dashed #d1d5db;margin:12px 0;}
.row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;}
.label{color:#6b7280;}.value{font-weight:600;}
.total{font-size:16px;font-weight:800;}.green{color:#10B981;}.red{color:#EF4444;}
.footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:20px;}
</style></head><body>
<h2>BluePOS</h2>
<div class="sub">Parda do'konlari uchun POS tizimi</div>
<div class="row"><span class="label">Chek #</span><span class="value">${deal.id}</span></div>
<div class="row"><span class="label">Sana</span><span class="value">${new Date().toLocaleDateString("uz-UZ")}</span></div>
<hr/>
<div class="row"><span class="label">Mijoz</span><span class="value">${deal.mijozIsm || "—"}</span></div>
<div class="row"><span class="label">Telefon</span><span class="value">${deal.mijozPhone || "—"}</span></div>
<div class="row"><span class="label">Manzil</span><span class="value">${deal.manzil || "—"}</span></div>
<hr/>
<div class="row"><span class="label">Material (${deal.totalMaterial?.toFixed(2)} metr)</span><span class="value">${fmt(deal.totalNarx)}</span></div>
${(deal.ornatishNarx || 0) > 0 ? `<div class="row"><span class="label">O'rnatish</span><span class="value">${fmt(deal.ornatishNarx)}</span></div>` : ""}
${(deal.chevarJami || 0) > 0 ? `<div class="row"><span class="label">Tikuvchi haqi</span><span class="value">${fmt(deal.chevarJami)}</span></div>` : ""}
<hr/>
<div class="row total"><span class="label">JAMI</span><span class="value">${fmt(grandTotal)}</span></div>
<div class="row"><span class="label">To'langan (zaklat)</span><span class="value green">${fmt(deal.zaklatSumma)}</span></div>
<div class="row"><span class="label">Qolgan qarz</span><span class="value ${deal.qarzSumma > 0 ? 'red' : 'green'}">${fmt(deal.qarzSumma)}</span></div>
${deal.qarzKaytarishKuni ? `<div class="row"><span class="label">To'lov muddati</span><span class="value">${fmtDate(deal.qarzKaytarishKuni)}</span></div>` : ""}
<hr/>
<div class="footer">Ushbu chek BluePOS tomonidan yaratildi</div>
</body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Chek ulashish" });
      else Alert.alert("PDF yaratildi", `Fayl: ${uri}`);
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setSharingChek(false); }
  }

  const NEXT_STATUSES: Record<string, string[]> = {
    yangi: ["tikuvda"],
    tikuvda: ["tayyor", "yangi"],
    tayyor: ["ornatilmoqda", "tikuvda"],
    ornatilmoqda: ["yopildi", "tayyor"],
    yopildi: [],
  };
  const nextStatuses = NEXT_STATUSES[deal?.status || "yangi"] || [];

  if (isLoading) {
    return (
      <View style={[st.loadWrap, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <ActivityIndicator color={C.primary} style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (!deal) {
    return (
      <View style={[st.loadWrap, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[st.emptyTxt, { color: C.textSecondary }]}>Buyurtma topilmadi</Text>
      </View>
    );
  }

  return (
    <View style={[st.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={[st.backBtn, { backgroundColor: C.card }]}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[st.headerTitle, { color: C.text }]} numberOfLines={1}>
            {deal.mijozIsm || "Noma'lum mijoz"}
          </Text>
          <Text style={[st.headerSub, { color: C.textSecondary }]}>#{deal.id} · {fmtDateTime(deal.createdAt)}</Text>
        </View>
        <TouchableOpacity
          style={[st.chekBtn, { opacity: sharingChek ? 0.6 : 1 }]}
          onPress={handleChek}
          disabled={sharingChek}
          activeOpacity={0.8}
        >
          {sharingChek ? <ActivityIndicator size="small" color={C.primary} /> : <Feather name="printer" size={16} color={C.primary} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >

        {/* ── Mijoz ma'lumotlari ── */}
        <Section title="Mijoz ma'lumotlari" icon="user">
          <InfoRow icon="user" label="Ism" value={deal.mijozIsm || "—"} />
          {deal.mijozPhone ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${deal.mijozPhone}`)}>
              <InfoRow icon="phone" label="Telefon" value={deal.mijozPhone} valueColor={C.primary} />
            </TouchableOpacity>
          ) : (
            <InfoRow icon="phone" label="Telefon" value="—" />
          )}
          {deal.manzil ? (
            <TouchableOpacity onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(deal.manzil!)}`)}>
              <InfoRow icon="map-pin" label="Manzil" value={deal.manzil} valueColor={C.primary} />
            </TouchableOpacity>
          ) : (
            <InfoRow icon="map-pin" label="Manzil" value="—" />
          )}
          {deal.mijozPhone && (
            <View style={st.callRow}>
              <TouchableOpacity
                style={[st.callBtn, { backgroundColor: "#D1FAE5" }]}
                onPress={() => Linking.openURL(`tel:${deal.mijozPhone}`)}
              >
                <Feather name="phone" size={16} color="#059669" />
                <Text style={[st.callBtnTxt, { color: "#059669" }]}>Qo'ng'iroq</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.callBtn, { backgroundColor: "#EEF2FF" }]}
                onPress={() => Linking.openURL(`https://t.me/${deal.mijozPhone?.replace("+", "")}`)}
              >
                <Feather name="send" size={16} color={C.primary} />
                <Text style={[st.callBtnTxt, { color: C.primary }]}>Telegram</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>

        {/* ── Buyurtma tafsilotlari ── */}
        <Section title="Buyurtma tafsilotlari" icon="layers">
          <InfoRow icon="bar-chart-2" label="Umumiy material" value={`${deal.totalMaterial?.toFixed(2)} metr`} />
          <InfoRow icon="tag" label="Narx (1 metr)" value={fmt(deal.narxPerMetr)} />
          <InfoRow icon="dollar-sign" label="Material summasi" value={fmt(deal.totalNarx)} />
          {deal.ornatishTuri && (
            <InfoRow
              icon="tool"
              label="O'rnatish turi"
              value={deal.ornatishTuri === "devor" ? "Devor (20 000 so'm)" : deal.ornatishTuri === "beton" ? "Beton (30 000 so'm)" : deal.ornatishTuri}
            />
          )}
          {(deal.ornatishNarx || 0) > 0 && (
            <InfoRow icon="tool" label="O'rnatish narxi" value={fmt(deal.ornatishNarx)} />
          )}
          {(deal.chevarJami || 0) > 0 && (
            <InfoRow icon="scissors" label="Tikuvchi haqi" value={fmt(deal.chevarJami)} />
          )}
        </Section>

        {/* ── To'lov holati ── */}
        <View style={[st.payCard, { backgroundColor: C.primary }]}>
          <Text style={st.payTitle}>To'lov holati</Text>
          <Text style={st.payTotal}>{fmt(grandTotal)}</Text>
          <View style={st.payRow}>
            <View style={st.payItem}>
              <Text style={st.payItemLabel}>To'langan</Text>
              <Text style={[st.payItemVal, { color: "#A7F3D0" }]}>{fmt(tolov)}</Text>
            </View>
            <View style={[st.payDivider]} />
            <View style={st.payItem}>
              <Text style={st.payItemLabel}>Qarz</Text>
              <Text style={[st.payItemVal, { color: deal.qarzSumma > 0 ? "#FCA5A5" : "#A7F3D0" }]}>
                {fmt(deal.qarzSumma)}
              </Text>
            </View>
            <View style={[st.payDivider]} />
            <View style={st.payItem}>
              <Text style={st.payItemLabel}>Zaklat</Text>
              <Text style={[st.payItemVal, { color: "rgba(255,255,255,0.85)" }]}>{fmt(deal.zaklatSumma)}</Text>
            </View>
          </View>
          {deal.qarzKaytarishKuni && (
            <View style={st.debtDue}>
              <Feather name="calendar" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={st.debtDueTxt}>Qaytarish kuni: {fmtDate(deal.qarzKaytarishKuni)}</Text>
            </View>
          )}
          {(deal.qarzSumma || 0) > 0 && (
            <TouchableOpacity
              style={st.payAcceptBtn}
              onPress={() => setShowPayModal(true)}
              activeOpacity={0.85}
            >
              <Feather name="check-circle" size={16} color="#fff" />
              <Text style={st.payAcceptTxt}>To'lov qabul qilish</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Sanalar ── */}
        <Section title="Sanalar" icon="calendar">
          <InfoRow icon="plus-circle" label="Yaratilgan" value={fmtDateTime(deal.createdAt)} />
          {deal.tayyorBolishKuni && (
            <InfoRow icon="check-circle" label="Tayyor bo'lish kuni" value={fmtDate(deal.tayyorBolishKuni)} />
          )}
          {deal.ornatishSanasi && (
            <InfoRow icon="tool" label="O'rnatish sanasi" value={fmtDate(deal.ornatishSanasi)} />
          )}
        </Section>

        {/* ── Ishchilar ── */}
        {(tailor || installer) && (
          <Section title="Ishchilar" icon="users">
            {tailor && (
              <InfoRow icon="scissors" label="Tikuvchi" value={tailor.fullName} />
            )}
            {installer && (
              <InfoRow icon="tool" label="O'rnatuvchi" value={installer.fullName} />
            )}
          </Section>
        )}

        {/* ── O'lchamlar ── */}
        {deal.measurements && Object.keys(deal.measurements).length > 0 && (
          <Section title="O'lchamlar" icon="maximize">
            {Object.entries(deal.measurements).map(([k, v]) => (
              <InfoRow key={k} icon="minus" label={k} value={String(v)} />
            ))}
          </Section>
        )}

        {/* ── SMS holati ── */}
        <Section title="Qo'shimcha" icon="info">
          <InfoRow
            icon="message-circle"
            label="SMS yuborildi"
            value={deal.smsYuborildi === "ha" ? "Ha ✓" : "Yo'q"}
            valueColor={deal.smsYuborildi === "ha" ? "#059669" : C.textSecondary}
          />
          {deal.izoh ? (
            <InfoRow icon="file-text" label="Izoh" value={deal.izoh} />
          ) : null}
        </Section>

        {/* ── Holat o'zgartirish ── */}
        {nextStatuses.length > 0 && (
          <View style={[st.section, { borderColor: C.border }]}>
            <View style={st.sectionHeader}>
              <View style={[st.sectionIcon, { backgroundColor: C.surface }]}>
                <Feather name="refresh-cw" size={14} color={C.primary} />
              </View>
              <Text style={[st.sectionTitle, { color: C.text }]}>Holat o'zgartirish</Text>
            </View>
            <View style={st.statusBtns}>
              {nextStatuses.map(ns => {
                const info = STATUSES.find(s => s.key === ns)!;
                return (
                  <TouchableOpacity
                    key={ns}
                    style={[st.statusBtn, { backgroundColor: info.color + "15", borderColor: info.color }]}
                    onPress={() => changeStatus(ns)}
                    disabled={changingStatus}
                  >
                    {changingStatus ? (
                      <ActivityIndicator size="small" color={info.color} />
                    ) : (
                      <>
                        <Feather name={info.icon} size={15} color={info.color} />
                        <Text style={[st.statusBtnTxt, { color: info.color }]}>{info.label}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Barcha statuslar ── */}
        <View style={[st.section, { borderColor: C.border }]}>
          <View style={st.sectionHeader}>
            <View style={[st.sectionIcon, { backgroundColor: C.surface }]}>
              <Feather name="list" size={14} color={C.primary} />
            </View>
            <Text style={[st.sectionTitle, { color: C.text }]}>Jarayon bosqichlari</Text>
          </View>
          <View style={st.timeline}>
            {STATUSES.map((s, idx) => {
              const isActive = s.key === deal.status;
              const isDone = STATUSES.findIndex(x => x.key === deal.status) > idx;
              return (
                <View key={s.key} style={st.timelineRow}>
                  <View style={[
                    st.timelineDot,
                    isActive && { backgroundColor: s.color, borderColor: s.color },
                    isDone && { backgroundColor: "#10B981", borderColor: "#10B981" },
                    !isActive && !isDone && { borderColor: C.border },
                  ]}>
                    {isDone && <Feather name="check" size={10} color="#fff" />}
                    {isActive && <Feather name={s.icon} size={10} color="#fff" />}
                  </View>
                  {idx < STATUSES.length - 1 && (
                    <View style={[st.timelineLine, { backgroundColor: isDone ? "#10B981" : C.border }]} />
                  )}
                  <Text style={[st.timelineLabel, {
                    color: isActive ? s.color : isDone ? "#10B981" : C.textSecondary,
                    fontFamily: isActive ? "Inter_700Bold" : "Inter_400Regular",
                  }]}>
                    {s.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Rasmlar ── */}
        {photos.length > 0 && (
          <Section title={`Rasmlar (${photos.length})`} icon="image">
            <Text style={[{ fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {photos.length} ta rasm yuklangan
            </Text>
          </Section>
        )}

        {/* ── Taklifnoma ── */}
        <TouchableOpacity
          style={[st.taklifBtn, { backgroundColor: "#EEF2FF", borderColor: C.primary }]}
          onPress={handleTaklifnoma}
          disabled={sharingChek}
          activeOpacity={0.85}
        >
          <Feather name="file-text" size={18} color={C.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.primary }]}>Taklifnoma yaratish</Text>
            <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary }]}>Professional PDF taklif ulashish</Text>
          </View>
          <Feather name="chevron-right" size={16} color={C.primary} />
        </TouchableOpacity>

      </ScrollView>

      {/* ── To'lov modali ── */}
      <Modal visible={showPayModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPayModal(false)}>
        <View style={[st.modalWrap, { backgroundColor: C.background }]}>
          <View style={[st.modalHeader, { borderBottomColor: C.border }]}>
            <Text style={[st.modalTitle, { color: C.text }]}>To'lov qabul qilish</Text>
            <TouchableOpacity onPress={() => setShowPayModal(false)}>
              <Feather name="x" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View style={[st.modalInfoCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={{ fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" }}>Qolgan qarz</Text>
              <Text style={{ fontSize: 22, color: "#EF4444", fontFamily: "Inter_700Bold" }}>{fmt(deal?.qarzSumma ?? 0)}</Text>
            </View>
            <Text style={[st.inputLabel, { color: C.textSecondary }]}>To'lov summasi</Text>
            <TextInput
              style={[st.modalInput, { borderColor: C.border, backgroundColor: C.surface, color: C.text }]}
              value={paySum}
              onChangeText={setPaySum}
              placeholder="0"
              placeholderTextColor={C.textSecondary}
              keyboardType="numeric"
            />
            <Text style={[st.inputLabel, { color: C.textSecondary }]}>To'lov turi</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(["naqd", "plastik"] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[st.payTurBtn, { borderColor: payTur === t ? C.primary : C.border, backgroundColor: payTur === t ? C.primary + "15" : C.surface }]}
                  onPress={() => setPayTur(t)}
                >
                  <Feather name={t === "naqd" ? "dollar-sign" : "credit-card"} size={16} color={payTur === t ? C.primary : C.textSecondary} />
                  <Text style={{ fontFamily: "Inter_600SemiBold", color: payTur === t ? C.primary : C.textSecondary, fontSize: 14 }}>
                    {t === "naqd" ? "Naqd" : "Plastik"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[st.paySubmitBtn, { backgroundColor: C.primary, opacity: payLoading ? 0.7 : 1 }]}
              onPress={handlePayment}
              disabled={payLoading}
              activeOpacity={0.85}
            >
              {payLoading
                ? <ActivityIndicator color="#fff" />
                : <><Feather name="check" size={18} color="#fff" /><Text style={st.paySubmitTxt}>To'lovni tasdiqlash</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Reusable components ──────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={[st.section, { borderColor: Colors.light.border }]}>
      <View style={st.sectionHeader}>
        <View style={[st.sectionIcon, { backgroundColor: Colors.light.surface }]}>
          <Feather name={icon as any} size={14} color={Colors.light.primary} />
        </View>
        <Text style={[st.sectionTitle, { color: Colors.light.text }]}>{title}</Text>
      </View>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function InfoRow({ icon, label, value, valueColor }: {
  icon: string; label: string; value: string; valueColor?: string;
}) {
  const C = Colors.light;
  return (
    <View style={st.infoRow}>
      <View style={st.infoLeft}>
        <Feather name={icon as any} size={14} color={C.textSecondary} />
        <Text style={[st.infoLabel, { color: C.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[st.infoValue, { color: valueColor || C.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1 },
  loadWrap: { flex: 1, paddingHorizontal: 16 },
  emptyTxt: { textAlign: "center", marginTop: 60, fontSize: 15, fontFamily: "Inter_400Regular" },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  statusTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  section: {
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1,
    padding: 16, gap: 12,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  infoRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  infoLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1 },

  callRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  callBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 12,
  },
  callBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  payCard: { borderRadius: 20, padding: 20 },
  payTitle: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" },
  payTotal: { fontSize: 28, color: "#fff", fontFamily: "Inter_700Bold", marginTop: 4, marginBottom: 16 },
  payRow: { flexDirection: "row", alignItems: "center" },
  payItem: { flex: 1, alignItems: "center", gap: 4 },
  payItemLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" },
  payItemVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  payDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },
  debtDue: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12 },
  debtDueTxt: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" },

  statusBtns: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  statusBtn: {
    flex: 1, minWidth: 120, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1.5,
  },
  statusBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  timeline: { gap: 0 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  timelineDot: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#E2E8F0",
  },
  timelineLine: { position: "absolute", left: 10, top: 26, width: 2, height: 16 },
  timelineLabel: { fontSize: 13 },

  chekBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE",
  },
  payAcceptBtn: {
    marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  payAcceptTxt: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },

  modalWrap: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalInfoCard: {
    borderRadius: 14, borderWidth: 1, padding: 16,
    alignItems: "center", gap: 4,
  },
  inputLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modalInput: {
    borderWidth: 1, borderRadius: 12, padding: 14,
    fontSize: 18, fontFamily: "Inter_700Bold",
  },
  payTurBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
  },
  paySubmitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 15, borderRadius: 14, marginTop: 8,
  },
  paySubmitTxt: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },

  taklifBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderRadius: 16, borderWidth: 1.5,
  },
});
