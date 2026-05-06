import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Platform,
  Modal, Alert, KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";

const C = Colors.light;

interface StockMovement {
  id: number;
  productId: number;
  mahsulotNomi: string;
  tur: "kirim" | "chiqim" | "tuzatish";
  miqdor: number;
  birlik: string;
  avvalgiQoldiq: number;
  yangiQoldiq: number;
  sabab: string | null;
  createdAt: string;
}

interface OmborProduct {
  id: number;
  name: string;
  stock: number;
  minStock: number;
  unit: string;
  isLow: boolean;
}

const TUR_COLORS = {
  kirim: { bg: "#D1FAE5", text: "#059669", icon: "arrow-down-left" as const, label: "Kirim" },
  chiqim: { bg: "#FEE2E2", text: "#DC2626", icon: "arrow-up-right" as const, label: "Chiqim" },
  tuzatish: { bg: "#FEF3C7", text: "#D97706", icon: "edit-2" as const, label: "Tuzatish" },
};

function fmt(n: number, unit?: string): string {
  return `${parseFloat(n.toFixed(2))} ${unit ?? ""}`.trim();
}

function fmtDate(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" }) +
    " " + dt.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateFull(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString("uz-UZ", { day: "2-digit", month: "long", year: "numeric" }) +
    " " + dt.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

type Tab = "harakatlar" | "qoldiq";

export default function OmborHarakatiScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("harakatlar");
  const [search, setSearch] = useState("");
  const [selectedMv, setSelectedMv] = useState<StockMovement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedProd, setSelectedProd] = useState<OmborProduct | null>(null);
  const [prodForm, setProdForm] = useState({ name: "", stock: "", minStock: "" });
  const [prodSaving, setProdSaving] = useState(false);
  const [prodDeleting, setProdDeleting] = useState(false);
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  const { data: movements = [], isLoading: mvLoading } = useQuery<StockMovement[]>({
    queryKey: ["stock-movements"],
    queryFn: () => apiReq("/ombor/harakati"),
    enabled: activeTab === "harakatlar",
  });

  const { data: products = [], isLoading: prodLoading } = useQuery<OmborProduct[]>({
    queryKey: ["ombor-qoldiq"],
    queryFn: () => apiReq("/ombor/qoldiq"),
    enabled: activeTab === "qoldiq",
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["stock-movements"] }),
      qc.invalidateQueries({ queryKey: ["ombor-qoldiq"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  async function handleDelete(mv: StockMovement) {
    Alert.alert(
      "O'chirish",
      `"${mv.mahsulotNomi}" — ${fmt(mv.miqdor, mv.birlik)} ${mv.tur} o'chiriladi va qoldiq qaytariladi. Davom etasizmi?`,
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "O'chirish", style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await apiReq(`/ombor/harakati/${mv.id}`, { method: "DELETE" });
              await Promise.all([
                qc.invalidateQueries({ queryKey: ["stock-movements"] }),
                qc.invalidateQueries({ queryKey: ["ombor-qoldiq"] }),
              ]);
              setSelectedMv(null);
              Alert.alert("O'chirildi", "Harakat o'chirildi, qoldiq qaytarildi");
            } catch (e: any) {
              Alert.alert("Xato", e.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  function openProductEdit(p: OmborProduct) {
    setSelectedProd(p);
    setProdForm({ name: p.name, stock: String(p.stock), minStock: String(p.minStock) });
  }

  async function handleProductSave() {
    if (!selectedProd) return;
    if (!prodForm.name.trim()) { Alert.alert("Xato", "Nom kiriting"); return; }
    setProdSaving(true);
    try {
      await apiReq(`/products/${selectedProd.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: prodForm.name.trim(),
          stock: parseFloat(prodForm.stock) || 0,
          minStock: parseFloat(prodForm.minStock) || 0,
        }),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ombor-qoldiq"] }),
        qc.invalidateQueries({ queryKey: ["stock-movements"] }),
        qc.invalidateQueries({ queryKey: ["products-list"] }),
      ]);
      setSelectedProd(null);
      Alert.alert("Saqlandi", `"${prodForm.name}" yangilandi`);
    } catch (e: any) {
      Alert.alert("Xato", e.message);
    } finally { setProdSaving(false); }
  }

  function handleProductDelete() {
    if (!selectedProd) return;
    Alert.alert(
      "O'chirish",
      `"${selectedProd.name}" mahsulotni o'chirishni xohlaysizmi?`,
      [
        { text: "Bekor", style: "cancel" },
        {
          text: "O'chirish", style: "destructive",
          onPress: async () => {
            setProdDeleting(true);
            try {
              await apiReq(`/products/${selectedProd.id}`, { method: "DELETE" });
              await Promise.all([
                qc.invalidateQueries({ queryKey: ["ombor-qoldiq"] }),
                qc.invalidateQueries({ queryKey: ["stock-movements"] }),
                qc.invalidateQueries({ queryKey: ["products-list"] }),
              ]);
              setSelectedProd(null);
              Alert.alert("O'chirildi", `"${selectedProd.name}" o'chirildi`);
            } catch (e: any) {
              Alert.alert("Xato", e.message);
            } finally { setProdDeleting(false); }
          },
        },
      ]
    );
  }

  const filteredMovements = movements.filter(m =>
    m.mahsulotNomi.toLowerCase().includes(search.toLowerCase()) ||
    (m.sabab ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) && p.stock > 0
  );

  const lowStockCount = products.filter(p => p.isLow).length;

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: topPadding + 12 }]}>
        <Text style={[s.title, { color: C.text }]}>Ombor harakati</Text>
        {lowStockCount > 0 && (
          <View style={s.lowBadge}>
            <Feather name="alert-triangle" size={12} color="#D97706" />
            <Text style={s.lowBadgeTxt}>{lowStockCount} kam</Text>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { borderColor: C.border }]}>
        {(["harakatlar", "qoldiq"] as Tab[]).map(t => (
          <TouchableOpacity key={t} onPress={() => setActiveTab(t)}
            style={[s.tabBtn, activeTab === t && [s.tabBtnActive, { borderColor: C.primary }]]}>
            <Text style={[s.tabTxt, { color: activeTab === t ? C.primary : C.textSecondary }]}>
              {t === "harakatlar" ? "Harakatlar" : "Joriy qoldiq"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={[s.searchBox, { borderColor: C.border, backgroundColor: C.surface }]}>
        <Feather name="search" size={16} color={C.textSecondary} />
        <TextInput
          style={[s.searchInput, { color: C.text }]}
          placeholder="Qidirish..."
          placeholderTextColor={C.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x-circle" size={16} color={C.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {(mvLoading || prodLoading) && <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />}

        {activeTab === "harakatlar" && !mvLoading && (
          <>
            {filteredMovements.length === 0 && (
              <View style={s.emptyWrap}>
                <Feather name="inbox" size={40} color={C.textSecondary} />
                <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Harakatlar topilmadi</Text>
              </View>
            )}
            {filteredMovements.map(mv => {
              const clr = TUR_COLORS[mv.tur];
              return (
                <TouchableOpacity
                  key={mv.id}
                  style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}
                  onPress={() => setSelectedMv(mv)}
                  activeOpacity={0.7}
                >
                  <View style={[s.mvIcon, { backgroundColor: clr.bg }]}>
                    <Feather name={clr.icon} size={16} color={clr.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.mvName, { color: C.text }]}>{mv.mahsulotNomi}</Text>
                    <Text style={[s.mvSabab, { color: C.textSecondary }]} numberOfLines={1}>
                      {mv.sabab ?? mv.tur}
                    </Text>
                    <Text style={[s.mvDate, { color: C.textSecondary }]}>{fmtDate(mv.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[s.mvAmount, { color: clr.text }]}>
                      {mv.tur === "kirim" ? "+" : "-"}{fmt(mv.miqdor, mv.birlik)}
                    </Text>
                    <Text style={[s.mvQoldiq, { color: C.textSecondary }]}>
                      → {fmt(mv.yangiQoldiq, mv.birlik)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {activeTab === "qoldiq" && !prodLoading && (
          <>
            {filteredProducts.length === 0 && (
              <View style={s.emptyWrap}>
                <Feather name="package" size={40} color={C.textSecondary} />
                <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Mahsulotlar topilmadi</Text>
              </View>
            )}
            {filteredProducts.map(p => (
              <TouchableOpacity key={p.id} onPress={() => openProductEdit(p)} activeOpacity={0.7}
                style={[s.card, { backgroundColor: C.surface, borderColor: p.isLow ? "#FCA5A5" : C.border }]}>
                <View style={[s.mvIcon, { backgroundColor: p.isLow ? "#FEE2E2" : "#EFF6FF" }]}>
                  <Feather name="package" size={16} color={p.isLow ? "#DC2626" : C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.mvName, { color: C.text }]}>{p.name}</Text>
                  <Text style={[s.mvSabab, { color: C.textSecondary }]}>
                    Min. qoldiq: {fmt(p.minStock, p.unit)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[s.mvAmount, { color: p.isLow ? "#DC2626" : "#059669" }]}>
                    {fmt(p.stock, p.unit)}
                  </Text>
                  {p.isLow && (
                    <View style={s.lowTag}>
                      <Text style={s.lowTagTxt}>Kam!</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {/* Product Edit Modal */}
      <Modal visible={!!selectedProd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedProd(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[s.modalWrap, { backgroundColor: C.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: C.border }]}>
              <Text style={[s.modalTitle, { color: C.text }]}>Mahsulotni tahrirlash</Text>
              <TouchableOpacity onPress={() => setSelectedProd(null)}>
                <Feather name="x" size={24} color={C.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              <View>
                <Text style={[s.editLabel, { color: C.textSecondary }]}>Mahsulot nomi</Text>
                <TextInput
                  style={[s.editInput, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
                  value={prodForm.name}
                  onChangeText={v => setProdForm(f => ({ ...f, name: v }))}
                  placeholder="Nom"
                  placeholderTextColor={C.textSecondary}
                />
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.editLabel, { color: C.textSecondary }]}>Joriy qoldiq</Text>
                  <TextInput
                    style={[s.editInput, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
                    value={prodForm.stock}
                    onChangeText={v => setProdForm(f => ({ ...f, stock: v }))}
                    placeholder="0"
                    placeholderTextColor={C.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.editLabel, { color: C.textSecondary }]}>Minimal qoldiq</Text>
                  <TextInput
                    style={[s.editInput, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
                    value={prodForm.minStock}
                    onChangeText={v => setProdForm(f => ({ ...f, minStock: v }))}
                    placeholder="0"
                    placeholderTextColor={C.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Save */}
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: C.primary, opacity: prodSaving ? 0.6 : 1 }]}
                onPress={handleProductSave}
                disabled={prodSaving}
                activeOpacity={0.85}
              >
                {prodSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="check" size={16} color="#fff" />
                    <Text style={s.saveBtnTxt}>Saqlash</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity
                style={[s.deleteBtn, { opacity: prodDeleting ? 0.6 : 1 }]}
                onPress={handleProductDelete}
                disabled={prodDeleting}
                activeOpacity={0.85}
              >
                {prodDeleting ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <>
                    <Feather name="trash-2" size={16} color="#DC2626" />
                    <Text style={s.deleteBtnTxt}>Mahsulotni o'chirish</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!selectedMv} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedMv(null)}>
        {selectedMv && (() => {
          const clr = TUR_COLORS[selectedMv.tur];
          return (
            <View style={[s.modalWrap, { backgroundColor: C.background }]}>
              <View style={[s.modalHeader, { borderBottomColor: C.border }]}>
                <Text style={[s.modalTitle, { color: C.text }]}>Harakat tafsiloti</Text>
                <TouchableOpacity onPress={() => setSelectedMv(null)}>
                  <Feather name="x" size={24} color={C.text} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
                {/* Type badge */}
                <View style={[s.detailTypeBadge, { backgroundColor: clr.bg }]}>
                  <Feather name={clr.icon} size={20} color={clr.text} />
                  <Text style={[s.detailTypeText, { color: clr.text }]}>{clr.label}</Text>
                </View>

                {/* Info card */}
                <View style={[s.detailCard, { borderColor: C.border }]}>
                  <DetailRow label="Mahsulot" value={selectedMv.mahsulotNomi} />
                  <DetailRow label="Miqdor" value={fmt(selectedMv.miqdor, selectedMv.birlik)} valueColor={clr.text} />
                  <DetailRow label="Avvalgi qoldiq" value={fmt(selectedMv.avvalgiQoldiq, selectedMv.birlik)} />
                  <DetailRow label="Yangi qoldiq" value={fmt(selectedMv.yangiQoldiq, selectedMv.birlik)} />
                  {selectedMv.sabab && <DetailRow label="Sabab" value={selectedMv.sabab} />}
                  <DetailRow label="Sana" value={fmtDateFull(selectedMv.createdAt)} />
                </View>

                {/* Delete button */}
                <TouchableOpacity
                  style={[s.deleteBtn, { opacity: deleting ? 0.6 : 1 }]}
                  onPress={() => handleDelete(selectedMv)}
                  disabled={deleting}
                  activeOpacity={0.85}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <>
                      <Feather name="trash-2" size={16} color="#DC2626" />
                      <Text style={s.deleteBtnTxt}>Harakatni o'chirish</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={[s.deleteHint, { color: C.textSecondary }]}>
                  O'chirilganda mahsulot qoldig'i avtomatik qaytariladi
                </Text>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={[s.detailLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[s.detailValue, { color: valueColor || C.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  lowBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF3C7", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  lowBadgeTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#D97706" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 16, marginBottom: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderColor: "transparent" },
  tabBtnActive: {},
  tabTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  mvIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  mvName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  mvSabab: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  mvDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  mvAmount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  mvQoldiq: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyWrap: { alignItems: "center", gap: 10, paddingVertical: 60 },
  emptyTxt: { fontSize: 15, fontFamily: "Inter_400Regular" },
  lowTag: { backgroundColor: "#FEE2E2", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 3 },
  lowTagTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#DC2626" },

  modalWrap: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  detailTypeBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  detailTypeText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  detailCard: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  detailLabel: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  detailValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1 },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 14, borderRadius: 14,
    backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FECACA",
  },
  deleteBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#DC2626" },
  deleteHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },

  editLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  editInput: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 14, borderRadius: 14,
  },
  saveBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
