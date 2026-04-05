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

interface Oyna {
  id: string;
  xona: string;
  en: string;
  boy: string;
  miqdor: number;
  pardaTuri: PardaTuri;
}

interface Calc {
  en: number; boy: number;
  materialEn: number; materialBoy: number;
  birOyna: number; jami: number;
}

interface Worker {
  id: number; fullName: string; phone: string;
  role: string; telegramChatId: string | null;
}

const PARDA_TURLARI: { id: PardaTuri; label: string; koeff: number }[] = [
  { id: "oddiy",        label: "Oddiy (×2)",   koeff: 2 },
  { id: "ikki_qavatli", label: "Ikki qavatli", koeff: 2 },
  { id: "karnizsiz",    label: "Karnizsiz (×1.5)", koeff: 1.5 },
];

const ORNATISH_TURLARI = [
  { id: "",       label: "Yo'q",   narx: 0 },
  { id: "devor",  label: "🧱 Devor", narx: 20000 },
  { id: "beton",  label: "🏗️ Beton", narx: 30000 },
];

const QOSHIMCHA_BOY = 0.3;

function hisobla(o: Oyna): Calc | null {
  const en = parseFloat(o.en);
  const boy = parseFloat(o.boy);
  if (!en || !boy || en <= 0 || boy <= 0) return null;
  const koeff = PARDA_TURLARI.find(p => p.id === o.pardaTuri)?.koeff ?? 2;
  const materialEn = en * koeff;
  const materialBoy = boy + QOSHIMCHA_BOY;
  const birOyna = materialEn * materialBoy;
  const jami = birOyna * o.miqdor;
  return { en, boy, materialEn, materialBoy, birOyna, jami };
}

function m(v: number) { return v.toFixed(2) + " m"; }
function sum(v: number) { return new Intl.NumberFormat("uz-UZ").format(Math.round(v)) + " so'm"; }
function p(s: string) { return parseFloat(s) || 0; }

function newOyna(xona = ""): Oyna {
  return { id: Math.random().toString(36).slice(2), xona, en: "", boy: "", miqdor: 1, pardaTuri: "oddiy" };
}

