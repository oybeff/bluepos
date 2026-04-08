import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, ActivityIndicator, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  PrinterSettings, defaultSettings,
  loadPrinterSettings, savePrinterSettings,
  printReceiptPdf, printBarcodeLabel,
} from "@/lib/printer";
import { apiReq } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const PAPER_SIZES = [
  { value: "58" as const, label: "58 mm", desc: "Kichik kassa" },
  { value: "80" as const, label: "80 mm", desc: "Standart" },
];
const LABEL_SIZES = [
  { value: "40x25" as const, label: "40×25 mm" },
  { value: "50x30" as const, label: "50×30 mm" },
  { value: "58x30" as const, label: "58×30 mm" },
  { value: "60x40" as const, label: "60×40 mm" },
];

function SectionHeader({ icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <View style={st.sectionHeader}>
      <View style={[st.sectionIcon, { backgroundColor: C.surface }]}>
        <Feather name={icon} size={20} color={C.primary} />
      </View>
      <View>
        <Text style={[st.sectionTitle, { color: C.text }]}>{title}</Text>
        <Text style={[st.sectionSub, { color: C.textSecondary }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboard, hint }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboard?: any; hint?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[st.fieldLabel, { color: C.textSecondary }]}>{label}</Text>
      <TextInput
        style={[st.input, { backgroundColor: C.background, borderColor: C.border, color: C.text }]}
        value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={C.textSecondary}
        keyboardType={keyboard || "default"} autoCapitalize="none" autoCorrect={false}
      />
      {hint && <Text style={[st.hint, { color: C.textSecondary }]}>{hint}</Text>}
    </View>
  );
}

