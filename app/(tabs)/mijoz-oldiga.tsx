import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import * as Location from "expo-location";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";

const C = Colors.light;

type PardaTuri = "oddiy" | "ikki_qavatli" | "karnizsiz";
type ItemType = "deraza" | "eshik";
type KarniizTuri = "karniiz" | "baget";

interface KAks {
  enabled: boolean;
  soni: string;
  narxi: string;
}

interface KarniizItem {
  id: string;
  turi: KarniizTuri;
  nomi: string;
  uzunlik: string;
  narxPerM: string;
  kronshteyn: KAks;
  kruchka: KAks;
  gulOyoq: { enabled: boolean; narxi: string };
  derjatel: KAks;
  babon: KAks;
  popik: { enabled: boolean; narxi: string };
  tikuv: { enabled: boolean; uzunlik: string; narxi: string };
}

interface RoomItem {
  id: string;
  type: ItemType;
  label: string;
  en: string;
  boy: string;
  miqdor: number;
  pardaTuri: PardaTuri;
}

interface Room {
  id: string;
  name: string;
  items: RoomItem[];
}

interface Worker {
  id: number; fullName: string; phone: string;
  role: string; telegramChatId: string | null;
}

const PARDA_TURLARI: { id: PardaTuri; label: string; koeff: number }[] = [
  { id: "oddiy",        label: "Oddiy (×2)",       koeff: 2 },
  { id: "ikki_qavatli", label: "Ikki qavatli",      koeff: 2 },
  { id: "karnizsiz",    label: "Karnizsiz (×1.5)", koeff: 1.5 },
];

const ORNATISH_TURLARI = [
  { id: "",       label: "Yo'q",     narx: 0 },
  { id: "devor",  label: "🧱 Devor", narx: 20000 },
  { id: "beton",  label: "🏗️ Beton", narx: 30000 },
];

const ROOM_NAMES = ["Mehmonxona", "Yotoqxona", "Oshxona", "Bolalar xonasi", "Kabinet", "Koridor", "Hammom"];
const QOSHIMCHA_BOY = 0.3;

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function m(v: number) { return v.toFixed(2) + " m"; }
function sum(v: number) { return new Intl.NumberFormat("uz-UZ").format(Math.round(v)) + " so'm"; }
function p(s: string) { return parseFloat(s) || 0; }

function newKarniizItem(turi: KarniizTuri): KarniizItem {
  return {
    id: uid(), turi,
    nomi: turi === "karniiz" ? "Turba karniiz" : "Baget",
    uzunlik: "250", narxPerM: "",
    kronshteyn: { enabled: false, soni: "3", narxi: "" },
    kruchka:    { enabled: false, soni: "20", narxi: "" },
    gulOyoq:    { enabled: false, narxi: "" },
    derjatel:   { enabled: false, soni: "3", narxi: "" },
    babon:      { enabled: false, soni: "2", narxi: "" },
    popik:      { enabled: false, narxi: "" },
    tikuv:      { enabled: false, uzunlik: "", narxi: "" },
  };
}

function calcKarniiz(k: KarniizItem): number {
  const uzL = p(k.uzunlik) / 100;
  let total = uzL * p(k.narxPerM);
  if (k.kronshteyn.enabled) total += p(k.kronshteyn.soni) * p(k.kronshteyn.narxi);
  if (k.kruchka.enabled)    total += p(k.kruchka.soni) * p(k.kruchka.narxi);
  if (k.gulOyoq.enabled)    total += p(k.gulOyoq.narxi);
  if (k.derjatel.enabled)   total += p(k.derjatel.soni) * p(k.derjatel.narxi);
  if (k.babon.enabled)      total += p(k.babon.soni) * p(k.babon.narxi);
  if (k.popik.enabled)      total += p(k.popik.narxi);
  if (k.tikuv.enabled)      total += (p(k.tikuv.uzunlik) / 100) * p(k.tikuv.narxi);
  return total;
}

function newRoom(name = "Xona"): Room {
  return {
    id: uid(), name,
    items: [{ id: uid(), type: "deraza", label: "Deraza 1", en: "", boy: "", miqdor: 1, pardaTuri: "oddiy" }],
  };
}

interface CalcResult {
  materialEn: number; materialBoy: number; birOyna: number; jami: number;
}

function calcItem(item: RoomItem): CalcResult | null {
  const en = p(item.en); const boy = p(item.boy);
  if (!en || !boy || en <= 0 || boy <= 0) return null;
  if (item.type === "eshik") {
    return { materialEn: en, materialBoy: boy + QOSHIMCHA_BOY, birOyna: en * (boy + QOSHIMCHA_BOY), jami: en * (boy + QOSHIMCHA_BOY) * item.miqdor };
  }
  const koeff = PARDA_TURLARI.find(pt => pt.id === item.pardaTuri)?.koeff ?? 2;
  const materialEn = en * koeff;
  const materialBoy = boy + QOSHIMCHA_BOY;
  const birOyna = materialEn * materialBoy;
  const jami = birOyna * item.miqdor;
  return { materialEn, materialBoy, birOyna, jami };
}

