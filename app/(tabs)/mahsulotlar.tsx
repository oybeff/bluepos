import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Modal,
  ScrollView, Alert, KeyboardAvoidingView, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { apiReq } from "@/lib/api";

const C = Colors.light;
const fmt = (n: number) => new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";

interface Category {
  id: string;
  key: string;
  name: string;
  emoji: string;
  isDefault: boolean;
  isAll?: boolean;
  dbId?: number;
}

interface Product {
  id: number;
  name: string;
  category: string;
  unit: string;
  barcode: string | null;
  buyingPrice: number;
  buyingPricePachka: number;
  pricePerUnit: number;
  stock: number;
  minStock: number;
  description: string | null;
  pachkaHajmi: number;
  uzunlik: number;
  rang: string | null;
  material: string | null;
}

const UNITS = [
  { value: "metr", label: "Metr (m)" },
  { value: "dona", label: "Dona (pcs)" },
  { value: "juft", label: "Juft (pair)" },
  { value: "paket", label: "Paket" },
  { value: "rulon", label: "Rulon" },
];


// ─── Add Category Modal ─────────────────────────────────────────────────────
const EMOJI_OPTIONS = ["📦", "🎭", "🪟", "🧵", "🏠", "📏", "🔵", "⬜", "〓", "≡",
  "🌸", "🔩", "📎", "🎀", "🛋️", "🔧", "⚙️", "🏷️", "📐", "🎨", "✂️", "🌀", "🎯", "💡"];

