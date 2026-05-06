import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, RefreshControl, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import { useAuth } from "@/context/auth";

const C = Colors.light;

interface Expense {
  id: number; worker_id: number; amount: number;
  description: string; category: string; manba: string;
  period: string; created_at: string;
}

interface Summary {
  workerName: string; oylikStavka: number; salaryPaid: number;
  kassaDeductions: number; netRemaining: number; totalShaxsiy: number;
  currentPeriod: string;
}

const KATEGORIYALAR = [
  { id: "transport",  label: "Transport",  icon: "truck"        as const, color: "#F59E0B" },
  { id: "ovqat",      label: "Ovqat",      icon: "coffee"       as const, color: "#10B981" },
  { id: "instrument", label: "Instrument", icon: "tool"         as const, color: "#3B82F6" },
  { id: "material",   label: "Material",   icon: "package"      as const, color: "#8B5CF6" },
  { id: "boshqa",     label: "Boshqa",     icon: "more-horizontal" as const, color: "#64748B" },
];

const MANBA_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  shaxsiy:  { label: "Shaxsiy",  color: "#64748B", bg: "#F1F5F9" },
  kassadan: { label: "Kassadan", color: "#DC2626", bg: "#FEE2E2" },
};

function fmt(v: number) { return new Intl.NumberFormat("uz-UZ").format(Math.round(v)); }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("uz-UZ", { day: "numeric", month: "short" });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

export default function ShaxsiyXarajatlarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const workerId = user?.linkedWorkerId;

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("boshqa");
  const [manba, setManba] = useState<"shaxsiy" | "kassadan">("shaxsiy");

  const wid = workerId ? `?workerId=${workerId}` : "";

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<Summary>({
    queryKey: ["worker-expenses-summary", workerId],
    queryFn: () => apiReq(`/worker-panel/expenses/summary${wid}`),
    enabled: !!workerId,
  });

  const { data: expensesData, isLoading: expensesLoading, refetch: refetchExpenses } = useQuery<{ expenses: Expense[] }>({
    queryKey: ["worker-expenses", workerId],
    queryFn: () => apiReq(`/worker-panel/expenses${wid}`),
    enabled: !!workerId,
  });

  const expenses = expensesData?.expenses || [];

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchExpenses()]);
    setRefreshing(false);
  }

  async function handleSubmit() {
    if (!amount || !description) { Alert.alert("Xato", "Summa va tavsif kiriting"); return; }
    setLoading(true);
    try {
      await apiReq("/worker-panel/expenses", {
        method: "POST",
        body: JSON.stringify({ workerId, amount: Number(amount), description, category, manba }),
      });
      setShowModal(false);
      setAmount(""); setDescription(""); setCategory("boshqa"); setManba("shaxsiy");
      qc.invalidateQueries({ queryKey: ["worker-expenses"] });
      qc.invalidateQueries({ queryKey: ["worker-expenses-summary"] });
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Xarajat qo'shib bo'lmadi");
    } finally { setLoading(false); }
  }

  if (!workerId) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 60, alignItems: "center" }]}>
        <Feather name="alert-circle" size={48} color={C.textSecondary} />
        <Text style={{ color: C.textSecondary, marginTop: 12, fontSize: 16 }}>
          Xodim profili topilmadi
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>Orqaga</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLoading = summaryLoading || expensesLoading;

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBack}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Shaxsiy xarajatlar</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        >
          {/* Salary Card */}
          {summary && (
            <View style={s.salaryCard}>
              <Text style={s.salaryTitle}>Oylik ma'lumotlar</Text>
              <View style={s.salaryRow}>
                <View style={s.salaryItem}>
                  <Text style={s.salaryLabel}>Oylik stavka</Text>
                  <Text style={s.salaryValue}>{fmt(summary.oylikStavka)}</Text>
                </View>
                <View style={s.salaryItem}>
                  <Text style={s.salaryLabel}>To'langan</Text>
                  <Text style={[s.salaryValue, { color: "#10B981" }]}>{fmt(summary.salaryPaid)}</Text>
                </View>
              </View>
              <View style={s.salaryRow}>
                <View style={s.salaryItem}>
                  <Text style={s.salaryLabel}>Kassadan olingan</Text>
                  <Text style={[s.salaryValue, { color: "#DC2626" }]}>{fmt(summary.kassaDeductions)}</Text>
                </View>
                <View style={s.salaryItem}>
                  <Text style={s.salaryLabel}>Qolgan</Text>
                  <Text style={[s.salaryValue, { color: "#4F46E5", fontSize: 20 }]}>{fmt(summary.netRemaining)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Add Button */}
          <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={s.addBtnText}>Xarajat qo'shish</Text>
          </TouchableOpacity>

          {/* Expense List */}
          <Text style={s.sectionTitle}>Xarajatlar tarixi</Text>
          {expenses.length === 0 ? (
            <View style={s.empty}>
              <Feather name="inbox" size={36} color={C.textSecondary} />
              <Text style={s.emptyText}>Xarajatlar yo'q</Text>
            </View>
          ) : (
            expenses.map(exp => {
              const kat = KATEGORIYALAR.find(k => k.id === exp.category) || KATEGORIYALAR[4];
              const m = MANBA_LABELS[exp.manba] || MANBA_LABELS.shaxsiy;
              return (
                <View key={exp.id} style={s.expenseCard}>
                  <View style={[s.expenseIcon, { backgroundColor: kat.color + "18" }]}>
                    <Feather name={kat.icon} size={16} color={kat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.expenseDesc} numberOfLines={1}>{exp.description}</Text>
                    <Text style={s.expenseDate}>{fmtDate(exp.created_at)} {fmtTime(exp.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={s.expenseAmount}>-{fmt(exp.amount)}</Text>
                    <View style={[s.manbaBadge, { backgroundColor: m.bg }]}>
                      <Text style={[s.manbaBadgeText, { color: m.color }]}>{m.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add Expense Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Yangi xarajat</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={22} color={C.text} />
              </TouchableOpacity>
            </View>

            {/* Manba selector */}
            <Text style={s.fieldLabel}>Manba</Text>
            <View style={s.manbaRow}>
              <TouchableOpacity
                style={[s.manbaBtn, manba === "shaxsiy" && s.manbaBtnActive]}
                onPress={() => setManba("shaxsiy")}
              >
                <Feather name="wallet" size={16} color={manba === "shaxsiy" ? "#fff" : C.text} />
                <Text style={[s.manbaBtnText, manba === "shaxsiy" && { color: "#fff" }]}>Shaxsiy pul</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.manbaBtn, manba === "kassadan" && s.manbaBtnKassa]}
                onPress={() => setManba("kassadan")}
              >
                <Feather name="archive" size={16} color={manba === "kassadan" ? "#fff" : C.text} />
                <Text style={[s.manbaBtnText, manba === "kassadan" && { color: "#fff" }]}>Kassadan</Text>
              </TouchableOpacity>
            </View>

            {manba === "kassadan" && (
              <View style={s.warningBox}>
                <Feather name="alert-triangle" size={14} color="#92400E" />
                <Text style={s.warningText}>Bu summa kassadan chiqim sifatida yoziladi va oyligingizdan ushlab qolinadi</Text>
              </View>
            )}

            {/* Category */}
            <Text style={s.fieldLabel}>Kategoriya</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {KATEGORIYALAR.map(k => (
                <TouchableOpacity
                  key={k.id}
                  style={[s.catChip, category === k.id && { backgroundColor: k.color, borderColor: k.color }]}
                  onPress={() => setCategory(k.id)}
                >
                  <Feather name={k.icon} size={13} color={category === k.id ? "#fff" : k.color} />
                  <Text style={[s.catChipText, category === k.id && { color: "#fff" }]}>{k.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Amount */}
            <Text style={s.fieldLabel}>Summa</Text>
            <TextInput
              style={s.input}
              placeholder="0"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholderTextColor={C.textSecondary}
            />

            {/* Description */}
            <Text style={s.fieldLabel}>Tavsif</Text>
            <TextInput
              style={s.input}
              placeholder="Nima uchun?"
              value={description}
              onChangeText={setDescription}
              placeholderTextColor={C.textSecondary}
            />

            <TouchableOpacity
              style={[s.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={s.submitBtnText}>Saqlash</Text>
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
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: "#4F46E5",
  },
  headerBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },

  salaryCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: "#E2E8F0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  salaryTitle: { fontSize: 14, fontWeight: "600", color: C.text, marginBottom: 12 },
  salaryRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  salaryItem: { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10 },
  salaryLabel: { fontSize: 11, color: C.textSecondary, marginBottom: 2 },
  salaryValue: { fontSize: 16, fontWeight: "700", color: C.text },

  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#4F46E5", borderRadius: 12, paddingVertical: 13, marginBottom: 20,
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  backBtn: {
    marginTop: 20, backgroundColor: "#4F46E5", paddingHorizontal: 24,
    paddingVertical: 10, borderRadius: 10,
  },

  sectionTitle: { fontSize: 15, fontWeight: "600", color: C.text, marginBottom: 10 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { marginTop: 8, color: C.textSecondary, fontSize: 14 },

  expenseCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: "#F1F5F9",
  },
  expenseIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  expenseDesc: { fontSize: 14, fontWeight: "500", color: C.text },
  expenseDate: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
  expenseAmount: { fontSize: 14, fontWeight: "700", color: "#DC2626" },
  manbaBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 3 },
  manbaBadgeText: { fontSize: 10, fontWeight: "600" },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: C.text },

  fieldLabel: { fontSize: 13, fontWeight: "600", color: C.text, marginBottom: 6 },
  manbaRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  manbaBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#E2E8F0",
  },
  manbaBtnActive: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  manbaBtnKassa: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  manbaBtnText: { fontSize: 13, fontWeight: "600", color: C.text },

  warningBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A",
    borderRadius: 10, padding: 10, marginBottom: 12,
  },
  warningText: { flex: 1, fontSize: 12, color: "#92400E", lineHeight: 16 },

  catChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#E2E8F0",
    marginRight: 8,
  },
  catChipText: { fontSize: 12, fontWeight: "600", color: C.text },

  input: {
    borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
    color: C.text, marginBottom: 12, backgroundColor: "#F8FAFC",
  },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#4F46E5", borderRadius: 12, paddingVertical: 14, marginTop: 4,
  },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