export default function MijozOldigaScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 110);

  // Oyna ro'yxati
  const [oynaList, setOynaList] = useState<Oyna[]>([newOyna("Mehmonxona")]);
  const [expandedId, setExpandedId] = useState<string>(oynaList[0].id);

  // Mijoz
  const [mijozIsm, setMijozIsm]     = useState("");
  const [mijozPhone, setMijozPhone] = useState("");
  const [manzil, setManzil]         = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);

  // Narx
  const [narxPerMetr, setNarxPerMetr]             = useState("");
  const [ornatishTuri, setOrnatishTuri]            = useState("");
  const [chevarHaqiPerMetr, setChevarHaqiPerMetr] = useState("");
  const [zaklatSumma, setZaklatSumma]             = useState("");
  const [tayyorKun, setTayyorKun]                 = useState("");
  const [izoh, setIzoh]                           = useState("");

  // Ishchilar
  const [selectedTailor, setSelectedTailor]       = useState<number | null>(null);
  const [selectedInstaller, setSelectedInstaller] = useState<number | null>(null);

  // Loading
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

  // Hisob-kitob
  const results     = oynaList.map(o => ({ oyna: o, calc: hisobla(o) }));
  const totalJami   = results.reduce((s, r) => s + (r.calc?.jami ?? 0), 0);
  const narx        = p(narxPerMetr);
  const totalNarx   = totalJami * narx;
  const ornatishNarx = ORNATISH_TURLARI.find(t => t.id === ornatishTuri)?.narx ?? 0;
  const jmDona      = oynaList.reduce((s, o) => s + o.miqdor, 0);
  const ornatishJami = ornatishNarx * jmDona;
  const chevarHaqi  = p(chevarHaqiPerMetr);
  const chevarJami  = chevarHaqi * totalJami;
  const zaklat      = p(zaklatSumma);
  const grandTotal  = totalNarx + ornatishJami + chevarJami;
  const qarz        = Math.max(0, grandTotal - zaklat);

  // Oyna actions
  const addOyna = () => {
    const o = newOyna();
    setOynaList(prev => [...prev, o]);
    setExpandedId(o.id);
  };
  const removeOyna = (id: string) =>
    setOynaList(prev => { const n = prev.filter(o => o.id !== id); return n.length ? n : [newOyna()]; });
  const updateOyna = useCallback((id: string, patch: Partial<Oyna>) =>
    setOynaList(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o)), []);

  // GPS
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
    measurements: results.filter(r => r.calc).map(({ oyna, calc }) => ({
      xona: oyna.xona, en: calc!.en, boy: calc!.boy,
      materialEn: calc!.materialEn, materialBoy: calc!.materialBoy,
      miqdor: oyna.miqdor, pardaTuri: oyna.pardaTuri, jami: calc!.jami,
    })),
    totalMaterial: totalJami, narxPerMetr: narx,
    totalNarx: grandTotal, ornatishTuri: ornatishTuri || null, ornatishNarx: ornatishJami,
    chevarHaqiPerMetr: chevarHaqi, chevarJami,
    zaklatSumma: zaklat, qarzSumma: qarz,
    tayyorBolishKuni: tayyorKun || null,
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
      const date = tayyorKun || "—";
      const text =
        `Hurmatli ${mijozIsm || "mijoz"}, siz uchun parda hisob-kitob tayyor!\n` +
        `Jami material: ${totalJami.toFixed(2)} m\n` +
        (grandTotal > 0 ? `Umumiy narx: ${sum(grandTotal)}\n` : "") +
        (zaklat > 0 ? `Zaklat: ${sum(zaklat)}\n` : "") +
        (qarz > 0 ? `Qolgan qarz: ${sum(qarz)}\n` : "") +
        `Tayyor sana: ${date}\n` +
        `— Blupos tizimi`;
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
    results.forEach(({ oyna, calc }, i) => {
      if (!calc) return;
      lines.push(`${i + 1}. *${oyna.xona || "Xona " + (i + 1)}* — ${m(calc.jami)}`);
    });
    lines.push(`\n📦 Jami: *${m(totalJami)}*`);
    if (grandTotal > 0) lines.push(`💰 Narx: *${sum(grandTotal)}*`);
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
      const rowsHtml = results.filter(r => r.calc).map(({ oyna, calc }, i) =>
        `<tr>
          <td style="text-align:center;font-weight:bold">${i + 1}</td>
          <td>${oyna.xona || "Xona " + (i + 1)}</td>
          <td style="text-align:center">${calc!.en.toFixed(2)} m</td>
          <td style="text-align:center">${calc!.boy.toFixed(2)} m</td>
          <td style="text-align:center;font-weight:bold;color:#4f46e5">${calc!.materialEn.toFixed(2)} m</td>
          <td style="text-align:center;font-weight:bold;color:#4f46e5">${calc!.materialBoy.toFixed(2)} m</td>
          <td style="text-align:center">${PARDA_TURLARI.find(p => p.id === oyna.pardaTuri)?.label || ""}</td>
          <td style="text-align:center">${oyna.miqdor} ta</td>
          <td style="text-align:center;font-weight:900;color:#4f46e5">${calc!.jami.toFixed(2)} m</td>
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
  .check-col { width:40px; border:1px solid #cbd5e1; }
</style></head><body>
<div class="top">
  <div>
    <div class="brand">BLUPOS</div>
    <div class="brand-sub">Parda, Karniz va Jaluziya — Chevar varaqasi</div>
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
      <th>#</th><th>Xona</th><th>Eni</th><th>Bo'yi</th>
      <th style="background:#3730a3">Mat. eni</th><th style="background:#3730a3">Mat. bo'yi</th>
      <th>Turi</th><th>Soni</th><th style="background:#3730a3">Jami (m)</th>
      <th>✓</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
    <tr style="background:#eef2ff">
      <td colspan="8" style="text-align:right;font-weight:bold;color:#3730a3">JAMI MATERIAL:</td>
      <td style="text-align:center;font-weight:900;font-size:13px;color:#3730a3">${totalJami.toFixed(2)} m</td>
      <td></td>
    </tr>
  </tbody>
</table>
<div class="foot-row">
  <div class="total-box">
    <div class="total-item"><div class="t-lbl">Jami material</div><div class="t-val">${totalJami.toFixed(2)} m</div></div>
    <div class="total-item"><div class="t-lbl">Xonalar soni</div><div class="t-val">${results.filter(r => r.calc).length} ta</div></div>
    <div class="total-item"><div class="t-lbl">Umumiy dona</div><div class="t-val">${jmDona} ta</div></div>
  </div>
  <div class="sig">
    <div>Chevar imzosi: ________________</div>
    <div style="margin-top:4px;font-size:8px;color:#cbd5e1">Blupos | ${new Date().toLocaleString("uz-UZ")}</div>
  </div>
</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Chevar varaqasini ulashish" });
      } else {
        Alert.alert("PDF tayyor", uri);
      }
    } catch { Alert.alert("Xato", "PDF yaratishda xato"); }
    finally { setPdfLoading(false); }
  };

  const generatePdf = async () => {
    if (!totalJami) { Alert.alert("Xato", "O'lchamlarni kiriting"); return; }
    setPdfLoading(true);
    try {
      const date = new Date().toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" });
      const rowsHtml = results.filter(r => r.calc).map(({ oyna, calc }, i) =>
        `<tr><td>${i+1}</td><td>${oyna.xona||"Xona "+(i+1)}</td><td>${calc!.en.toFixed(2)}×${calc!.boy.toFixed(2)}</td><td>${calc!.materialEn.toFixed(2)}×${calc!.materialBoy.toFixed(2)}</td><td>${PARDA_TURLARI.find(p=>p.id===oyna.pardaTuri)?.label||""}</td><td>${oyna.miqdor}ta</td><td>${calc!.jami.toFixed(2)}m</td></tr>`
      ).join("");
      const html = `<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a2e;padding:24px 32px}