function AddCategoryModal({ visible, onClose, onSaved }: {
  visible: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { Alert.alert("Xato", "Kategoriya nomini kiriting"); return; }
    setSaving(true);
    try {
      await apiReq("/categories", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), emoji }),
      });
      setName("");
      setEmoji("📦");
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Saqlashda xato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[catModalStyles.container, { backgroundColor: C.background }]}>
        <View style={[catModalStyles.header, { borderBottomColor: C.border }]}>
          <Text style={[catModalStyles.title, { color: C.text }]}>Yangi kategoriya</Text>
          <TouchableOpacity onPress={onClose} style={catModalStyles.closeBtn}>
            <Feather name="x" size={22} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={catModalStyles.body} contentContainerStyle={{ gap: 16 }}>
          <View>
            <Text style={[catModalStyles.label, { color: C.textSecondary }]}>Kategoriya nomi *</Text>
            <TextInput
              style={[catModalStyles.input, { backgroundColor: C.card, borderColor: C.border, color: C.text }]}
              value={name}
              onChangeText={setName}
              placeholder="Masalan: Rolikli shtora, Setka parda..."
              placeholderTextColor={C.textSecondary}
              autoFocus
            />
          </View>

          <View>
            <Text style={[catModalStyles.label, { color: C.textSecondary }]}>Emoji belgisi</Text>
            <View style={catModalStyles.emojiGrid}>
              {EMOJI_OPTIONS.map(e => (
                <TouchableOpacity
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={[catModalStyles.emojiBtn, emoji === e && { backgroundColor: C.primary + "20", borderColor: C.primary }]}
                >
                  <Text style={catModalStyles.emoji}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[catModalStyles.previewBox, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[catModalStyles.previewLabel, { color: C.textSecondary }]}>Ko'rinish:</Text>
            <View style={catModalStyles.previewRow}>
              <Text style={catModalStyles.previewEmoji}>{emoji}</Text>
              <Text style={[catModalStyles.previewName, { color: C.text }]}>
                {name || "Kategoriya nomi"}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={[catModalStyles.footer, { borderTopColor: C.border }]}>
          <TouchableOpacity onPress={onClose} style={[catModalStyles.cancelBtn, { borderColor: C.border }]}>
            <Text style={[catModalStyles.cancelText, { color: C.textSecondary }]}>Bekor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !name.trim()}
            style={[catModalStyles.saveBtn, { backgroundColor: C.primary, opacity: saving || !name.trim() ? 0.5 : 1 }]}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={catModalStyles.saveBtnText}>Yaratish</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const catModalStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  closeBtn: { padding: 4 },
  body: { flex: 1, padding: 20 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiBtn: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  emoji: { fontSize: 24 },
  previewBox: { borderRadius: 12, borderWidth: 1, padding: 14 },
  previewLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  previewEmoji: { fontSize: 28 },
  previewName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  footer: { flexDirection: "row", gap: 12, padding: 20, borderTopWidth: 1 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  saveBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

// ─── Add Product Modal ──────────────────────────────────────────────────────
function AddProductModal({ visible, categories, onClose, onSaved }: {
  visible: boolean; categories: Category[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "", category: "", unit: "metr", barcode: "",
    buyingPrice: "", pricePerUnit: "", stock: "", minStock: "",
    description: "", pachkaHajmi: "1", rang: "", material: "",
  });
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"basic" | "prices">("basic");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const selectableCats = categories.filter(c => !c.isAll);

  function resetForm() {
    setForm({ name: "", category: "", unit: "metr", barcode: "", buyingPrice: "", pricePerUnit: "", stock: "", minStock: "", description: "", pachkaHajmi: "1", rang: "", material: "" });
    setStep("basic");
  }

  async function handleSave() {
    if (!form.name.trim()) { Alert.alert("Xato", "Mahsulot nomini kiriting"); return; }
    if (!form.pricePerUnit) { Alert.alert("Xato", "Sotish narxini kiriting"); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        category: form.category || (selectableCats[0]?.key || "accessory"),
        unit: form.unit,
        barcode: form.barcode || undefined,
        buyingPrice: parseFloat(form.buyingPrice) || 0,
        pricePerUnit: parseFloat(form.pricePerUnit),
        stock: parseFloat(form.stock) || 0,
        minStock: parseFloat(form.minStock) || 0,
        description: form.description || undefined,
        pachkaHajmi: parseFloat(form.pachkaHajmi) || 1,
        rang: form.rang || undefined,
        material: form.material || undefined,
      };
      await apiReq("/products", { method: "POST", body: JSON.stringify(body) });
      Alert.alert("Muvaffaqiyat", `"${form.name}" mahsulot qo'shildi ✓`);
      resetForm();
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Saqlashda xato");
    } finally {
      setSaving(false);
    }
  }

  const inp = [addStyles.input, { backgroundColor: C.card, borderColor: C.border, color: C.text }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[addStyles.container, { backgroundColor: C.background }]}>
          <View style={[addStyles.header, { borderBottomColor: C.border }]}>
            <Text style={[addStyles.title, { color: C.text }]}>Yangi mahsulot qo'shish</Text>
            <TouchableOpacity onPress={() => { resetForm(); onClose(); }}>
              <Feather name="x" size={22} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Step tabs */}
          <View style={[addStyles.stepRow, { backgroundColor: C.surface }]}>
            {([
              { key: "basic", label: "1. Asosiy" },
              { key: "prices", label: "2. Narx/Zaxira" },
            ] as const).map(s => (
              <TouchableOpacity
                key={s.key}
                onPress={() => setStep(s.key)}
                style={[addStyles.stepBtn, step === s.key && { backgroundColor: C.primary }]}
              >
                <Text style={[addStyles.stepText, { color: step === s.key ? "#fff" : C.textSecondary }]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={addStyles.body}>
            {step === "basic" ? (
              <>
                <View>
                  <Text style={[addStyles.label, { color: C.textSecondary }]}>Mahsulot nomi *</Text>
                  <TextInput style={inp} value={form.name} onChangeText={v => set("name", v)}
                    placeholder="Masalan: Baget Classic 3m oq" placeholderTextColor={C.textSecondary} autoFocus />
                </View>

                <View>
                  <Text style={[addStyles.label, { color: C.textSecondary }]}>Kategoriya</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {selectableCats.map(cat => (
                        <TouchableOpacity
                          key={cat.key}
                          onPress={() => set("category", cat.key)}
                          style={[addStyles.catChip, {
                            backgroundColor: form.category === cat.key ? C.primary : C.card,
                            borderColor: form.category === cat.key ? C.primary : C.border,
                          }]}
                        >
                          <Text style={addStyles.catChipEmoji}>{cat.emoji}</Text>
                          <Text style={[addStyles.catChipText, { color: form.category === cat.key ? "#fff" : C.text }]}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={addStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[addStyles.label, { color: C.textSecondary }]}>O'lchov birligi</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {UNITS.map(u => (
                          <TouchableOpacity key={u.value} onPress={() => set("unit", u.value)}
                            style={[addStyles.unitChip, {
                              backgroundColor: form.unit === u.value ? C.primary : C.card,
                              borderColor: form.unit === u.value ? C.primary : C.border,
                            }]}>
                            <Text style={[addStyles.unitText, { color: form.unit === u.value ? "#fff" : C.text }]}>
                              {u.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </View>

                <View style={addStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[addStyles.label, { color: C.textSecondary }]}>Rang</Text>
                    <TextInput style={inp} value={form.rang} onChangeText={v => set("rang", v)}
                      placeholder="Oq, bronza..." placeholderTextColor={C.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[addStyles.label, { color: C.textSecondary }]}>Material</Text>
                    <TextInput style={inp} value={form.material} onChangeText={v => set("material", v)}
                      placeholder="PVC, Metall..." placeholderTextColor={C.textSecondary} />
                  </View>
                </View>

                <View>
                  <Text style={[addStyles.label, { color: C.textSecondary }]}>Barcode (ixtiyoriy)</Text>
                  <TextInput style={[inp, { fontFamily: "Inter_400Regular" }]}
                    value={form.barcode} onChangeText={v => set("barcode", v)}
                    placeholder="869XXXXXXXXXX" placeholderTextColor={C.textSecondary}
                    keyboardType="number-pad" />
                </View>

                <View>
                  <Text style={[addStyles.label, { color: C.textSecondary }]}>Izoh</Text>
                  <TextInput style={[inp, { height: 70 }]}
                    value={form.description} onChangeText={v => set("description", v)}
                    placeholder="Qo'shimcha ma'lumot..." placeholderTextColor={C.textSecondary}
                    multiline />
                </View>
              </>
            ) : (
              <>
                <View style={[addStyles.priceCard, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Feather name="tag" size={16} color={C.primary} />
                    <Text style={[addStyles.cardTitle, { color: C.text }]}>Narxlar</Text>
                  </View>
                  <View style={addStyles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[addStyles.label, { color: C.textSecondary }]}>Xarid narxi (so'm)</Text>
                      <TextInput style={inp} value={form.buyingPrice} onChangeText={v => set("buyingPrice", v)}
                        placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[addStyles.label, { color: C.textSecondary }]}>Sotish narxi * (so'm)</Text>
                      <TextInput style={[inp, { borderColor: C.primary }]}
                        value={form.pricePerUnit} onChangeText={v => set("pricePerUnit", v)}
                        placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
                    </View>
                  </View>
                  {parseFloat(form.buyingPrice) > 0 && parseFloat(form.pricePerUnit) > 0 && (
                    <View style={[addStyles.marginBadge, { backgroundColor: "#10B98115" }]}>
                      <Feather name="trending-up" size={14} color="#10B981" />
                      <Text style={[addStyles.marginText, { color: "#10B981" }]}>
                        Foyda: +{Math.round(((parseFloat(form.pricePerUnit) - parseFloat(form.buyingPrice)) / parseFloat(form.buyingPrice)) * 100)}%
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[addStyles.priceCard, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Feather name="package" size={16} color="#F59E0B" />
                    <Text style={[addStyles.cardTitle, { color: C.text }]}>Zaxira</Text>
                  </View>
                  <View style={addStyles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[addStyles.label, { color: C.textSecondary }]}>Joriy zaxira ({form.unit})</Text>
                      <TextInput style={inp} value={form.stock} onChangeText={v => set("stock", v)}
                        placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[addStyles.label, { color: C.textSecondary }]}>Minimal zaxira</Text>
                      <TextInput style={inp} value={form.minStock} onChangeText={v => set("minStock", v)}
                        placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <Text style={[addStyles.label, { color: C.textSecondary }]}>1 pachkada nechta dona</Text>
                    <TextInput style={inp} value={form.pachkaHajmi} onChangeText={v => set("pachkaHajmi", v)}
                      placeholder="1" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          <View style={[addStyles.footer, { borderTopColor: C.border }]}>
            {step === "basic" ? (
              <>
                <TouchableOpacity onPress={() => { resetForm(); onClose(); }}
                  style={[addStyles.cancelBtn, { borderColor: C.border }]}>
                  <Text style={[addStyles.cancelText, { color: C.textSecondary }]}>Bekor</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep("prices")}
                  style={[addStyles.nextBtn, { backgroundColor: C.primary }]}>
                  <Text style={addStyles.nextText}>Keyingi →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setStep("basic")}
                  style={[addStyles.cancelBtn, { borderColor: C.border }]}>
                  <Text style={[addStyles.cancelText, { color: C.textSecondary }]}>← Orqaga</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={saving}
                  style={[addStyles.nextBtn, { backgroundColor: "#10B981", opacity: saving ? 0.7 : 1 }]}>
                  {saving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={addStyles.nextText}>✓ Saqlash</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const addStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  stepRow: { flexDirection: "row", margin: 16, borderRadius: 12, padding: 4, gap: 4 },
  stepBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  stepText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  body: { padding: 16, gap: 14 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", gap: 12 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  catChipEmoji: { fontSize: 16 },
  catChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  unitChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  unitText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  priceCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  marginBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, padding: 8, borderRadius: 8 },
  marginText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  footer: { flexDirection: "row", gap: 12, padding: 16, borderTopWidth: 1 },
  cancelBtn: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  nextBtn: { flex: 1, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nextText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

// ─── Main Products Screen ───────────────────────────────────────────────────
export default function MahsulotlarScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: categories = [], refetch: refetchCats } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => apiReq("/categories"),
  });

  const { data: rawProducts, isLoading, refetch: refetchProducts } = useQuery<{ products?: Product[] } | Product[]>({
    queryKey: ["products-list"],
    queryFn: () => apiReq<{ products?: Product[] } | Product[]>("/products?limit=500"),
  });

  const products: Product[] = Array.isArray(rawProducts)
    ? rawProducts
    : ((rawProducts as { products?: Product[] })?.products ?? []);

  const getCatInfo = (key: string) => {
    const cat = categories.find(c => c.key === key);
    return { name: cat?.name || key, emoji: cat?.emoji || "📦" };
  };

  const catCount: Record<string, number> = { all: products.length };
  products.forEach(p => { catCount[p.category] = (catCount[p.category] || 0) + 1; });

  const filtered = products.filter(p => {
    const matchCat = catFilter === "all" || p.category === catFilter;
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode || "").includes(search) ||
      (p.rang || "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const lowStockCount = products.filter(p => p.minStock > 0 && p.stock <= p.minStock).length;

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refetchCats(), refetchProducts()]);
    setRefreshing(false);
  }

  function onCatSaved() {
    qc.invalidateQueries({ queryKey: ["categories"] });
    refetchCats();
  }

  function onProductSaved() {
    qc.invalidateQueries({ queryKey: ["products-list"] });
    refetchProducts();
  }

  const renderProduct = ({ item: p }: { item: Product }) => {
    const isLow = p.minStock > 0 && p.stock <= p.minStock;
    const isOut = p.stock <= 0;
    const catInfo = getCatInfo(p.category);
    const margin = p.buyingPrice > 0 ? Math.round(((p.pricePerUnit - p.buyingPrice) / p.buyingPrice) * 100) : null;

    return (
      <View style={[styles.productCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.productTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.productName, { color: C.text }]} numberOfLines={1}>{p.name}</Text>
            <View style={styles.productMeta}>
              <Text style={styles.catChip}>{catInfo.emoji} {catInfo.name}</Text>
              {p.rang && <Text style={[styles.metaTag, { color: C.textSecondary }]}>{p.rang}</Text>}
              {p.material && <Text style={[styles.metaTag, { color: C.textSecondary }]}>{p.material}</Text>}
            </View>
          </View>
          {(isLow || isOut) && (
            <View style={[styles.alertBadge, { backgroundColor: isOut ? "#FEE2E2" : "#FEF3C7" }]}>
              <Feather name="alert-triangle" size={12} color={isOut ? "#EF4444" : "#F59E0B"} />
            </View>
          )}
        </View>

        <View style={styles.productStats}>
          <View style={[styles.statBox, { backgroundColor: isOut ? "#FEF2F2" : isLow ? "#FFFBEB" : "#ECFDF5" }]}>
            <Text style={[styles.statVal, { color: isOut ? "#EF4444" : isLow ? "#F59E0B" : "#10B981" }]}>
              {new Intl.NumberFormat("uz-UZ").format(p.stock)} {p.unit}
            </Text>
            <Text style={[styles.statLbl, { color: isOut ? "#EF4444" : isLow ? "#F59E0B" : "#10B981" }]}>
              {isOut ? "Tugagan" : isLow ? "Kam" : "Zaxira"}
            </Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: C.surface }]}>
            <Text style={[styles.statVal, { color: C.text }]}>{fmt(p.pricePerUnit)}</Text>
            <Text style={[styles.statLbl, { color: C.textSecondary }]}>Sotish</Text>
          </View>
          {margin !== null && margin > 0 && (
            <View style={[styles.statBox, { backgroundColor: "#ECFDF5" }]}>
              <Text style={[styles.statVal, { color: "#10B981" }]}>+{margin}%</Text>
              <Text style={[styles.statLbl, { color: "#10B981" }]}>Foyda</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <AddCategoryModal visible={showAddCat} onClose={() => setShowAddCat(false)} onSaved={onCatSaved} />
      <AddProductModal visible={showAddProduct} categories={categories} onClose={() => setShowAddProduct(false)} onSaved={onProductSaved} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding, borderBottomColor: C.border }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: C.text }]}>Mahsulotlar</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => setShowAddCat(true)}
              style={[styles.headerBtn, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Feather name="tag" size={16} color={C.primary} />
              <Text style={[styles.headerBtnText, { color: C.primary }]}>Kategoriya</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAddProduct(true)}
              style={[styles.headerBtn, { backgroundColor: C.primary }]}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={[styles.headerBtnText, { color: "#fff" }]}>Qo'shish</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Low stock warning */}
        {lowStockCount > 0 && (
          <View style={[styles.alertBanner, { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" }]}>
            <Feather name="alert-triangle" size={14} color="#F59E0B" />
            <Text style={styles.alertText}>{lowStockCount} ta mahsulot zaxirasi kam</Text>
          </View>
        )}

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: C.card, borderColor: C.border }]}>
          <Feather name="search" size={16} color={C.textSecondary} />
          <TextInput style={[styles.searchInput, { color: C.text }]}
            placeholder="Nom, barcode, rang..." placeholderTextColor={C.textSecondary}
            value={search} onChangeText={setSearch} />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={C.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Category tabs */}
      <View style={{ backgroundColor: C.background }}>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={c => c.key}
          contentContainerStyle={styles.catList}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: cat }) => (
            <TouchableOpacity
              onPress={() => setCatFilter(cat.key)}
              style={[styles.catBtn, {
                backgroundColor: catFilter === cat.key ? C.primary : C.card,
                borderColor: catFilter === cat.key ? C.primary : C.border,
              }]}
            >
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
              <Text style={[styles.catName, { color: catFilter === cat.key ? "#fff" : C.text }]}>
                {cat.name}
              </Text>
              {(catCount[cat.key] || 0) > 0 && (
                <View style={[styles.catCount, { backgroundColor: catFilter === cat.key ? "rgba(255,255,255,0.25)" : C.surface }]}>
                  <Text style={[styles.catCountText, { color: catFilter === cat.key ? "#fff" : C.textSecondary }]}>
                    {catCount[cat.key] || 0}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Products list */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={C.primary} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="package" size={40} color={C.border} />
          <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>
            {search ? "Topilmadi" : "Mahsulot yo'q"}
          </Text>
          <TouchableOpacity onPress={() => setShowAddProduct(true)}
            style={[styles.emptyBtn, { backgroundColor: C.primary }]}>
            <Text style={styles.emptyBtnText}>+ Mahsulot qo'shish</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={styles.list}
          renderItem={renderProduct}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          ListFooterComponent={
            <Text style={[styles.footer, { color: C.textSecondary }]}>
              {filtered.length} ta mahsulot
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 14, gap: 10, borderBottomWidth: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  headerBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  headerBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  alertBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 10, borderRadius: 10, borderWidth: 1,
  },
  alertText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#92400E" },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", height: 44 },
  catList: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  catBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  catEmoji: { fontSize: 15 },
  catName: { fontSize: 13, fontFamily: "Inter_500Medium" },
  catCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  catCountText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 12 },
  productCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  productTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  productName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  productMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#64748B", backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  metaTag: { fontSize: 12, fontFamily: "Inter_400Regular" },
  alertBadge: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  productStats: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center" },
  statVal: { fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "center" },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 60, gap: 14 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_500Medium" },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  footer: { textAlign: "center", fontSize: 13, fontFamily: "Inter_400Regular", paddingVertical: 16 },
});
