import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Modal, ActivityIndicator, FlatList,
  Alert, Platform, KeyboardAvoidingView, Vibration,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import { printReceipt } from "@/lib/printer";

const C = Colors.light;
const fmt = (n: number) => new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0)) + " so'm";

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
  rang: string | null;
  material: string | null;
}

interface CartItem {
  product: Product;
  qty: number;
  price: number;
}

const UNITS = [
  { value: "metr", label: "Metr" },
  { value: "dona", label: "Dona" },
  { value: "rulon", label: "Rulon" },
  { value: "kg", label: "Kg" },
  { value: "litr", label: "Litr" },
  { value: "juft", label: "Juft" },
  { value: "paket", label: "Paket" },
];

// ─── Quick Add Modal ──────────────────────────────────────────────────────────
function QuickAddModal({ visible, barcode, categories, onClose, onAdded }: {
  visible: boolean; barcode: string;
  categories: any[]; onClose: () => void; onAdded: (p: Product) => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("metr");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setName(""); setUnit("metr"); setBuyingPrice(""); setPricePerUnit(""); setCategory(""); setStock(""); }
  }, [visible]);

  const cats = categories.filter((c: any) => !c.isAll);

  async function handleSave() {
    if (!name.trim()) { Alert.alert("Xato", "Nom kiriting"); return; }
    if (!pricePerUnit) { Alert.alert("Xato", "Sotish narxini kiriting"); return; }
    setSaving(true);
    try {
      const p = await apiReq<Product>("/products", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          category: category || (cats[0]?.key || "boshqa"),
          unit, barcode,
          buyingPrice: parseFloat(buyingPrice) || 0,
          pricePerUnit: parseFloat(pricePerUnit),
          stock: parseFloat(stock) || 0,
        }),
      });
      onAdded(p);
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Saqlashda xato");
    } finally { setSaving(false); }
  }

  const inp = { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular", backgroundColor: C.card, borderColor: C.border, color: C.text };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1, backgroundColor: C.background }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", padding: 20, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 6 }}>Yangi mahsulot</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EEF2FF", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                <Feather name="hash" size={12} color={C.primary} />
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.primary, letterSpacing: 1 }}>{barcode}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={C.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 24 }}>
            {/* Name */}
            <View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Nomi *</Text>
              <TextInput style={inp} value={name} onChangeText={setName} placeholder="Masalan: Baget Classic oq" placeholderTextColor={C.textSecondary} autoFocus />
            </View>

            {/* Category */}
            {cats.length > 0 && (
              <View>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Kategoriya</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {cats.map((cat: any) => (
                      <TouchableOpacity key={cat.key} onPress={() => setCategory(cat.key)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: category === cat.key ? C.primary : C.card, borderColor: category === cat.key ? C.primary : C.border }}>
                        <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: category === cat.key ? "#fff" : C.text }}>{cat.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Unit */}
            <View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>O'lchov</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {UNITS.map(u => (
                  <TouchableOpacity key={u.value} onPress={() => setUnit(u.value)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: unit === u.value ? C.primary : C.card, borderColor: unit === u.value ? C.primary : C.border }}>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: unit === u.value ? "#fff" : C.text }}>{u.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Prices */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Kelgan narx</Text>
                <TextInput style={inp} value={buyingPrice} onChangeText={setBuyingPrice} placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Sotish narxi *</Text>
                <TextInput style={{ ...inp, borderColor: C.primary }} value={pricePerUnit} onChangeText={setPricePerUnit} placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
              </View>
            </View>

            {/* Stock */}
            <View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Boshlang'ich zaxira</Text>
              <TextInput style={inp} value={stock} onChangeText={setStock} placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
            </View>

            {/* Profit */}
            {parseFloat(buyingPrice) > 0 && parseFloat(pricePerUnit) > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, backgroundColor: "#ECFDF5" }}>
                <Feather name="trending-up" size={14} color="#10B981" />
                <Text style={{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  Foyda: +{Math.round(((parseFloat(pricePerUnit) - parseFloat(buyingPrice)) / parseFloat(buyingPrice)) * 100)}%
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={{ flexDirection: "row", gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: C.border }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 0.8, height: 52, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.textSecondary, fontFamily: "Inter_500Medium", fontSize: 15 }}>Bekor</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving || !name.trim() || !pricePerUnit}
              style={{ flex: 1.4, height: 52, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primary, opacity: saving || !name.trim() || !pricePerUnit ? 0.5 : 1 }}>
              {saving ? <ActivityIndicator color="#fff" size="small" />
                : <><Feather name="plus" size={16} color="#fff" /><Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Qo'shish va savatchaga</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Not Found Dialog ─────────────────────────────────────────────────────────
function NotFoundDialog({ visible, barcode, onAddNew, onClose }: {
  visible: boolean; barcode: string; onAddNew: () => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View style={{ width: "100%", maxWidth: 340, borderRadius: 20, padding: 24, alignItems: "center", gap: 12, backgroundColor: C.background }}>
          <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#FFFBEB", alignItems: "center", justifyContent: "center" }}>
            <Feather name="alert-circle" size={34} color="#F59E0B" />
          </View>
          <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" }}>Mahsulot topilmadi</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EEF2FF", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}>
            <Feather name="hash" size={14} color={C.primary} />
            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: C.primary, letterSpacing: 1.5 }}>{barcode}</Text>
          </View>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", lineHeight: 22 }}>
            Bu barkodli mahsulot ro'yxatda yo'q.{"\n"}Yangi mahsulot sifatida qo'shilsinmi?
          </Text>
          <View style={{ flexDirection: "row", gap: 12, width: "100%", marginTop: 4 }}>
            <TouchableOpacity onPress={onClose}
              style={{ flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.textSecondary, fontFamily: "Inter_500Medium", fontSize: 15 }}>Bekor</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onAddNew}
              style={{ flex: 1.4, height: 50, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primary }}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Ha, qo'shish</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Product Search Modal ─────────────────────────────────────────────────────