export default function MijozOldigaScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 110);

  const [rooms, setRooms] = useState<Room[]>([newRoom("Mehmonxona")]);
  const [expandedRoom, setExpandedRoom] = useState<string>(rooms[0].id);
  const [expandedItem, setExpandedItem] = useState<string>(rooms[0].items[0]?.id ?? "");

  const [mijozIsm, setMijozIsm]     = useState("");
  const [mijozPhone, setMijozPhone] = useState("");
  const [manzil, setManzil]         = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);

  const [narxPerMetr, setNarxPerMetr]             = useState("");
  const [ornatishTuri, setOrnatishTuri]            = useState("");
  const [chevarHaqiPerMetr, setChevarHaqiPerMetr] = useState("");
  const [zaklatSumma, setZaklatSumma]             = useState("");
  const [tayyorKun, setTayyorKun]                 = useState("");
  const [qaytarishMuddati, setQaytarishMuddati]   = useState("");
  const [izoh, setIzoh]                           = useState("");

  const [selectedTailor, setSelectedTailor]       = useState<number | null>(null);
  const [selectedInstaller, setSelectedInstaller] = useState<number | null>(null);

  const [karniizList, setKarniizList]       = useState<KarniizItem[]>([]);
  const [expandedKarniiz, setExpandedKarniiz] = useState<string>("");

  const [saving, setSaving]         = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sending, setSending]       = useState(false);

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["workers-all"],
    queryFn: () => apiReq<Worker[]>("/workers"),
    retry: false,
  });
  const tailors    = workers.filter(w => w.role === "chevar");
  const installers = workers.filter(w => w.role === "montaj");

  // ─── Hisob ────────────────────────────────────────────────
  interface FlatItem { room: Room; item: RoomItem; calc: CalcResult }
  const flatItems: FlatItem[] = [];
  rooms.forEach(room => room.items.forEach(item => {
    const calc = calcItem(item);
    if (calc) flatItems.push({ room, item, calc });
  }));

  const totalJami     = flatItems.reduce((s, fi) => s + fi.calc.jami, 0);
  const narx          = p(narxPerMetr);
  const totalNarx     = totalJami * narx;
  const ornatishNarx  = ORNATISH_TURLARI.find(t => t.id === ornatishTuri)?.narx ?? 0;
  const jmDona        = rooms.reduce((s, r) => s + r.items.reduce((ss, i) => ss + i.miqdor, 0), 0);
  const ornatishJami  = ornatishNarx * jmDona;
  const chevarHaqi    = p(chevarHaqiPerMetr);
  const chevarJami    = chevarHaqi * totalJami;
  const karniizTotal  = karniizList.reduce((s, k) => s + calcKarniiz(k), 0);
  const zaklat        = p(zaklatSumma);
  const grandTotal    = totalNarx + ornatishJami + chevarJami + karniizTotal;
  const qarz          = Math.max(0, grandTotal - zaklat);

  // ─── Karniiz actions ──────────────────────────────────────
  const addKarniiz = (turi: KarniizTuri) => {
    const item = newKarniizItem(turi);
    setKarniizList(prev => [...prev, item]);
    setExpandedKarniiz(item.id);
  };
  const removeKarniiz = (id: string) => setKarniizList(prev => prev.filter(k => k.id !== id));
  const updateKarniiz = useCallback((id: string, patch: Partial<KarniizItem>) =>
    setKarniizList(prev => prev.map(k => k.id === id ? { ...k, ...patch } : k)), []);
  const updateKarniizAks = useCallback((id: string, field: keyof KarniizItem, patch: object) =>
    setKarniizList(prev => prev.map(k => k.id === id ? { ...k, [field]: { ...(k[field] as object), ...patch } } : k)), []);

  // ─── Room/Item actions ────────────────────────────────────
  const addRoom = () => {
    const r = newRoom(`Xona ${rooms.length + 1}`);
    setRooms(prev => [...prev, r]);
    setExpandedRoom(r.id);
    setExpandedItem(r.items[0]?.id ?? "");
  };
  const removeRoom = (id: string) =>
    setRooms(prev => { const n = prev.filter(r => r.id !== id); return n.length ? n : [newRoom()]; });
  const updateRoomName = (id: string, name: string) =>
    setRooms(prev => prev.map(r => r.id === id ? { ...r, name } : r));

  const addItem = (roomId: string, type: ItemType) => {
    const room = rooms.find(r => r.id === roomId);
    const cnt = (room?.items.filter(i => i.type === type).length ?? 0) + 1;
    const label = type === "deraza" ? `Deraza ${cnt}` : `Eshik ${cnt}`;
    const def: RoomItem = { id: uid(), type, label, en: type === "deraza" ? "150" : "90", boy: type === "deraza" ? "160" : "210", miqdor: 1, pardaTuri: "oddiy" };
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, items: [...r.items, def] } : r));
    setExpandedItem(def.id);
  };
  const removeItem = (roomId: string, itemId: string) =>
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, items: r.items.filter(i => i.id !== itemId) } : r));
  const updateItem = useCallback((roomId: string, itemId: string, patch: Partial<RoomItem>) =>
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, items: r.items.map(i => i.id === itemId ? { ...i, ...patch } : i) } : r)), []);

  // ─── GPS ──────────────────────────────────────────────────
  const getGps = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("GPS ruxsati berilmagan"); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lon } = loc.coords;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, { headers: { "Accept-Language": "uz,ru" } });
        const d = await r.json() as any;
        const a = d.address;
        const parts = [a?.road || a?.pedestrian, a?.house_number, a?.suburb || a?.neighbourhood, a?.city || a?.town || a?.village].filter(Boolean);
        setManzil(parts.length ? parts.join(", ") : `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      } catch { setManzil(`${lat.toFixed(5)}, ${lon.toFixed(5)}`); }
    } catch { Alert.alert("GPS xatosi"); }
    finally { setGpsLoading(false); }
  };

  const payload = () => ({
    mijozIsm: mijozIsm || null, mijozPhone: mijozPhone || null, manzil: manzil || null,
    measurements: flatItems.map(({ room, item, calc }) => ({
      xona: room.name, itemType: item.type, label: item.label,
      en: p(item.en), boy: p(item.boy),
      materialEn: calc.materialEn, materialBoy: calc.materialBoy,
      miqdor: item.miqdor, pardaTuri: item.pardaTuri, jami: calc.jami,
    })),
    totalMaterial: totalJami, narxPerMetr: narx,
    totalNarx: grandTotal, ornatishTuri: ornatishTuri || null, ornatishNarx: ornatishJami,
    chevarHaqiPerMetr: chevarHaqi, chevarJami,
    karniizJami: karniizTotal,
    zaklatSumma: zaklat, qarzSumma: qarz,
    tayyorBolishKuni: tayyorKun || null,
    qaytarishMuddati: qaytarishMuddati || null,
    tailorWorkerId: selectedTailor, installerWorkerId: selectedInstaller,
    izoh: izoh || null,
  });

  const saveDeal = async () => {
    if (!totalJami) { Alert.alert("Xato", "Avval o'lchamlarni kiriting"); return; }
    setSaving(true);
    try {
      await apiReq("/client-deals", { method: "POST", body: JSON.stringify(payload()) });
      Alert.alert("Saqlandi!", "Bitishuv saqlandi", [{ text: "OK", onPress: () => router.back() }]);
    } catch { Alert.alert("Xato", "Saqlashda xato yuz berdi"); }
    finally { setSaving(false); }
  };

  const sendSms = async () => {
    if (!mijozPhone) { Alert.alert("Xato", "Mijoz telefon raqamini kiriting"); return; }
    if (!totalJami)  { Alert.alert("Xato", "O'lchamlarni kiriting"); return; }
    setSending(true);
    try {
      const text =
        `Hurmatli ${mijozIsm || "mijoz"}, siz uchun parda hisob-kitob tayyor!\n` +
        `Jami material: ${m(totalJami)}\n` +
        (grandTotal > 0 ? `Umumiy narx: ${sum(grandTotal)}\n` : "") +
        (zaklat > 0 ? `Zaklat: ${sum(zaklat)}\n` : "") +
        (qarz > 0 ? `Qolgan qarz: ${sum(qarz)}\n` : "") +
        `Tayyor sana: ${tayyorKun || "—"}\n— Bluepos tizimi`;
      await apiReq("/sms/send", { method: "POST", body: JSON.stringify({ phone: mijozPhone, text }) });
      Alert.alert("SMS yuborildi!", `${mijozPhone} raqamiga SMS yuborildi`);
    } catch { Alert.alert("Xato", "SMS yuborishda xato yuz berdi"); }
    finally { setSending(false); }
  };

  const sendTelegram = async () => {
    if (!selectedTailor && !selectedInstaller) { Alert.alert("Xato", "Ishchini tanlang"); return; }
    if (!totalJami) { Alert.alert("Xato", "O'lchamlarni kiriting"); return; }
    setSending(true);
    try {
      const r = await apiReq<{ success?: boolean; errors?: string[] }>("/telegram/send-order", { method: "POST", body: JSON.stringify(payload()) });
      if (r.success) Alert.alert("Yuborildi!");
      else Alert.alert("Xato", r.errors?.join(", ") || "Yuborib bo'lmadi");
    } catch { Alert.alert("Xato", "Telegram bilan bog'lanib bo'lmadi"); }
    finally { setSending(false); }
  };

  const shareText = async () => {
    if (!totalJami) { Alert.alert("Xato", "O'lchamlarni kiriting"); return; }
    const lines = ["📋 *HISOB-KITOB — BLUPOS*"];
    if (mijozIsm)  lines.push(`👤 ${mijozIsm}`);
    if (manzil)    lines.push(`📍 ${manzil}`);
    lines.push("");
    rooms.forEach((room, ri) => {
      const roomItems = flatItems.filter(fi => fi.room.id === room.id);
      if (!roomItems.length) return;
      lines.push(`🏠 *${room.name}*`);
      roomItems.forEach(({ item, calc }) => {
        const icon = item.type === "deraza" ? "🪟" : "🚪";
        lines.push(`  ${icon} ${item.label}: ${p(item.en).toFixed(2)}×${p(item.boy).toFixed(2)}m → ${m(calc.jami)}`);
      });
    });
    lines.push(`\n📦 Jami material: *${m(totalJami)}*`);
    if (karniizList.length > 0) {
      lines.push("\n🔩 *Karniiz va Baget:*");
      karniizList.forEach(k => {
        const kT = calcKarniiz(k);
        lines.push(`  ${k.turi === "karniiz" ? "—" : "≡"} ${k.nomi} (${(p(k.uzunlik)/100).toFixed(2)} m)${kT > 0 ? ` · ${sum(kT)}` : ""}`);
      });
    }
    if (grandTotal > 0) lines.push(`\n💰 Umumiy narx: *${sum(grandTotal)}*`);
    if (zaklat > 0)     lines.push(`✅ Zaklat: ${sum(zaklat)}`);
    if (qarz > 0)       lines.push(`⚠️ Qarz: *${sum(qarz)}*`);
    if (tayyorKun)      lines.push(`📅 Tayyor: ${tayyorKun}`);
    await Share.share({ message: lines.join("\n") });
  };

  const generateChevarPdf = async () => {
    if (!totalJami) { Alert.alert("Xato", "O'lchamlarni kiriting"); return; }
    setPdfLoading(true);
    try {
      const date = new Date().toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" });
      const tailor = workers.find(w => w.id === selectedTailor);
      const rowsHtml = flatItems.map(({ room, item, calc }, i) =>
        `<tr>
          <td style="text-align:center;font-weight:bold">${i + 1}</td>
          <td>${room.name}</td>
          <td>${item.type === "deraza" ? "🪟" : "🚪"} ${item.label}</td>
          <td style="text-align:center">${p(item.en).toFixed(2)} m</td>
          <td style="text-align:center">${p(item.boy).toFixed(2)} m</td>
          <td style="text-align:center;font-weight:bold;color:#4f46e5">${calc.materialEn.toFixed(2)} m</td>
          <td style="text-align:center;font-weight:bold;color:#4f46e5">${calc.materialBoy.toFixed(2)} m</td>
          <td style="text-align:center">${item.type === "deraza" ? (PARDA_TURLARI.find(pt => pt.id === item.pardaTuri)?.label || "") : "Eshik"}</td>
          <td style="text-align:center">${item.miqdor} ta</td>
          <td style="text-align:center;font-weight:900;color:#4f46e5">${calc.jami.toFixed(2)} m</td>
          <td></td>
        </tr>`
      ).join("");

      const html = `<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8">
<style>
  @page { size: A5 landscape; margin: 10mm 12mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
  .top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; border-bottom:2px solid #4f46e5; padding-bottom:6px; }
  .brand { font-size:18px; font-weight:900; color:#4f46e5; letter-spacing:2px; }
  .brand-sub { font-size:9px; color:#64748b; margin-top:2px; }
  .right { text-align:right; }
  .right .label { font-size:9px; color:#94a3b8; text-transform:uppercase; }
  .right .val { font-size:11px; font-weight:700; color:#1e293b; }
  .info-row { display:flex; gap:20px; margin-bottom:8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px; }
  .info-item .lbl { font-size:8px; color:#94a3b8; text-transform:uppercase; }
  .info-item .val { font-size:11px; font-weight:700; color:#1e293b; }
  table { width:100%; border-collapse:collapse; font-size:10px; margin-top:4px; }
  thead tr { background:#4f46e5; color:white; }
  th { padding:5px 6px; text-align:center; font-size:9px; font-weight:bold; }
  td { border:1px solid #e2e8f0; padding:5px 6px; }
  tr:nth-child(even) td { background:#f8fafc; }
  .foot-row { display:flex; justify-content:space-between; align-items:center; margin-top:8px; }
  .total-box { background:#4f46e5; color:white; border-radius:6px; padding:5px 14px; display:flex; gap:16px; }
  .total-item .t-lbl { font-size:8px; opacity:.8; }
  .total-item .t-val { font-size:14px; font-weight:900; }
  .sig { text-align:center; font-size:9px; color:#94a3b8; }
</style></head><body>
<div class="top">
  <div>
    <div class="brand">BLUPOS</div>
    <div class="brand-sub">Parda, Karniiz va Jaluziya — Chevar varaqasi</div>
  </div>
  <div class="right">
    <div class="label">Sana</div><div class="val">${date}</div>
    ${tayyorKun ? `<div class="label" style="margin-top:3px">Tayyor</div><div class="val" style="color:#ef4444">${tayyorKun}</div>` : ""}
  </div>
</div>
<div class="info-row">
  ${mijozIsm ? `<div class="info-item"><div class="lbl">Mijoz</div><div class="val">${mijozIsm}</div></div>` : ""}
  ${mijozPhone ? `<div class="info-item"><div class="lbl">Telefon</div><div class="val">${mijozPhone}</div></div>` : ""}
  ${manzil ? `<div class="info-item"><div class="lbl">Manzil</div><div class="val">${manzil}</div></div>` : ""}
  ${tailor ? `<div class="info-item"><div class="lbl">Chevar</div><div class="val">${tailor.fullName}</div></div>` : ""}
</div>
<table>
  <thead>
    <tr>
      <th>#</th><th>Xona</th><th>Nomi</th><th>Eni</th><th>Bo'yi</th>
      <th style="background:#3730a3">Mat. eni</th><th style="background:#3730a3">Mat. bo'yi</th>
      <th>Turi</th><th>Soni</th><th style="background:#3730a3">Jami (m)</th>
      <th>✓</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
    <tr style="background:#eef2ff">
      <td colspan="9" style="text-align:right;font-weight:bold;color:#3730a3">JAMI MATERIAL:</td>
      <td style="text-align:center;font-weight:900;font-size:13px;color:#3730a3">${totalJami.toFixed(2)} m</td>
      <td></td>
    </tr>
  </tbody>
</table>
<div class="foot-row">
  <div class="total-box">
    <div class="total-item"><div class="t-lbl">Jami material</div><div class="t-val">${totalJami.toFixed(2)} m</div></div>
    <div class="total-item"><div class="t-lbl">Xonalar</div><div class="t-val">${rooms.length} ta</div></div>
    <div class="total-item"><div class="t-lbl">Jami dona</div><div class="t-val">${jmDona} ta</div></div>
  </div>
  <div class="sig">
    <div>Chevar imzosi: ________________</div>
    <div style="margin-top:4px;font-size:8px;color:#cbd5e1">Bluepos | ${new Date().toLocaleString("uz-UZ")}</div>
  </div>
</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Chevar varaqasini ulashish" });
      } else { Alert.alert("PDF tayyor", uri); }
    } catch { Alert.alert("Xato", "PDF yaratishda xato"); }
    finally { setPdfLoading(false); }
  };

  const generatePdf = async () => {
    if (!totalJami) { Alert.alert("Xato", "O'lchamlarni kiriting"); return; }
    setPdfLoading(true);
    try {
      const date = new Date().toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" });
      const rowsHtml = flatItems.map(({ room, item, calc }, i) =>
        `<tr><td>${i+1}</td><td>${room.name}</td><td>${item.type === "deraza" ? "🪟" : "🚪"} ${item.label}</td><td>${p(item.en).toFixed(2)}×${p(item.boy).toFixed(2)}</td><td>${calc.materialEn.toFixed(2)}×${calc.materialBoy.toFixed(2)}</td><td>${item.type === "deraza" ? (PARDA_TURLARI.find(pt=>pt.id===item.pardaTuri)?.label||"") : "Eshik"}</td><td>${item.miqdor}ta</td><td>${calc.jami.toFixed(2)}m</td></tr>`
      ).join("");
      const html = `<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a2e;padding:24px 32px}
.hdr{text-align:center;border-bottom:2px solid #4f46e5;padding-bottom:12px;margin-bottom:16px}
.hdr h1{font-size:24px;color:#4f46e5;font-weight:900;letter-spacing:2px}.hdr p{font-size:11px;color:#64748b;margin-top:3px}
.sec{margin-bottom:14px}.stl{font-size:10px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;border-bottom:1px solid #e2e8f0;padding-bottom:3px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ii{display:flex;flex-direction:column;gap:2px}
.il{font-size:9px;color:#94a3b8;text-transform:uppercase}.iv{font-size:12px;font-weight:700;color:#1e293b}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#f1f5f9;border:1px solid #e2e8f0;padding:6px 8px;text-align:left;font-size:10px;color:#475569;font-weight:bold}
td{border:1px solid #e2e8f0;padding:6px 8px}tr:nth-child(even) td{background:#f8fafc}
.tr td{font-weight:bold;background:#eef2ff!important;color:#4338ca}
.pbox{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
.pr{display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px dashed #e2e8f0}
.pr:last-child{border-bottom:none}.pl{color:#475569;font-size:12px}.pv{font-weight:700;font-size:12px}
.grand{background:#4338ca;color:white;padding:10px 14px;display:flex;justify-content:space-between;border-radius:8px;margin-top:8px}
.foot{border-top:1px solid #e2e8f0;margin-top:20px;padding-top:8px;text-align:center;color:#94a3b8;font-size:10px}
</style></head><body>
<div class="hdr"><h1>BLUPOS</h1><p>Parda, Karniiz va Jaluziya Do'koni — Hisob-kitob</p></div>
${mijozIsm||mijozPhone||manzil?`<div class="sec"><div class="stl">Mijoz</div><div class="g2">
${mijozIsm?`<div class="ii"><span class="il">Ism</span><span class="iv">${mijozIsm}</span></div>`:""}
${mijozPhone?`<div class="ii"><span class="il">Tel</span><span class="iv">${mijozPhone}</span></div>`:""}
${manzil?`<div class="ii" style="grid-column:span 2"><span class="il">Manzil</span><span class="iv">${manzil}</span></div>`:""}
<div class="ii"><span class="il">Sana</span><span class="iv">${date}</span></div></div></div>`:`<p style="color:#64748b;font-size:11px;margin-bottom:14px">Sana: ${date}</p>`}
<div class="sec"><div class="stl">Deraza va eshik o'lchamlari</div>
<table><thead><tr><th>#</th><th>Xona</th><th>Nomi</th><th>O'lcham</th><th>Material</th><th>Turi</th><th>Soni</th><th>Jami</th></tr></thead>
<tbody>${rowsHtml}<tr class="tr"><td colspan="7" style="text-align:right">Jami material:</td><td>${totalJami.toFixed(2)}m</td></tr></tbody></table></div>
${narx>0||ornatishJami>0||chevarJami>0?`<div class="sec"><div class="stl">Narx</div><div class="pbox">
${narx>0?`<div class="pr"><span class="pl">Parda (${totalJami.toFixed(2)}m × ${narx.toLocaleString("uz-UZ")}so'm)</span><span class="pv">${totalNarx.toLocaleString("uz-UZ")}so'm</span></div>`:""}
${ornatishJami>0?`<div class="pr"><span class="pl">O'rnatish</span><span class="pv">${ornatishJami.toLocaleString("uz-UZ")}so'm</span></div>`:""}
${chevarJami>0?`<div class="pr"><span class="pl">Chevar haqi</span><span class="pv">${chevarJami.toLocaleString("uz-UZ")}so'm</span></div>`:""}
</div><div class="grand"><span style="font-weight:bold">UMUMIY NARX:</span><span style="font-size:18px;font-weight:900">${grandTotal.toLocaleString("uz-UZ")} so'm</span></div>
${zaklat>0?`<div style="display:flex;justify-content:space-between;padding:6px 12px;background:#f0fdf4;border-radius:6px;margin-top:6px;font-size:12px;color:#166534"><span>Zaklat:</span><span style="font-weight:700">${zaklat.toLocaleString("uz-UZ")}so'm</span></div>`:""}
${qarz>0?`<div style="display:flex;justify-content:space-between;padding:6px 12px;background:#fef2f2;border-radius:6px;margin-top:6px;font-size:12px;color:#991b1b"><span>Qolgan qarz:</span><span style="font-weight:700">${qarz.toLocaleString("uz-UZ")}so'm</span></div>`:""}
</div>`:""}
${tayyorKun?`<div class="sec"><div class="stl">Tayyor bo'lish sanasi</div><p style="font-size:14px;font-weight:bold;color:#1e293b">${tayyorKun}</p></div>`:""}
${izoh?`<div class="sec"><div class="stl">Izoh</div><p style="font-size:12px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px">${izoh}</p></div>`:""}
<div class="foot">Bluepos tizimi | ${new Date().toLocaleString("uz-UZ")}</div>
</body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Hisob-kitobni saqlash" });
      } else { Alert.alert("PDF tayyor", uri); }
    } catch { Alert.alert("Xato", "PDF yaratishda xato"); }
    finally { setPdfLoading(false); }
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: topPadding + 10, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: C.text }]}>Mijoz oldiga</Text>
        <TouchableOpacity onPress={saveDeal} disabled={saving}
          style={[s.saveBtn, { backgroundColor: C.primary, opacity: saving ? 0.6 : 1 }]}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="save" size={14} color="#fff" />}
          <Text style={s.saveBtnTxt}>Saqlash</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 14 }}>

        {/* MIJOZ */}
        <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Mijoz ma'lumotlari</Text>
          <Inp label="Ism (ixtiyoriy)" value={mijozIsm} onChange={setMijozIsm} placeholder="Abdullayev Jasur" />
          <Inp label="Telefon" value={mijozPhone} onChange={setMijozPhone} placeholder="+998 90 123 45 67" keyboard="phone-pad" />
          <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Manzil</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput style={[s.input, { flex: 1, borderColor: C.border, color: C.text, backgroundColor: C.card }]}
              value={manzil} onChangeText={setManzil}
              placeholder="Ko'cha, uy yoki GPS" placeholderTextColor={C.textSecondary} />
            <TouchableOpacity style={[s.gpsBtn, { borderColor: C.border, backgroundColor: C.card }]}
              onPress={getGps} disabled={gpsLoading}>
              {gpsLoading ? <ActivityIndicator size="small" color={C.primary} /> : <Feather name="map-pin" size={18} color={C.primary} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* O'LCHAMLAR */}
        <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Xonalar va o'lchamlar</Text>
            <TouchableOpacity onPress={addRoom} style={[s.addBtn, { backgroundColor: C.primary }]}>
              <Feather name="plus" size={14} color="#fff" />
              <Text style={s.addBtnTxt}>Xona</Text>
            </TouchableOpacity>
          </View>

          {/* Summary */}
          {flatItems.length > 0 && (
            <View style={[s.summaryBadge, { backgroundColor: "#EEF2FF" }]}>
              <Feather name="layers" size={12} color={C.primary} />
              <Text style={[s.summaryTxt, { color: C.primary }]}>
                {rooms.length} xona · {flatItems.filter(fi => fi.item.type === "deraza").length} deraza · {flatItems.filter(fi => fi.item.type === "eshik").length} eshik · {m(totalJami)} mato
              </Text>
            </View>
          )}

          {rooms.map((room) => {
            const isRoomOpen = expandedRoom === room.id;
            const roomFlatItems = flatItems.filter(fi => fi.room.id === room.id);
            const roomTotal = roomFlatItems.reduce((sum, fi) => sum + fi.calc.jami, 0);
            return (
              <View key={room.id} style={[s.roomCard, { borderColor: isRoomOpen ? C.primary : C.border }]}>
                {/* Room header */}
                <TouchableOpacity style={[s.roomHead, { backgroundColor: isRoomOpen ? C.primary + "10" : C.card }]}
                  onPress={() => setExpandedRoom(isRoomOpen ? "" : room.id)}>
                  <View style={[s.roomIcon, { backgroundColor: isRoomOpen ? C.primary + "20" : C.surface }]}>
                    <Feather name="home" size={15} color={isRoomOpen ? C.primary : C.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.roomName, { color: C.text }]}>{room.name}</Text>
                    <Text style={[s.roomSub, { color: C.textSecondary }]}>
                      {room.items.filter(i => i.type === "deraza").length} deraza · {room.items.filter(i => i.type === "eshik").length} eshik
                      {roomTotal > 0 ? ` · ${m(roomTotal)}` : ""}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    {rooms.length > 1 && (
                      <TouchableOpacity onPress={() => removeRoom(room.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="trash-2" size={15} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                    <Feather name={isRoomOpen ? "chevron-up" : "chevron-down"} size={16} color={C.textSecondary} />
                  </View>
                </TouchableOpacity>

                {isRoomOpen && (
                  <View style={{ padding: 12, gap: 10 }}>
                    {/* Room name chips */}
                    <View style={{ gap: 6 }}>
                      <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Xona nomi</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {ROOM_NAMES.map(n => (
                            <TouchableOpacity key={n} onPress={() => updateRoomName(room.id, n)}
                              style={[s.nameChip, { borderColor: room.name === n ? C.primary : C.border, backgroundColor: room.name === n ? C.primary + "15" : C.surface }]}>
                              <Text style={[s.nameChipTxt, { color: room.name === n ? C.primary : C.textSecondary }]}>{n}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                      <TextInput style={[s.input, { borderColor: C.border, color: C.text, backgroundColor: C.card }]}
                        value={room.name} onChangeText={v => updateRoomName(room.id, v)}
                        placeholder="Xona nomi" placeholderTextColor={C.textSecondary} />
                    </View>

                    {/* Items */}
                    {room.items.map((item) => {
                      const fi = flatItems.find(f => f.item.id === item.id);
                      const isItemOpen = expandedItem === item.id;
                      const isD = item.type === "deraza";
                      const itemBg = isD ? "#EFF6FF" : "#FFF7ED";
                      const itemBorder = isD ? "#BFDBFE" : "#FED7AA";
                      const itemColor = isD ? "#2563EB" : "#D97706";
                      return (
                        <View key={item.id} style={[s.itemCard, { backgroundColor: itemBg, borderColor: isItemOpen ? itemColor : itemBorder }]}>
                          <TouchableOpacity style={s.itemHead}
                            onPress={() => setExpandedItem(isItemOpen ? "" : item.id)}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                              <Feather name={isD ? "grid" : "layout"} size={14} color={itemColor} />
                              <Text style={[s.itemLabel, { color: itemColor }]}>{item.label}</Text>
                              {fi && <Text style={[s.itemCalcBadge, { color: itemColor, backgroundColor: itemBg }]}>{m(fi.calc.jami)}</Text>}
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <TouchableOpacity onPress={() => removeItem(room.id, item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Feather name="x" size={15} color="#9CA3AF" />
                              </TouchableOpacity>
                              <Feather name={isItemOpen ? "chevron-up" : "chevron-down"} size={14} color={itemColor} />
                            </View>
                          </TouchableOpacity>

                          {isItemOpen && (
                            <View style={{ gap: 10, paddingTop: 8 }}>
                              {/* Label */}
                              <View style={{ gap: 4 }}>
                                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Nomi</Text>
                                <TextInput style={[s.input, { borderColor: itemBorder, color: C.text, backgroundColor: "#fff" }]}
                                  value={item.label} onChangeText={v => updateItem(room.id, item.id, { label: v })}
                                  placeholder={isD ? "Deraza 1" : "Eshik 1"} placeholderTextColor={C.textSecondary} />
                              </View>

                              {/* Dimensions */}
                              <View style={{ flexDirection: "row", gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                  <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Eni (m)</Text>
                                  <TextInput style={[s.input, { borderColor: itemBorder, color: C.text, backgroundColor: "#fff" }]}
                                    value={item.en} onChangeText={v => updateItem(room.id, item.id, { en: v })}
                                    placeholder={isD ? "1.5" : "0.9"} placeholderTextColor={C.textSecondary}
                                    keyboardType="decimal-pad" />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Bo'yi (m)</Text>
                                  <TextInput style={[s.input, { borderColor: itemBorder, color: C.text, backgroundColor: "#fff" }]}
                                    value={item.boy} onChangeText={v => updateItem(room.id, item.id, { boy: v })}
                                    placeholder={isD ? "1.6" : "2.1"} placeholderTextColor={C.textSecondary}
                                    keyboardType="decimal-pad" />
                                </View>
                              </View>

                              {/* Parda turi (only for deraza) */}
                              {isD && (
                                <View style={{ gap: 6 }}>
                                  <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Parda turi</Text>
                                  <View style={{ flexDirection: "row", gap: 6 }}>
                                    {PARDA_TURLARI.map(pt => (
                                      <TouchableOpacity key={pt.id}
                                        style={[s.chip, { flex: 1, borderColor: item.pardaTuri === pt.id ? C.primary : itemBorder, backgroundColor: item.pardaTuri === pt.id ? "#DBEAFE" : "#fff" }]}
                                        onPress={() => updateItem(room.id, item.id, { pardaTuri: pt.id })}>
                                        <Text style={[s.chipTxt, { color: item.pardaTuri === pt.id ? "#1D4ED8" : C.textSecondary }]} numberOfLines={2}>{pt.label}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                </View>
                              )}

                              {/* Miqdor */}
                              <View style={{ gap: 4 }}>
                                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Soni</Text>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                                  <TouchableOpacity style={[s.counterBtn, { borderColor: itemBorder, backgroundColor: "#fff" }]}
                                    onPress={() => updateItem(room.id, item.id, { miqdor: Math.max(1, item.miqdor - 1) })}>
                                    <Feather name="minus" size={16} color={itemColor} />
                                  </TouchableOpacity>
                                  <Text style={[s.counterVal, { color: C.text }]}>{item.miqdor}</Text>
                                  <TouchableOpacity style={[s.counterBtn, { borderColor: itemBorder, backgroundColor: "#fff" }]}
                                    onPress={() => updateItem(room.id, item.id, { miqdor: item.miqdor + 1 })}>
                                    <Feather name="plus" size={16} color={itemColor} />
                                  </TouchableOpacity>
                                  <Text style={[s.fieldLabel, { color: C.textSecondary }]}>ta</Text>
                                </View>
                              </View>

                              {/* Calc result */}
                              {fi && (
                                <View style={[s.calcBox, { backgroundColor: "#fff", borderColor: itemBorder }]}>
                                  <Text style={[s.calcTitle, { color: itemColor }]}>Hisob natijasi</Text>
                                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                                    <CalcChip label="Material eni"   value={m(fi.calc.materialEn)} color={itemColor} />
                                    <CalcChip label="Material bo'yi" value={m(fi.calc.materialBoy)} color={itemColor} />
                                    <CalcChip label="1 ta"           value={m(fi.calc.birOyna)} color={itemColor} />
                                    <CalcChip label={`${item.miqdor} ta jami`} value={m(fi.calc.jami)} color={itemColor} highlight />
                                  </View>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Add deraza/eshik buttons */}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity style={[s.addItemBtn, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}
                        onPress={() => addItem(room.id, "deraza")}>
                        <Feather name="grid" size={14} color="#2563EB" />
                        <Text style={[s.addItemBtnTxt, { color: "#2563EB" }]}>+ Deraza</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.addItemBtn, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}
                        onPress={() => addItem(room.id, "eshik")}>
                        <Feather name="layout" size={14} color="#D97706" />
                        <Text style={[s.addItemBtnTxt, { color: "#D97706" }]}>+ Eshik</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          {/* Add room button */}
          <TouchableOpacity style={[s.addRoomBtn, { borderColor: C.primary + "50", backgroundColor: C.primary + "08" }]} onPress={addRoom}>
            <Feather name="plus-circle" size={16} color={C.primary} />
            <Text style={[s.addRoomBtnTxt, { color: C.primary }]}>Xona qo'shish</Text>
          </TouchableOpacity>

          {/* Total */}
          {totalJami > 0 && (
            <View style={[s.totalRow, { backgroundColor: C.primary + "12", borderColor: C.primary + "30" }]}>
              <Text style={[s.totalLabel, { color: C.text }]}>Jami material:</Text>
              <Text style={[s.totalVal, { color: C.primary }]}>{m(totalJami)}</Text>
            </View>
          )}
        </View>

        {/* KARNIIZ VA BAGET */}
        <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Karniiz va Baget</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity onPress={() => addKarniiz("karniiz")}
                style={[s.addBtn, { backgroundColor: "#7C3AED" }]}>
                <Feather name="minus-square" size={13} color="#fff" />
                <Text style={s.addBtnTxt}>Karniiz</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => addKarniiz("baget")}
                style={[s.addBtn, { backgroundColor: "#0891B2" }]}>
                <Feather name="align-justify" size={13} color="#fff" />
                <Text style={s.addBtnTxt}>Baget</Text>
              </TouchableOpacity>
            </View>
          </View>

          {karniizList.length === 0 && (
            <TouchableOpacity style={[s.addRoomBtn, { borderColor: "#7C3AED40", backgroundColor: "#F5F3FF" }]}
              onPress={() => addKarniiz("karniiz")}>
              <Feather name="plus-circle" size={15} color="#7C3AED" />
              <Text style={[s.addRoomBtnTxt, { color: "#7C3AED" }]}>Karniiz yoki Baget qo'shish</Text>
            </TouchableOpacity>
          )}

          {karniizList.map((kItem) => {
            const isOpen = expandedKarniiz === kItem.id;
            const isK = kItem.turi === "karniiz";
            const kColor = isK ? "#7C3AED" : "#0891B2";
            const kBg    = isK ? "#F5F3FF" : "#ECFEFF";
            const kBorder= isK ? "#DDD6FE" : "#A5F3FC";
            const kTotal = calcKarniiz(kItem);
            const uzL = p(kItem.uzunlik) / 100;

            return (
              <View key={kItem.id} style={[s.roomCard, { borderColor: isOpen ? kColor : kBorder, backgroundColor: kBg }]}>
                <TouchableOpacity style={[s.roomHead, { backgroundColor: isOpen ? kColor + "15" : kBg }]}
                  onPress={() => setExpandedKarniiz(isOpen ? "" : kItem.id)}>
                  <View style={[s.roomIcon, { backgroundColor: kColor + "20" }]}>
                    <Feather name={isK ? "minus-square" : "align-justify"} size={15} color={kColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.roomName, { color: C.text }]}>{kItem.nomi}</Text>
                    <Text style={[s.roomSub, { color: C.textSecondary }]}>
                      {uzL.toFixed(2)} m{kTotal > 0 ? ` · ${sum(kTotal)}` : ""}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <TouchableOpacity onPress={() => removeKarniiz(kItem.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="trash-2" size={15} color="#ef4444" />
                    </TouchableOpacity>
                    <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={C.textSecondary} />
                  </View>
                </TouchableOpacity>

                {isOpen && (
                  <View style={{ padding: 12, gap: 10 }}>
                    {/* Nom */}
                    <View style={{ gap: 4 }}>
                      <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Nomi</Text>
                      <TextInput style={[s.input, { borderColor: kBorder, color: C.text, backgroundColor: "#fff" }]}
                        value={kItem.nomi} onChangeText={v => updateKarniiz(kItem.id, { nomi: v })}
                        placeholder={isK ? "Turba karniiz" : "Baget"} placeholderTextColor={C.textSecondary} />
                    </View>
                    {/* Uzunlik + Narx */}
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Uzunligi</Text>
                        <TextInput style={[s.input, { borderColor: kBorder, color: C.text, backgroundColor: "#fff" }]}
                          value={kItem.uzunlik} onChangeText={v => updateKarniiz(kItem.id, { uzunlik: v })}
                          placeholder="250" placeholderTextColor={C.textSecondary} keyboardType="decimal-pad" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Narxi (1m, so'm)</Text>
                        <TextInput style={[s.input, { borderColor: kBorder, color: C.text, backgroundColor: "#fff" }]}
                          value={kItem.narxPerM} onChangeText={v => updateKarniiz(kItem.id, { narxPerM: v })}
                          placeholder="15 000" placeholderTextColor={C.textSecondary} keyboardType="decimal-pad" />
                      </View>
                    </View>

                    {/* Aksessuarlar */}
                    <Text style={[s.fieldLabel, { color: kColor, fontFamily: "Inter_700Bold", marginTop: 4 }]}>Aksessuarlar</Text>

                    {/* Kronshteyn */}
                    <KAksRow label="Kronshteyn" icon="anchor" value={kItem.kronshteyn} color={kColor} border={kBorder}
                      onToggle={() => updateKarniizAks(kItem.id, "kronshteyn", { enabled: !kItem.kronshteyn.enabled })}
                      onSoni={v => updateKarniizAks(kItem.id, "kronshteyn", { soni: v })}
                      onNarx={v => updateKarniizAks(kItem.id, "kronshteyn", { narxi: v })} />

                    {/* Kruçka */}
                    <KAksRow label="Kruçka (halqa)" icon="link" value={kItem.kruchka} color={kColor} border={kBorder}
                      onToggle={() => updateKarniizAks(kItem.id, "kruchka", { enabled: !kItem.kruchka.enabled })}
                      onSoni={v => updateKarniizAks(kItem.id, "kruchka", { soni: v })}
                      onNarx={v => updateKarniizAks(kItem.id, "kruchka", { narxi: v })} />

                    {/* Gul oyoq (ikki yoni) */}
                    <View style={[aksStyles.wrap, { borderColor: kItem.gulOyoq.enabled ? kColor : kBorder }]}>
                      <TouchableOpacity style={aksStyles.headerRow}
                        onPress={() => updateKarniizAks(kItem.id, "gulOyoq", { enabled: !kItem.gulOyoq.enabled })}>
                        <View style={[aksStyles.dot, { backgroundColor: kItem.gulOyoq.enabled ? kColor : "#D1D5DB" }]} />
                        <Feather name="star" size={13} color={kItem.gulOyoq.enabled ? kColor : "#9CA3AF"} />
                        <Text style={[aksStyles.label, { color: kItem.gulOyoq.enabled ? kColor : C.textSecondary }]}>Gul oyoq (ikki yoni)</Text>
                      </TouchableOpacity>
                      {kItem.gulOyoq.enabled && (
                        <View style={{ paddingTop: 8, paddingHorizontal: 4 }}>
                          <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Juft narxi (so'm)</Text>
                          <TextInput style={[s.input, { borderColor: kBorder, color: C.text, backgroundColor: "#fff", height: 38 }]}
                            value={kItem.gulOyoq.narxi} onChangeText={v => updateKarniizAks(kItem.id, "gulOyoq", { narxi: v })}
                            placeholder="20 000" placeholderTextColor={C.textSecondary} keyboardType="decimal-pad" />
                        </View>
                      )}
                    </View>

                    {/* Derjatel */}
                    <KAksRow label="Derjatel (ushlagich)" icon="paperclip" value={kItem.derjatel} color={kColor} border={kBorder}
                      onToggle={() => updateKarniizAks(kItem.id, "derjatel", { enabled: !kItem.derjatel.enabled })}
                      onSoni={v => updateKarniizAks(kItem.id, "derjatel", { soni: v })}
                      onNarx={v => updateKarniizAks(kItem.id, "derjatel", { narxi: v })} />

                    {/* Babon */}
                    <KAksRow label="Babon (bezak)" icon="wind" value={kItem.babon} color={kColor} border={kBorder}
                      onToggle={() => updateKarniizAks(kItem.id, "babon", { enabled: !kItem.babon.enabled })}
                      onSoni={v => updateKarniizAks(kItem.id, "babon", { soni: v })}
                      onNarx={v => updateKarniizAks(kItem.id, "babon", { narxi: v })} />

                    {/* Popik */}
                    <View style={[aksStyles.wrap, { borderColor: kItem.popik.enabled ? kColor : kBorder }]}>
                      <TouchableOpacity style={aksStyles.headerRow}
                        onPress={() => updateKarniizAks(kItem.id, "popik", { enabled: !kItem.popik.enabled })}>
                        <View style={[aksStyles.dot, { backgroundColor: kItem.popik.enabled ? kColor : "#D1D5DB" }]} />
                        <Feather name="tag" size={13} color={kItem.popik.enabled ? kColor : "#9CA3AF"} />
                        <Text style={[aksStyles.label, { color: kItem.popik.enabled ? kColor : C.textSecondary }]}>Popik (uchpopik)</Text>
                      </TouchableOpacity>
                      {kItem.popik.enabled && (
                        <View style={{ paddingTop: 8, paddingHorizontal: 4 }}>
                          <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Narxi (so'm)</Text>
                          <TextInput style={[s.input, { borderColor: kBorder, color: C.text, backgroundColor: "#fff", height: 38 }]}
                            value={kItem.popik.narxi} onChangeText={v => updateKarniizAks(kItem.id, "popik", { narxi: v })}
                            placeholder="5 000" placeholderTextColor={C.textSecondary} keyboardType="decimal-pad" />
                        </View>
                      )}
                    </View>

                    {/* Tikuv (parda qirvog'i) */}
                    <View style={[aksStyles.wrap, { borderColor: kItem.tikuv.enabled ? kColor : kBorder }]}>
                      <TouchableOpacity style={aksStyles.headerRow}
                        onPress={() => updateKarniizAks(kItem.id, "tikuv", { enabled: !kItem.tikuv.enabled })}>
                        <View style={[aksStyles.dot, { backgroundColor: kItem.tikuv.enabled ? kColor : "#D1D5DB" }]} />
                        <Feather name="scissors" size={13} color={kItem.tikuv.enabled ? kColor : "#9CA3AF"} />
                        <Text style={[aksStyles.label, { color: kItem.tikuv.enabled ? kColor : C.textSecondary }]}>Parda qirvog'i tikuvi</Text>
                      </TouchableOpacity>
                      {kItem.tikuv.enabled && (
                        <View style={{ paddingTop: 8, flexDirection: "row", gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Uzunlik (cm)</Text>
                            <TextInput style={[s.input, { borderColor: kBorder, color: C.text, backgroundColor: "#fff", height: 38 }]}
                              value={kItem.tikuv.uzunlik} onChangeText={v => updateKarniizAks(kItem.id, "tikuv", { uzunlik: v })}
                              placeholder="500" placeholderTextColor={C.textSecondary} keyboardType="decimal-pad" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Narxi (1m, so'm)</Text>
                            <TextInput style={[s.input, { borderColor: kBorder, color: C.text, backgroundColor: "#fff", height: 38 }]}
                              value={kItem.tikuv.narxi} onChangeText={v => updateKarniizAks(kItem.id, "tikuv", { narxi: v })}
                              placeholder="3 000" placeholderTextColor={C.textSecondary} keyboardType="decimal-pad" />
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Item total */}
                    {kTotal > 0 && (
                      <View style={[s.totalRow, { backgroundColor: kColor + "12", borderColor: kColor + "30", marginTop: 4 }]}>
                        <Text style={[s.totalLabel, { color: C.text }]}>{kItem.nomi} jami:</Text>
                        <Text style={[s.totalVal, { color: kColor, fontSize: 16 }]}>{sum(kTotal)}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {karniizList.length > 0 && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <TouchableOpacity style={[s.addItemBtn, { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}
                onPress={() => addKarniiz("karniiz")}>
                <Feather name="plus" size={13} color="#7C3AED" />
                <Text style={[s.addItemBtnTxt, { color: "#7C3AED" }]}>+ Karniiz</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.addItemBtn, { backgroundColor: "#ECFEFF", borderColor: "#A5F3FC" }]}
                onPress={() => addKarniiz("baget")}>
                <Feather name="plus" size={13} color="#0891B2" />
                <Text style={[s.addItemBtnTxt, { color: "#0891B2" }]}>+ Baget</Text>
              </TouchableOpacity>
            </View>
          )}

          {karniizTotal > 0 && (
            <View style={[s.totalRow, { backgroundColor: "#7C3AED15", borderColor: "#7C3AED30", marginTop: 8 }]}>
              <Text style={[s.totalLabel, { color: C.text }]}>Karniiz/Baget jami:</Text>
              <Text style={[s.totalVal, { color: "#7C3AED" }]}>{sum(karniizTotal)}</Text>
            </View>
          )}
        </View>

        {/* NARX */}
        <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Narx va xizmatlar</Text>
          <Inp label="Parda narxi (1 metr, so'm)" value={narxPerMetr} onChange={setNarxPerMetr} placeholder="50 000" keyboard="decimal-pad" />
          {narx > 0 && (
            <View style={[s.resultRow, { backgroundColor: "#fef9c3" }]}>
              <Text style={s.resultLbl}>Parda:</Text>
              <Text style={[s.resultVal, { color: "#92400e" }]}>{sum(totalNarx)}</Text>
            </View>
          )}

          <Text style={[s.fieldLabel, { color: C.textSecondary, marginTop: 10 }]}>O'rnatish xizmati</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {ORNATISH_TURLARI.map(t => (
              <TouchableOpacity key={t.id}
                style={[s.chip, { flex: 1, borderColor: ornatishTuri === t.id ? "#f97316" : C.border, backgroundColor: ornatishTuri === t.id ? "#fff7ed" : C.surface }]}
                onPress={() => setOrnatishTuri(t.id)}>
                <Text style={[s.chipTxt, { color: ornatishTuri === t.id ? "#c2410c" : C.textSecondary }]}>{t.label}</Text>
                {t.narx > 0 && <Text style={{ fontSize: 9, color: ornatishTuri === t.id ? "#ea580c" : C.textSecondary }}>{(t.narx/1000).toFixed(0)}k/ta</Text>}
              </TouchableOpacity>
            ))}
          </View>
          {ornatishJami > 0 && (
            <View style={[s.resultRow, { backgroundColor: "#fff7ed" }]}>
              <Text style={s.resultLbl}>O'rnatish ({jmDona} ta):</Text>
              <Text style={[s.resultVal, { color: "#c2410c" }]}>{sum(ornatishJami)}</Text>
            </View>
          )}

          <Inp label="Chevar haqi (1 metr, ixtiyoriy)" value={chevarHaqiPerMetr} onChange={setChevarHaqiPerMetr} placeholder="0" keyboard="decimal-pad" />
          {chevarJami > 0 && (
            <View style={[s.resultRow, { backgroundColor: "#f5f3ff" }]}>
              <Text style={s.resultLbl}>Chevar haqi:</Text>
              <Text style={[s.resultVal, { color: "#7c3aed" }]}>{sum(chevarJami)}</Text>
            </View>
          )}
          {karniizTotal > 0 && (
            <View style={[s.resultRow, { backgroundColor: "#F5F3FF" }]}>
              <Text style={s.resultLbl}>Karniiz/Baget ({karniizList.length} ta):</Text>
              <Text style={[s.resultVal, { color: "#7C3AED" }]}>{sum(karniizTotal)}</Text>
            </View>
          )}

          {grandTotal > 0 && (
            <View style={[s.grandBox, { backgroundColor: C.primary }]}>
              <Text style={s.grandLabel}>UMUMIY NARX</Text>
              <Text style={s.grandVal}>{sum(grandTotal)}</Text>
            </View>
          )}

          <Inp label="Zaklat (oldindan to'lov, so'm)" value={zaklatSumma} onChange={setZaklatSumma} placeholder="0" keyboard="decimal-pad" />
          {zaklat > 0 && (
            <View style={[s.resultRow, { backgroundColor: qarz > 0 ? "#fef2f2" : "#f0fdf4" }]}>
              <Text style={s.resultLbl}>Qolgan qarz:</Text>
              <Text style={[s.resultVal, { color: qarz > 0 ? "#991b1b" : "#166534" }]}>{sum(qarz)}</Text>
            </View>
          )}

          <Inp label="Tayyor bo'lish sanasi" value={tayyorKun} onChange={setTayyorKun} placeholder="Masalan: 15-dekabr" />
          <Inp label="Qarz qaytarish muddati (YYYY-MM-DD)" value={qaytarishMuddati} onChange={setQaytarishMuddati} placeholder="Masalan: 2025-02-20" />
        </View>

        {/* ISHCHILAR */}
        {(tailors.length > 0 || installers.length > 0) && (
          <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Telegram ishchilar</Text>
            {tailors.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Chevar</Text>
                {tailors.map(w => (
                  <TouchableOpacity key={w.id}
                    style={[s.workerRow, { borderColor: selectedTailor === w.id ? C.primary : C.border, backgroundColor: selectedTailor === w.id ? C.primary + "10" : C.card }]}
                    onPress={() => setSelectedTailor(selectedTailor === w.id ? null : w.id)}>
                    <Feather name="scissors" size={14} color={selectedTailor === w.id ? C.primary : C.textSecondary} />
                    <Text style={[s.workerName, { color: C.text }]}>{w.fullName}</Text>
                    {selectedTailor === w.id && <Feather name="check-circle" size={16} color={C.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {installers.length > 0 && (
              <View style={{ gap: 4, marginTop: 8 }}>
                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>O'rnatuvchi</Text>
                {installers.map(w => (
                  <TouchableOpacity key={w.id}
                    style={[s.workerRow, { borderColor: selectedInstaller === w.id ? "#f97316" : C.border, backgroundColor: selectedInstaller === w.id ? "#fff7ed" : C.card }]}
                    onPress={() => setSelectedInstaller(selectedInstaller === w.id ? null : w.id)}>
                    <Feather name="tool" size={14} color={selectedInstaller === w.id ? "#f97316" : C.textSecondary} />
                    <Text style={[s.workerName, { color: C.text }]}>{w.fullName}</Text>
                    {selectedInstaller === w.id && <Feather name="check-circle" size={16} color="#f97316" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity style={[s.telegramBtn, { opacity: sending ? 0.6 : 1 }]}
              onPress={sendTelegram} disabled={sending}>
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={15} color="#fff" />}
              <Text style={s.telegramBtnTxt}>Telegramga yuborish</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* IZOH */}
        <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Izoh (ixtiyoriy)</Text>
          <TextInput style={[s.textarea, { borderColor: C.border, color: C.text, backgroundColor: C.card }]}
            value={izoh} onChangeText={setIzoh}
            placeholder="Qo'shimcha ma'lumotlar..." placeholderTextColor={C.textSecondary}
            multiline numberOfLines={3} />
        </View>

        {/* ACTION BUTTONS */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}
              onPress={generatePdf} disabled={pdfLoading}>
              {pdfLoading ? <ActivityIndicator size="small" color="#3b82f6" /> : <Feather name="file-text" size={15} color="#3b82f6" />}
              <Text style={[s.actionBtnTxt, { color: "#1d4ed8" }]}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}
              onPress={generateChevarPdf} disabled={pdfLoading}>
              <Feather name="scissors" size={15} color="#7c3aed" />
              <Text style={[s.actionBtnTxt, { color: "#6d28d9" }]}>Chevar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}
              onPress={shareText}>
              <Feather name="share-2" size={15} color="#16a34a" />
              <Text style={[s.actionBtnTxt, { color: "#15803d" }]}>Ulash</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}
              onPress={sendSms} disabled={sending}>
              {sending ? <ActivityIndicator size="small" color="#ea580c" /> : <Feather name="message-square" size={15} color="#ea580c" />}
              <Text style={[s.actionBtnTxt, { color: "#c2410c" }]}>SMS</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[s.bigSaveBtn, { backgroundColor: C.primary, opacity: saving ? 0.7 : 1 }]}
            onPress={saveDeal} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="check-circle" size={18} color="#fff" />}
            <Text style={s.bigSaveBtnTxt}>Bitishuv sifatida saqlash</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Inp({ label, value, onChange, placeholder, keyboard }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: any;
}) {
  return (
    <View style={{ gap: 4, marginBottom: 8 }}>
      <Text style={[s.fieldLabel, { color: C.textSecondary }]}>{label}</Text>
      <TextInput style={[s.input, { borderColor: C.border, color: C.text, backgroundColor: C.card }]}
        value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={C.textSecondary}
        keyboardType={keyboard || "default"} />
    </View>
  );
}

function CalcChip({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <View style={[s.calcChip, highlight && { borderColor: color + "60", backgroundColor: color + "15" }]}>
      <Text style={[s.calcChipLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[s.calcChipVal, { color: highlight ? color : C.text }]}>{value}</Text>
    </View>
  );
}

function KAksRow({ label, icon, value, color, border, onToggle, onSoni, onNarx }: {
  label: string; icon: string; value: KAks; color: string; border: string;
  onToggle: () => void; onSoni: (v: string) => void; onNarx: (v: string) => void;
}) {
  return (
    <View style={[aksStyles.wrap, { borderColor: value.enabled ? color : border }]}>
      <TouchableOpacity style={aksStyles.headerRow} onPress={onToggle}>
        <View style={[aksStyles.dot, { backgroundColor: value.enabled ? color : "#D1D5DB" }]} />
        <Feather name={icon as any} size={13} color={value.enabled ? color : "#9CA3AF"} />
        <Text style={[aksStyles.label, { color: value.enabled ? color : C.textSecondary }]}>{label}</Text>
      </TouchableOpacity>
      {value.enabled && (
        <View style={{ paddingTop: 8, flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Soni</Text>
            <TextInput style={[s.input, { borderColor: border, color: C.text, backgroundColor: "#fff", height: 38 }]}
              value={value.soni} onChangeText={onSoni}
              placeholder="1" placeholderTextColor={C.textSecondary} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Narxi (1 ta, so'm)</Text>
            <TextInput style={[s.input, { borderColor: border, color: C.text, backgroundColor: "#fff", height: 38 }]}
              value={value.narxi} onChangeText={onNarx}
              placeholder="5 000" placeholderTextColor={C.textSecondary} keyboardType="decimal-pad" />
          </View>
        </View>
      )}
    </View>
  );
}

const aksStyles = StyleSheet.create({
  wrap:      { borderWidth: 1.5, borderRadius: 10, padding: 10, gap: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  label:     { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
});

const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, backgroundColor: C.card },
  backBtn:      { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title:        { fontSize: 17, fontFamily: "Inter_700Bold", flex: 1, textAlign: "center" },
  saveBtn:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  saveBtnTxt:   { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  section:      { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  fieldLabel:   { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 4 },
  input:        { height: 44, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  textarea:     { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, minHeight: 80, textAlignVertical: "top", fontFamily: "Inter_400Regular" },
  gpsBtn:       { width: 44, height: 44, borderWidth: 1.5, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  addBtn:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addBtnTxt:    { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },

  summaryBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginBottom: 6 },
  summaryTxt:   { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  roomCard:     { borderWidth: 1.5, borderRadius: 14, overflow: "hidden", marginTop: 8 },
  roomHead:     { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  roomIcon:     { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  roomName:     { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  roomSub:      { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  nameChip:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5 },
  nameChipTxt:  { fontSize: 11, fontFamily: "Inter_500Medium" },

  itemCard:     { borderRadius: 12, borderWidth: 1.5, overflow: "hidden" },
  itemHead:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10 },
  itemLabel:    { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  itemCalcBadge:{ fontSize: 11, fontFamily: "Inter_500Medium", marginLeft: 4 },

  addItemBtn:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
  addItemBtnTxt:{ fontSize: 12, fontFamily: "Inter_600SemiBold" },

  addRoomBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", marginTop: 4 },
  addRoomBtnTxt:{ fontSize: 13, fontFamily: "Inter_600SemiBold" },

  chip:         { borderWidth: 1.5, borderRadius: 8, padding: 8, alignItems: "center", gap: 2 },
  chipTxt:      { fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  counterBtn:   { width: 36, height: 36, borderWidth: 1.5, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  counterVal:   { fontSize: 20, fontFamily: "Inter_700Bold", minWidth: 30, textAlign: "center" },

  calcBox:      { borderWidth: 1, borderRadius: 10, padding: 10 },
  calcTitle:    { fontSize: 10, fontFamily: "Inter_700Bold", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 },
  calcChip:     { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 8, backgroundColor: "#f8fafc", alignItems: "center", minWidth: "45%", flex: 1 },
  calcChipLabel:{ fontSize: 9, fontFamily: "Inter_500Medium", marginBottom: 2 },
  calcChipVal:  { fontSize: 13, fontFamily: "Inter_700Bold" },

  totalRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8 },
  totalLabel:   { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  totalVal:     { fontSize: 18, fontFamily: "Inter_700Bold" },

  resultRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 8, padding: 9, marginTop: 4 },
  resultLbl:    { fontSize: 12, fontFamily: "Inter_500Medium", color: "#64748b" },
  resultVal:    { fontSize: 12, fontFamily: "Inter_700Bold" },

  grandBox:     { borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 10 },
  grandLabel:   { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  grandVal:     { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },

  workerRow:    { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 11, marginBottom: 4 },
  workerName:   { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  telegramBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#0088cc", borderRadius: 10, padding: 12, marginTop: 8 },
  telegramBtnTxt: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  actionBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 13 },
  actionBtnTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  bigSaveBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, padding: 16 },
  bigSaveBtnTxt:{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
