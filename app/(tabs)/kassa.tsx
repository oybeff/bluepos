import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl, Platform, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import * as Print from "expo-print";

const C = Colors.light;

interface KassaTransaction {
  id: number;
  shiftId: number;
  tur: "kirim" | "chiqim";
  tolov: "naqd" | "plastik";
  summa: number;
  tavsif: string;
  kategoriya: string;
  createdAt: string;
}

interface KassaShift {
  id: number;
  status: "ochiq" | "yopiq";
  boshlanishQoldiq: number;
  naqdJami: number;
  plastikJami: number;
  chiqimJami: number;
  yakunQoldiq: number | null;
  ochilganSana: string;
  yopilganSana: string | null;
  transactions: KassaTransaction[];
}

const KATEGORIYALAR = ["savdo", "kirim", "chiqim", "ish haqi", "ijara", "ta'mirlash", "umumiy"];

function fmt(n: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";
}

function fmtTime(d: string): string {
  return new Date(d).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

export default function KassaScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  // Transaction form
  const [txnTur, setTxnTur] = useState<"kirim" | "chiqim">("kirim");
  const [txnTolov, setTxnTolov] = useState<"naqd" | "plastik">("naqd");
  const [txnSumma, setTxnSumma] = useState("");
  const [txnTavsif, setTxnTavsif] = useState("");
  const [txnKategoriya, setTxnKategoriya] = useState("savdo");

  // Open shift form
  const [boshlanishQoldiq, setBoshlanishQoldiq] = useState("0");

  const { data: shift, isLoading } = useQuery<KassaShift | null>({
    queryKey: ["kassa-current"],
    queryFn: () => apiReq("/kassa/shifts/current"),
    refetchInterval: 30000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["kassa-current"] });
    setRefreshing(false);
  }, [qc]);

  const handleOpenShift = async () => {
    setLoading(true);
    try {
      await apiReq("/kassa/shifts/open", {
        method: "POST",
        body: JSON.stringify({ boshlanishQoldiq: parseFloat(boshlanishQoldiq) || 0 }),
      });
      await qc.invalidateQueries({ queryKey: ["kassa-current"] });
      setShowOpenModal(false);
      setBoshlanishQoldiq("0");
    } catch (e: any) {
      Alert.alert("Xato", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintShift = async () => {
    if (!shift) return;
    try {
      const fmtDate = (d: string) => new Date(d).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const fmtN = (n: number) => new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0));
      const txns = shift.transactions || [];
      const naqdKirim = txns.filter((t: any) => t.tur === "kirim" && t.tolov === "naqd").reduce((s: number, t: any) => s + t.summa, 0);
      const plastikKirim = txns.filter((t: any) => t.tur === "kirim" && t.tolov === "plastik").reduce((s: number, t: any) => s + t.summa, 0);
      const chiqim = txns.filter((t: any) => t.tur === "chiqim").reduce((s: number, t: any) => s + t.summa, 0);
      const yakunQoldiq = shift.boshlanishQoldiq + naqdKirim - chiqim;

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 74mm; }
  h2 { text-align:center; font-size:15px; margin:4px 0; }
  .sub { text-align:center; font-size:9px; }
  hr { border-top: 1px dashed #000; margin: 5px 0; }
  .row { display:flex; justify-content:space-between; margin: 2px 0; }
  .total { font-size:14px; font-weight:bold; }
  .footer { text-align:center; font-size:9px; margin-top:8px; }
</style></head><body>
<h2>Blupos</h2>
<div class="sub">KASSA SMENA XISOBOTI</div>
<hr>
<div class="row"><span>Smena #${shift.id}</span><span>${shift.status === "ochiq" ? "OCHIQ" : "YOPIQ"}</span></div>
<div class="row"><span>Ochildi:</span><span>${fmtDate(shift.ochilganSana)}</span></div>
${shift.yopilganSana ? `<div class="row"><span>Yopildi:</span><span>${fmtDate(shift.yopilganSana)}</span></div>` : ""}
<hr>
<div class="row"><span>Boshlang'ich:</span><span>${fmtN(shift.boshlanishQoldiq)} so'm</span></div>
<div class="row"><span>Naqd kirim:</span><span>${fmtN(naqdKirim)} so'm</span></div>
<div class="row"><span>Plastik:</span><span>${fmtN(plastikKirim)} so'm</span></div>
<div class="row"><span>Chiqim:</span><span>-${fmtN(chiqim)} so'm</span></div>
<hr>
<div class="row total"><span>YAKUNIY QOLDIQ</span><span>${fmtN(yakunQoldiq)} so'm</span></div>
<hr>
<div class="row"><span>Tranzaksiyalar:</span><span>${txns.length} ta</span></div>
<hr>
<div class="footer">${new Date().toLocaleString("uz-UZ")}</div>
</body></html>`;
      if (Platform.OS === "web") {
        const w = window.open("", "_blank");
        if (w) { w.document.write(html); w.document.close(); w.print(); }
      } else {
        await Print.printAsync({ html });
      }
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Chop etishda xatolik");
    }
  };

  const handleCloseShift = async () => {
    if (!shift) return;
    Alert.alert("Shiftni yopish", "Haqiqatan ham shiftni yopmoqchimisiz?", [
      { text: "Bekor", style: "cancel" },
      {
        text: "Yopish", style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            await apiReq(`/kassa/shifts/${shift.id}/close`, { method: "POST", body: JSON.stringify({}) });
            await qc.invalidateQueries({ queryKey: ["kassa-current"] });
          } catch (e: any) {
            Alert.alert("Xato", e.message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleAddTxn = async () => {
    if (!shift || !txnSumma || !txnTavsif) {
      Alert.alert("Xato", "Summa va tavsifni kiriting");
      return;
    }
    setLoading(true);
    try {
      await apiReq("/kassa/transactions", {
        method: "POST",
        body: JSON.stringify({
          shiftId: shift.id,
          tur: txnTur,
          tolov: txnTolov,
          summa: parseFloat(txnSumma),
          tavsif: txnTavsif,
          kategoriya: txnKategoriya,
        }),
      });
      await qc.invalidateQueries({ queryKey: ["kassa-current"] });
      setShowModal(false);
      setTxnSumma("");
      setTxnTavsif("");
    } catch (e: any) {
      Alert.alert("Xato", e.message);
    } finally {
      setLoading(false);
    }
  };

  const naqdQoldiq = shift ? shift.boshlanishQoldiq + shift.naqdJami - shift.chiqimJami : 0;

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: topPadding + 12 }]}>
        <Text style={s.title}>Kassa</Text>
        {shift && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={handlePrintShift} style={[s.closeShiftBtn, { backgroundColor: "#F1F5F9", borderColor: "#CBD5E1" }]}>
              <Feather name="printer" size={14} color="#334155" />
              <Text style={[s.closeShiftTxt, { color: "#334155" }]}>Chek</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCloseShift} style={s.closeShiftBtn}>
              <Feather name="lock" size={14} color="#DC2626" />
              <Text style={s.closeShiftTxt}>Yopish</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {isLoading && <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />}

        {!isLoading && !shift && (
          <View style={s.emptyState}>
            <View style={[s.emptyIcon, { backgroundColor: "#F0FDF4" }]}>
              <Feather name="unlock" size={36} color="#10B981" />
            </View>
            <Text style={[s.emptyTitle, { color: C.text }]}>Shift ochilmagan</Text>
            <Text style={[s.emptySubtitle, { color: C.textSecondary }]}>Ishni boshlash uchun shift oching</Text>
            <TouchableOpacity
              style={[s.openBtn, { backgroundColor: "#10B981" }]}
              onPress={() => setShowOpenModal(true)}
            >
              <Feather name="play" size={18} color="#fff" />
              <Text style={s.openBtnTxt}>Shift ochish</Text>
            </TouchableOpacity>
          </View>
        )}

        {shift && (
          <>
            {/* Joriy qoldiq */}
            <View style={[s.balanceCard, { backgroundColor: C.primary }]}>
              <Text style={s.balanceLabel}>Naqd qoldiq</Text>
              <Text style={s.balanceAmount}>{fmt(naqdQoldiq)}</Text>
              <View style={s.balanceRow}>
                <View style={s.balanceItem}>
                  <Feather name="credit-card" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={s.balanceItemTxt}>Plastik: {fmt(shift.plastikJami)}</Text>
                </View>
                <View style={s.balanceItem}>
                  <Feather name="trending-up" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={s.balanceItemTxt}>Kirim: {fmt(shift.naqdJami + shift.plastikJami)}</Text>
                </View>
                <View style={s.balanceItem}>
                  <Feather name="trending-down" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={s.balanceItemTxt}>Chiqim: {fmt(shift.chiqimJami)}</Text>
                </View>
              </View>
            </View>

            {/* Amallar */}
            <View style={s.actionsRow}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: "#D1FAE5" }]}
                onPress={() => { setTxnTur("kirim"); setShowModal(true); }}
              >
                <Feather name="plus-circle" size={22} color="#059669" />
                <Text style={[s.actionBtnTxt, { color: "#059669" }]}>Kirim</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: "#FEE2E2" }]}
                onPress={() => { setTxnTur("chiqim"); setShowModal(true); }}
              >
                <Feather name="minus-circle" size={22} color="#DC2626" />
                <Text style={[s.actionBtnTxt, { color: "#DC2626" }]}>Chiqim</Text>
              </TouchableOpacity>
            </View>

            {/* Tranzaksiyalar */}
            <Text style={[s.sectionTitle, { color: C.text }]}>Bugungi operatsiyalar ({shift.transactions?.length ?? 0})</Text>
            {(shift.transactions ?? []).length === 0 && (
              <Text style={[s.emptyTxn, { color: C.textSecondary }]}>Hali operatsiya yo'q</Text>
            )}
            {(shift.transactions ?? []).map(txn => (
              <View key={txn.id} style={[s.txnCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <View style={[s.txnIcon, { backgroundColor: txn.tur === "kirim" ? "#D1FAE5" : "#FEE2E2" }]}>
                  <Feather name={txn.tur === "kirim" ? "arrow-down-left" : "arrow-up-right"} size={16} color={txn.tur === "kirim" ? "#059669" : "#DC2626"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.txnTavsif, { color: C.text }]}>{txn.tavsif}</Text>
                  <Text style={[s.txnMeta, { color: C.textSecondary }]}>{txn.kategoriya} · {txn.tolov} · {fmtTime(txn.createdAt)}</Text>
                </View>
                <Text style={[s.txnAmount, { color: txn.tur === "kirim" ? "#059669" : "#DC2626" }]}>
                  {txn.tur === "kirim" ? "+" : "-"}{fmt(txn.summa)}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Transaction Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: C.surface }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: C.text }]}>{txnTur === "kirim" ? "Kirim qo'shish" : "Chiqim qo'shish"}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={22} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Tur toggle */}
            <View style={s.toggleRow}>
              {(["kirim", "chiqim"] as const).map(t => (
                <TouchableOpacity key={t} onPress={() => setTxnTur(t)}
                  style={[s.toggleBtn, txnTur === t && { backgroundColor: t === "kirim" ? "#059669" : "#DC2626" }]}>
                  <Text style={[s.toggleTxt, { color: txnTur === t ? "#fff" : C.textSecondary }]}>
                    {t === "kirim" ? "Kirim" : "Chiqim"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* To'lov turi */}
            <View style={s.toggleRow}>
              {(["naqd", "plastik"] as const).map(t => (
                <TouchableOpacity key={t} onPress={() => setTxnTolov(t)}
                  style={[s.toggleBtn, txnTolov === t && { backgroundColor: C.primary }]}>
                  <Text style={[s.toggleTxt, { color: txnTolov === t ? "#fff" : C.textSecondary }]}>
                    {t === "naqd" ? "💵 Naqd" : "💳 Plastik"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[s.modalInput, { borderColor: C.border, color: C.text }]}
              placeholder="Summa"
              placeholderTextColor={C.textSecondary}
              value={txnSumma}
              onChangeText={setTxnSumma}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[s.modalInput, { borderColor: C.border, color: C.text }]}
              placeholder="Tavsif (masalan: Parda sotuvi)"
              placeholderTextColor={C.textSecondary}
              value={txnTavsif}
              onChangeText={setTxnTavsif}
            />

            {/* Kategoriya */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {KATEGORIYALAR.map(k => (
                  <TouchableOpacity key={k} onPress={() => setTxnKategoriya(k)}
                    style={[s.catBtn, txnKategoriya === k && { backgroundColor: C.primary, borderColor: C.primary }]}>
                    <Text style={[s.catTxt, { color: txnKategoriya === k ? "#fff" : C.textSecondary }]}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={[s.submitBtn, { backgroundColor: txnTur === "kirim" ? "#059669" : "#DC2626" }]}
              onPress={handleAddTxn} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={s.submitTxt}>{txnTur === "kirim" ? "Kirim qo'shish" : "Chiqim qo'shish"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Open Shift Modal */}
      <Modal visible={showOpenModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: C.surface }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: C.text }]}>Shift ochish</Text>
              <TouchableOpacity onPress={() => setShowOpenModal(false)}>
                <Feather name="x" size={22} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[s.modalLabel, { color: C.textSecondary }]}>Kassadagi boshlang'ich naqd pulni kiriting</Text>
            <TextInput
              style={[s.modalInput, { borderColor: C.border, color: C.text }]}
              placeholder="Boshlang'ich qoldiq (so'm)"
              placeholderTextColor={C.textSecondary}
              value={boshlanishQoldiq}
              onChangeText={setBoshlanishQoldiq}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={[s.submitBtn, { backgroundColor: "#10B981" }]}
              onPress={handleOpenShift} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Feather name="play" size={18} color="#fff" />
                  <Text style={s.submitTxt}>Shiftni boshlash</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: C.text },
  closeShiftBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEE2E2", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  closeShiftTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#DC2626" },
  emptyState: { alignItems: "center", gap: 12, paddingVertical: 60 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  openBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, marginTop: 8 },
  openBtnTxt: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  balanceCard: { borderRadius: 20, padding: 20 },
  balanceLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" },
  balanceAmount: { fontSize: 32, color: "#fff", fontFamily: "Inter_700Bold", marginTop: 4, marginBottom: 16 },
  balanceRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  balanceItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  balanceItemTxt: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular" },
  actionsRow: { flexDirection: "row", gap: 12 },
  actionBtn: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 16, borderRadius: 16 },
  actionBtnTxt: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyTxn: { textAlign: "center", fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 20 },
  txnCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  txnIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  txnTavsif: { fontSize: 14, fontFamily: "Inter_500Medium" },
  txnMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  txnAmount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  modalInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular" },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: "#F1F5F9" },
  toggleTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  catBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: "#E2E8F0" },
  catTxt: { fontSize: 12, fontFamily: "Inter_500Medium" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 14 },
  submitTxt: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
