import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Modal,
  ScrollView, Alert, KeyboardAvoidingView, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { apiReq } from "@/lib/api";
import { printBarcodeLabel, BarcodePaperSize } from "@/lib/printer";

const C = Colors.light;
const fmt = (n: number) => new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";

interface Category {
  id: number;
  key: string;
  name: string;
  emoji: string;
  isDefault: number;
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
  pricePerUnit: number;
  stock: number;
  minStock: number;
  description: string | null;
  pachkaHajmi: number;
  rang: string | null;
  material: string | null;
}

const UNITS = [
  { value: "metr", label: "Metr (m)" },
  { value: "dona", label: "Dona" },
  { value: "rulon", label: "Rulon" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "litr", label: "Litr (l)" },
  { value: "juft", label: "Juft" },
  { value: "paket", label: "Paket" },
];

const EMOJI_OPTIONS = ["📦", "🎭", "🪟", "🧵", "🏠", "📏", "🔵", "⬜", "〓", "≡",
  "🌸", "🔩", "📎", "🎀", "🛋️", "🔧", "⚙️", "🏷️", "📐", "🎨", "✂️", "🌀", "🎯", "💡"];

// ─── Barcode Scanner Mini ────────────────────────────────────────────────────
function BarcodeScanner({ onScanned, onClose }: { onScanned: (code: string) => void; onClose: () => void }) {
  const [perm, requestPerm] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const scannedRef = useRef(false);

  if (!perm) return <ActivityIndicator style={{ flex: 1 }} color={C.primary} />;
  if (!perm.granted) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
        <Feather name="camera-off" size={40} color={C.textSecondary} />
        <Text style={{ color: C.text, fontSize: 15, textAlign: "center", fontFamily: "Inter_400Regular" }}>
          Kamera ruxsati kerak
        </Text>
        <TouchableOpacity onPress={requestPerm}
          style={{ backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Ruxsat berish</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000", borderRadius: 16, overflow: "hidden" }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        autofocus="on"
        zoom={0}
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"] }}
        onBarcodeScanned={(data) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          onScanned(data.data);
        }}
      />
      {/* Overlay frame */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <View style={{ width: 260, height: 140, position: "relative" }}>
          <View style={{ position: "absolute", top: 0, left: 0, width: 28, height: 28, borderTopWidth: 3, borderLeftWidth: 3, borderColor: "#fff", borderTopLeftRadius: 4 }} />
          <View style={{ position: "absolute", top: 0, right: 0, width: 28, height: 28, borderTopWidth: 3, borderRightWidth: 3, borderColor: "#fff", borderTopRightRadius: 4 }} />
          <View style={{ position: "absolute", bottom: 0, left: 0, width: 28, height: 28, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: "#fff", borderBottomLeftRadius: 4 }} />
          <View style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderBottomWidth: 3, borderRightWidth: 3, borderColor: "#fff", borderBottomRightRadius: 4 }} />
          <View style={{ position: "absolute", top: "50%", left: 4, right: 4, height: 2, backgroundColor: "#4ADE80", opacity: 0.9 }} />
        </View>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 12, fontFamily: "Inter_400Regular" }}>
          Barkodni ramka ichiga yo'naltiring
        </Text>
      </View>
      {/* Controls */}
      <View style={{ position: "absolute", top: 12, right: 12, flexDirection: "row", gap: 8 }}>
        <TouchableOpacity onPress={() => setTorch(t => !t)}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: torch ? "rgba(252,211,77,0.4)" : "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
          <Feather name={torch ? "zap" : "zap-off"} size={18} color={torch ? "#FCD34D" : "#fff"} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
          <Feather name="x" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Add Category Modal ─────────────────────────────────────────────────────
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
      await apiReq("/categories", { method: "POST", body: JSON.stringify({ name: name.trim(), emoji }) });
      setName(""); setEmoji("📦");
      onSaved(); onClose();
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Saqlashda xato");
    } finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[catModalSt.container, { backgroundColor: C.background }]}>
        <View style={[catModalSt.header, { borderBottomColor: C.border }]}>
          <Text style={[catModalSt.title, { color: C.text }]}>Yangi kategoriya</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={C.textSecondary} /></TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 20 }} contentContainerStyle={{ gap: 16 }}>
          <View>
            <Text style={[catModalSt.label, { color: C.textSecondary }]}>Kategoriya nomi *</Text>
            <TextInput
              style={[catModalSt.input, { backgroundColor: C.card, borderColor: C.border, color: C.text }]}
              value={name} onChangeText={setName}
              placeholder="Masalan: Rolikli shtora..." placeholderTextColor={C.textSecondary} autoFocus />
          </View>
          <View>
            <Text style={[catModalSt.label, { color: C.textSecondary }]}>Emoji belgisi</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {EMOJI_OPTIONS.map(e => (
                <TouchableOpacity key={e} onPress={() => setEmoji(e)}
                  style={[catModalSt.emojiBtn, emoji === e && { backgroundColor: C.primary + "20", borderColor: C.primary }]}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={[catModalSt.preview, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={{ fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular", marginBottom: 6 }}>Ko'rinish:</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 26 }}>{emoji}</Text>
              <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.text }}>{name || "Kategoriya nomi"}</Text>
            </View>
          </View>
        </ScrollView>
        <View style={[catModalSt.footer, { borderTopColor: C.border }]}>
          <TouchableOpacity onPress={onClose} style={[catModalSt.cancelBtn, { borderColor: C.border }]}>
            <Text style={{ color: C.textSecondary, fontFamily: "Inter_500Medium", fontSize: 15 }}>Bekor</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} disabled={saving || !name.trim()}
            style={[catModalSt.saveBtn, { backgroundColor: C.primary, opacity: saving || !name.trim() ? 0.5 : 1 }]}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Yaratish</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const catModalSt = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  emojiBtn: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  preview: { borderRadius: 12, borderWidth: 1, padding: 14 },
  footer: { flexDirection: "row", gap: 12, padding: 20, borderTopWidth: 1 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  saveBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});

// ─── Add Product Modal ──────────────────────────────────────────────────────
type BarcodeMode = "mavjud" | "yangi";

function AddProductModal({ visible, categories, onClose, onSaved, initialBarcode }: {
  visible: boolean; categories: Category[]; onClose: () => void; onSaved: () => void;
  initialBarcode?: string;
}) {
  const [form, setForm] = useState({
    name: "", category: "", unit: "metr", barcode: "",
    buyingPrice: "", pricePerUnit: "", stock: "", minStock: "",
    description: "", pachkaHajmi: "1", rang: "", material: "",
  });
  const [barcodeMode, setBarcodeMode] = useState<BarcodeMode>("yangi");
  const [showScanner, setShowScanner] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"basic" | "prices">("basic");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const selectableCats = categories.filter(c => !c.isAll);

  useEffect(() => {
    if (!visible) return;
    setForm({ name: "", category: "", unit: "metr", barcode: "", buyingPrice: "", pricePerUnit: "", stock: "", minStock: "", description: "", pachkaHajmi: "1", rang: "", material: "" });
    setShowScanner(false);
    setStep("basic");
    if (initialBarcode) {
      setBarcodeMode("mavjud");
      setForm(f => ({ ...f, barcode: initialBarcode }));
    } else {
      setBarcodeMode("yangi");
      generateBarcode();
    }
  }, [visible]);

  function resetForm() {
    setForm({ name: "", category: "", unit: "metr", barcode: "", buyingPrice: "", pricePerUnit: "", stock: "", minStock: "", description: "", pachkaHajmi: "1", rang: "", material: "" });
    setBarcodeMode("yangi");
    setShowScanner(false);
    setStep("basic");
  }

  async function generateBarcode() {
    setGeneratingBarcode(true);
    try {
      const res = await apiReq<{ barcode: string }>("/products/generate-barcode");
      set("barcode", res.barcode);
    } catch {
      Alert.alert("Xato", "Barcode generatsiya qilishda xato");
    } finally { setGeneratingBarcode(false); }
  }

  // Auto-generate when switching to "yangi" mode
  async function switchMode(mode: BarcodeMode) {
    setBarcodeMode(mode);
    if (mode === "yangi" && !form.barcode) {
      await generateBarcode();
    }
    if (mode === "mavjud") {
      set("barcode", "");
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { Alert.alert("Xato", "Mahsulot nomini kiriting"); return; }
    if (!form.pricePerUnit) { Alert.alert("Xato", "Sotish narxini kiriting"); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        category: form.category || (selectableCats[0]?.key || "boshqa"),
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
      Alert.alert("✓ Saqlandi", `"${form.name}" mahsulot qo'shildi`);
      resetForm(); onSaved(); onClose();
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Saqlashda xato");
    } finally { setSaving(false); }
  }

  const inp = [addSt.input, { backgroundColor: C.card, borderColor: C.border, color: C.text }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[addSt.container, { backgroundColor: C.background }]}>
          {/* Header */}
          <View style={[addSt.header, { borderBottomColor: C.border }]}>
            <Text style={[addSt.title, { color: C.text }]}>Yangi mahsulot</Text>
            <TouchableOpacity onPress={() => { resetForm(); onClose(); }}>
              <Feather name="x" size={22} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Step tabs */}
          <View style={[addSt.stepRow, { backgroundColor: C.surface }]}>
            {(["basic", "prices"] as const).map((s, i) => (
              <TouchableOpacity key={s} onPress={() => setStep(s)}
                style={[addSt.stepBtn, step === s && { backgroundColor: C.primary }]}>
                <Text style={[addSt.stepText, { color: step === s ? "#fff" : C.textSecondary }]}>
                  {i + 1}. {s === "basic" ? "Asosiy ma'lumot" : "Narx va zaxira"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={addSt.body}>
            {step === "basic" ? (
              <>
                {/* Product name */}
                <View>
                  <Text style={[addSt.label, { color: C.textSecondary }]}>Mahsulot nomi *</Text>
                  <TextInput style={inp} value={form.name} onChangeText={v => set("name", v)}
                    placeholder="Masalan: Baget Classic 3m oq" placeholderTextColor={C.textSecondary} autoFocus />
                </View>

                {/* Category */}
                <View>
                  <Text style={[addSt.label, { color: C.textSecondary }]}>Kategoriya</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {selectableCats.map(cat => (
                        <TouchableOpacity key={cat.key} onPress={() => set("category", cat.key)}
                          style={[addSt.chip, {
                            backgroundColor: form.category === cat.key ? C.primary : C.card,
                            borderColor: form.category === cat.key ? C.primary : C.border,
                          }]}>
                          <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
                          <Text style={[addSt.chipText, { color: form.category === cat.key ? "#fff" : C.text }]}>{cat.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Unit */}
                <View>
                  <Text style={[addSt.label, { color: C.textSecondary }]}>O'lchov birligi</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {UNITS.map(u => (
                        <TouchableOpacity key={u.value} onPress={() => set("unit", u.value)}
                          style={[addSt.unitChip, {
                            backgroundColor: form.unit === u.value ? C.primary : C.card,
                            borderColor: form.unit === u.value ? C.primary : C.border,
                          }]}>
                          <Text style={[addSt.chipText, { color: form.unit === u.value ? "#fff" : C.text, fontSize: 13 }]}>
                            {u.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Color & Material */}
                <View style={addSt.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[addSt.label, { color: C.textSecondary }]}>Rang</Text>
                    <TextInput style={inp} value={form.rang} onChangeText={v => set("rang", v)}
                      placeholder="Oq, ko'k..." placeholderTextColor={C.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[addSt.label, { color: C.textSecondary }]}>Material</Text>
                    <TextInput style={inp} value={form.material} onChangeText={v => set("material", v)}
                      placeholder="PVC, Metall..." placeholderTextColor={C.textSecondary} />
                  </View>
                </View>

                {/* ─── BARCODE SECTION ─── */}
                <View style={[addSt.barcodeCard, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Feather name="hash" size={16} color={C.primary} />
                    <Text style={[addSt.cardTitle, { color: C.text }]}>Shtrix kod (barcode)</Text>
                  </View>

                  {/* Mode selector */}
                  <View style={[addSt.modeRow, { backgroundColor: C.background }]}>
                    <TouchableOpacity onPress={() => switchMode("yangi")}
                      style={[addSt.modeBtn, barcodeMode === "yangi" && { backgroundColor: C.primary }]}>
                      <Feather name="zap" size={14} color={barcodeMode === "yangi" ? "#fff" : C.textSecondary} />
                      <Text style={[addSt.modeBtnText, { color: barcodeMode === "yangi" ? "#fff" : C.textSecondary }]}>
                        Yangi generatsiya
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => switchMode("mavjud")}
                      style={[addSt.modeBtn, barcodeMode === "mavjud" && { backgroundColor: C.primary }]}>
                      <Feather name="camera" size={14} color={barcodeMode === "mavjud" ? "#fff" : C.textSecondary} />
                      <Text style={[addSt.modeBtnText, { color: barcodeMode === "mavjud" ? "#fff" : C.textSecondary }]}>
                        Mavjud barkod
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Generated barcode display */}
                  {barcodeMode === "yangi" && (
                    <View style={{ marginTop: 12 }}>
                      <View style={[addSt.generatedBox, { borderColor: C.primary + "40", backgroundColor: C.primary + "08" }]}>
                        {generatingBarcode ? (
                          <ActivityIndicator color={C.primary} />
                        ) : (
                          <>
                            <Text style={[addSt.generatedCode, { color: C.primary }]}>
                              {form.barcode || "—"}
                            </Text>
                            <TouchableOpacity onPress={generateBarcode} style={addSt.regenBtn}>
                              <Feather name="refresh-cw" size={16} color={C.primary} />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                      <Text style={[addSt.barcodeHint, { color: C.textSecondary }]}>
                        🇺🇿 Avtomatik 13 xonali EAN barcode yaratildi
                      </Text>
                    </View>
                  )}

                  {/* Existing barcode input + scanner */}
                  {barcodeMode === "mavjud" && (
                    <View style={{ marginTop: 12 }}>
                      {showScanner ? (
                        <View style={{ height: 200, borderRadius: 12, overflow: "hidden" }}>
                          <BarcodeScanner
                            onScanned={(code) => {
                              set("barcode", code);
                              setShowScanner(false);
                            }}
                            onClose={() => setShowScanner(false)}
                          />
                        </View>
                      ) : (
                        <View style={addSt.row}>
                          <TextInput
                            style={[inp, { flex: 1 }]}
                            value={form.barcode} onChangeText={v => set("barcode", v)}
                            placeholder="Barkod raqamini kiriting yoki skaner bilan o'qing"
                            placeholderTextColor={C.textSecondary}
                            keyboardType="number-pad"
                          />
                          <TouchableOpacity onPress={() => setShowScanner(true)}
                            style={[addSt.scanBtn, { backgroundColor: C.primary }]}>
                            <Feather name="camera" size={20} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      )}
                      <Text style={[addSt.barcodeHint, { color: C.textSecondary }]}>
                        Mahsulot qutisidagi mavjud barkodni kiriting yoki skaner bilan o'qing
                      </Text>
                    </View>
                  )}
                </View>

                {/* Description */}
                <View>
                  <Text style={[addSt.label, { color: C.textSecondary }]}>Izoh (ixtiyoriy)</Text>
                  <TextInput style={[inp, { height: 60, textAlignVertical: "top", paddingTop: 10 }]}
                    value={form.description} onChangeText={v => set("description", v)}
                    placeholder="Qo'shimcha ma'lumot..." placeholderTextColor={C.textSecondary} multiline />
                </View>
              </>
            ) : (
              <>
                {/* Prices card */}
                <View style={[addSt.priceCard, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <Feather name="tag" size={16} color={C.primary} />
                    <Text style={[addSt.cardTitle, { color: C.text }]}>Narxlar</Text>
                  </View>
                  <View style={addSt.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[addSt.label, { color: C.textSecondary }]}>Kelgan narx (so'm)</Text>
                      <TextInput style={inp} value={form.buyingPrice} onChangeText={v => set("buyingPrice", v)}
                        placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[addSt.label, { color: C.textSecondary }]}>Sotish narxi * (so'm)</Text>
                      <TextInput style={[inp, { borderColor: C.primary }]}
                        value={form.pricePerUnit} onChangeText={v => set("pricePerUnit", v)}
                        placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
                    </View>
                  </View>

                  {/* Profit margin */}
                  {parseFloat(form.buyingPrice) > 0 && parseFloat(form.pricePerUnit) > 0 && (
                    <View style={{ marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: "#ECFDF5", flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Feather name="trending-up" size={14} color="#10B981" />
                      <Text style={{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                        Foyda: +{Math.round(((parseFloat(form.pricePerUnit) - parseFloat(form.buyingPrice)) / parseFloat(form.buyingPrice)) * 100)}%
                        {" "}({fmt(parseFloat(form.pricePerUnit) - parseFloat(form.buyingPrice))} / {UNITS.find(u => u.value === form.unit)?.label || form.unit})
                      </Text>
                    </View>
                  )}
                </View>

                {/* Stock card */}
                <View style={[addSt.priceCard, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <Feather name="package" size={16} color="#F59E0B" />
                    <Text style={[addSt.cardTitle, { color: C.text }]}>Zaxira miqdori</Text>
                  </View>
                  <View style={addSt.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[addSt.label, { color: C.textSecondary }]}>
                        Joriy zaxira ({UNITS.find(u => u.value === form.unit)?.label || form.unit})
                      </Text>
                      <TextInput style={inp} value={form.stock} onChangeText={v => set("stock", v)}
                        placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[addSt.label, { color: C.textSecondary }]}>Minimal zaxira</Text>
                      <TextInput style={inp} value={form.minStock} onChangeText={v => set("minStock", v)}
                        placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <Text style={[addSt.label, { color: C.textSecondary }]}>
                      {form.unit === "rulon" ? "1 rulonda necha m" : "1 pachkada necha dona"}
                    </Text>
                    <TextInput style={inp} value={form.pachkaHajmi} onChangeText={v => set("pachkaHajmi", v)}
                      placeholder="1" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
                  </View>
                </View>

                {/* Summary */}
                {form.name && form.pricePerUnit && (
                  <View style={[addSt.summaryCard, { backgroundColor: "#EEF2FF", borderColor: C.primary + "30" }]}>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.primary, marginBottom: 8 }}>
                      📋 Xulosa
                    </Text>
                    <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22 }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold" }}>{form.name}</Text>
                      {"\n"}Kategoriya: {selectableCats.find(c => c.key === form.category)?.name || "Belgilanmagan"}
                      {"\n"}Birlik: {UNITS.find(u => u.value === form.unit)?.label}
                      {"\n"}Sotish narxi: {fmt(parseFloat(form.pricePerUnit) || 0)}
                      {form.barcode ? `\nBarcode: ${form.barcode}` : ""}
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[addSt.footer, { borderTopColor: C.border }]}>
            {step === "basic" ? (
              <>
                <TouchableOpacity onPress={() => { resetForm(); onClose(); }}
                  style={[addSt.cancelBtn, { borderColor: C.border }]}>
                  <Text style={[addSt.cancelText, { color: C.textSecondary }]}>Bekor</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep("prices")}
                  style={[addSt.nextBtn, { backgroundColor: C.primary }]}>
                  <Text style={addSt.nextText}>Keyingi →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setStep("basic")}
                  style={[addSt.cancelBtn, { borderColor: C.border }]}>
                  <Text style={[addSt.cancelText, { color: C.textSecondary }]}>← Orqaga</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={saving}
                  style={[addSt.nextBtn, { backgroundColor: "#10B981", opacity: saving ? 0.7 : 1 }]}>
                  {saving ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={addSt.nextText}>✓ Saqlash</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const addSt = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  stepRow: { flexDirection: "row", margin: 16, borderRadius: 12, padding: 4, gap: 4 },
  stepBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  stepText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  body: { padding: 16, gap: 14, paddingBottom: 24 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", gap: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  unitChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  barcodeCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  modeRow: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 3 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8 },
  modeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  generatedBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 10, borderWidth: 1, padding: 14, minHeight: 52 },
  generatedCode: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: 2 },
  regenBtn: { padding: 6 },
  barcodeHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 6, lineHeight: 16 },
  scanBtn: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  priceCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  summaryCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  footer: { flexDirection: "row", gap: 12, padding: 16, borderTopWidth: 1 },
  cancelBtn: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  nextBtn: { flex: 1, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nextText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

// ─── Edit Product Modal ────────────────────────────────────────────────────
function EditProductModal({ visible, product, categories, onClose, onSaved }: {
  visible: boolean; product: Product | null; categories: Category[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "", category: "", unit: "metr", barcode: "",
    buyingPrice: "", pricePerUnit: "", stock: "", minStock: "",
    description: "", pachkaHajmi: "1", rang: "", material: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const selectableCats = categories.filter(c => !c.isAll);

  useEffect(() => {
    if (product && visible) {
      setForm({
        name: product.name || "",
        category: product.category || "",
        unit: product.unit || "metr",
        barcode: product.barcode || "",
        buyingPrice: product.buyingPrice ? String(product.buyingPrice) : "",
        pricePerUnit: product.pricePerUnit ? String(product.pricePerUnit) : "",
        stock: product.stock ? String(product.stock) : "",
        minStock: product.minStock ? String(product.minStock) : "",
        description: product.description || "",
        pachkaHajmi: product.pachkaHajmi ? String(product.pachkaHajmi) : "1",
        rang: product.rang || "",
        material: product.material || "",
      });
    }
  }, [product, visible]);

  async function handleSave() {
    if (!form.name.trim()) { Alert.alert("Xato", "Mahsulot nomini kiriting"); return; }
    if (!form.pricePerUnit) { Alert.alert("Xato", "Sotish narxini kiriting"); return; }
    if (!product) return;
    setSaving(true);
    try {
      await apiReq(`/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category || (selectableCats[0]?.key || "boshqa"),
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
        }),
      });
      Alert.alert("✓ Saqlandi", `"${form.name}" yangilandi`);
      onSaved(); onClose();
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Saqlashda xato");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!product) return;
    Alert.alert(
      "O'chirish",
      `"${product.name}" mahsulotni o'chirishni xohlaysizmi?`,
      [
        { text: "Bekor", style: "cancel" },
        {
          text: "O'chirish", style: "destructive", onPress: async () => {
            setDeleting(true);
            try {
              await apiReq(`/products/${product.id}`, { method: "DELETE" });
              Alert.alert("✓ O'chirildi", `"${product.name}" o'chirildi`);
              onSaved(); onClose();
            } catch (e: any) {
              Alert.alert("Xato", e.message || "O'chirishda xato");
            } finally { setDeleting(false); }
          },
        },
      ]
    );
  }

  const inp = [addSt.input, { backgroundColor: C.card, borderColor: C.border, color: C.text }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[addSt.container, { backgroundColor: C.background }]}>
          <View style={[addSt.header, { borderBottomColor: C.border }]}>
            <Text style={[addSt.title, { color: C.text }]}>Mahsulotni tahrirlash</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={C.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={addSt.body}>
            <View>
              <Text style={[addSt.label, { color: C.textSecondary }]}>Mahsulot nomi *</Text>
              <TextInput style={inp} value={form.name} onChangeText={v => set("name", v)} placeholder="Nom" placeholderTextColor={C.textSecondary} />
            </View>
            <View>
              <Text style={[addSt.label, { color: C.textSecondary }]}>Kategoriya</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {selectableCats.map(cat => (
                    <TouchableOpacity key={cat.key} onPress={() => set("category", cat.key)}
                      style={[addSt.chip, {
                        backgroundColor: form.category === cat.key ? C.primary : C.card,
                        borderColor: form.category === cat.key ? C.primary : C.border,
                      }]}>
                      <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
                      <Text style={[addSt.chipText, { color: form.category === cat.key ? "#fff" : C.text }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View>
              <Text style={[addSt.label, { color: C.textSecondary }]}>O'lchov birligi</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {UNITS.map(u => (
                    <TouchableOpacity key={u.value} onPress={() => set("unit", u.value)}
                      style={[addSt.unitChip, {
                        backgroundColor: form.unit === u.value ? C.primary : C.card,
                        borderColor: form.unit === u.value ? C.primary : C.border,
                      }]}>
                      <Text style={[addSt.chipText, { color: form.unit === u.value ? "#fff" : C.text, fontSize: 13 }]}>{u.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={addSt.row}>
              <View style={{ flex: 1 }}>
                <Text style={[addSt.label, { color: C.textSecondary }]}>Rang</Text>
                <TextInput style={inp} value={form.rang} onChangeText={v => set("rang", v)} placeholder="Oq, ko'k..." placeholderTextColor={C.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[addSt.label, { color: C.textSecondary }]}>Material</Text>
                <TextInput style={inp} value={form.material} onChangeText={v => set("material", v)} placeholder="PVC, Metall..." placeholderTextColor={C.textSecondary} />
              </View>
            </View>
            <View style={addSt.row}>
              <View style={{ flex: 1 }}>
                <Text style={[addSt.label, { color: C.textSecondary }]}>Kelgan narx</Text>
                <TextInput style={inp} value={form.buyingPrice} onChangeText={v => set("buyingPrice", v)} placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[addSt.label, { color: C.textSecondary }]}>Sotish narxi *</Text>
                <TextInput style={[inp, { borderColor: C.primary }]} value={form.pricePerUnit} onChangeText={v => set("pricePerUnit", v)} placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
              </View>
            </View>
            <View style={addSt.row}>
              <View style={{ flex: 1 }}>
                <Text style={[addSt.label, { color: C.textSecondary }]}>Joriy zaxira</Text>
                <TextInput style={inp} value={form.stock} onChangeText={v => set("stock", v)} placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[addSt.label, { color: C.textSecondary }]}>Minimal zaxira</Text>
                <TextInput style={inp} value={form.minStock} onChangeText={v => set("minStock", v)} placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
              </View>
            </View>
            <View>
              <Text style={[addSt.label, { color: C.textSecondary }]}>Izoh</Text>
              <TextInput style={[inp, { height: 60, textAlignVertical: "top", paddingTop: 10 }]}
                value={form.description} onChangeText={v => set("description", v)}
                placeholder="Qo'shimcha..." placeholderTextColor={C.textSecondary} multiline />
            </View>
          </ScrollView>
          <View style={[addSt.footer, { borderTopColor: C.border }]}>
            <TouchableOpacity onPress={handleDelete} disabled={deleting}
              style={[addSt.cancelBtn, { borderColor: "#EF4444" }]}>
              {deleting ? <ActivityIndicator size="small" color="#EF4444" />
                : <><Feather name="trash-2" size={16} color="#EF4444" /><Text style={{ color: "#EF4444", fontFamily: "Inter_500Medium", fontSize: 14, marginLeft: 4 }}>O'chirish</Text></>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving}
              style={[addSt.nextBtn, { backgroundColor: C.primary, opacity: saving ? 0.7 : 1 }]}>
              {saving ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={addSt.nextText}>✓ Saqlash</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Products Screen ───────────────────────────────────────────────────
export default function MahsulotlarScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ addBarcode?: string }>();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [initialBarcode, setInitialBarcode] = useState<string | undefined>();
  const [printProduct, setPrintProduct] = useState<Product | null>(null);
  const [printCount, setPrintCount] = useState("1");
  const [printPaper, setPrintPaper] = useState<BarcodePaperSize>("58mm");
  const [printing, setPrinting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (params.addBarcode) {
      setInitialBarcode(params.addBarcode);
      setShowAddProduct(true);
    }
  }, [params.addBarcode]);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: categories = [], refetch: refetchCats } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => apiReq("/categories"),
  });

  const { data: rawProducts, isLoading, refetch: refetchProducts } = useQuery({
    queryKey: ["products-list"],
    queryFn: () => apiReq<{ products: Product[]; total: number } | Product[]>("/products?limit=500"),
  });

  const products: Product[] = Array.isArray(rawProducts)
    ? rawProducts
    : (rawProducts as any)?.products ?? [];

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

  const renderProduct = ({ item: p }: { item: Product }) => {
    const isLow = p.minStock > 0 && p.stock <= p.minStock;
    const isOut = p.stock <= 0;
    const catInfo = getCatInfo(p.category);
    const margin = p.buyingPrice > 0 ? Math.round(((p.pricePerUnit - p.buyingPrice) / p.buyingPrice) * 100) : null;
    const unitLabel = UNITS.find(u => u.value === p.unit)?.label || p.unit;

    return (
      <View style={[pSt.card, { backgroundColor: C.card, borderColor: isLow ? "#F59E0B40" : C.border }]}>
        <View style={pSt.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[pSt.name, { color: C.text }]} numberOfLines={1}>{p.name}</Text>
            <View style={pSt.meta}>
              <View style={[pSt.catBadge, { backgroundColor: C.surface }]}>
                <Text style={{ fontSize: 12 }}>{catInfo.emoji}</Text>
                <Text style={[pSt.catText, { color: C.textSecondary }]}>{catInfo.name}</Text>
              </View>
              {p.barcode && (
                <View style={[pSt.barcodeBadge, { backgroundColor: "#EEF2FF" }]}>
                  <Feather name="hash" size={10} color={C.primary} />
                  <Text style={[pSt.barcodeText, { color: C.primary }]}>{p.barcode}</Text>
                </View>
              )}
            </View>
            {(p.rang || p.material) && (
              <Text style={[pSt.attrs, { color: C.textSecondary }]}>
                {[p.rang, p.material].filter(Boolean).join(" · ")}
              </Text>
            )}
          </View>
          {(isLow || isOut) && (
            <View style={[pSt.alertBadge, { backgroundColor: isOut ? "#FEE2E2" : "#FEF3C7" }]}>
              <Feather name="alert-triangle" size={12} color={isOut ? "#EF4444" : "#F59E0B"} />
            </View>
          )}
        </View>

        <View style={pSt.stats}>
          <View style={[pSt.stat, { backgroundColor: isOut ? "#FEF2F2" : isLow ? "#FFFBEB" : "#ECFDF5" }]}>
            <Text style={[pSt.statVal, { color: isOut ? "#EF4444" : isLow ? "#F59E0B" : "#10B981" }]}>
              {new Intl.NumberFormat("uz-UZ").format(p.stock)}
            </Text>
            <Text style={[pSt.statLbl, { color: isOut ? "#EF4444" : isLow ? "#F59E0B" : "#10B981" }]}>
              {isOut ? "Tugagan" : isLow ? "Kam (" + unitLabel + ")" : unitLabel}
            </Text>
          </View>
          <View style={[pSt.stat, { backgroundColor: C.surface, flex: 1.4 }]}>
            <Text style={[pSt.statVal, { color: C.text, fontSize: 13 }]}>{fmt(p.pricePerUnit)}</Text>
            <Text style={[pSt.statLbl, { color: C.textSecondary }]}>Sotish / {p.unit}</Text>
          </View>
          {p.buyingPrice > 0 && (
            <View style={[pSt.stat, { backgroundColor: C.surface }]}>
              <Text style={[pSt.statVal, { color: C.textSecondary, fontSize: 12 }]}>{fmt(p.buyingPrice)}</Text>
              <Text style={[pSt.statLbl, { color: C.textSecondary }]}>Kelgan</Text>
            </View>
          )}
          {margin !== null && margin > 0 && (
            <View style={[pSt.stat, { backgroundColor: "#ECFDF5" }]}>
              <Text style={[pSt.statVal, { color: "#10B981" }]}>+{margin}%</Text>
              <Text style={[pSt.statLbl, { color: "#10B981" }]}>Foyda</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() => setEditProduct(p)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6,
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
              borderColor: C.primary, backgroundColor: C.primary + "10" }}
          >
            <Feather name="edit-2" size={13} color={C.primary} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: C.primary }}>
              Tahrirlash
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setPrintProduct(p); setPrintCount("1"); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6,
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
              borderColor: C.border }}
          >
            <Feather name="printer" size={13} color={C.primary} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: C.primary }}>
              Barcode chiqarish
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[mainSt.container, { backgroundColor: C.background }]}>
      <AddCategoryModal visible={showAddCat} onClose={() => setShowAddCat(false)} onSaved={() => {
        qc.invalidateQueries({ queryKey: ["categories"] }); refetchCats();
      }} />
      <AddProductModal
        visible={showAddProduct}
        categories={categories}
        initialBarcode={initialBarcode}
        onClose={() => { setShowAddProduct(false); setInitialBarcode(undefined); }}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["products-list"] }); refetchProducts(); }}
      />
      <EditProductModal
        visible={!!editProduct}
        product={editProduct}
        categories={categories}
        onClose={() => setEditProduct(null)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["products-list"] }); refetchProducts(); }}
      />

      {/* ── Print Barcode Modal ── */}
      <Modal visible={!!printProduct} transparent animationType="fade" onRequestClose={() => setPrintProduct(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ width: "100%", maxWidth: 320, borderRadius: 20, padding: 24, backgroundColor: C.background, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
                <Feather name="tag" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: C.text }} numberOfLines={1}>
                  {printProduct?.name}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary }}>
                  {printProduct?.barcode || "Barcode yo'q"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPrintProduct(null)}>
                <Feather name="x" size={20} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
            <View>
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary, marginBottom: 8 }}>
                Nechta nusxa chiqarish?
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {["1", "2", "5", "10", "20", "50"].map(n => (
                  <TouchableOpacity key={n} onPress={() => setPrintCount(n)}
                    style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
                      borderColor: printCount === n ? C.primary : C.border,
                      backgroundColor: printCount === n ? C.primary + "15" : C.card }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold",
                      color: printCount === n ? C.primary : C.text }}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={{ height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, marginTop: 10,
                  backgroundColor: C.card, borderColor: C.border, color: C.text, fontSize: 15, fontFamily: "Inter_400Regular" }}
                value={printCount} onChangeText={v => setPrintCount(v.replace(/[^0-9]/g, ""))}
                keyboardType="numeric" placeholder="Boshqa son..." placeholderTextColor={C.textSecondary}
              />
            </View>
            <View>
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary, marginBottom: 8 }}>
                Qog'oz o'lchami
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {([
                  { key: "58mm" as const, label: "58 mm", desc: "Chek" },
                  { key: "80mm" as const, label: "80 mm", desc: "Standart" },
                  { key: "a4" as const, label: "A4", desc: "Katta" },
                ] as const).map(p => (
                  <TouchableOpacity key={p.key} onPress={() => setPrintPaper(p.key)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: "center",
                      borderColor: printPaper === p.key ? C.primary : C.border,
                      backgroundColor: printPaper === p.key ? C.primary + "15" : C.card }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold",
                      color: printPaper === p.key ? C.primary : C.text }}>{p.label}</Text>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular",
                      color: printPaper === p.key ? C.primary : C.textSecondary }}>{p.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {!printProduct?.barcode && (
              <View style={{ flexDirection: "row", gap: 8, backgroundColor: "#FFFBEB", borderRadius: 10, padding: 10 }}>
                <Feather name="alert-triangle" size={14} color="#D97706" />
                <Text style={{ fontSize: 12, color: "#D97706", fontFamily: "Inter_400Regular", flex: 1 }}>
                  Bu mahsulotda barcode yo'q. Mahsulotni tahrirlang va barcode qo'shing.
                </Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => setPrintProduct(null)}
                style={{ flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: C.textSecondary, fontFamily: "Inter_500Medium" }}>Bekor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={printing || !printProduct?.barcode}
                onPress={async () => {
                  if (!printProduct) return;
                  setPrinting(true);
                  try {
                    await printBarcodeLabel(printProduct, parseInt(printCount) || 1, printPaper);
                  } catch (e: any) {
                    Alert.alert("Xato", e.message || "Chop etishda xato");
                  } finally {
                    setPrinting(false);
                    setPrintProduct(null);
                  }
                }}
                style={{ flex: 1.5, height: 48, borderRadius: 12, backgroundColor: printing ? C.border : C.primary,
                  alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
                {printing
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Feather name="printer" size={16} color="#fff" />
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Chiqarish</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[mainSt.header, { paddingTop: topPadding, borderBottomColor: C.border }]}>
        <View style={mainSt.headerRow}>
          <View>
            <Text style={[mainSt.title, { color: C.text }]}>Mahsulotlar</Text>
            <Text style={[mainSt.subtitle, { color: C.textSecondary }]}>{products.length} ta mahsulot</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => setShowAddCat(true)}
              style={[mainSt.headerBtn, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Feather name="tag" size={15} color={C.primary} />
              <Text style={[mainSt.headerBtnText, { color: C.primary }]}>Kategoriya</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAddProduct(true)}
              style={[mainSt.headerBtn, { backgroundColor: C.primary }]}>
              <Feather name="plus" size={15} color="#fff" />
              <Text style={[mainSt.headerBtnText, { color: "#fff" }]}>Qo'shish</Text>
            </TouchableOpacity>
          </View>
        </View>

        {lowStockCount > 0 && (
          <View style={[mainSt.alertBanner, { backgroundColor: "#FFFBEB", borderColor: "#F59E0B30" }]}>
            <Feather name="alert-triangle" size={14} color="#F59E0B" />
            <Text style={mainSt.alertText}>{lowStockCount} ta mahsulot zaxirasi kam yoki tugagan</Text>
          </View>
        )}

        <View style={[mainSt.searchBar, { backgroundColor: C.card, borderColor: C.border }]}>
          <Feather name="search" size={16} color={C.textSecondary} />
          <TextInput style={[mainSt.searchInput, { color: C.text }]}
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
      <FlatList
        horizontal
        data={categories}
        keyExtractor={c => c.key}
        contentContainerStyle={mainSt.catList}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item: cat }) => (
          <TouchableOpacity onPress={() => setCatFilter(cat.key)}
            style={[mainSt.catBtn, {
              backgroundColor: catFilter === cat.key ? C.primary : C.card,
              borderColor: catFilter === cat.key ? C.primary : C.border,
            }]}>
            <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
            <Text style={[mainSt.catName, { color: catFilter === cat.key ? "#fff" : C.text }]}>{cat.name}</Text>
            {(catCount[cat.key] || 0) > 0 && (
              <View style={[mainSt.catCount, { backgroundColor: catFilter === cat.key ? "rgba(255,255,255,0.25)" : C.surface }]}>
                <Text style={[mainSt.catCountText, { color: catFilter === cat.key ? "#fff" : C.textSecondary }]}>
                  {catCount[cat.key] || 0}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Products list */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={C.primary} />
      ) : filtered.length === 0 ? (
        <View style={mainSt.empty}>
          <Feather name="package" size={40} color={C.border} />
          <Text style={[mainSt.emptyTitle, { color: C.textSecondary }]}>
            {search ? "Qidiruv bo'yicha topilmadi" : "Hali mahsulot qo'shilmagan"}
          </Text>
          {!search && (
            <TouchableOpacity onPress={() => setShowAddProduct(true)}
              style={[mainSt.emptyBtn, { backgroundColor: C.primary }]}>
              <Text style={mainSt.emptyBtnText}>+ Mahsulot qo'shish</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => String(p.id)}
          renderItem={renderProduct}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const pSt = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  catBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  barcodeBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  barcodeText: { fontSize: 11, fontFamily: "Inter_400Regular", letterSpacing: 0.5 },
  attrs: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  alertBadge: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderRadius: 10, padding: 8, alignItems: "center" },
  statVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2 },
});

const mainSt = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  headerBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  alertText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#92400E" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  catList: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  catBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  catName: { fontSize: 13, fontFamily: "Inter_500Medium" },
  catCount: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  catCountText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_500Medium", textAlign: "center" },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
});