.hdr{text-align:center;border-bottom:2px solid #3b82f6;padding-bottom:12px;margin-bottom:16px}
.hdr h1{font-size:24px;color:#3b82f6;font-weight:900;letter-spacing:2px}.hdr p{font-size:11px;color:#64748b;margin-top:3px}
.sec{margin-bottom:14px}.stl{font-size:10px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;border-bottom:1px solid #e2e8f0;padding-bottom:3px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ii{display:flex;flex-direction:column;gap:2px}
.il{font-size:9px;color:#94a3b8;text-transform:uppercase}.iv{font-size:12px;font-weight:700;color:#1e293b}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#f1f5f9;border:1px solid #e2e8f0;padding:6px 8px;text-align:left;font-size:10px;color:#475569;font-weight:bold}
td{border:1px solid #e2e8f0;padding:6px 8px}tr:nth-child(even) td{background:#f8fafc}
.tr td{font-weight:bold;background:#dbeafe!important;color:#1e40af}
.pbox{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
.pr{display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px dashed #e2e8f0}
.pr:last-child{border-bottom:none}.pl{color:#475569;font-size:12px}.pv{font-weight:700;font-size:12px}
.grand{background:#1e40af;color:white;padding:10px 14px;display:flex;justify-content:space-between;border-radius:8px;margin-top:8px}
.foot{border-top:1px solid #e2e8f0;margin-top:20px;padding-top:8px;text-align:center;color:#94a3b8;font-size:10px}
</style></head><body>
<div class="hdr"><h1>BLUPOS</h1><p>Parda, Karniz va Jaluziya Do'koni — Hisob-kitob</p></div>
${mijozIsm||mijozPhone||manzil?`<div class="sec"><div class="stl">Mijoz</div><div class="g2">
${mijozIsm?`<div class="ii"><span class="il">Ism</span><span class="iv">${mijozIsm}</span></div>`:""}
${mijozPhone?`<div class="ii"><span class="il">Tel</span><span class="iv">${mijozPhone}</span></div>`:""}
${manzil?`<div class="ii" style="grid-column:span 2"><span class="il">Manzil</span><span class="iv">${manzil}</span></div>`:""}
<div class="ii"><span class="il">Sana</span><span class="iv">${date}</span></div></div></div>`:`<p style="color:#64748b;font-size:11px;margin-bottom:14px">Sana: ${date}</p>`}
<div class="sec"><div class="stl">O'lchamlar va material</div>
<table><thead><tr><th>#</th><th>Xona</th><th>Deraza</th><th>Material</th><th>Turi</th><th>Soni</th><th>Jami</th></tr></thead>
<tbody>${rowsHtml}<tr class="tr"><td colspan="6" style="text-align:right">Jami material:</td><td>${totalJami.toFixed(2)}m</td></tr></tbody></table></div>
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
<div class="foot">Blupos tizimi | ${new Date().toLocaleString("uz-UZ")}</div>
</body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Hisob-kitobni saqlash" });
      } else {
        Alert.alert("PDF tayyor", uri);
      }
    } catch { Alert.alert("Xato", "PDF yaratishda xato"); }
    finally { setPdfLoading(false); }
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Fixed header */}
      <View style={[s.header, { paddingTop: topPadding + 10, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: C.text }]}>Mijoz oldiga</Text>
        <TouchableOpacity
          onPress={saveDeal} disabled={saving}
          style={[s.saveBtn, { backgroundColor: C.primary, opacity: saving ? 0.6 : 1 }]}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="save" size={14} color="#fff" />
          }
          <Text style={s.saveBtnTxt}>Saqlash</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 14 }}>

        {/* === MIJOZ === */}
        <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Mijoz ma'lumotlari</Text>
          <Inp label="Ism (ixtiyoriy)" value={mijozIsm} onChange={setMijozIsm} placeholder="Abdullayev Jasur" />
          <Inp label="Telefon" value={mijozPhone} onChange={setMijozPhone} placeholder="+998 90 123 45 67" keyboard="phone-pad" />
          <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Manzil</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[s.input, { flex: 1, borderColor: C.border, color: C.text, backgroundColor: C.card }]}
              value={manzil} onChangeText={setManzil}
              placeholder="Ko'cha, uy yoki GPS" placeholderTextColor={C.textSecondary}
            />
            <TouchableOpacity
              style={[s.gpsBtn, { borderColor: C.border, backgroundColor: C.card }]}
              onPress={getGps} disabled={gpsLoading}
            >
              {gpsLoading
                ? <ActivityIndicator size="small" color={C.primary} />
                : <Feather name="map-pin" size={18} color={C.primary} />
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* === O'LCHAMLAR === */}
        <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[s.sectionLabel, { color: C.textSecondary }]}>O'lchamlar</Text>
            <TouchableOpacity onPress={addOyna} style={[s.addBtn, { backgroundColor: C.primary }]}>
              <Feather name="plus" size={14} color="#fff" />
              <Text style={s.addBtnTxt}>Xona qo'shish</Text>
            </TouchableOpacity>
          </View>

          {oynaList.map((oyna, idx) => {
            const calc = hisobla(oyna);
            const isOpen = expandedId === oyna.id;
            return (
              <View key={oyna.id} style={[s.oynaWrap, { borderColor: C.border }]}>
                {/* Row header */}
                <TouchableOpacity
                  style={[s.oynaHead, { backgroundColor: isOpen ? C.primary + "12" : C.card }]}
                  onPress={() => setExpandedId(isOpen ? "" : oyna.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                    <View style={[s.numBadge, { backgroundColor: C.primary }]}>
                      <Text style={s.numBadgeTxt}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.oynaTitle, { color: C.text }]} numberOfLines={1}>
                        {oyna.xona || `Xona ${idx + 1}`}
                      </Text>
                      {calc && (
                        <Text style={{ fontSize: 11, color: C.primary, marginTop: 1 }}>
                          {m(calc.jami)} material
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    {oynaList.length > 1 && (
                      <TouchableOpacity onPress={() => removeOyna(oyna.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="trash-2" size={15} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                    <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={C.textSecondary} />
                  </View>
                </TouchableOpacity>

                {/* Expanded form */}
                {isOpen && (
                  <View style={{ padding: 12, gap: 10, backgroundColor: C.card }}>
                    <Inp label="Xona nomi" value={oyna.xona} onChange={v => updateOyna(oyna.id, { xona: v })} placeholder="Mehmonxona" />

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Inp label="En (m)" value={oyna.en} onChange={v => updateOyna(oyna.id, { en: v })} placeholder="3.5" keyboard="decimal-pad" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Inp label="Bo'y (m)" value={oyna.boy} onChange={v => updateOyna(oyna.id, { boy: v })} placeholder="2.7" keyboard="decimal-pad" />
                      </View>
                    </View>

                    {/* Parda turi */}
                    <View style={{ gap: 6 }}>
                      <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Parda turi</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {PARDA_TURLARI.map(p => (
                          <TouchableOpacity
                            key={p.id}
                            style={[s.chip, {
                              flex: 1,
                              borderColor: oyna.pardaTuri === p.id ? C.primary : C.border,
                              backgroundColor: oyna.pardaTuri === p.id ? C.primary + "15" : C.surface,
                            }]}
                            onPress={() => updateOyna(oyna.id, { pardaTuri: p.id })}
                          >
                            <Text style={[s.chipTxt, { color: oyna.pardaTuri === p.id ? C.primary : C.textSecondary }]} numberOfLines={2}>
                              {p.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Soni */}
                    <View style={{ gap: 6 }}>
                      <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Soni</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                        <TouchableOpacity
                          style={[s.counterBtn, { borderColor: C.border, backgroundColor: C.surface }]}
                          onPress={() => updateOyna(oyna.id, { miqdor: Math.max(1, oyna.miqdor - 1) })}
                        >
                          <Feather name="minus" size={18} color={C.text} />
                        </TouchableOpacity>
                        <Text style={[s.counterVal, { color: C.text }]}>{oyna.miqdor}</Text>
                        <TouchableOpacity
                          style={[s.counterBtn, { borderColor: C.border, backgroundColor: C.surface }]}
                          onPress={() => updateOyna(oyna.id, { miqdor: oyna.miqdor + 1 })}
                        >
                          <Feather name="plus" size={18} color={C.text} />
                        </TouchableOpacity>
                        <Text style={[s.fieldLabel, { color: C.textSecondary }]}>ta</Text>
                      </View>
                    </View>

                    {/* Hisob natijasi */}
                    {calc && (
                      <View style={[s.calcBox, { backgroundColor: C.primary + "08", borderColor: C.primary + "25" }]}>
                        <Text style={[s.calcTitle, { color: C.primary }]}>Hisob natijasi</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                          <CalcChip label="Material eni"  value={m(calc.materialEn)} />
                          <CalcChip label="Material bo'yi" value={m(calc.materialBoy)} />
                          <CalcChip label="1 ta"          value={m(calc.birOyna)} />
                          <CalcChip label={`${oyna.miqdor} ta jami`} value={m(calc.jami)} highlight />
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Jami */}
          {totalJami > 0 && (
            <View style={[s.totalRow, { backgroundColor: C.primary + "12", borderColor: C.primary + "30" }]}>
              <Text style={[s.totalLabel, { color: C.text }]}>Jami material:</Text>
              <Text style={[s.totalVal, { color: C.primary }]}>{m(totalJami)}</Text>
            </View>
          )}
        </View>

        {/* === NARX === */}
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
              <TouchableOpacity
                key={t.id}
                style={[s.chip, {
                  flex: 1,
                  borderColor: ornatishTuri === t.id ? "#f97316" : C.border,
                  backgroundColor: ornatishTuri === t.id ? "#fff7ed" : C.surface,
                }]}
                onPress={() => setOrnatishTuri(t.id)}
              >
                <Text style={[s.chipTxt, { color: ornatishTuri === t.id ? "#c2410c" : C.textSecondary }]}>{t.label}</Text>
                {t.narx > 0 && (
                  <Text style={{ fontSize: 9, color: ornatishTuri === t.id ? "#ea580c" : C.textSecondary }}>
                    {(t.narx / 1000).toFixed(0)}k/ta
                  </Text>
                )}
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
        </View>

        {/* === ISHCHILAR === */}
        {(tailors.length > 0 || installers.length > 0) && (
          <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Telegram ishchilar</Text>

            {tailors.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Chevar</Text>
                {tailors.map(w => (
                  <TouchableOpacity
                    key={w.id}
                    style={[s.workerRow, {
                      borderColor: selectedTailor === w.id ? C.primary : C.border,
                      backgroundColor: selectedTailor === w.id ? C.primary + "10" : C.card,
                    }]}
                    onPress={() => setSelectedTailor(selectedTailor === w.id ? null : w.id)}
                  >
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
                  <TouchableOpacity
                    key={w.id}
                    style={[s.workerRow, {
                      borderColor: selectedInstaller === w.id ? "#f97316" : C.border,
                      backgroundColor: selectedInstaller === w.id ? "#fff7ed" : C.card,
                    }]}
                    onPress={() => setSelectedInstaller(selectedInstaller === w.id ? null : w.id)}
                  >
                    <Feather name="tool" size={14} color={selectedInstaller === w.id ? "#f97316" : C.textSecondary} />
                    <Text style={[s.workerName, { color: C.text }]}>{w.fullName}</Text>
                    {selectedInstaller === w.id && <Feather name="check-circle" size={16} color="#f97316" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[s.telegramBtn, { opacity: sending ? 0.6 : 1 }]}
              onPress={sendTelegram} disabled={sending}
            >
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={15} color="#fff" />}
              <Text style={s.telegramBtnTxt}>Telegramga yuborish</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* === IZOH === */}
        <View style={[s.section, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textSecondary }]}>Izoh (ixtiyoriy)</Text>
          <TextInput
            style={[s.textarea, { borderColor: C.border, color: C.text, backgroundColor: C.card }]}
            value={izoh} onChangeText={setIzoh}
            placeholder="Qo'shimcha ma'lumotlar..."
            placeholderTextColor={C.textSecondary}
            multiline numberOfLines={3}
          />
        </View>

        {/* === ACTION BUTTONS === */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={[s.actionBtn, { flex: 1, backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}
              onPress={generatePdf} disabled={pdfLoading}
            >
              {pdfLoading
                ? <ActivityIndicator size="small" color="#3b82f6" />
                : <Feather name="file-text" size={15} color="#3b82f6" />
              }
              <Text style={[s.actionBtnTxt, { color: "#1d4ed8" }]}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, { flex: 1, backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}
              onPress={generateChevarPdf} disabled={pdfLoading}
            >
              <Feather name="scissors" size={15} color="#7c3aed" />
              <Text style={[s.actionBtnTxt, { color: "#6d28d9" }]}>Chevar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, { flex: 1, backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}
              onPress={shareText}
            >
              <Feather name="share-2" size={15} color="#16a34a" />
              <Text style={[s.actionBtnTxt, { color: "#15803d" }]}>Ulash</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, { flex: 1, backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}
              onPress={sendSms} disabled={sending}
            >
              {sending
                ? <ActivityIndicator size="small" color="#ea580c" />
                : <Feather name="message-square" size={15} color="#ea580c" />
              }
              <Text style={[s.actionBtnTxt, { color: "#c2410c" }]}>SMS</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[s.bigSaveBtn, { backgroundColor: C.primary, opacity: saving ? 0.7 : 1 }]}
            onPress={saveDeal} disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="check-circle" size={18} color="#fff" />}
            <Text style={s.bigSaveBtnTxt}>Bitishuv sifatida saqlash</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Kichik komponentlar ───────────────────────────────────────────────────
function Inp({ label, value, onChange, placeholder, keyboard }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: any;
}) {
  return (
    <View style={{ gap: 4, marginBottom: 8 }}>
      <Text style={[s.fieldLabel, { color: C.textSecondary }]}>{label}</Text>
      <TextInput
        style={[s.input, { borderColor: C.border, color: C.text, backgroundColor: C.card }]}
        value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={C.textSecondary}
        keyboardType={keyboard || "default"}
      />
    </View>
  );
}

function CalcChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[s.calcChip, highlight && { borderColor: C.primary + "50", backgroundColor: C.primary + "12" }]}>
      <Text style={[s.calcChipLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[s.calcChipVal, { color: highlight ? C.primary : C.text }]}>{value}</Text>
    </View>
  );
}

// ─── Stillar ──────────────────────────────────────────────────────────────
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

  oynaWrap:     { borderWidth: 1, borderRadius: 12, overflow: "hidden", marginTop: 8 },
  oynaHead:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  numBadge:     { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  numBadgeTxt:  { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  oynaTitle:    { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  chip:         { borderWidth: 1.5, borderRadius: 8, padding: 8, alignItems: "center", gap: 2 },
  chipTxt:      { fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  counterBtn:   { width: 38, height: 38, borderWidth: 1.5, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  counterVal:   { fontSize: 20, fontFamily: "Inter_700Bold", minWidth: 32, textAlign: "center" },

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
