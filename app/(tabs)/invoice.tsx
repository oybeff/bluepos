import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

const C = Colors.light;

interface Client {
  id: number;
  fullName: string;
  phone: string;
  address?: string;
}

interface InvoiceItem {
  nomi: string;
  miqdor: string;
  birlik: string;
  narx: string;
  jami: number;
}

const BIRLIKLAR = ["metr", "dona", "m²", "kg", "rulon"];

function fmt(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n));
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function today() {
  return new Date().toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function invoiceNumber() {
  return "INV-" + Date.now().toString().slice(-8);
}

export default function InvoiceScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [showClients, setShowClients] = useState(false);
  const [izoh, setIzoh] = useState("");
  const [chegirma, setChegirma] = useState("0");
  const [items, setItems] = useState<InvoiceItem[]>([
    { nomi: "", miqdor: "1", birlik: "metr", narx: "", jami: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const invNum = React.useRef(invoiceNumber());

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-list"],
    queryFn: () => apiReq("/clients").then((r: any) => r.clients ?? r),
  });

  const filteredClients = clients.filter(c =>
    c.fullName.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch)
  );

  const updateItem = (idx: number, field: keyof InvoiceItem, val: string) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      const item = updated[idx];
      const miqdor = parseFloat(item.miqdor) || 0;
      const narx = parseFloat(item.narx) || 0;
      updated[idx].jami = miqdor * narx;
      return updated;
    });
  };

  const addItem = () => setItems(prev => [...prev, { nomi: "", miqdor: "1", birlik: "metr", narx: "", jami: 0 }]);
  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const subtotal = items.reduce((s, i) => s + i.jami, 0);
  const chegirmaSum = parseFloat(chegirma) || 0;
  const total = Math.max(0, subtotal - chegirmaSum);

  const generateInvoiceText = () => {
    const lines: string[] = [];
    lines.push(`HISOB-FAKTURA: ${invNum.current}`);
    lines.push(`Sana: ${today()}`);
    lines.push("─".repeat(36));
    if (selectedClient) {
      lines.push(`Mijoz: ${selectedClient.fullName}`);
      lines.push(`Tel: ${selectedClient.phone}`);
      lines.push("─".repeat(36));
    }
    lines.push("Mahsulot / Xizmat:");
    items.forEach((it, i) => {
      if (!it.nomi) return;
      lines.push(`${i + 1}. ${it.nomi}`);
      lines.push(`   ${it.miqdor} ${it.birlik} × ${fmt(parseFloat(it.narx) || 0)} = ${fmt(it.jami)} so'm`);
    });
    lines.push("─".repeat(36));
    lines.push(`Jami: ${fmt(subtotal)} so'm`);
    if (chegirmaSum > 0) {
      lines.push(`Chegirma: -${fmt(chegirmaSum)} so'm`);
      lines.push(`To'lash kerak: ${fmt(total)} so'm`);
    }
    if (izoh) {
      lines.push("─".repeat(36));
      lines.push(`Izoh: ${izoh}`);
    }
    lines.push("─".repeat(36));
    lines.push("Blupos tizimi orqali yaratildi");
    return lines.join("\n");
  };

  const generateInvoiceHtml = () => {
    const rows = items.filter(i => i.nomi).map(i =>
      `<tr>
        <td>${escHtml(i.nomi)}</td>
        <td style="text-align:center">${escHtml(i.miqdor)} ${escHtml(i.birlik)}</td>
        <td style="text-align:right">${fmt(parseFloat(i.narx)||0)}</td>
        <td style="text-align:right"><b>${fmt(i.jami)}</b></td>
      </tr>`
    ).join("");
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color:#000; width:74mm; }
  h2 { text-align:center; font-size:15px; margin:4px 0; }
  .sub { text-align:center; font-size:9px; color:#555; }
  hr { border-top:1px dashed #000; margin:5px 0; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  th { font-weight:bold; border-bottom:1px solid #000; padding:2px 0; }
  td { padding:2px 0; vertical-align:top; }
  .total { font-size:13px; font-weight:bold; text-align:right; margin-top:6px; }
  .footer { text-align:center; font-size:9px; margin-top:8px; }
</style></head><body>
<h2>Blupos</h2>
<div class="sub">HISOB-FAKTURA</div>
<hr>
<div style="display:flex;justify-content:space-between">
  <span>№ ${invNum.current}</span>
  <span>${today()}</span>
</div>
${selectedClient ? `<hr><b>Mijoz:</b> ${escHtml(selectedClient.fullName)}<br><span>${escHtml(selectedClient.phone)}</span>` : ""}
<hr>
<table>
  <tr><th style="text-align:left">Mahsulot</th><th>Miqdor</th><th style="text-align:right">Narx</th><th style="text-align:right">Jami</th></tr>
  ${rows}
</table>
<hr>
<div class="total">Jami: ${fmt(subtotal)} so'm</div>
${chegirmaSum > 0 ? `<div style="text-align:right;font-size:11px">Chegirma: -${fmt(chegirmaSum)} so'm</div>
<div class="total" style="font-size:15px">To'lash: ${fmt(total)} so'm</div>` : ""}
${izoh ? `<hr><div style="font-size:10px">Izoh: ${escHtml(izoh)}</div>` : ""}
<hr>
<div class="footer">Xaridingiz uchun rahmat!</div>
</body></html>`;
  };

  const handlePrint = async () => {
    if (items.every(i => !i.nomi)) {
      Alert.alert("Xato", "Kamida bitta mahsulot/xizmat kiriting");
      return;
    }
    setLoading(true);
    try {
      if (Platform.OS === "web") {
        // Web: open print dialog
        const w = window.open("", "_blank");
        if (w) { w.document.write(generateInvoiceHtml()); w.document.close(); w.print(); }
      } else {
        await Print.printAsync({ html: generateInvoiceHtml() });
      }
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Chop etishda xatolik");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (items.every(i => !i.nomi)) {
      Alert.alert("Xato", "Kamida bitta mahsulot/xizmat kiriting");
      return;
    }
    setLoading(true);
    try {
      if (Platform.OS !== "web") {
        // Generate PDF then share
        const { uri } = await Print.printToFileAsync({ html: generateInvoiceHtml() });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Hisob-faktura ${invNum.current}` });
        } else {
          Alert.alert("Saqlandi", `PDF fayl: ${uri}`);
        }
      } else {
        // Web fallback
        const text = generateInvoiceText();
        Alert.alert(`Hisob-faktura ${invNum.current}`, text, [{ text: "OK" }]);
      }
    } catch {
      Alert.alert(`Hisob-faktura ${invNum.current}`, generateInvoiceText(), [{ text: "OK" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewInvoice = () => {
    invNum.current = invoiceNumber();
    setSelectedClient(null);
    setClientSearch("");
    setItems([{ nomi: "", miqdor: "1", birlik: "metr", narx: "", jami: 0 }]);
    setIzoh("");
    setChegirma("0");
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: topPadding + 12 }]}>
        <Text style={[s.title, { color: C.text }]}>Hisob-faktura</Text>
        <TouchableOpacity onPress={handleNewInvoice} style={[s.newBtn, { backgroundColor: "#EFF6FF" }]}>
          <Feather name="plus" size={16} color={C.primary} />
          <Text style={[s.newBtnTxt, { color: C.primary }]}>Yangi</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 14 }}>
        {/* Invoice header */}
        <View style={[s.invHeader, { backgroundColor: C.primary }]}>
          <View>
            <Text style={s.invNum}>{invNum.current}</Text>
            <Text style={s.invDate}>Sana: {today()}</Text>
          </View>
          <Feather name="file-text" size={32} color="rgba(255,255,255,0.4)" />
        </View>

        {/* Mijoz tanlash */}
        <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Mijoz</Text>
          {selectedClient ? (
            <View style={s.selectedClient}>
              <View style={{ flex: 1 }}>
                <Text style={[s.clientName, { color: C.text }]}>{selectedClient.fullName}</Text>
                <Text style={[s.clientPhone, { color: C.textSecondary }]}>{selectedClient.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedClient(null)}>
                <Feather name="x" size={18} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={[s.clientSearchBtn, { borderColor: C.border }]}
                onPress={() => setShowClients(!showClients)}>
                <Feather name="user" size={16} color={C.textSecondary} />
                <Text style={[s.clientSearchTxt, { color: C.textSecondary }]}>Mijoz tanlang (ixtiyoriy)</Text>
                <Feather name={showClients ? "chevron-up" : "chevron-down"} size={16} color={C.textSecondary} />
              </TouchableOpacity>
              {showClients && (
                <>
                  <TextInput
                    style={[s.input, { borderColor: C.border, color: C.text, marginTop: 8 }]}
                    placeholder="Ism yoki telefon bilan qidirish"
                    placeholderTextColor={C.textSecondary}
                    value={clientSearch}
                    onChangeText={setClientSearch}
                  />
                  {filteredClients.slice(0, 5).map(c => (
                    <TouchableOpacity key={c.id} style={[s.clientRow, { borderColor: C.border }]}
                      onPress={() => { setSelectedClient(c); setShowClients(false); }}>
                      <Text style={[s.clientName, { color: C.text }]}>{c.fullName}</Text>
                      <Text style={[s.clientPhone, { color: C.textSecondary }]}>{c.phone}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          )}
        </View>

        {/* Mahsulotlar */}
        <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Mahsulotlar / Xizmatlar</Text>
          {items.map((item, idx) => (
            <View key={idx} style={[s.itemRow, { borderColor: C.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Text style={[s.itemNum, { color: C.textSecondary }]}>{idx + 1}.</Text>
                <TextInput
                  style={[s.input, { flex: 1, borderColor: C.border, color: C.text }]}
                  placeholder="Nomi"
                  placeholderTextColor={C.textSecondary}
                  value={item.nomi}
                  onChangeText={v => updateItem(idx, "nomi", v)}
                />
                <TouchableOpacity onPress={() => removeItem(idx)}>
                  <Feather name="trash-2" size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  style={[s.input, { flex: 1, borderColor: C.border, color: C.text }]}
                  placeholder="Miqdor"
                  placeholderTextColor={C.textSecondary}
                  value={item.miqdor}
                  onChangeText={v => updateItem(idx, "miqdor", v)}
                  keyboardType="decimal-pad"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 140 }}>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {BIRLIKLAR.map(b => (
                      <TouchableOpacity key={b} onPress={() => updateItem(idx, "birlik", b)}
                        style={[s.birlikBtn, item.birlik === b && { backgroundColor: C.primary, borderColor: C.primary }]}>
                        <Text style={[s.birlikTxt, { color: item.birlik === b ? "#fff" : C.textSecondary }]}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
                <TextInput
                  style={[s.input, { flex: 1, borderColor: C.border, color: C.text }]}
                  placeholder="Narx (so'm)"
                  placeholderTextColor={C.textSecondary}
                  value={item.narx}
                  onChangeText={v => updateItem(idx, "narx", v)}
                  keyboardType="decimal-pad"
                />
                <Text style={[s.itemTotal, { color: C.primary }]}>= {fmt(item.jami)}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity style={[s.addItemBtn, { borderColor: C.border }]} onPress={addItem}>
            <Feather name="plus" size={16} color={C.primary} />
            <Text style={[s.addItemTxt, { color: C.primary }]}>Qo'shish</Text>
          </TouchableOpacity>
        </View>

        {/* Chegirma va izoh */}
        <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border, gap: 10 }]}>
          <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Chegirma va izoh</Text>
          <TextInput
            style={[s.input, { borderColor: C.border, color: C.text }]}
            placeholder="Chegirma (so'm)"
            placeholderTextColor={C.textSecondary}
            value={chegirma}
            onChangeText={setChegirma}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[s.input, { borderColor: C.border, color: C.text }]}
            placeholder="Izoh (ixtiyoriy)"
            placeholderTextColor={C.textSecondary}
            value={izoh}
            onChangeText={setIzoh}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Jami */}
        <View style={[s.totalCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, { color: C.textSecondary }]}>Jami:</Text>
            <Text style={[s.totalVal, { color: C.text }]}>{fmt(subtotal)} so'm</Text>
          </View>
          {chegirmaSum > 0 && (
            <View style={s.totalRow}>
              <Text style={[s.totalLabel, { color: C.textSecondary }]}>Chegirma:</Text>
              <Text style={[s.totalVal, { color: "#DC2626" }]}>-{fmt(chegirmaSum)} so'm</Text>
            </View>
          )}
          <View style={[s.totalRow, s.totalMain]}>
            <Text style={[s.totalLabel, { color: C.text, fontSize: 17, fontFamily: "Inter_700Bold" }]}>To'lash kerak:</Text>
            <Text style={[s.totalVal, { color: C.primary, fontSize: 20, fontFamily: "Inter_700Bold" }]}>{fmt(total)} so'm</Text>
          </View>
        </View>

        {/* Buttons */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            style={[s.shareBtn, { flex: 1, backgroundColor: "#1E293B" }]}
            onPress={handlePrint}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Feather name="printer" size={18} color="#fff" />
                <Text style={s.shareBtnTxt}>Chop etish</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.shareBtn, { flex: 1, backgroundColor: C.primary }]}
            onPress={handleShare}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Feather name="share-2" size={18} color="#fff" />
                <Text style={s.shareBtnTxt}>PDF ulashish</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  newBtnTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  invHeader: { borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  invNum: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  invDate: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular", marginTop: 4 },
  section: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  selectedClient: { flexDirection: "row", alignItems: "center", gap: 10 },
  clientName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  clientPhone: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  clientSearchBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  clientSearchTxt: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  clientRow: { paddingVertical: 10, borderTopWidth: 1 },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  itemRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  itemNum: { fontSize: 14, fontFamily: "Inter_700Bold", minWidth: 20 },
  itemTotal: { fontSize: 15, fontFamily: "Inter_700Bold", minWidth: 90, textAlign: "right" },
  birlikBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: "#E2E8F0" },
  birlikTxt: { fontSize: 12, fontFamily: "Inter_500Medium" },
  addItemBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, borderStyle: "dashed" },
  addItemTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  totalCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalMain: { paddingTop: 10, borderTopWidth: 1, borderColor: "#E2E8F0", marginTop: 4 },
  totalLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  totalVal: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 16 },
  shareBtnTxt: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
});
