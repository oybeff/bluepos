import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, RefreshControl, Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import { fmtDate, fmtTime as fmtTimeUtil, fmtNum } from "../../lib/date-utils";

const C = Colors.light;

interface Txn {
  id: number; type: string; amount: number;
  description: string; category: string; createdAt: string;
}

const KATEGORIYALAR = [
  { id: "ijara",    label: "Ijara",    icon: "home"         as const, color: "#8B5CF6" },
  { id: "transport",label: "Transport", icon: "truck"        as const, color: "#F59E0B" },
  { id: "ish_haqi", label: "Ish haqi", icon: "users"        as const, color: "#3B82F6" },
  { id: "kommunal", label: "Kommunal", icon: "zap"          as const, color: "#10B981" },
  { id: "boshqa",   label: "Boshqa",   icon: "more-horizontal"as const, color: "#64748B" },
];

function sum(v: number) { return fmtNum(Math.round(v)) + " so'm"; }
function fmtTime(d: string) { return fmtTimeUtil(d); }
function today() { return fmtDate(new Date(), { month: "long", year: true }); }

export default function RasxodlarScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 90);

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("boshqa");

  const { data: todayTxns = [], isLoading } = useQuery<Txn[]>({
    queryKey: ["rasxodlar-today"],
    queryFn: () => apiReq<Txn[]>("/finance/transactions?period=today&type=expense"),
    retry: false,
  });

  const { data: monthTxns = [] } = useQuery<Txn[]>({
    queryKey: ["rasxodlar-month"],
    queryFn: () => apiReq<Txn[]>("/finance/transactions?period=month&type=expense"),
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["rasxodlar-today"] }),
      qc.invalidateQueries({ queryKey: ["rasxodlar-month"] }),
      qc.invalidateQueries({ queryKey: ["finance-today"] }),
      qc.invalidateQueries({ queryKey: ["finance-month"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const todayTotal = todayTxns.reduce((s, t) => s + t.amount, 0);
  const monthTotal = monthTxns.reduce((s, t) => s + t.amount, 0);

  const resetForm = () => { setAmount(""); setDescription(""); setCategory("boshqa"); };

  const handleDelete = async (id: number) => {
    Alert.alert("O'chirish", "Bu rasxodni o'chirmoqchimisiz?", [
      { text: "Bekor", style: "cancel" },
      { text: "O'chirish", style: "destructive", onPress: async () => {
        try {
          await apiReq(`/finance/transactions/${id}`, { method: "DELETE" });
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["rasxodlar-today"] }),
            qc.invalidateQueries({ queryKey: ["rasxodlar-month"] }),
            qc.invalidateQueries({ queryKey: ["finance-today"] }),
            qc.invalidateQueries({ queryKey: ["finance-month"] }),
            qc.invalidateQueries({ queryKey: ["worker-expenses"] }),
            qc.invalidateQueries({ queryKey: ["worker-expenses-summary"] }),
          ]);
        } catch { Alert.alert("Xato", "O'chirib bo'lmadi"); }
      }},
    ]);
  };

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert("Xato", "Summa kiriting"); return; }
    if (!description.trim()) { Alert.alert("Xato", "Tavsif kiriting"); return; }

    setLoading(true);
    try {
      await apiReq("/finance/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: amt,
          description: description.trim(),
          category,
        }),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["rasxodlar-today"] }),
        qc.invalidateQueries({ queryKey: ["rasxodlar-month"] }),
        qc.invalidateQueries({ queryKey: ["finance-today"] }),
        qc.invalidateQueries({ queryKey: ["finance-month"] }),
      ]);
      setShowModal(false);
      resetForm();
    } catch { Alert.alert("Xato", "Server xatosi"); }
    finally { setLoading(false); }
  };

  const katCfg = (id: string) => KATEGORIYALAR.find(k => k.id === id) ?? KATEGORIYALAR[4];

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* ─── Header ─────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: topPadding + 10, borderBottomColor: C.border }]}>
        <View>
          <Text style={[s.headerTitle, { color: C.text }]}>Rasxodlar</Text>
          <Text style={[s.headerDate, { color: C.textSecondary }]}>{today()}</Text>
        </View>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: "#EF4444" }]}
          onPress={() => setShowModal(true)}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={s.addBtnTxt}>Qo'shish</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Jami kartalar ─────────────────────────────────────── */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={[s.sumCard, { flex: 1, backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Feather name="sun" size={18} color="#EF4444" />
            <Text style={[s.sumVal, { color: "#DC2626" }]}>{sum(todayTotal)}</Text>
            <Text style={[s.sumLbl, { color: "#EF4444" }]}>Bugungi chiqim</Text>
          </View>
          <View style={[s.sumCard, { flex: 1, backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
            <Feather name="calendar" size={18} color="#F59E0B" />
            <Text style={[s.sumVal, { color: "#D97706" }]}>{sum(monthTotal)}</Text>
            <Text style={[s.sumLbl, { color: "#F59E0B" }]}>Bu oylik chiqim</Text>
          </View>
        </View>

        {/* ─── Kategoriyalar ─────────────────────────────────────── */}
        <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.sectionTitle, { color: C.textSecondary }]}>Bu oylik kategoriyalar</Text>
          {KATEGORIYALAR.map(kat => {
            const kat_total = monthTxns.filter(t => t.category === kat.id).reduce((s, t) => s + t.amount, 0);
            if (!kat_total) return null;
            const pct = monthTotal > 0 ? (kat_total / monthTotal) * 100 : 0;
            return (
              <View key={kat.id} style={{ gap: 5 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[s.katIcon, { backgroundColor: kat.color + "18" }]}>
                      <Feather name={kat.icon} size={13} color={kat.color} />
                    </View>
                    <Text style={[s.katName, { color: C.text }]}>{kat.label}</Text>
                  </View>
                  <Text style={[s.katAmt, { color: C.text }]}>{sum(kat_total)}</Text>
                </View>
                <View style={[s.progBg, { backgroundColor: C.border }]}>
                  <View style={[s.progFill, { width: `${pct}%` as any, backgroundColor: kat.color }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── Bugungi rasxodlar ─────────────────────────────────── */}
        <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.sectionTitle, { color: C.textSecondary }]}>Bugungi rasxodlar</Text>
          {isLoading && <ActivityIndicator color={C.primary} style={{ paddingVertical: 16 }} />}
          {!isLoading && todayTxns.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
              <Feather name="check-circle" size={32} color="#10B981" />
              <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Bugun rasxod yo'q</Text>
            </View>
          )}
          <View style={{ gap: 6 }}>
            {todayTxns.map(t => {
              const kat = katCfg(t.category);
              return (
                <TouchableOpacity key={t.id} style={[s.txnRow, { backgroundColor: C.surface, borderColor: C.border }]} activeOpacity={0.7} onPress={() => handleDelete(t.id)}>
                  <View style={[s.katIcon, { backgroundColor: kat.color + "18" }]}>
                    <Feather name={kat.icon} size={14} color={kat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.txnDesc, { color: C.text }]} numberOfLines={1}>{t.description}</Text>
                    <Text style={[s.txnTime, { color: C.textSecondary }]}>{fmtTime(t.createdAt)}</Text>
                  </View>
                  <Text style={[s.txnAmt, { color: "#EF4444" }]}>-{sum(t.amount)}</Text>
                  <Feather name="trash-2" size={15} color="#94A3B8" />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ─── Modal ──────────────────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={s.modalWrap}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowModal(false)} />
            <ScrollView
              bounces={false}
              contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[s.sheet, { backgroundColor: C.card }]}>
                <View style={s.sheetHandle} />
                <Text style={[s.sheetTitle, { color: C.text }]}>Yangi rasxod</Text>

                {/* Kategoriya */}
                <Text style={[s.fieldLbl, { color: C.textSecondary }]}>Kategoriya</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {KATEGORIYALAR.map(k => (
                      <TouchableOpacity
                        key={k.id}
                        style={[s.katChip, {
                          borderColor: category === k.id ? k.color : C.border,
                          backgroundColor: category === k.id ? k.color + "15" : C.surface,
                        }]}
                        onPress={() => setCategory(k.id)}
                      >
                        <Feather name={k.icon} size={13} color={category === k.id ? k.color : C.textSecondary} />
                        <Text style={[s.katChipTxt, { color: category === k.id ? k.color : C.textSecondary }]}>
                          {k.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Summa */}
                <Text style={[s.fieldLbl, { color: C.textSecondary }]}>Summa (so'm)</Text>
                <TextInput
                  style={[s.input, { borderColor: C.border, color: C.text, backgroundColor: C.surface }]}
                  value={amount} onChangeText={setAmount}
                  placeholder="Masalan: 50 000" placeholderTextColor={C.textSecondary}
                  keyboardType="decimal-pad"
                />

                {/* Tavsif */}
                <Text style={[s.fieldLbl, { color: C.textSecondary }]}>Tavsif</Text>
                <TextInput
                  style={[s.input, { borderColor: C.border, color: C.text, backgroundColor: C.surface }]}
                  value={description} onChangeText={setDescription}
                  placeholder="Masalan: Oylik ijara to'lovi" placeholderTextColor={C.textSecondary}
                />

                <TouchableOpacity
                  style={[s.submitBtn, { backgroundColor: "#EF4444", opacity: loading ? 0.7 : 1 }]}
                  onPress={handleAdd} disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <><Feather name="check" size={18} color="#fff" /><Text style={s.submitTxt}>Saqlash</Text></>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1 },
  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle:{ fontSize: 22, fontFamily: "Inter_700Bold" },
  headerDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  addBtnTxt:  { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  sumCard:    { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6, alignItems: "center" },
  sumVal:     { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  sumLbl:     { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },

  section:    { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  sectionTitle:{ fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },

  katIcon:    { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  katName:    { fontSize: 13, fontFamily: "Inter_500Medium" },
  katAmt:     { fontSize: 13, fontFamily: "Inter_700Bold" },
  progBg:     { height: 4, borderRadius: 2, overflow: "hidden" },
  progFill:   { height: 4, borderRadius: 2 },

  txnRow:     { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12 },
  txnDesc:    { fontSize: 13, fontFamily: "Inter_500Medium" },
  txnTime:    { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  txnAmt:     { fontSize: 13, fontFamily: "Inter_700Bold" },
  emptyTxt:   { fontSize: 13, fontFamily: "Inter_400Regular" },

  modalWrap:  { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  backdrop:   { flex: 1 },
  sheet:      { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 4 },
  sheetHandle:{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 16 },
  fieldLbl:   { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input:      { height: 46, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 12 },
  katChip:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
  katChipTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  submitBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 14, marginTop: 8 },
  submitTxt:  { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
