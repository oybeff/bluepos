import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import { CameraView, useCameraPermissions } from "expo-camera";

const C = Colors.light;

const UNITS = ["metr", "dona", "kg", "rulon", "paket", "litr", "quti"];

interface Item {
  mahsulotNomi: string;
  miqdor: string;
  birlik: string;
  kelganNarx: string;
}

function newItem(): Item {
  return { mahsulotNomi: "", miqdor: "", birlik: "metr", kelganNarx: "" };
}

function fmt(n: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";
}

export default function OldiBerdiScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();

  const [yetkazuvchi, setYetkazuvchi] = useState("");
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [yolkira, setYolkira] = useState("");
  const [izoh, setIzoh] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [scanTarget, setScanTarget] = useState<number | null>(null);
  const [scanCooldown, setScanCooldown] = useState(false);

  const openScanner = async (itemIndex: number) => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { Alert.alert("Kamera ruxsati kerak"); return; }
    }
    setScanTarget(itemIndex);
    setScanCooldown(false);
  };

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanCooldown || scanTarget === null) return;
    setScanCooldown(true);
    updateItem(scanTarget, "mahsulotNomi", data);
    setScanTarget(null);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 110);

  const updateItem = (i: number, field: keyof Item, val: string) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  };

  const addItem = () => setItems(prev => [...prev, newItem()]);

  const removeItem = (i: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== i));
  };

  const itemTotal = (it: Item) => {
    const q = parseFloat(it.miqdor) || 0;
    const p = parseFloat(it.kelganNarx) || 0;
    return q * p;
  };

  const subtotal = items.reduce((s, it) => s + itemTotal(it), 0);
  const shipping = parseFloat(yolkira) || 0;
  const grandTotal = subtotal + shipping;

  const canSubmit = yetkazuvchi.trim() && items.some(it => it.mahsulotNomi.trim() && parseFloat(it.miqdor) > 0);

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert("Xato", "Yetkazuvchi ismi va kamida 1 ta mahsulot kiriting");
      return;
    }

    const validItems = items.filter(it => it.mahsulotNomi.trim() && parseFloat(it.miqdor) > 0);

    setLoading(true);
    try {
      await apiReq("/stock-receipts", {
        method: "POST",
        body: JSON.stringify({
          yetkazuvchi: yetkazuvchi.trim(),
          yolkira: shipping,
          izoh: izoh.trim() || null,
          items: validItems.map(it => ({
            mahsulotNomi: it.mahsulotNomi.trim(),
            miqdor: parseFloat(it.miqdor),
            birlik: it.birlik,
            kelganNarx: parseFloat(it.kelganNarx) || 0,
            sotishNarx: 0,
            jami: itemTotal(it),
          })),
        }),
      });

      await qc.invalidateQueries({ queryKey: ["products"] });
      setSuccess(true);

      setTimeout(() => {
        setYetkazuvchi("");
        setItems([newItem()]);
        setYolkira("");
        setIzoh("");
        setSuccess(false);
      }, 2000);
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Server xatosi");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[s.root, s.successRoot, { backgroundColor: "#F0FDF4" }]}>
        <View style={s.successBox}>
          <View style={s.successIcon}>
            <Feather name="check" size={40} color="#fff" />
          </View>
          <Text style={s.successTitle}>Berildi!</Text>
          <Text style={s.successSub}>Ombor muvaffaqiyatli yangilandi</Text>
          <Text style={s.successAmt}>{fmt(grandTotal)}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.root, { backgroundColor: C.background }]}>
        {/* Header */}
        <View style={[s.header, { paddingTop: topPadding + 12, borderBottomWidth: 1, borderBottomColor: C.border }]}>
          <View>
            <Text style={[s.title, { color: C.text }]}>Tovar kirim</Text>
            <Text style={[{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 2 }]}>
              Kelgan tovarlarni qo'shish
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Supplier */}
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.cardTitle, { color: C.text }]}>Yetkazuvchi</Text>
            <View style={[s.inputRow, { borderColor: C.border }]}>
              <Feather name="user" size={16} color={C.textSecondary} />
              <TextInput
                style={[s.input, { color: C.text }]}
                placeholder="Masalan: Mirzamol"
                placeholderTextColor={C.textSecondary}
                value={yetkazuvchi}
                onChangeText={setYetkazuvchi}
              />
            </View>
          </View>

          {/* Items */}
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={s.cardHeader}>
              <Text style={[s.cardTitle, { color: C.text }]}>Mahsulotlar</Text>
              <TouchableOpacity onPress={addItem} style={[s.addBtn, { backgroundColor: C.primary + "18" }]}>
                <Feather name="plus" size={16} color={C.primary} />
                <Text style={[s.addBtnTxt, { color: C.primary }]}>Qo'shish</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 16, marginTop: 8 }}>
              {items.map((it, i) => (
                <View key={i} style={[s.itemBox, { borderColor: C.border }]}>
                  <View style={s.itemHeader}>
                    <View style={[s.itemNum, { backgroundColor: C.primary }]}>
                      <Text style={s.itemNumTxt}>{i + 1}</Text>
                    </View>
                    <Text style={[s.itemTitle, { color: C.text }]}>Mahsulot {i + 1}</Text>
                    {items.length > 1 && (
                      <TouchableOpacity onPress={() => removeItem(i)} style={s.removeBtn}>
                        <Feather name="x" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Product name */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={[s.inputRow, { borderColor: C.border, flex: 1 }]}>
                      <Feather name="package" size={16} color={C.textSecondary} />
                      <TextInput
                        style={[s.input, { color: C.text }]}
                        placeholder="Mahsulot nomi (masalan: Zashitnik)"
                        placeholderTextColor={C.textSecondary}
                        value={it.mahsulotNomi}
                        onChangeText={v => updateItem(i, "mahsulotNomi", v)}
                      />
                    </View>
                    <TouchableOpacity
                      style={[s.scanBtn, { borderColor: C.border, backgroundColor: C.primary + "12" }]}
                      onPress={() => openScanner(i)}
                    >
                      <Feather name="maximize" size={18} color={C.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Qty + Unit */}
                  <View style={s.twoCol}>
                    <View style={[s.inputRow, { borderColor: C.border, flex: 1 }]}>
                      <Feather name="layers" size={16} color={C.textSecondary} />
                      <TextInput
                        style={[s.input, { color: C.text }]}
                        placeholder="Miqdor"
                        placeholderTextColor={C.textSecondary}
                        value={it.miqdor}
                        onChangeText={v => updateItem(i, "miqdor", v)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 0 }}>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {UNITS.map(u => (
                          <TouchableOpacity
                            key={u}
                            onPress={() => updateItem(i, "birlik", u)}
                            style={[s.unitBtn, it.birlik === u && { backgroundColor: C.primary, borderColor: C.primary }]}
                          >
                            <Text style={[s.unitTxt, { color: it.birlik === u ? "#fff" : C.textSecondary }]}>{u}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  {/* Price */}
                  <View style={[s.inputRow, { borderColor: C.border }]}>
                    <Feather name="dollar-sign" size={16} color={C.textSecondary} />
                    <TextInput
                      style={[s.input, { color: C.text }]}
                      placeholder="Kelgan narx (1 birlik uchun)"
                      placeholderTextColor={C.textSecondary}
                      value={it.kelganNarx}
                      onChangeText={v => updateItem(i, "kelganNarx", v)}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  {/* Row total */}
                  {itemTotal(it) > 0 && (
                    <View style={[s.rowTotal, { backgroundColor: C.primary + "12" }]}>
                      <Text style={[s.rowTotalTxt, { color: C.primary }]}>
                        {it.miqdor} {it.birlik} × {parseFloat(it.kelganNarx).toLocaleString()} = {fmt(itemTotal(it))}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Extra */}
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.cardTitle, { color: C.text }]}>Qo'shimcha (ixtiyoriy)</Text>
            <View style={[s.inputRow, { borderColor: C.border }]}>
              <Feather name="truck" size={16} color={C.textSecondary} />
              <TextInput
                style={[s.input, { color: C.text }]}
                placeholder="Yo'lkira"
                placeholderTextColor={C.textSecondary}
                value={yolkira}
                onChangeText={setYolkira}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[s.inputRow, { borderColor: C.border, marginTop: 8 }]}>
              <Feather name="edit-3" size={16} color={C.textSecondary} />
              <TextInput
                style={[s.input, { color: C.text }]}
                placeholder="Izoh"
                placeholderTextColor={C.textSecondary}
                value={izoh}
                onChangeText={setIzoh}
              />
            </View>
          </View>

          {/* Summary */}
          <View style={[s.summary, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { color: C.textSecondary }]}>Mahsulotlar jami</Text>
              <Text style={[s.summaryVal, { color: C.text }]}>{fmt(subtotal)}</Text>
            </View>
            {shipping > 0 && (
              <View style={s.summaryRow}>
                <Text style={[s.summaryLabel, { color: C.textSecondary }]}>Yo'lkira</Text>
                <Text style={[s.summaryVal, { color: C.text }]}>{fmt(shipping)}</Text>
              </View>
            )}
            <View style={[s.summaryRow, s.summaryTotal]}>
              <Text style={[s.summaryTotalLabel, { color: C.text }]}>Hammasi</Text>
              <Text style={[s.summaryTotalVal, { color: C.primary }]}>{fmt(grandTotal)}</Text>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: canSubmit ? "#10B981" : "#CBD5E1", opacity: loading ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={loading || !canSubmit}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check-circle" size={22} color="#fff" />
                <Text style={s.submitTxt}>Berildi</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Barcode Scanner Modal */}
      <Modal visible={scanTarget !== null} animationType="slide" onRequestClose={() => setScanTarget(null)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, paddingTop: insets.top + 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" }}>Barkod skaner</Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 }}>Barkodni kameraga yaqinlashtiring</Text>
            </View>
            <TouchableOpacity
              onPress={() => setScanTarget(null)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
            >
              <Feather name="x" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {scanTarget !== null && (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e", "pdf417"] }}
              onBarcodeScanned={handleBarcode}
            />
          )}

          {/* Scan frame overlay */}
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <View style={{ width: 260, height: 160, borderRadius: 16, borderWidth: 3, borderColor: C.primary, backgroundColor: "transparent" }}>
              <View style={{ position: "absolute", top: -3, left: -3, width: 32, height: 32, borderTopWidth: 4, borderLeftWidth: 4, borderColor: "#fff", borderRadius: 4 }} />
              <View style={{ position: "absolute", top: -3, right: -3, width: 32, height: 32, borderTopWidth: 4, borderRightWidth: 4, borderColor: "#fff", borderRadius: 4 }} />
              <View style={{ position: "absolute", bottom: -3, left: -3, width: 32, height: 32, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: "#fff", borderRadius: 4 }} />
              <View style={{ position: "absolute", bottom: -3, right: -3, width: 32, height: 32, borderBottomWidth: 4, borderRightWidth: 4, borderColor: "#fff", borderRadius: 4 }} />
            </View>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 16, textAlign: "center" }}>Barkod yoki QR kod</Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  successRoot: { alignItems: "center", justifyContent: "center" },
  successBox: { alignItems: "center", gap: 12 },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#10B981" },
  successSub: { fontSize: 16, fontFamily: "Inter_400Regular", color: "#64748B" },
  successAmt: { fontSize: 22, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { padding: 6 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  addBtnTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", height: 48 },
  itemBox: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  itemHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  itemNumTxt: { fontSize: 11, color: "#fff", fontFamily: "Inter_700Bold" },
  itemTitle: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  removeBtn: { padding: 4 },
  twoCol: { gap: 8 },
  unitBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: "#E2E8F0" },
  unitTxt: { fontSize: 12, fontFamily: "Inter_500Medium" },
  rowTotal: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  rowTotalTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  summary: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  summaryVal: { fontSize: 14, fontFamily: "Inter_500Medium" },
  summaryTotal: { borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 10, marginTop: 4 },
  summaryTotalLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  summaryTotalVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 58, borderRadius: 18 },
  submitTxt: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  scanBtn: { width: 48, height: 48, borderWidth: 1.5, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
