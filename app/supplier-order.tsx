import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, FlatList, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";

const C = Colors.light;

interface Product {
  id: number;
  name: string;
  category: string;
  pricePerUnit: number;
  buyingPrice: number;
  stock: number;
  unit: string;
  barcode: string | null;
}

interface OrderItem {
  productId: number;
  productName: string;
  unit: string;
  miqdor: string;
  narx: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0)) + " so'm";
}

export default function SupplierOrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const [step, setStep] = useState<"form" | "products">("form");
  const [yetkazuvchi, setYetkazuvchi] = useState("");
  const [yolkira, setYolkira] = useState("");
  const [izoh, setIzoh] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: rawProducts = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["products-for-order"],
    queryFn: async () => {
      const res = await apiReq("/products") as any;
      return res.products || res || [];
    },
  });

  const filteredProducts = useMemo(() => {
    if (!search) return rawProducts;
    return rawProducts.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode || "").includes(search) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [rawProducts, search]);

  function addProduct(p: Product) {
    const exists = items.find(i => i.productId === p.id);
    if (exists) {
      Alert.alert("Allaqo'shilgan", `"${p.name}" ro'yxatda bor`);
      setStep("form");
      return;
    }
    setItems(prev => [...prev, {
      productId: p.id,
      productName: p.name,
      unit: p.unit,
      miqdor: "",
      narx: String(p.buyingPrice || ""),
    }]);
    setStep("form");
    setSearch("");
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: "miqdor" | "narx", val: string) {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  }

  const totalSum = items.reduce((s, i) => {
    const m = parseFloat(i.miqdor) || 0;
    const n = parseFloat(i.narx) || 0;
    return s + m * n;
  }, 0);

  const grandTotal = totalSum + (parseFloat(yolkira) || 0);

  async function handleSave() {
    if (items.length === 0) { Alert.alert("Xato", "Kamida bitta mahsulot qo'shing"); return; }
    const missingQty = items.find(i => !i.miqdor || parseFloat(i.miqdor) <= 0);
    if (missingQty) { Alert.alert("Xato", `"${missingQty.productName}" miqdori kiritilmagan`); return; }

    setSaving(true);
    try {
      const receiptNumber = `RCP-${Date.now()}`;
      const body = {
        receiptNumber,
        yetkazuvchi: yetkazuvchi.trim() || "Noma'lum",
        kelganSana: new Date().toISOString(),
        yolkira: parseFloat(yolkira) || 0,
        qoshimchaHarajat: 0,
        jami: grandTotal,
        izoh: izoh.trim() || null,
        status: "keldi",
        items: items.map(i => ({
          productId: i.productId,
          mahsulotNomi: i.productName,
          miqdor: parseFloat(i.miqdor),
          narx: parseFloat(i.narx) || 0,
          jami: (parseFloat(i.miqdor) || 0) * (parseFloat(i.narx) || 0),
        })),
      };

      await apiReq("/stock-receipts", {
        method: "POST",
        body: JSON.stringify(body),
      });

      await qc.invalidateQueries({ queryKey: ["products-all"] });
      await qc.invalidateQueries({ queryKey: ["products-catalog"] });
      await qc.invalidateQueries({ queryKey: ["products-for-order"] });

      Alert.alert(
        "✅ Kirim saqlandi",
        `${yetkazuvchi || "Yetkazuvchi"} dan ${items.length} ta mahsulot kirim qilindi.\nJami: ${fmt(grandTotal)}`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Saqlashda xato");
    } finally {
      setSaving(false);
    }
  }

  // Product picker screen
  if (step === "products") {
    return (
      <View style={[s.root, { backgroundColor: C.background }]}>
        <View style={[s.header, { paddingTop: topPad }]}>
          <TouchableOpacity style={[s.backBtn, { backgroundColor: C.card }]} onPress={() => setStep("form")}>
            <Feather name="arrow-left" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={[s.title, { color: C.text }]}>Mahsulot tanlash</Text>
        </View>
        <View style={[s.searchRow, { backgroundColor: C.card, borderColor: C.border }]}>
          <Feather name="search" size={16} color={C.textSecondary} />
          <TextInput
            style={[s.searchInput, { color: C.text }]}
            placeholder="Qidirish..."
            placeholderTextColor={C.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
        {productsLoading
          ? <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
          : (
          <FlatList
            data={filteredProducts}
            keyExtractor={i => i.id.toString()}
            contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: insets.bottom + 20 }}
            renderItem={({ item: p }) => (
              <TouchableOpacity
                style={[s.productItem, { backgroundColor: C.card, borderColor: C.border }]}
                onPress={() => addProduct(p)}
              >
                <View style={[s.productItemIcon, { backgroundColor: C.surface }]}>
                  <Feather name="package" size={18} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.productItemName, { color: C.text }]}>{p.name}</Text>
                  <Text style={[s.productItemMeta, { color: C.textSecondary }]}>
                    {p.category} · Ombor: {p.stock} {p.unit}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[s.productItemPrice, { color: C.primary }]}>{fmt(p.buyingPrice)}</Text>
                  <Text style={[s.productItemUnit, { color: C.textSecondary }]}>/{p.unit}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: C.card }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: C.text }]}>Yetkazuvchi kirim</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>{items.length} ta mahsulot</Text>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }}
      >
        {/* Supplier info */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={s.cardHeader}>
            <Feather name="truck" size={16} color={C.primary} />
            <Text style={[s.cardTitle, { color: C.text }]}>Yetkazuvchi ma'lumotlari</Text>
          </View>
          <Field label="Yetkazuvchi nomi" value={yetkazuvchi} onChange={setYetkazuvchi} placeholder="Kompaniya yoki shaxs..." />
          <Field label="Yo'lkira (so'm)" value={yolkira} onChange={setYolkira} placeholder="0" keyboardType="numeric" />
          <Field label="Izoh" value={izoh} onChange={setIzoh} multiline />
        </View>

        {/* Products */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[s.cardHeader, { marginBottom: 12 }]}>
            <Feather name="package" size={16} color={C.primary} />
            <Text style={[s.cardTitle, { color: C.text }]}>Mahsulotlar</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[s.addProdBtn, { backgroundColor: C.primary }]}
              onPress={() => setStep("products")}
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={s.addProdBtnTxt}>Qo'shish</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <TouchableOpacity
              style={[s.emptyProd, { borderColor: C.border, backgroundColor: C.surface }]}
              onPress={() => setStep("products")}
            >
              <Feather name="plus-circle" size={24} color={C.primary} />
              <Text style={[s.emptyProdTxt, { color: C.textSecondary }]}>Mahsulot qo'shish uchun bosing</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 10 }}>
              {items.map((item, idx) => (
                <View key={item.productId} style={[s.itemRow, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <View style={s.itemHeader}>
                    <Text style={[s.itemName, { color: C.text }]} numberOfLines={1}>{item.productName}</Text>
                    <TouchableOpacity onPress={() => removeItem(idx)}>
                      <Feather name="x" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                  <View style={s.itemInputs}>
                    <View style={s.itemInputWrap}>
                      <Text style={[s.itemInputLbl, { color: C.textSecondary }]}>Miqdor ({item.unit})</Text>
                      <TextInput
                        style={[s.itemInput, { color: C.text, borderColor: C.border }]}
                        value={item.miqdor}
                        onChangeText={v => updateItem(idx, "miqdor", v)}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={C.textSecondary}
                      />
                    </View>
                    <View style={s.itemInputWrap}>
                      <Text style={[s.itemInputLbl, { color: C.textSecondary }]}>Narx (so'm)</Text>
                      <TextInput
                        style={[s.itemInput, { color: C.text, borderColor: C.border }]}
                        value={item.narx}
                        onChangeText={v => updateItem(idx, "narx", v)}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={C.textSecondary}
                      />
                    </View>
                    <View style={s.itemInputWrap}>
                      <Text style={[s.itemInputLbl, { color: C.textSecondary }]}>Jami</Text>
                      <Text style={[s.itemTotal, { color: C.primary }]}>
                        {fmt((parseFloat(item.miqdor) || 0) * (parseFloat(item.narx) || 0))}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Summary */}
        {items.length > 0 && (
          <View style={[s.summary, { backgroundColor: C.primary }]}>
            <View style={s.summaryRow}>
              <Text style={s.summaryLbl}>Mahsulotlar:</Text>
              <Text style={s.summaryVal}>{fmt(totalSum)}</Text>
            </View>
            {parseFloat(yolkira) > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLbl}>Yo'lkira:</Text>
                <Text style={s.summaryVal}>{fmt(parseFloat(yolkira))}</Text>
              </View>
            )}
            <View style={[s.summaryRow, s.summaryTotal]}>
              <Text style={s.summaryTotalLbl}>Jami to'lov:</Text>
              <Text style={s.summaryTotalVal}>{fmt(grandTotal)}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Save button */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 8, backgroundColor: C.card, borderTopColor: C.border }]}>
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: items.length > 0 ? "#10B981" : C.border }]}
          onPress={handleSave}
          disabled={saving || items.length === 0}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Feather name="save" size={18} color="#fff" />
              <Text style={s.saveBtnTxt}>Kirimni saqlash</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: "Inter_500Medium" }}>{label}</Text>
      <TextInput
        style={[{
          borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
          fontSize: 14, fontFamily: "Inter_400Regular",
          color: C.text, borderColor: C.border, backgroundColor: C.surface,
        }, multiline && { height: 70, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || label + "..."}
        placeholderTextColor={C.textSecondary}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  addProdBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  addProdBtnTxt: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyProd: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 12, padding: 20, alignItems: "center", gap: 8 },
  emptyProdTxt: { fontSize: 13, fontFamily: "Inter_400Regular" },
  itemRow: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  itemHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemName: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1, marginRight: 8 },
  itemInputs: { flexDirection: "row", gap: 8 },
  itemInputWrap: { flex: 1, gap: 3 },
  itemInputLbl: { fontSize: 10, fontFamily: "Inter_400Regular" },
  itemInput: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 13, fontFamily: "Inter_400Regular" },
  itemTotal: { fontSize: 13, fontFamily: "Inter_700Bold", paddingTop: 10 },
  summary: { borderRadius: 16, padding: 16, gap: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLbl: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular" },
  summaryVal: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  summaryTotal: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", paddingTop: 8, marginTop: 4 },
  summaryTotalLbl: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  summaryTotalVal: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  bottomBar: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  saveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 16 },
  saveBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  productItem: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 12 },
  productItemIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  productItemName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  productItemMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  productItemPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },
  productItemUnit: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