function ProductSearch({ visible, products, onSelect, onClose }: {
  visible: boolean; products: Product[]; onSelect: (p: Product) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || "").includes(search) ||
    (p.rang || "").toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.background }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: C.text }}>Mahsulot tanlash</Text>
          <TouchableOpacity onPress={() => { setSearch(""); onClose(); }}><Feather name="x" size={22} color={C.textSecondary} /></TouchableOpacity>
        </View>
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, paddingHorizontal: 12, height: 44 }}>
            <Feather name="search" size={16} color={C.textSecondary} />
            <TextInput style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text }}
              value={search} onChangeText={setSearch} placeholder="Nom, barcode, rang..." placeholderTextColor={C.textSecondary} autoFocus />
            {search ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={16} color={C.textSecondary} /></TouchableOpacity> : null}
          </View>
        </View>
        <FlatList data={filtered} keyExtractor={p => String(p.id)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item: p }) => {
            const isOut = p.stock <= 0;
            return (
              <TouchableOpacity onPress={() => {
                if (isOut) { Alert.alert("Zaxira yo'q", `"${p.name}" tugagan`); return; }
                onSelect(p); setSearch(""); onClose();
              }} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: isOut ? "#FCA5A5" : C.border, backgroundColor: C.card, opacity: isOut ? 0.7 : 1 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 2 }}>
                    {[p.rang, p.material].filter(Boolean).join(" · ")}{p.barcode ? ` · ${p.barcode}` : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.primary }}>{fmt(p.pricePerUnit)}</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: isOut ? "#EF4444" : "#10B981" }}>
                    {isOut ? "Tugagan" : `${p.stock} ${p.unit}`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", padding: 40, gap: 10 }}>
              <Feather name="package" size={36} color={C.border} />
              <Text style={{ color: C.textSecondary, fontFamily: "Inter_400Regular" }}>Topilmadi</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

// ─── Cart Item Row ────────────────────────────────────────────────────────────
function CartRow({ item, onQtyChange, onRemove }: {
  item: CartItem; onQtyChange: (qty: number) => void; onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [qtyText, setQtyText] = useState(String(item.qty));
  const isFloat = item.product.unit === "metr" || item.product.unit === "rulon" || item.product.unit === "litr" || item.product.unit === "kg";
  const step = isFloat ? 0.5 : 1;

  function confirmQty() {
    const v = parseFloat(qtyText) || 0;
    if (v <= 0) { onRemove(); return; }
    onQtyChange(v); setEditing(false);
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text }} numberOfLines={1}>{item.product.name}</Text>
        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary }}>{fmt(item.price)} / {item.product.unit}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <TouchableOpacity onPress={() => item.qty > step ? onQtyChange(parseFloat((item.qty - step).toFixed(2))) : onRemove()}
          style={{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.surface }}>
          <Feather name="minus" size={14} color={C.text} />
        </TouchableOpacity>
        {editing ? (
          <TextInput style={{ width: 60, height: 32, borderWidth: 1.5, borderRadius: 8, textAlign: "center", fontSize: 14, fontFamily: "Inter_600SemiBold", borderColor: C.primary, color: C.text }}
            value={qtyText} onChangeText={setQtyText} onBlur={confirmQty} onSubmitEditing={confirmQty}
            keyboardType="decimal-pad" autoFocus />
        ) : (
          <TouchableOpacity onPress={() => { setQtyText(String(item.qty)); setEditing(true); }} style={{ width: 60, height: 32, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: C.text }}>{item.qty % 1 === 0 ? item.qty : item.qty.toFixed(2)}</Text>
            <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: C.textSecondary }}>{item.product.unit}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => onQtyChange(parseFloat((item.qty + step).toFixed(2)))}
          style={{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.primary }}>
          <Feather name="plus" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.text }}>{fmt(item.qty * item.price)}</Text>
        <TouchableOpacity onPress={onRemove}><Feather name="trash-2" size={14} color="#EF4444" /></TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SotuvScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  // Camera — useCameraPermissions at TOP level (not in sub-component!)
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const lastScanned = useRef<string | null>(null);

  // Cart & UI state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [chegirma, setChegirma] = useState("");
  const [tolovTuri, setTolovTuri] = useState<"naqd" | "plastik" | "aralash">("naqd");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  // Not found flow
  const [notFoundBarcode, setNotFoundBarcode] = useState("");
  const [showNotFound, setShowNotFound] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [showSearch, setShowSearch] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  const { data: products = [], refetch: refetchProducts } = useQuery<Product[]>({
    queryKey: ["products-for-sale"],
    queryFn: () => apiReq<Product[]>("/products?limit=500"),
  });
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: () => apiReq<any[]>("/categories"),
  });

  const jami = cart.reduce((s, it) => s + it.qty * it.price, 0);
  const chegirmaVal = parseFloat(chegirma) || 0;
  const yakuniy = Math.max(0, jami - chegirmaVal);

  function addToCart(product: Product) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id);
      if (idx >= 0) {
        const u = [...prev];
        u[idx] = { ...u[idx], qty: parseFloat((u[idx].qty + 1).toFixed(2)) };
        return u;
      }
      return [...prev, { product, qty: 1, price: product.pricePerUnit }];
    });
  }

  async function lookupBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBarcodeInput("");
    setLookingUp(true);
    try {
      const local = products.find(p => p.barcode === trimmed);
      if (local) { addToCart(local); return; }
      try {
        const found = await apiReq<Product>(`/products/by-barcode/${encodeURIComponent(trimmed)}`);
        addToCart(found);
      } catch {
        setNotFoundBarcode(trimmed);
        setShowNotFound(true);
      }
    } finally { setLookingUp(false); }
  }

  // Barcode scanned callback — called by CameraView inline
  async function handleBarcode({ data }: { type: string; data: string }) {
    if (scanned || lookingUp || data === lastScanned.current) return;
    lastScanned.current = data;
    setScanned(true);
    setShowScanner(false);
    if (Platform.OS !== "web") Vibration.vibrate(80);
    await lookupBarcode(data);
    // Reset for next scan
    setTimeout(() => {
      setScanned(false);
      lastScanned.current = null;
    }, 1000);
  }

  function openScanner() {
    setScanned(false);
    lastScanned.current = null;
    setTorch(false);
    if (!permission?.granted) {
      requestPermission();
    }
    setShowScanner(true);
  }

  function updateQty(idx: number, qty: number) {
    setCart(prev => prev.map((it, i) => i === idx ? { ...it, qty } : it));
  }
  function removeItem(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      const items = cart.map(it => ({
        productId: it.product.id,
        productName: it.product.name,
        unit: it.product.unit,
        qty: it.qty,
        pricePerUnit: it.price,
        buyingPrice: it.product.buyingPrice,
      }));
      const sale = await apiReq<Record<string, any>>("/product-sales", {
        method: "POST",
        body: JSON.stringify({ items, tolovTuri, chegirma: chegirmaVal }),
      });
      setLastSale({ ...sale, cartSnapshot: [...cart], yakuniy, tolovTuri });
      setCart([]); setChegirma(""); setShowCheckout(false);
      refetchProducts();
      qc.invalidateQueries({ queryKey: ["products-for-sale"] });
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Saqlashda xato");
    } finally { setSaving(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>

      {/* ════ SCANNER FULLSCREEN ════ */}
      {showScanner && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#0A0A0A" }]}>
            {/* Top bar */}
            <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TouchableOpacity onPress={() => setShowScanner(false)}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
                <Feather name="arrow-left" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" }}>Barkod skaner</Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Inter_400Regular" }}>Mahsulot barcodni skanerlang</Text>
              </View>
              <TouchableOpacity onPress={() => { setScanned(false); lastScanned.current = null; }}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
                <Feather name="refresh-ccw" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Camera area */}
            {!permission?.granted ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 }}>
                <Feather name="camera-off" size={52} color="rgba(255,255,255,0.4)" />
                <Text style={{ color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" }}>Kamera ruxsati kerak</Text>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" }}>
                  Barkod o'qish uchun kameraga ruxsat bering
                </Text>
                <TouchableOpacity onPress={requestPermission}
                  style={{ backgroundColor: C.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}>
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Ruxsat berish</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowScanner(false)}>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular" }}>Yopish</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ height: 340, position: "relative", overflow: "hidden" }}>
                {!scanned ? (
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    autofocus="on"
                    zoom={0}
                    enableTorch={torch}
                    barcodeScannerSettings={{
                      barcodeTypes: ["ean13", "ean8", "code128", "code39", "upc_a", "upc_e", "qr", "pdf417", "aztec", "codabar"],
                    }}
                    onBarcodeScanned={handleBarcode}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#111", alignItems: "center", justifyContent: "center", gap: 12 }]}>
                    <ActivityIndicator color="#4ADE80" size="large" />
                    <Text style={{ color: "#4ADE80", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>O'qildi! Tekshirilmoqda...</Text>
                  </View>
                )}

                {/* Torch */}
                {!scanned && (
                  <TouchableOpacity onPress={() => setTorch(t => !t)}
                    style={{ position: "absolute", bottom: 12, right: 12, zIndex: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: torch ? "#FCD34D" : "rgba(255,255,255,0.3)" }}>
                    <Feather name={torch ? "zap" : "zap-off"} size={20} color={torch ? "#FCD34D" : "#fff"} />
                  </TouchableOpacity>
                )}

                {/* Scan frame overlay */}
                <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
                  <View style={{ width: 280, height: 170, position: "relative", marginBottom: 12 }}>
                    {/* Corners */}
                    {[
                      { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
                      { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
                      { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
                      { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
                    ].map((s, i) => (
                      <View key={i} style={{ position: "absolute", width: 22, height: 22, borderColor: "#fff", ...s }} />
                    ))}
                    {!scanned && (
                      <View style={{ position: "absolute", top: "50%", left: 4, right: 4, height: 2, backgroundColor: "#4ADE80", opacity: 0.9 }} />
                    )}
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
                    📷 Barcodni ramka ichiga yo'naltiring
                  </Text>
                </View>
              </View>
            )}

            {/* Bottom panel */}
            <View style={{ flex: 1, backgroundColor: C.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, alignItems: "center", justifyContent: "center", gap: 12 }}>
              <Feather name="maximize" size={32} color={C.primary} />
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text }}>Skanerlash kutilmoqda</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center" }}>
                Mahsulot barcodni yuqoridagi kameraga ko'rsating
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ════ MODALS ════ */}
      <NotFoundDialog
        visible={showNotFound}
        barcode={notFoundBarcode}
        onClose={() => setShowNotFound(false)}
        onAddNew={() => { setShowNotFound(false); setShowQuickAdd(true); }}
      />
      <QuickAddModal
        visible={showQuickAdd}
        barcode={notFoundBarcode}
        categories={categories}
        onClose={() => setShowQuickAdd(false)}
        onAdded={(product) => {
          setShowQuickAdd(false);
          refetchProducts();
          qc.invalidateQueries({ queryKey: ["products-for-sale"] });
          qc.invalidateQueries({ queryKey: ["products-list"] });
          addToCart(product);
        }}
      />
      <ProductSearch
        visible={showSearch}
        products={products}
        onSelect={(p) => { addToCart(p); setShowSearch(false); }}
        onClose={() => setShowSearch(false)}
      />

      {/* ════ CHECKOUT MODAL ════ */}
      <Modal visible={showCheckout} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCheckout(false)}>
        <View style={{ flex: 1, backgroundColor: C.background }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: C.text }}>Sotuvni tasdiqlash</Text>
            <TouchableOpacity onPress={() => setShowCheckout(false)}><Feather name="x" size={22} color={C.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 24 }}>
            {/* Items */}
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10, backgroundColor: C.card }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Mahsulotlar ({cart.length} ta)
              </Text>
              {cart.map((it, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 13, color: C.text, fontFamily: "Inter_400Regular" }} numberOfLines={1}>{it.product.name}</Text>
                  <Text style={{ fontSize: 12, color: C.textSecondary }}>×{it.qty} {it.product.unit}</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text }}>{fmt(it.qty * it.price)}</Text>
                </View>
              ))}
            </View>

            {/* Discount */}
            <View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Chegirma (so'm)</Text>
              <TextInput style={{ height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, fontFamily: "Inter_400Regular", backgroundColor: C.card, borderColor: C.border, color: C.text }}
                value={chegirma} onChangeText={setChegirma} placeholder="0" placeholderTextColor={C.textSecondary} keyboardType="numeric" />
            </View>

            {/* Payment type */}
            <View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>To'lov turi</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {(["naqd", "plastik", "aralash"] as const).map(t => (
                  <TouchableOpacity key={t} onPress={() => setTolovTuri(t)}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, backgroundColor: tolovTuri === t ? C.primary : C.card, borderColor: tolovTuri === t ? C.primary : C.border }}>
                    <Feather name={t === "naqd" ? "dollar-sign" : t === "plastik" ? "credit-card" : "layers"} size={15} color={tolovTuri === t ? "#fff" : C.textSecondary} />
                    <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: tolovTuri === t ? "#fff" : C.text }}>
                      {t === "naqd" ? "Naqd" : t === "plastik" ? "Plastik" : "Aralash"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Total */}
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10, backgroundColor: C.card }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: C.textSecondary }}>Jami:</Text>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: C.text }}>{fmt(jami)}</Text>
              </View>
              {chegirmaVal > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: "#EF4444" }}>Chegirma:</Text>
                  <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#EF4444" }}>−{fmt(chegirmaVal)}</Text>
                </View>
              )}
              <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginTop: 4 }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: C.text }}>To'lash kerak:</Text>
                <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: C.primary }}>{fmt(yakuniy)}</Text>
              </View>
            </View>
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: C.border }}>
            <TouchableOpacity onPress={() => setShowCheckout(false)}
              style={{ flex: 0.8, height: 54, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.textSecondary, fontFamily: "Inter_500Medium", fontSize: 15 }}>Bekor</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCheckout} disabled={saving}
              style={{ flex: 1.5, height: 54, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#10B981", opacity: saving ? 0.7 : 1 }}>
              {saving ? <ActivityIndicator color="#fff" />
                : <><Feather name="check" size={18} color="#fff" /><Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Sotish · {fmt(yakuniy)}</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════ SUCCESS RECEIPT ════ */}
      {lastSale && (
        <Modal visible animationType="fade" transparent>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <View style={{ width: "100%", maxWidth: 360, borderRadius: 20, padding: 24, alignItems: "center", backgroundColor: C.background }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Feather name="check" size={30} color="#10B981" />
              </View>
              <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: C.text }}>Sotuv amalga oshirildi!</Text>
              <Text style={{ fontSize: 30, fontFamily: "Inter_700Bold", color: C.primary, marginTop: 6 }}>{fmt(lastSale.yakuniy)}</Text>
              <Text style={{ fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 4 }}>
                {lastSale.tolovTuri === "naqd" ? "💵 Naqd" : lastSale.tolovTuri === "plastik" ? "💳 Plastik" : "🔀 Aralash"}
              </Text>
              <View style={{ borderTopWidth: 1, borderTopColor: C.border, width: "100%", marginVertical: 12 }} />
              {lastSale.cartSnapshot?.map((it: CartItem, i: number) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: 3 }}>
                  <Text style={{ color: C.text, fontFamily: "Inter_400Regular", flex: 1 }} numberOfLines={1}>{it.product.name}</Text>
                  <Text style={{ color: C.textSecondary, marginHorizontal: 8 }}>×{it.qty}</Text>
                  <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold" }}>{fmt(it.qty * it.price)}</Text>
                </View>
              ))}
              {/* Print receipt button */}
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await printReceipt(lastSale);
                  } catch (e: any) {
                    Alert.alert("Xato", e.message || "Chek chiqarishda xato");
                  }
                }}
                style={{ marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                  width: "100%", paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
                  backgroundColor: C.card }}
              >
                <Feather name="printer" size={17} color={C.primary} />
                <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Chek chiqarish</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLastSale(null)}
                style={{ marginTop: 10, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", width: "100%" }}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>✓ Yangi sotuv</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ════ MAIN CONTENT ════ */}
      {/* Header */}
      <View style={{ paddingTop: topPad, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: C.text }}>Sotuv</Text>
            {cart.length > 0
              ? <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: C.primary, marginTop: 2 }}>{cart.length} ta mahsulot · {fmt(jami)}</Text>
              : <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary, marginTop: 2 }}>Barkod skaner yoki qidirish</Text>}
          </View>
          {cart.length > 0 && (
            <TouchableOpacity onPress={() => Alert.alert("Tozalash", "Savatchani tozalaysizmi?", [
              { text: "Yo'q" },
              { text: "Ha", style: "destructive", onPress: () => { setCart([]); setChegirma(""); } },
            ])} style={{ padding: 8 }}>
              <Feather name="trash-2" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Barcode input bar */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, margin: 16, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 52, backgroundColor: C.card }}>
          <Feather name="hash" size={16} color={lookingUp ? C.primary : C.textSecondary} />
          {lookingUp
            ? <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="small" />
            : (
              <TextInput
                style={{ flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: C.text }}
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                onSubmitEditing={() => lookupBarcode(barcodeInput)}
                placeholder="Barkod raqami kiriting..."
                placeholderTextColor={C.textSecondary}
                keyboardType="number-pad"
                returnKeyType="search"
              />
            )}
          <TouchableOpacity onPress={openScanner} style={{ width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.primary }}>
            <Feather name="camera" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 6 }}>
          <TouchableOpacity onPress={() => setShowSearch(true)}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card }}>
            <Feather name="search" size={17} color={C.primary} />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.primary }}>Mahsulot qidirish</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openScanner}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: C.primary }}>
            <Feather name="camera" size={17} color="#fff" />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" }}>Kamera skaner</Text>
          </TouchableOpacity>
        </View>

        {/* Cart */}
        {cart.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
            <Feather name="shopping-cart" size={52} color={C.border} />
            <Text style={{ fontSize: 18, fontFamily: "Inter_600SemiBold", color: C.textSecondary }}>Savatcha bo'sh</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", lineHeight: 20 }}>
              Mahsulot qo'shish uchun barkodni skaner bilan o'qing{"\n"}yoki «Mahsulot qidirish» tugmasini bosing
            </Text>
            <TouchableOpacity onPress={openScanner}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8, backgroundColor: C.primary }}>
              <Feather name="camera" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Skaner ochish</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 180 }}>
            {cart.map((item, idx) => (
              <CartRow key={`${item.product.id}-${idx}`}
                item={item}
                onQtyChange={(qty) => updateQty(idx, qty)}
                onRemove={() => removeItem(idx)}
              />
            ))}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Checkout bottom bar */}
      {cart.length > 0 && (
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 16, padding: 16, paddingBottom: insets.bottom + 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: C.border }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary }}>Jami to'lash:</Text>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: C.primary }}>{fmt(yakuniy)}</Text>
          </View>
          <TouchableOpacity onPress={() => setShowCheckout(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, backgroundColor: "#10B981" }}>
            <Feather name="check-circle" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>Sotish</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
