import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import DateInput, { buildDateStr } from "@/components/DateInput";

const C = Colors.light;

const STEPS = [
  { id: 1, label: "Mijoz", icon: "user" as const },
  { id: 2, label: "O'lcham", icon: "maximize" as const },
  { id: 3, label: "Narx", icon: "tag" as const },
  { id: 4, label: "To'lov", icon: "credit-card" as const },
  { id: 5, label: "Ishchi", icon: "users" as const },
];

const ORNATISH_TURLARI = [
  { key: "devor", label: "Devor", desc: "20 000 so'm", price: 20000 },
  { key: "beton", label: "Beton", desc: "30 000 so'm", price: 30000 },
  { key: "yo'q", label: "Yo'q", desc: "Bepul", price: 0 },
];

interface Worker { id: number; fullName: string; role: string; }
interface Measurement { key: string; value: string; }

function fmt(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0)) + " so'm";
}

function LabeledInput({ label, value, onChange, placeholder, keyboardType, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean;
}) {
  return (
    <View style={li.wrap}>
      <Text style={[li.label, { color: C.textSecondary }]}>{label}</Text>
      <TextInput
        style={[li.input, { color: C.text, borderColor: C.border, backgroundColor: C.card },
          multiline && { height: 80, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || label + "..."}
        placeholderTextColor={C.textSecondary}
        keyboardType={keyboardType || "default"}
        multiline={multiline}
      />
    </View>
  );
}

const li = StyleSheet.create({
  wrap: { gap: 5 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginLeft: 2 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
});

export default function NewDealScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Mijoz
  const [mijozIsm, setMijozIsm] = useState("");
  const [mijozPhone, setMijozPhone] = useState("");
  const [manzil, setManzil] = useState("");

  // Step 2 — O'lchamlar
  const [measurements, setMeasurements] = useState<Measurement[]>([
    { key: "Eni", value: "" },
    { key: "Balandligi", value: "" },
  ]);

  // Step 3 — Narx
  const [totalMaterial, setTotalMaterial] = useState("");
  const [narxPerMetr, setNarxPerMetr] = useState("");
  const [ornatishTuri, setOrnatishTuri] = useState("yo'q");
  const [chevarHaqiPerMetr, setChevarHaqiPerMetr] = useState("");

  // Step 4 — To'lov
  const [zaklatSumma, setZaklatSumma] = useState("");
  const [tayyorDay, setTayyorDay] = useState("");
  const [tayyorMonth, setTayyorMonth] = useState("");
  const [tayyorYear, setTayyorYear] = useState("");
  const [qarzDay, setQarzDay] = useState("");
  const [qarzMonth, setQarzMonth] = useState("");
  const [qarzYear, setQarzYear] = useState("");
  const [izoh, setIzoh] = useState("");

  // Step 5 — Ishchilar
  const [tailorId, setTailorId] = useState<number | null>(null);
  const [installerId, setInstallerId] = useState<number | null>(null);

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["workers"],
    queryFn: () => apiReq("/workers"),
  });

  const tailors = workers.filter(w => w.role === "tailor" || w.role === "seller" || w.role === "measurer");
  const installers = workers.filter(w => w.role === "installer");
  const allForTailor = workers;

  // Calculations
  const mat = parseFloat(totalMaterial) || 0;
  const npm = parseFloat(narxPerMetr) || 0;
  const chv = parseFloat(chevarHaqiPerMetr) || 0;
  const totalNarx = mat * npm;
  const chevarJami = mat * chv;
  const ornatishObj = ORNATISH_TURLARI.find(o => o.key === ornatishTuri)!;
  const ornatishNarx = ornatishObj?.price || 0;
  const grandTotal = totalNarx + ornatishNarx + chevarJami;
  const zaklat = parseFloat(zaklatSumma) || 0;
  const qarz = Math.max(0, grandTotal - zaklat);

  function addMeasurement() {
    setMeasurements(prev => [...prev, { key: "", value: "" }]);
  }
  function removeMeasurement(idx: number) {
    setMeasurements(prev => prev.filter((_, i) => i !== idx));
  }
  function updateMeasurement(idx: number, field: "key" | "value", val: string) {
    setMeasurements(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  }

  function validateStep(): string | null {
    if (step === 1) {
      if (!mijozIsm.trim() && !mijozPhone.trim()) return "Ism yoki telefon kiriting";
    }
    if (step === 3) {
      if (!totalMaterial || parseFloat(totalMaterial) <= 0) return "Umumiy material kiriting";
      if (!narxPerMetr || parseFloat(narxPerMetr) <= 0) return "Narx kiriting";
    }
    return null;
  }

  function goNext() {
    const err = validateStep();
    if (err) { Alert.alert("Xato", err); return; }
    if (step < 5) setStep(s => s + 1);
  }

  async function handleSave() {
    const err = validateStep();
    if (err) { Alert.alert("Xato", err); return; }

    setSaving(true);
    try {
      const measurementsObj: Record<string, string> = {};
      measurements.filter(m => m.key && m.value).forEach(m => {
        measurementsObj[m.key] = m.value;
      });

      const body = {
        mijozIsm: mijozIsm.trim() || null,
        mijozPhone: mijozPhone.trim() || null,
        manzil: manzil.trim() || null,
        measurements: Object.keys(measurementsObj).length ? measurementsObj : null,
        totalMaterial: mat,
        narxPerMetr: npm,
        totalNarx,
        ornatishTuri: ornatishTuri === "yo'q" ? null : ornatishTuri,
        ornatishNarx,
        chevarHaqiPerMetr: chv,
        chevarJami,
        zaklatSumma: zaklat,
        qarzSumma: qarz,
        tayyorBolishKuni: buildDateStr(tayyorDay, tayyorMonth, tayyorYear) || null,
        qarzKaytarishKuni: buildDateStr(qarzDay, qarzMonth, qarzYear) || null,
        izoh: izoh.trim() || null,
        tailorWorkerId: tailorId,
        installerWorkerId: installerId,
      };

      const created = await apiReq("/client-deals", {
        method: "POST",
        body: JSON.stringify(body),
      }) as any;

      // Agar qarz bo'lsa — qarz daftariga avtomatik qo'shish
      if (qarz > 0) {
        try {
          await apiReq("/qarz-daftar", {
            method: "POST",
            body: JSON.stringify({
              ism: mijozIsm || mijozPhone || "Noma'lum",
              telefon: mijozPhone || null,
              tur: "olindi",
              narsa: `Buyurtma #${created.deal?.id ?? created.id} — parda`,
              summa: qarz,
              qaytarishSana: buildDateStr(qarzDay, qarzMonth, qarzYear) || null,
              izoh: manzil ? `Manzil: ${manzil}` : null,
            }),
          });
        } catch { /* qarz-daftar xatosi buyurtmani to'xtatmasin */ }
      }

      await qc.invalidateQueries({ queryKey: ["client-deals"] });
      await qc.invalidateQueries({ queryKey: ["deals-recent"] });
      await qc.invalidateQueries({ queryKey: ["qarz-daftar"] });

      Alert.alert(
        "✅ Buyurtma yaratildi",
        `${mijozIsm || mijozPhone || "Yangi"} mijoz uchun buyurtma muvaffaqiyatli saqlandi`,
        [
          { text: "Ko'rish", onPress: () => router.replace(`/deal/${created.deal?.id ?? created.id}` as any) },
          { text: "Bosh sahifa", onPress: () => router.replace("/(tabs)") },
        ]
      );
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Buyurtma saqlanmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: C.card }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: C.text }]}>Yangi buyurtma</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>Qadam {step} / {STEPS.length}</Text>
        </View>
      </View>

      {/* Step indicators */}
      <View style={s.steps}>
        {STEPS.map(st => (
          <TouchableOpacity key={st.id} style={s.stepItem} onPress={() => st.id < step && setStep(st.id)}>
            <View style={[s.stepDot, {
              backgroundColor: step === st.id ? C.primary : step > st.id ? "#10B981" : C.border,
            }]}>
              {step > st.id
                ? <Feather name="check" size={12} color="#fff" />
                : <Feather name={st.icon} size={12} color={step === st.id ? "#fff" : C.textSecondary} />
              }
            </View>
            <Text style={[s.stepLbl, { color: step === st.id ? C.primary : step > st.id ? "#10B981" : C.textSecondary }]}>
              {st.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 120 }}
      >

        {/* ── STEP 1: Mijoz ── */}
        {step === 1 && (
          <View style={{ gap: 14 }}>
            <SectionHeader icon="user" title="Mijoz ma'lumotlari" />
            <LabeledInput label="Mijoz ismi" value={mijozIsm} onChange={setMijozIsm} placeholder="To'liq ism..." />
            <LabeledInput label="Telefon raqami" value={mijozPhone} onChange={setMijozPhone} placeholder="+998 90 123 45 67" keyboardType="phone-pad" />
            <LabeledInput label="Manzil" value={manzil} onChange={setManzil} placeholder="Ko'cha, uy raqami..." multiline />
          </View>
        )}

        {/* ── STEP 2: O'lchamlar ── */}
        {step === 2 && (
          <View style={{ gap: 14 }}>
            <SectionHeader icon="maximize" title="O'lchamlar" />
            {measurements.map((m, idx) => (
              <View key={idx} style={[s.measureRow, { borderColor: C.border }]}>
                <TextInput
                  style={[s.measureKey, { color: C.text, borderColor: C.border }]}
                  value={m.key}
                  onChangeText={v => updateMeasurement(idx, "key", v)}
                  placeholder="Nom (Eni)"
                  placeholderTextColor={C.textSecondary}
                />
                <TextInput
                  style={[s.measureVal, { color: C.text, borderColor: C.border }]}
                  value={m.value}
                  onChangeText={v => updateMeasurement(idx, "value", v)}
                  placeholder="Qiymat"
                  placeholderTextColor={C.textSecondary}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[s.measureDel, { backgroundColor: "#FEF2F2" }]}
                  onPress={() => removeMeasurement(idx)}
                  disabled={measurements.length === 1}
                >
                  <Feather name="minus" size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={[s.addBtn, { borderColor: C.primary }]} onPress={addMeasurement}>
              <Feather name="plus" size={16} color={C.primary} />
              <Text style={[s.addBtnTxt, { color: C.primary }]}>O'lcham qo'shish</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 3: Narx ── */}
        {step === 3 && (
          <View style={{ gap: 14 }}>
            <SectionHeader icon="tag" title="Material va narxlar" />
            <LabeledInput label="Umumiy material (metr)" value={totalMaterial} onChange={setTotalMaterial} keyboardType="decimal-pad" placeholder="0.00" />
            <LabeledInput label="Narx (1 metr)" value={narxPerMetr} onChange={setNarxPerMetr} keyboardType="decimal-pad" placeholder="0" />
            <LabeledInput label="Tikuvchi haqi (1 metrga)" value={chevarHaqiPerMetr} onChange={setChevarHaqiPerMetr} keyboardType="decimal-pad" placeholder="0" />

            <View style={li.wrap}>
              <Text style={[li.label, { color: C.textSecondary }]}>O'rnatish turi</Text>
              <View style={s.ornatishRow}>
                {ORNATISH_TURLARI.map(ot => (
                  <TouchableOpacity
                    key={ot.key}
                    style={[s.ornatishBtn, {
                      borderColor: ornatishTuri === ot.key ? C.primary : C.border,
                      backgroundColor: ornatishTuri === ot.key ? C.surface : C.card,
                    }]}
                    onPress={() => setOrnatishTuri(ot.key)}
                  >
                    <Text style={[s.ornatishLbl, { color: ornatishTuri === ot.key ? C.primary : C.text }]}>{ot.label}</Text>
                    <Text style={[s.ornatishDesc, { color: C.textSecondary }]}>{ot.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Hisob */}
            {mat > 0 && npm > 0 && (
              <View style={[s.calcCard, { backgroundColor: C.primary }]}>
                <Text style={s.calcTitle}>Hisob</Text>
                <View style={s.calcRow}>
                  <Text style={s.calcLbl}>Material:</Text>
                  <Text style={s.calcVal}>{fmt(totalNarx)}</Text>
                </View>
                {chevarJami > 0 && (
                  <View style={s.calcRow}>
                    <Text style={s.calcLbl}>Tikuvchi haqi:</Text>
                    <Text style={s.calcVal}>{fmt(chevarJami)}</Text>
                  </View>
                )}
                {ornatishNarx > 0 && (
                  <View style={s.calcRow}>
                    <Text style={s.calcLbl}>O'rnatish:</Text>
                    <Text style={s.calcVal}>{fmt(ornatishNarx)}</Text>
                  </View>
                )}
                <View style={[s.calcRow, s.calcTotal]}>
                  <Text style={s.calcTotalLbl}>Jami:</Text>
                  <Text style={s.calcTotalVal}>{fmt(grandTotal)}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── STEP 4: To'lov ── */}
        {step === 4 && (
          <View style={{ gap: 14 }}>
            <SectionHeader icon="credit-card" title="To'lov va sanalar" />

            {grandTotal > 0 && (
              <View style={[s.payInfo, { backgroundColor: C.surface, borderColor: C.border }]}>
                <View style={s.payInfoRow}>
                  <Text style={[s.payInfoLbl, { color: C.textSecondary }]}>Umumiy summa</Text>
                  <Text style={[s.payInfoVal, { color: C.text }]}>{fmt(grandTotal)}</Text>
                </View>
                <View style={s.payInfoRow}>
                  <Text style={[s.payInfoLbl, { color: C.textSecondary }]}>Zaklat</Text>
                  <Text style={[s.payInfoVal, { color: "#059669" }]}>{fmt(zaklat)}</Text>
                </View>
                <View style={[s.payInfoRow, { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, marginTop: 4 }]}>
                  <Text style={[s.payInfoLbl, { color: C.textSecondary }]}>Qolgan qarz</Text>
                  <Text style={[s.payInfoVal, { color: qarz > 0 ? "#DC2626" : "#059669", fontFamily: "Inter_700Bold" }]}>{fmt(qarz)}</Text>
                </View>
              </View>
            )}

            <LabeledInput label="Zaklat summasi" value={zaklatSumma} onChange={setZaklatSumma} keyboardType="decimal-pad" placeholder="0" />
            <DateInput
              label="Tayyor bo'lish kuni"
              day={tayyorDay} month={tayyorMonth} year={tayyorYear}
              onChangeDay={setTayyorDay} onChangeMonth={setTayyorMonth} onChangeYear={setTayyorYear}
            />
            <DateInput
              label="Qarz qaytarish kuni"
              day={qarzDay} month={qarzMonth} year={qarzYear}
              onChangeDay={setQarzDay} onChangeMonth={setQarzMonth} onChangeYear={setQarzYear}
            />
            <LabeledInput label="Izoh" value={izoh} onChange={setIzoh} multiline placeholder="Qo'shimcha ma'lumotlar..." />
          </View>
        )}

        {/* ── STEP 5: Ishchilar ── */}
        {step === 5 && (
          <View style={{ gap: 14 }}>
            <SectionHeader icon="users" title="Ishchilarni belgilash" />

            <View style={li.wrap}>
              <Text style={[li.label, { color: C.textSecondary }]}>Tikuvchi</Text>
              <View style={s.workerList}>
                <TouchableOpacity
                  style={[s.workerBtn, {
                    borderColor: tailorId === null ? C.primary : C.border,
                    backgroundColor: tailorId === null ? C.surface : C.card,
                  }]}
                  onPress={() => setTailorId(null)}
                >
                  <Text style={[s.workerBtnTxt, { color: tailorId === null ? C.primary : C.textSecondary }]}>Belgilanmagan</Text>
                </TouchableOpacity>
                {allForTailor.map(w => (
                  <TouchableOpacity
                    key={w.id}
                    style={[s.workerBtn, {
                      borderColor: tailorId === w.id ? C.primary : C.border,
                      backgroundColor: tailorId === w.id ? C.surface : C.card,
                    }]}
                    onPress={() => setTailorId(w.id)}
                  >
                    <Text style={[s.workerBtnTxt, { color: tailorId === w.id ? C.primary : C.text }]}>{w.fullName}</Text>
                    <Text style={[s.workerRole, { color: C.textSecondary }]}>{w.role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={li.wrap}>
              <Text style={[li.label, { color: C.textSecondary }]}>O'rnatuvchi</Text>
              <View style={s.workerList}>
                <TouchableOpacity
                  style={[s.workerBtn, {
                    borderColor: installerId === null ? C.primary : C.border,
                    backgroundColor: installerId === null ? C.surface : C.card,
                  }]}
                  onPress={() => setInstallerId(null)}
                >
                  <Text style={[s.workerBtnTxt, { color: installerId === null ? C.primary : C.textSecondary }]}>Belgilanmagan</Text>
                </TouchableOpacity>
                {installers.length === 0 && workers.map(w => (
                  <TouchableOpacity
                    key={w.id}
                    style={[s.workerBtn, {
                      borderColor: installerId === w.id ? C.primary : C.border,
                      backgroundColor: installerId === w.id ? C.surface : C.card,
                    }]}
                    onPress={() => setInstallerId(w.id)}
                  >
                    <Text style={[s.workerBtnTxt, { color: installerId === w.id ? C.primary : C.text }]}>{w.fullName}</Text>
                  </TouchableOpacity>
                ))}
                {installers.map(w => (
                  <TouchableOpacity
                    key={w.id}
                    style={[s.workerBtn, {
                      borderColor: installerId === w.id ? C.primary : C.border,
                      backgroundColor: installerId === w.id ? C.surface : C.card,
                    }]}
                    onPress={() => setInstallerId(w.id)}
                  >
                    <Text style={[s.workerBtnTxt, { color: installerId === w.id ? C.primary : C.text }]}>{w.fullName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Summary */}
            <View style={[s.summary, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[s.summaryTitle, { color: C.text }]}>Xulosa</Text>
              <SummaryRow label="Mijoz" value={mijozIsm || mijozPhone || "—"} />
              <SummaryRow label="Material" value={`${mat} m × ${fmt(npm)}`} />
              <SummaryRow label="Jami" value={fmt(grandTotal)} bold />
              <SummaryRow label="Zaklat" value={fmt(zaklat)} />
              <SummaryRow label="Qarz" value={fmt(qarz)} color={qarz > 0 ? "#DC2626" : "#059669"} />
            </View>
          </View>
        )}

      </ScrollView>

      {/* Bottom navigation */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 8, backgroundColor: C.card, borderTopColor: C.border }]}>
        {step > 1 && (
          <TouchableOpacity style={[s.prevBtn, { borderColor: C.border }]} onPress={() => setStep(s => s - 1)}>
            <Feather name="arrow-left" size={18} color={C.text} />
            <Text style={[s.prevBtnTxt, { color: C.text }]}>Orqaga</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {step < 5 ? (
          <TouchableOpacity style={[s.nextBtn, { backgroundColor: C.primary }]} onPress={goNext}>
            <Text style={s.nextBtnTxt}>Keyingi</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.nextBtn, { backgroundColor: "#10B981", paddingHorizontal: 28 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check" size={18} color="#fff" />
                <Text style={s.nextBtnTxt}>Saqlash</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: any; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={[{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.surface }]}>
        <Feather name={icon} size={16} color={C.primary} />
      </View>
      <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: C.text }}>{title}</Text>
    </View>
  );
}

function SummaryRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" }}>{label}</Text>
      <Text style={{ fontSize: 13, color: color || C.text, fontFamily: bold ? "Inter_700Bold" : "Inter_500Medium" }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

  steps: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  stepItem: { alignItems: "center", gap: 4, flex: 1 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepLbl: { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center" },

  measureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  measureKey: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular" },
  measureVal: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular" },
  measureDel: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, borderStyle: "dashed" },
  addBtnTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },

  ornatishRow: { flexDirection: "row", gap: 8 },
  ornatishBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 10, alignItems: "center", gap: 2 },
  ornatishLbl: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  ornatishDesc: { fontSize: 11, fontFamily: "Inter_400Regular" },

  calcCard: { borderRadius: 16, padding: 16, gap: 8 },
  calcTitle: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular", marginBottom: 4 },
  calcRow: { flexDirection: "row", justifyContent: "space-between" },
  calcLbl: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular" },
  calcVal: { fontSize: 13, color: "#fff", fontFamily: "Inter_600SemiBold" },
  calcTotal: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.3)", paddingTop: 8, marginTop: 4 },
  calcTotalLbl: { fontSize: 15, color: "#fff", fontFamily: "Inter_700Bold" },
  calcTotalVal: { fontSize: 18, color: "#fff", fontFamily: "Inter_700Bold" },

  payInfo: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  payInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  payInfoLbl: { fontSize: 13, fontFamily: "Inter_400Regular" },
  payInfoVal: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  workerList: { gap: 8 },
  workerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  workerBtnTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  workerRole: { fontSize: 11, fontFamily: "Inter_400Regular" },

  summary: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 2 },
  summaryTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 6 },

  bottomBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  prevBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  prevBtnTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  nextBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  nextBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
