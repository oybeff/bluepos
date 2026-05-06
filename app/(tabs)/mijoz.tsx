import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiReq } from "@/lib/api";
import Colors from "@/constants/colors";
import DateInput, { buildDateStr } from "@/components/DateInput";

const C = Colors.light;
const fmt = (n: number) => new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";

interface Oyna {
  id: string;
  xona: string;
  en: string;
  boy: string;
  miqdor: string;
}

const newOyna = (): Oyna => ({
  id: Date.now().toString(),
  xona: "",
  en: "200",
  boy: "270",
  miqdor: "2",
});

function parseN(v: string) { return parseFloat(v.replace(",", ".")) || 0; }

function calcOyna(o: Oyna) {
  const en = parseN(o.en) / 100;
  const boy = parseN(o.boy) / 100;
  const miqdor = parseN(o.miqdor) || 1;
  const matEn = en * 2.2;
  const matBoy = boy + 0.3;
  const jami = matEn * matBoy * miqdor;
  return { en, boy, matEn, matBoy, jami };
}

export default function MijozScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [step, setStep] = useState<"info" | "oynas" | "xizmat" | "xodim" | "yakun">("info");
  const [saving, setSaving] = useState(false);

  // Client search
  const [clientSearch, setClientSearch] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Info
  const [ism, setIsm] = useState("");
  const [tel, setTel] = useState("");
  const [manzil, setManzil] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [tayyorDay, setTayyorDay] = useState("");
  const [tayyorMonth, setTayyorMonth] = useState("");
  const [tayyorYear, setTayyorYear] = useState("");

  // Oynas
  const [oynaList, setOynaList] = useState<Oyna[]>([newOyna()]);
  const [narx, setNarx] = useState("80000");

  // Xizmat
  const [ornatish, setOrnatish] = useState<"devor" | "beton" | "">("");
  const [chevar, setChevar] = useState("5000");

  // Xodim
  const [tailorId, setTailorId] = useState<number | null>(null);
  const [installerId, setInstallerId] = useState<number | null>(null);
  const [zaklat, setZaklat] = useState("");

  // Workers picker
  const [pickerTarget, setPickerTarget] = useState<"tailor" | "installer" | null>(null);

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: () => apiReq<any[]>("/workers"),
  });
  const tailors = workers.filter((w: any) => w.role === "chevar");
  const installers = workers.filter((w: any) => w.role === "montaj");

  // Calculations
  const calcResults = oynaList.map(o => ({ o, c: calcOyna(o) }));
  const totalMat = calcResults.reduce((s, { c }) => s + c.jami, 0);
  const narxPerMetr = parseN(narx);
  const totalNarx = totalMat * narxPerMetr;
  const ornatishNarx = ornatish === "devor" ? 20000 : ornatish === "beton" ? 30000 : 0;
  const oynaCount = oynaList.reduce((s, o) => s + (parseN(o.miqdor) || 1), 0);
  const ornatishJami = ornatishNarx * oynaCount;
  const chevarJami = totalMat * parseN(chevar);
  const grandTotal = totalNarx + ornatishJami + chevarJami;
  const zaklatSumma = parseN(zaklat);
  const qarzSumma = Math.max(0, grandTotal - zaklatSumma);

  async function getGps() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Ruxsat berilmadi", "Joylashuv uchun ruxsat kerak");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setGpsCoords({ lat: latitude, lng: longitude });
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          { headers: { "Accept-Language": "uz,ru" } }
        );
        const data = await res.json() as any;
        const addr = data.address || {};
        const parts = [addr.road || addr.pedestrian, addr.house_number, addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.village].filter(Boolean);
        setManzil(parts.length > 0 ? parts.join(", ") : data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      } catch {
        setManzil(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
      Alert.alert("✅ Joylashuv aniqlandi!");
    } catch (e: any) {
      Alert.alert("Xato", "Joylashuv aniqlanmadi");
    } finally {
      setGpsLoading(false);
    }
  }

  async function saveDeal() {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const mapsLink = gpsCoords
        ? `https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}`
        : null;

      const payload = {
        mijozIsm: ism || null,
        mijozPhone: tel || null,
        manzil: manzil || null,
        mapsLink,
        measurements: calcResults.map(({ o, c }) => ({
          xona: o.xona || "Xona",
          en: c.en, boy: c.boy,
          materialEn: c.matEn, materialBoy: c.matBoy,
          miqdor: parseN(o.miqdor) || 1,
          pardaTuri: "oddiy",
          jami: c.jami,
        })),
        totalMaterial: totalMat,
        narxPerMetr: narxPerMetr,
        totalNarx,
        ornatishTuri: ornatish || null,
        ornatishNarx: ornatishJami,
        chevarHaqiPerMetr: parseN(chevar),
        chevarJami,
        zaklatSumma: zaklatSumma,
        qarzSumma,
        tayyorBolishKuni: buildDateStr(tayyorDay, tayyorMonth, tayyorYear) || null,
        tailorWorkerId: tailorId,
        installerWorkerId: installerId,
        totalNarxFull: grandTotal,
      };

      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain?.startsWith("http") ? domain : `https://${domain}`;
      const res = await fetch(`${base}/api/client-deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payload, totalNarx: grandTotal }),
      });

      if (!res.ok) throw new Error("Saqlashda xato");
      const deal = await res.json() as any;

      // Send Telegram
      if (tailorId || installerId) {
        await fetch(`${base}/api/telegram/send-deal`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }

      qc.invalidateQueries({ queryKey: ["client-deals"] });
      Alert.alert("✅ Saqlandi!", `Bitim #${deal.id} muvaffaqiyatli saqlandi`, [
        { text: "Yangi bitim", onPress: resetForm },
      ]);
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Saqlashda muammo yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setStep("info");
    setIsm(""); setTel(""); setManzil(""); setGpsCoords(null); setTayyorDay(""); setTayyorMonth(""); setTayyorYear("");
    setOynaList([newOyna()]); setNarx("80000");
    setOrnatish(""); setChevar("5000");
    setTailorId(null); setInstallerId(null); setZaklat("");
    setClientSearch(""); setClientSearchResults([]);
  }

  async function searchClients(query: string) {
    setClientSearch(query);
    if (query.length < 2) { setClientSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain?.startsWith("http") ? domain : `https://${domain}`;
      const r = await fetch(`${base}/api/customers?search=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json() as { clients?: any[] } | any[];
      setClientSearchResults(Array.isArray(data) ? data : (data.clients ?? []));
    } catch { setClientSearchResults([]); }
    finally { setSearchLoading(false); }
  }

  function fillFromClient(c: any) {
    setIsm(c.fullName || "");
    setTel(c.phone || "");
    setManzil(c.address || "");
    setShowClientPicker(false);
    setClientSearch("");
    setClientSearchResults([]);
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  const STEPS = [
    { key: "info", label: "Mijoz" },
    { key: "oynas", label: "O'lcham" },
    { key: "xizmat", label: "Xizmat" },
    { key: "xodim", label: "Xodim" },
    { key: "yakun", label: "Yakun" },
  ];
  const stepIdx = STEPS.findIndex(s => s.key === step);

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={[styles.title, { color: C.text }]}>Mijoz oldiga</Text>
        <Text style={[styles.subtitle, { color: C.textSecondary }]}>GPS · Hisob · Telegram</Text>
      </View>

      {/* Step indicator */}
      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <TouchableOpacity key={s.key} onPress={() => setStep(s.key as any)} style={styles.stepItem}>
            <View style={[
              styles.stepDot,
              i < stepIdx && { backgroundColor: C.success },
              i === stepIdx && { backgroundColor: C.primary },
              i > stepIdx && { backgroundColor: C.border },
            ]}>
              {i < stepIdx
                ? <Feather name="check" size={10} color="#fff" />
                : <Text style={styles.stepNum}>{i + 1}</Text>
              }
            </View>
            <Text style={[styles.stepLabel, { color: i === stepIdx ? C.primary : C.textSecondary }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* STEP 1: Mijoz ma'lumotlari */}
        {step === "info" && (
          <View>
            {/* Mavjud mijoz qidirish */}
            <View style={[styles.card, { marginBottom: 12 }]}>
              <SLabel>Mavjud mijozdan tanlash</SLabel>
              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.input, { flex: 1, color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
                  value={clientSearch}
                  onChangeText={searchClients}
                  onFocus={() => setShowClientPicker(true)}
                  placeholder="Ism yoki telefon bilan qidiring..."
                  placeholderTextColor={C.textSecondary}
                />
                {searchLoading && <ActivityIndicator size="small" color={C.primary} style={{ marginLeft: 8 }} />}
                {clientSearch.length > 0 && !searchLoading && (
                  <TouchableOpacity onPress={() => { setClientSearch(""); setClientSearchResults([]); setShowClientPicker(false); }} style={{ marginLeft: 8 }}>
                    <Feather name="x" size={18} color={C.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {clientSearchResults.length > 0 && (
                <View style={[styles.searchDropdown, { backgroundColor: C.card, borderColor: C.border }]}>
                  {clientSearchResults.map((c: any) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.searchItem, { borderBottomColor: C.border }]}
                      onPress={() => fillFromClient(c)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.searchAvatar, { backgroundColor: C.primary + "20" }]}>
                        <Text style={[styles.searchAvatarText, { color: C.primary }]}>{(c.fullName || "?").charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.searchName, { color: C.text }]}>{c.fullName}</Text>
                        <Text style={[styles.searchPhone, { color: C.textSecondary }]}>{c.phone || "Telefon yo'q"}</Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={C.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {clientSearch.length >= 2 && clientSearchResults.length === 0 && !searchLoading && (
                <Text style={[styles.noResult, { color: C.textSecondary }]}>Mijoz topilmadi — yangi sifatida davom eting</Text>
              )}
            </View>

          <View style={styles.card}>
            <SLabel>Mijoz ismi</SLabel>
            <SInput value={ism} onChange={setIsm} placeholder="To'liq ism" />
            <SLabel>Telefon raqam</SLabel>
            <SInput value={tel} onChange={setTel} placeholder="+998 90 123 45 67" keyboardType="phone-pad" />
            <SLabel>Manzil</SLabel>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
                value={manzil}
                onChangeText={v => { setManzil(v); setGpsCoords(null); }}
                placeholder="Ko'cha, uy raqami"
                placeholderTextColor={C.textSecondary}
              />
              <TouchableOpacity
                style={[styles.iconBtn, { borderColor: C.border, backgroundColor: gpsCoords ? C.primary + "20" : C.surface }]}
                onPress={getGps}
                disabled={gpsLoading}
              >
                {gpsLoading
                  ? <ActivityIndicator size="small" color={C.primary} />
                  : <Feather name="navigation" size={18} color={gpsCoords ? C.primary : C.textSecondary} />
                }
              </TouchableOpacity>
            </View>
            {gpsCoords && (
              <Text style={[styles.gpsTag, { color: C.success }]}>
                📍 {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
              </Text>
            )}
            <DateInput
              label="Tayyor bo'lish kuni"
              day={tayyorDay} month={tayyorMonth} year={tayyorYear}
              onChangeDay={setTayyorDay} onChangeMonth={setTayyorMonth} onChangeYear={setTayyorYear}
            />
          </View>
          </View>
        )}

        {/* STEP 2: O'lchamlar */}
        {step === "oynas" && (
          <View>
            <View style={styles.card}>
              <SLabel>Parda narxi (1 metr uchun)</SLabel>
              <SInput value={narx} onChange={setNarx} keyboardType="numeric" suffix="so'm" />
            </View>

            {oynaList.map((o, idx) => (
              <View key={o.id} style={[styles.card, { marginTop: 12 }]}>
                <View style={[styles.row, { marginBottom: 10 }]}>
                  <Text style={[styles.cardTitle, { color: C.text }]}>🪟 {idx + 1}-oyna</Text>
                  {oynaList.length > 1 && (
                    <TouchableOpacity onPress={() => setOynaList(l => l.filter(x => x.id !== o.id))}>
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <SLabel>Xona nomi</SLabel>
                <SInput value={o.xona} onChange={v => setOynaList(l => l.map(x => x.id === o.id ? { ...x, xona: v } : x))} placeholder="Mehmonxona" />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <SLabel>Eni (cm)</SLabel>
                    <SInput value={o.en} onChange={v => setOynaList(l => l.map(x => x.id === o.id ? { ...x, en: v } : x))} keyboardType="numeric" />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <SLabel>Bo'yi (cm)</SLabel>
                    <SInput value={o.boy} onChange={v => setOynaList(l => l.map(x => x.id === o.id ? { ...x, boy: v } : x))} keyboardType="numeric" />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <SLabel>Dona</SLabel>
                    <SInput value={o.miqdor} onChange={v => setOynaList(l => l.map(x => x.id === o.id ? { ...x, miqdor: v } : x))} keyboardType="numeric" />
                  </View>
                </View>
                {(() => {
                  const c = calcOyna(o);
                  return (
                    <View style={[styles.calcResult, { backgroundColor: C.primary + "12" }]}>
                      <Text style={[styles.calcText, { color: C.textSecondary }]}>Material: <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold" }}>{c.jami.toFixed(2)} m²</Text></Text>
                      <Text style={[styles.calcText, { color: C.textSecondary }]}>Narx: <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold" }}>{fmt(c.jami * narxPerMetr)}</Text></Text>
                    </View>
                  );
                })()}
              </View>
            ))}

            <TouchableOpacity
              style={[styles.addBtn, { borderColor: C.primary }]}
              onPress={() => setOynaList(l => [...l, newOyna()])}
            >
              <Feather name="plus" size={18} color={C.primary} />
              <Text style={[styles.addBtnText, { color: C.primary }]}>Oyna qo'shish</Text>
            </TouchableOpacity>

            <View style={[styles.totalCard, { backgroundColor: C.primary }]}>
              <Text style={styles.totalLabel}>Jami material</Text>
              <Text style={styles.totalVal}>{totalMat.toFixed(2)} m²</Text>
              <Text style={styles.totalLabel}>Parda narxi</Text>
              <Text style={styles.totalVal}>{fmt(totalNarx)}</Text>
            </View>
          </View>
        )}

        {/* STEP 3: Xizmatlar */}
        {step === "xizmat" && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { color: C.text, marginBottom: 14 }]}>O'rnatish turi</Text>
            {[
              { key: "devor", label: "🧱 Devor", narx: "20,000 so'm/oyna" },
              { key: "beton", label: "🏗️ Beton", narx: "30,000 so'm/oyna" },
              { key: "", label: "❌ O'rnatish yo'q", narx: "" },
            ].map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.optBtn,
                  { borderColor: ornatish === opt.key ? C.primary : C.border, backgroundColor: ornatish === opt.key ? C.primary + "12" : C.surface },
                ]}
                onPress={() => setOrnatish(opt.key as any)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optLabel, { color: C.text }]}>{opt.label}</Text>
                  {opt.narx ? <Text style={[styles.optSub, { color: C.textSecondary }]}>{opt.narx}</Text> : null}
                </View>
                {ornatish === opt.key && <Feather name="check-circle" size={20} color={C.primary} />}
              </TouchableOpacity>
            ))}

            {ornatish && (
              <View style={[styles.calcResult, { backgroundColor: C.primary + "12", marginTop: 8 }]}>
                <Text style={[styles.calcText, { color: C.textSecondary }]}>
                  {oynaCount} oyna × {fmt(ornatishNarx)} = <Text style={{ color: C.primary, fontFamily: "Inter_700Bold" }}>{fmt(ornatishJami)}</Text>
                </Text>
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: C.border }]} />

            <Text style={[styles.cardTitle, { color: C.text, marginBottom: 10 }]}>Chevar haqi</Text>
            <SLabel>1 metr uchun narx</SLabel>
            <SInput value={chevar} onChange={setChevar} keyboardType="numeric" suffix="so'm/m" />
            {parseN(chevar) > 0 && (
              <View style={[styles.calcResult, { backgroundColor: "#F0FDF4" }]}>
                <Text style={[styles.calcText, { color: C.textSecondary }]}>
                  {totalMat.toFixed(2)} m × {fmt(parseN(chevar))} = <Text style={{ color: "#22C55E", fontFamily: "Inter_700Bold" }}>{fmt(chevarJami)}</Text>
                </Text>
              </View>
            )}
          </View>
        )}

        {/* STEP 4: Xodimlar */}
        {step === "xodim" && (
          <View>
            <View style={styles.card}>
              <WorkerPicker
                label="👗 Chevar (tikuvchi)"
                workers={tailors}
                selectedId={tailorId}
                onSelect={setTailorId}
              />
            </View>
            <View style={[styles.card, { marginTop: 12 }]}>
              <WorkerPicker
                label="🔧 O'rnatuvchi usta"
                workers={installers}
                selectedId={installerId}
                onSelect={setInstallerId}
              />
            </View>
            <View style={[styles.card, { marginTop: 12 }]}>
              <SLabel>Boshlang'ich to'lov (zaklat)</SLabel>
              <SInput value={zaklat} onChange={setZaklat} keyboardType="numeric" suffix="so'm" />
              {zaklatSumma > 0 && (
                <View style={[styles.calcResult, { backgroundColor: "#FFF7ED" }]}>
                  <Text style={[styles.calcText, { color: C.textSecondary }]}>
                    Qarz: <Text style={{ color: "#EF4444", fontFamily: "Inter_700Bold" }}>{fmt(qarzSumma)}</Text>
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* STEP 5: Yakun */}
        {step === "yakun" && (
          <View>
            <View style={[styles.summaryCard, { backgroundColor: C.primary }]}>
              <Text style={styles.summaryTitle}>📊 Jami hisob</Text>
              <SumRow label="Parda narxi" value={fmt(totalNarx)} />
              {ornatishJami > 0 && <SumRow label={`O'rnatish (${ornatish === "devor" ? "Devor" : "Beton"})`} value={fmt(ornatishJami)} />}
              {chevarJami > 0 && <SumRow label="Chevar haqi" value={fmt(chevarJami)} />}
              <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.3)", marginVertical: 10 }]} />
              <SumRow label="GRAND TOTAL" value={fmt(grandTotal)} big />
              {zaklatSumma > 0 && <>
                <SumRow label="Zaklat" value={fmt(zaklatSumma)} />
                <SumRow label="Qarz qoldi" value={fmt(qarzSumma)} red />
              </>}
            </View>

            <View style={[styles.card, { marginTop: 12 }]}>
              {ism ? <InfoRow icon="user" label={ism} /> : null}
              {tel ? <InfoRow icon="phone" label={tel} /> : null}
              {manzil ? <InfoRow icon="map-pin" label={manzil} /> : null}
              {buildDateStr(tayyorDay, tayyorMonth, tayyorYear) ? <InfoRow icon="calendar" label={`Tayyor: ${buildDateStr(tayyorDay, tayyorMonth, tayyorYear)}`} /> : null}
              <InfoRow icon="layers" label={`${oynaList.length} oyna, jami ${totalMat.toFixed(2)} m²`} />
              {tailorId && <InfoRow icon="scissors" label={`Chevar: ${workers.find((w: any) => w.id === tailorId)?.fullName || "?"}`} />}
              {installerId && <InfoRow icon="tool" label={`Ustа: ${workers.find((w: any) => w.id === installerId)?.fullName || "?"}`} />}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: saving ? C.textSecondary : "#22C55E" }]}
              onPress={saveDeal}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="send" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>SAQLASH · Telegram yuborish</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom nav */}
      <View style={[styles.navBar, { paddingBottom: insets.bottom + 8, backgroundColor: C.card, borderTopColor: C.border }]}>
        <TouchableOpacity
          style={[styles.navBtn, { borderColor: C.border }]}
          onPress={() => { const i = stepIdx; if (i > 0) setStep(STEPS[i - 1].key as any); }}
          disabled={stepIdx === 0}
        >
          <Feather name="chevron-left" size={20} color={stepIdx === 0 ? C.textSecondary : C.text} />
          <Text style={[styles.navBtnText, { color: stepIdx === 0 ? C.textSecondary : C.text }]}>Orqaga</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.stepCounter, { color: C.textSecondary }]}>{stepIdx + 1} / {STEPS.length}</Text>
        </View>

        {step !== "yakun" ? (
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnPrimary, { backgroundColor: C.primary }]}
            onPress={() => setStep(STEPS[stepIdx + 1].key as any)}
          >
            <Text style={styles.navBtnPrimaryText}>Keyingisi</Text>
            <Feather name="chevron-right" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.navBtn, { borderColor: "transparent" }]} />
        )}
      </View>

      {/* Worker picker modal */}
      <Modal visible={!!pickerTarget} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: C.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: C.text }]}>Xodim tanlash</Text>
            <TouchableOpacity onPress={() => setPickerTarget(null)}>
              <Feather name="x" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={pickerTarget === "tailor" ? tailors : installers}
            keyExtractor={(item: any) => String(item.id)}
            renderItem={({ item }: any) => (
              <TouchableOpacity
                style={[styles.workerItem, { borderBottomColor: C.border }]}
                onPress={() => {
                  if (pickerTarget === "tailor") setTailorId(item.id);
                  else setInstallerId(item.id);
                  setPickerTarget(null);
                }}
              >
                <View style={[styles.workerAvatar, { backgroundColor: C.primary }]}>
                  <Text style={styles.workerAvatarText}>{(item.fullName || "?")[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.workerName, { color: C.text }]}>{item.fullName}</Text>
                  <Text style={[styles.workerRole, { color: C.textSecondary }]}>{item.telegramChatId ? "✅ Telegram" : "📵 Telegram yo'q"}</Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>Xodimlar topilmadi</Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

function WorkerPicker({ label, workers, selectedId, onSelect }: {
  label: string;
  workers: any[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const C = Colors.light;
  const selected = workers.find((w: any) => w.id === selectedId);
  return (
    <View>
      <Text style={[styles.cardTitle, { color: C.text, marginBottom: 10 }]}>{label}</Text>
      {workers.map((w: any) => (
        <TouchableOpacity
          key={w.id}
          style={[
            styles.optBtn,
            { borderColor: selectedId === w.id ? C.primary : C.border, backgroundColor: selectedId === w.id ? C.primary + "12" : C.surface },
          ]}
          onPress={() => onSelect(selectedId === w.id ? null : w.id)}
        >
          <View style={[styles.workerAvatar, { backgroundColor: C.primary, marginRight: 10 }]}>
            <Text style={styles.workerAvatarText}>{(w.fullName || "?")[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.optLabel, { color: C.text }]}>{w.fullName}</Text>
            <Text style={[styles.optSub, { color: w.telegramChatId ? C.success : C.textSecondary }]}>
              {w.telegramChatId ? "✅ Telegram bog'langan" : "📵 Telegram yo'q"}
            </Text>
          </View>
          {selectedId === w.id && <Feather name="check-circle" size={20} color={C.primary} />}
        </TouchableOpacity>
      ))}
      {workers.length === 0 && (
        <Text style={[styles.emptyText, { color: C.textSecondary }]}>Hali xodim yo'q</Text>
      )}
    </View>
  );
}

function SLabel({ children }: { children: string }) {
  return <Text style={[styles.label, { color: Colors.light.textSecondary }]}>{children}</Text>;
}

function SInput({ value, onChange, placeholder, keyboardType, suffix }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: "default" | "numeric" | "phone-pad";
  suffix?: string;
}) {
  const C = Colors.light;
  return (
    <View style={[styles.inputWrapper, { borderColor: C.border, backgroundColor: C.surface }]}>
      <TextInput
        style={[styles.input, { flex: 1, color: C.text }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || ""}
        placeholderTextColor={C.textSecondary}
        keyboardType={keyboardType || "default"}
      />
      {suffix && <Text style={[styles.suffix, { color: C.textSecondary }]}>{suffix}</Text>}
    </View>
  );
}

function SumRow({ label, value, big, red }: { label: string; value: string; big?: boolean; red?: boolean }) {
  return (
    <View style={styles.sumRow}>
      <Text style={[styles.sumLabel, big && styles.sumLabelBig]}>{label}</Text>
      <Text style={[styles.sumVal, big && styles.sumValBig, red && { color: "#FCA5A5" }]}>{value}</Text>
    </View>
  );
}

function InfoRow({ icon, label }: { icon: any; label: string }) {
  const C = Colors.light;
  return (
    <View style={[styles.infoRow, { borderBottomColor: C.border }]}>
      <Feather name={icon} size={14} color={C.primary} />
      <Text style={[styles.infoText, { color: C.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  steps: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  stepItem: { alignItems: "center", flex: 1 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepNum: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  stepLabel: { fontSize: 9, fontFamily: "Inter_500Medium" },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 18,
    gap: 10,
    marginTop: 4,
  },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
  },
  input: { fontSize: 15, fontFamily: "Inter_400Regular", height: 48 },
  suffix: { fontSize: 13, fontFamily: "Inter_400Regular" },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  gpsTag: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: -4 },
  calcResult: {
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  calcText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  addBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  addBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  totalCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    gap: 4,
  },
  totalLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular" },
  totalVal: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  divider: { height: 1, marginVertical: 6 },
  optBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  optLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  optSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  summaryCard: {
    borderRadius: 24,
    padding: 20,
    gap: 6,
  },
  summaryTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 8 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sumLabel: { color: "rgba(255,255,255,0.75)", fontSize: 14, fontFamily: "Inter_400Regular" },
  sumLabelBig: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  sumVal: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sumValBig: { fontSize: 20, fontFamily: "Inter_700Bold" },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  infoText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  saveBtn: {
    marginTop: 16,
    height: 58,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  navBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  navBtnPrimary: { borderWidth: 0 },
  navBtnPrimaryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  stepCounter: { fontSize: 12, fontFamily: "Inter_400Regular" },
  searchRow: { flexDirection: "row", alignItems: "center" },
  searchDropdown: {
    marginTop: 6, borderRadius: 14, borderWidth: 1, overflow: "hidden",
  },
  searchItem: {
    flexDirection: "row", alignItems: "center", padding: 12, gap: 12,
    borderBottomWidth: 1,
  },
  searchAvatar: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
  },
  searchAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  searchName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  searchPhone: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  noResult: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 8, textAlign: "center" },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 24,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  workerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  workerAvatarText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  workerName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  workerRole: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  emptyText: { textAlign: "center", padding: 24, fontSize: 14, fontFamily: "Inter_400Regular" },
});