function ChipRow<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string; desc?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
      {options.map(o => (
        <TouchableOpacity
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[st.chip, value === o.value && { backgroundColor: C.primary, borderColor: C.primary }]}
        >
          <Text style={[st.chipTxt, value === o.value && { color: "#fff" }]}>{o.label}</Text>
          {o.desc && <Text style={[st.chipSub, value === o.value && { color: "rgba(255,255,255,0.75)" }]}>{o.desc}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function PrinterSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<PrinterSettings>({ ...defaultSettings });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingReceipt, setTestingReceipt] = useState(false);
  const [testingBarcode, setTestingBarcode] = useState(false);

  useEffect(() => {
    loadPrinterSettings().then(s => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const set = useCallback(<K extends keyof PrinterSettings>(key: K, val: PrinterSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await savePrinterSettings(settings);
      Alert.alert("✅ Saqlandi", "Printer sozlamalari saqlandi");
    } catch {
      Alert.alert("Xato", "Saqlashda muammo");
    } finally {
      setSaving(false);
    }
  }

  async function testReceiptPrinter() {
    await savePrinterSettings(settings);
    setTestingReceipt(true);
    try {
      if (settings.receiptType === "wifi") {
        await apiReq<any>("/print/test", {
          method: "POST",
          body: JSON.stringify({
            printerIp: settings.receiptIp,
            printerPort: settings.receiptPort,
            paperMm: settings.receiptPaperMm,
          }),
        });
        Alert.alert("✅ Muvaffaqiyat", "Test cheki chop etildi!");
      } else {
        await printReceiptPdf({
          cartSnapshot: [
            { product: { name: "Test mahsulot", unit: "dona" }, qty: 2, price: 15000 },
            { product: { name: "Parda (sintetik)", unit: "metr" }, qty: 3.5, price: 45000 },
          ],
          discount: 5000,
          chegirmaVal: 5000,
          yakuniy: 152500,
          tolovTuri: "naqd",
        }, "BluePOS Do'kon");
      }
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Printer bilan ulanishda muammo");
    } finally {
      setTestingReceipt(false);
    }
  }

  async function testBarcodePrinter() {
    await savePrinterSettings(settings);
    setTestingBarcode(true);
    try {
      if (settings.barcodeEnabled) {
        await apiReq<any>("/print/barcode", {
          method: "POST",
          body: JSON.stringify({
            printerIp: settings.barcodeIp,
            printerPort: settings.barcodePort,
            name: "Test Mahsulot",
            barcode: "8690000000017",
            price: 35000,
            count: 1,
          }),
        });
        Alert.alert("✅ Muvaffaqiyat", "Test barcode chop etildi!");
      } else {
        await printBarcodeLabel({
          name: "Test Mahsulot",
          barcode: "8690000000017",
          pricePerUnit: 35000,
          unit: "dona",
        }, 2);
      }
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Printer bilan ulanishda muammo");
    } finally {
      setTestingBarcode(false);
    }
  }

  if (loading) {
    return (
      <View style={[st.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[st.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 12, borderBottomColor: C.border }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <View>
          <Text style={[st.headerTitle, { color: C.text }]}>Printer sozlamalari</Text>
          <Text style={[st.headerSub, { color: C.textSecondary }]}>Termal printer ulash</Text>
        </View>
        <TouchableOpacity
          style={[st.saveBtn, { backgroundColor: saving ? C.border : C.primary }]}
          onPress={handleSave} disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Feather name="save" size={15} color="#fff" /><Text style={st.saveBtnTxt}>Saqlash</Text></>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>

        {/* ── INFO CARD ── */}
        <View style={[st.infoCard, { backgroundColor: "#EEF2FF", borderColor: C.primary + "30" }]}>
          <Feather name="info" size={14} color={C.primary} />
          <Text style={[st.infoTxt, { color: C.primary }]}>
            WiFi termal printer bilan ulanish uchun printer va telefon bir xil Wi-Fi tarmoqda bo'lishi kerak.
            Printer IP manzilini printer sozlamalaridan yoki router dan toping.
            <Text style={{ fontFamily: "Inter_700Bold" }}> Port odatda 9100.</Text>
          </Text>
        </View>

        {/* ══════════════════════════════════
            ── RECEIPT PRINTER ──
        ══════════════════════════════════ */}
        <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={st.cardHead}>
            <SectionHeader
              icon="printer"
              title="Chek printeri"
              subtitle="Xaridorga sotuv cheki chiqarish"
            />
            <Switch
              value={settings.receiptEnabled}
              onValueChange={v => set("receiptEnabled", v)}
              trackColor={{ true: C.primary, false: C.border }}
              thumbColor="#fff"
            />
          </View>

          <View style={[st.typeTabs, { borderColor: C.border }]}>
            {([
              { v: "wifi" as const, label: "📡 WiFi (ESC/POS)", desc: "Tezkor, to'g'ridan-to'g'ri" },
              { v: "pdf" as const, label: "📄 PDF chop etish", desc: "Ilovalar orqali" },
            ]).map(t => (
              <TouchableOpacity
                key={t.v}
                onPress={() => set("receiptType", t.v)}
                style={[st.typeTab, settings.receiptType === t.v && { backgroundColor: C.primary + "15", borderColor: C.primary }]}
              >
                <Text style={[st.typeTabTxt, settings.receiptType === t.v && { color: C.primary }]}>{t.label}</Text>
                <Text style={[st.typeTabSub, settings.receiptType === t.v && { color: C.primary + "99" }]}>{t.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {settings.receiptType === "wifi" && (
            <>
              <Field
                label="Printer IP manzili"
                value={settings.receiptIp}
                onChangeText={v => set("receiptIp", v)}
                placeholder="192.168.1.100"
                keyboard="decimal-pad"
                hint="Router sozlamalaridan printer IP sini toping"
              />
              <Field
                label="Port"
                value={settings.receiptPort}
                onChangeText={v => set("receiptPort", v)}
                placeholder="9100"
                keyboard="numeric"
              />
            </>
          )}

          <View>
            <Text style={[st.fieldLabel, { color: C.textSecondary }]}>Qog'oz kengligi</Text>
            <ChipRow
              options={PAPER_SIZES.map(p => ({ value: p.value, label: p.label, desc: p.desc }))}
              value={settings.receiptPaperMm}
              onChange={v => set("receiptPaperMm", v)}
            />
          </View>

          <TouchableOpacity
            style={[st.testBtn, { borderColor: testingReceipt ? C.border : C.primary }]}
            onPress={testReceiptPrinter} disabled={testingReceipt}
          >
            {testingReceipt
              ? <ActivityIndicator color={C.primary} size="small" />
              : <Feather name="printer" size={16} color={C.primary} />}
            <Text style={[st.testBtnTxt, { color: C.primary }]}>
              {testingReceipt ? "Chop etilmoqda..." : "Test cheki chiqarish"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════
            ── BARCODE LABEL PRINTER ──
        ══════════════════════════════════ */}
        <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={st.cardHead}>
            <SectionHeader
              icon="tag"
              title="Barcode label printer"
              subtitle="Mahsulot stikeri va barcode chiqarish"
            />
            <Switch
              value={settings.barcodeEnabled}
              onValueChange={v => set("barcodeEnabled", v)}
              trackColor={{ true: C.primary, false: C.border }}
              thumbColor="#fff"
            />
          </View>

          {settings.barcodeEnabled ? (
            <>
              <View style={[st.infoBanner, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                <Feather name="zap" size={13} color="#059669" />
                <Text style={[st.infoTxt, { color: "#059669", flex: 1 }]}>
                  WiFi orqali termal label printerga to'g'ridan-to'g'ri ESC/POS format yuboriladi.
                  (Xprinter, GOOJPRT, TSC va boshqalar)
                </Text>
              </View>
              <Field
                label="Label printer IP manzili"
                value={settings.barcodeIp}
                onChangeText={v => set("barcodeIp", v)}
                placeholder="192.168.1.101"
                keyboard="decimal-pad"
              />
              <Field
                label="Port"
                value={settings.barcodePort}
                onChangeText={v => set("barcodePort", v)}
                placeholder="9100"
                keyboard="numeric"
              />
              <View>
                <Text style={[st.fieldLabel, { color: C.textSecondary }]}>Label o'lchami</Text>
                <ChipRow
                  options={LABEL_SIZES.map(l => ({ value: l.value, label: l.label }))}
                  value={settings.barcodeLabelSize}
                  onChange={v => set("barcodeLabelSize", v)}
                />
              </View>
            </>
          ) : (
            <View style={[st.infoBanner, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
              <Feather name="info" size={13} color="#D97706" />
              <Text style={[st.infoTxt, { color: "#D97706", flex: 1 }]}>
                Barcode printer o'chirilgan. Yoqilsa WiFi termal label printerga ulangan bo'ladi.
                O'chirilganda PDF orqali chop etiladi.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[st.testBtn, { borderColor: testingBarcode ? C.border : "#10B981" }]}
            onPress={testBarcodePrinter} disabled={testingBarcode}
          >
            {testingBarcode
              ? <ActivityIndicator color="#10B981" size="small" />
              : <Feather name="tag" size={16} color="#10B981" />}
            <Text style={[st.testBtnTxt, { color: "#10B981" }]}>
              {testingBarcode ? "Chop etilmoqda..." : "Test barcode chiqarish"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── TIPS ── */}
        <View style={[st.tipsCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[st.tipsTitle, { color: C.text }]}>📌 Ulanish bo'yicha maslahatlar</Text>
          {[
            "Printer va telefon bir xil Wi-Fi tarmoqda bo'lsin",
            "Printer IP manzilini printer menyu yoki router'dan toping",
            "Port odatda 9100 (ESC/POS standart)",
            "58mm: 1 kolonka, 80mm: 2 kolonka uchun mos",
            "Zebra printerlar uchun ZPL format qo'llab-quvvatlanmaydi",
          ].map((tip, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold" }}>{i + 1}.</Text>
              <Text style={[st.tipTxt, { color: C.textSecondary }]}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  saveBtn: {
    marginLeft: "auto", flexDirection: "row", alignItems: "center",
    gap: 6, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12, minWidth: 90, justifyContent: "center",
  },
  saveBtnTxt: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },

  scroll: { padding: 16, gap: 16 },

  infoCard: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  infoTxt: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  card: {
    borderRadius: 18, borderWidth: 1, padding: 18, gap: 4,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  typeTabs: { flexDirection: "row", gap: 8, marginBottom: 14 },
  typeTab: {
    flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 10,
    alignItems: "center", borderColor: "#E2E8F0",
  },
  typeTabTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#64748B" },
  typeTabSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 2 },

  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  input: {
    height: 46, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular",
  },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 5 },

  chip: {
    borderWidth: 1.5, borderRadius: 10, borderColor: "#E2E8F0",
    paddingHorizontal: 14, paddingVertical: 8, alignItems: "center",
  },
  chipTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151" },
  chipSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginTop: 1 },

  testBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, marginTop: 6,
  },
  testBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  infoBanner: {
    flexDirection: "row", gap: 8, borderRadius: 10, borderWidth: 1,
    padding: 12, marginBottom: 14, alignItems: "flex-start",
  },

  tipsCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  tipsTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  tipTxt: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, flex: 1 },
});
