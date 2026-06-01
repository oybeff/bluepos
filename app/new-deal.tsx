import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import * as FileSystem from "expo-file-system";
import DateInput, { buildDateStr } from "@/components/DateInput";
import { fmtNum } from "../lib/date-utils";

const C = Colors.light;

const STEPS = [
  { id: 1, label: "Mijoz", icon: "user" as const },
  { id: 2, label: "Rasmlar", icon: "camera" as const },
  { id: 3, label: "Narx", icon: "tag" as const },
  { id: 4, label: "Mahsulot", icon: "box" as const },
  { id: 5, label: "To'lov", icon: "credit-card" as const },
];


interface PhotoItem { uri: string; width: number; height: number; }
interface Worker { id: number; fullName: string; role: string; }
interface Product { id: number; name: string; pricePerUnit: number; price_per_unit?: number; stock: number; barcode?: string; category?: string; unit?: string; }
interface DealProduct { productId: number; name: string; qty: number; unit: string; price: number; }

function fmt(n: number) {
  return fmtNum(Math.round(n || 0)) + " so'm";
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

  // Step 2 — Rasmlar
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  // Step 3 — Narx + Tikuvchi
  const [totalMaterial, setTotalMaterial] = useState("");
  const [narxPerMetr, setNarxPerMetr] = useState("");
  const [ornatishNarxi, setOrnatishNarxi] = useState("");
  const [chevarHaqiPerMetr, setChevarHaqiPerMetr] = useState("");
  const [tailorId, setTailorId] = useState<number | null>(null);

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["workers"],
    queryFn: () => apiReq("/workers"),
  });
  const tailors = workers.filter(w => w.role === "tailor" || w.role === "seller" || w.role === "measurer");

  // Step 4 — To'lov
  const [zaklatSumma, setZaklatSumma] = useState("");
  const [tayyorDay, setTayyorDay] = useState("");
  const [tayyorMonth, setTayyorMonth] = useState("");
  const [tayyorYear, setTayyorYear] = useState("");
  const [qarzDay, setQarzDay] = useState("");
  const [qarzMonth, setQarzMonth] = useState("");
  const [qarzYear, setQarzYear] = useState("");
  const [izoh, setIzoh] = useState("");

  // Step 4 — Mahsulotlar
  const [dealProducts, setDealProducts] = useState<DealProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiReq("/products"),
  });
  const filteredProducts = productSearch.trim()
    ? allProducts.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.barcode && p.barcode.includes(productSearch))
      ).slice(0, 8)
    : [];

  // Calculations
  const mat = parseFloat(totalMaterial) || 0;
  const npm = parseFloat(narxPerMetr) || 0;
  const chv = parseFloat(chevarHaqiPerMetr) || 0;
  const totalNarx = mat * npm;
  const chevarJami = mat * chv;
  const ornatishNarx = parseFloat(ornatishNarxi) || 0;
  const productsTotal = dealProducts.reduce((s, p) => s + p.qty * p.price, 0);
  const grandTotal = totalNarx + ornatishNarx + chevarJami + productsTotal;
  const zaklat = parseFloat(zaklatSumma) || 0;
  const qarz = Math.max(0, grandTotal - zaklat);

  async function pickPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => ({ uri: a.uri, width: a.width, height: a.height }))]);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Xato", "Kamera ruxsati kerak"); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => ({ uri: a.uri, width: a.width, height: a.height }))]);
    }
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
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
      const body = {
        mijozIsm: mijozIsm.trim() || null,
        mijozPhone: mijozPhone.trim() || null,
        manzil: manzil.trim() || null,
        materialJami: mat,
        narxMetr: npm,
        totalNarx,
        ornatishTuri: ornatishNarx > 0 ? "devor" : null,
        tikuvchiNarxMetr: chv,
        zaklat: zaklat,
        qarzSumma: qarz,
        tayyorSana: buildDateStr(tayyorDay, tayyorMonth, tayyorYear) || null,
        qarzQaytarishSana: buildDateStr(qarzDay, qarzMonth, qarzYear) || null,
        izoh: izoh.trim() || null,
        tikuvchiId: tailorId,
      };

      const created = await apiReq("/client-deals", {
        method: "POST",
        body: JSON.stringify(body),
      }) as any;

      // Upload photos as base64
      const dealId = created.deal?.id ?? created.id;
      if (photos.length > 0) {
        for (const p of photos) {
          try {
            const b64 = await FileSystem.readAsStringAsync(p.uri, { encoding: 'base64' as any });
            const ext = p.uri.split(".").pop() || "jpg";
            await apiReq(`/client-deals/${dealId}/photos`, {
              method: "POST",
              body: JSON.stringify({ base64: b64, filename: `photo.${ext}` }),
            });
          } catch {}
        }
      }

      // Save deal products
      if (dealProducts.length > 0) {
        for (const dp of dealProducts) {
          try {
            await apiReq(`/client-deals/${dealId}/products`, {
              method: "POST",
              body: JSON.stringify({
                product_id: dp.productId,
                product_name: dp.name,
                qty: dp.qty,
                unit: dp.unit,
                price_per_unit: dp.price,
              }),
            });
          } catch {}
        }
      }

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

        {/* ── STEP 2: Rasmlar ── */}
        {step === 2 && (
          <View style={{ gap: 14 }}>
            <SectionHeader icon="camera" title="Hisob-kitob rasmlari" />
            <Text style={{ fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" }}>
              Daftardagi hisob-kitob yoki o'lchamlarni rasmga oling yoki galereyadan yuklang
            </Text>

            {photos.length > 0 && (
              <View style={s.photoGrid}>
                {photos.map((p, idx) => (
                  <View key={idx} style={s.photoWrap}>
                    <Image source={{ uri: p.uri }} style={s.photoImg} />
                    <TouchableOpacity style={s.photoDel} onPress={() => removePhoto(idx)}>
                      <Feather name="x" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity style={[s.photoBtn, { borderColor: C.primary, flex: 1 }]} onPress={takePhoto}>
                <Feather name="camera" size={20} color={C.primary} />
                <Text style={[s.photoBtnTxt, { color: C.primary }]}>Kamera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.photoBtn, { borderColor: C.primary, flex: 1 }]} onPress={pickPhotos}>
                <Feather name="image" size={20} color={C.primary} />
                <Text style={[s.photoBtnTxt, { color: C.primary }]}>Galereya</Text>
              </TouchableOpacity>
            </View>

            {photos.length === 0 && (
              <View style={[s.photoEmpty, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Feather name="image" size={40} color={C.textSecondary} />
                <Text style={{ fontSize: 14, color: C.textSecondary, fontFamily: "Inter_500Medium", marginTop: 8 }}>
                  Hali rasm yuklanmagan
                </Text>
                <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4 }}>
                  2-3 yoki ko'proq rasm yuklang
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── STEP 3: Narx ── */}
        {step === 3 && (
          <View style={{ gap: 14 }}>
            <SectionHeader icon="tag" title="Material va narxlar" />
            <LabeledInput label="Umumiy material (metr)" value={totalMaterial} onChange={setTotalMaterial} keyboardType="decimal-pad" placeholder="0.00" />
            <LabeledInput label="Narx (1 metr)" value={narxPerMetr} onChange={setNarxPerMetr} keyboardType="decimal-pad" placeholder="0" />
            <LabeledInput label="Tikuvchi haqi (1 metrga)" value={chevarHaqiPerMetr} onChange={setChevarHaqiPerMetr} keyboardType="decimal-pad" placeholder="0" />
            <LabeledInput label="O'rnatish xizmati narxi" value={ornatishNarxi} onChange={setOrnatishNarxi} keyboardType="decimal-pad" placeholder="0" />

            {/* Tikuvchi tanlash */}
            <View style={li.wrap}>
              <Text style={[li.label, { color: C.textSecondary }]}>✂️ Tikuvchi</Text>
              <View style={s.tailorList}>
                <TouchableOpacity
                  style={[s.tailorBtn, {
                    borderColor: tailorId === null ? C.primary : C.border,
                    backgroundColor: tailorId === null ? C.surface : C.card,
                  }]}
                  onPress={() => setTailorId(null)}
                >
                  <Text style={[s.tailorBtnTxt, { color: tailorId === null ? C.primary : C.textSecondary }]}>Belgilanmagan</Text>
                </TouchableOpacity>
                {(tailors.length > 0 ? tailors : workers).map(w => (
                  <TouchableOpacity
                    key={w.id}
                    style={[s.tailorBtn, {
                      borderColor: tailorId === w.id ? C.primary : C.border,
                      backgroundColor: tailorId === w.id ? C.surface : C.card,
                    }]}
                    onPress={() => setTailorId(w.id)}
                  >
                    <Text style={[s.tailorBtnTxt, { color: tailorId === w.id ? C.primary : C.text }]}>{w.fullName}</Text>
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

        {/* ── STEP 4: Mahsulotlar ── */}
        {step === 4 && (
          <View style={{ gap: 14 }}>
            <SectionHeader icon="box" title="Mahsulotlar (ixtiyoriy)" />
            <Text style={{ fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" }}>
              Buyurtmaga aksessuar yoki tayyor mahsulot qo'shing — ombordagi stock avtomatik kamayadi
            </Text>

            {/* Search */}
            <View style={[li.input, { flexDirection: "row", alignItems: "center", gap: 8, borderColor: C.border, backgroundColor: C.card }]}>
              <Feather name="search" size={16} color={C.textSecondary} />
              <TextInput
                style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text }}
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="Mahsulot qidirish..."
                placeholderTextColor={C.textSecondary}
              />
              {productSearch.length > 0 && (
                <TouchableOpacity onPress={() => setProductSearch("")}>
                  <Feather name="x" size={16} color={C.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Search results */}
            {filteredProducts.length > 0 && (
              <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card, overflow: "hidden" }}>
                {filteredProducts.map((p, i) => (
                  <TouchableOpacity
                    key={p.id}
                    style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 10,
                      borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.border }}
                    onPress={() => {
                      if (dealProducts.find(dp => dp.productId === p.id)) return;
                      setDealProducts(prev => [...prev, {
                        productId: p.id, name: p.name, qty: 1,
                        unit: p.unit || "dona", price: p.pricePerUnit || p.price_per_unit || 0,
                      }]);
                      setProductSearch("");
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" }}>
                      <Feather name="box" size={16} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text }} numberOfLines={1}>{p.name}</Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary }}>
                        {fmt(p.pricePerUnit || p.price_per_unit || 0)} • Omborda: {p.stock}
                      </Text>
                    </View>
                    {dealProducts.find(dp => dp.productId === p.id) ? (
                      <Feather name="check-circle" size={18} color="#10B981" />
                    ) : (
                      <Feather name="plus-circle" size={18} color={C.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Selected products */}
            {dealProducts.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary }}>
                  Tanlangan ({dealProducts.length})
                </Text>
                {dealProducts.map((dp, idx) => (
                  <View key={dp.productId} style={{ flexDirection: "row", alignItems: "center", gap: 8,
                    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text }} numberOfLines={1}>{dp.name}</Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary }}>
                        {fmt(dp.price)} × {dp.qty} = {fmt(dp.qty * dp.price)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <TouchableOpacity
                        style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}
                        onPress={() => setDealProducts(prev => prev.map((p, i) => i === idx ? { ...p, qty: Math.max(1, p.qty - 1) } : p))}
                      >
                        <Feather name="minus" size={14} color={C.text} />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: C.text, minWidth: 24, textAlign: "center" }}>{dp.qty}</Text>
                      <TouchableOpacity
                        style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}
                        onPress={() => setDealProducts(prev => prev.map((p, i) => i === idx ? { ...p, qty: p.qty + 1 } : p))}
                      >
                        <Feather name="plus" size={14} color={C.text} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => setDealProducts(prev => prev.filter((_, i) => i !== idx))}>
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 4 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary }}>Mahsulotlar jami:</Text>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: C.primary }}>{fmt(productsTotal)}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── STEP 5: To'lov ── */}
        {step === 5 && (
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

        {/* ── Summary (shown in step 5) ── */}
        {step === 5 && grandTotal > 0 && (
          <View style={[s.summary, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.summaryTitle, { color: C.text }]}>Xulosa</Text>
            <SummaryRow label="Mijoz" value={mijozIsm || mijozPhone || "—"} />
            <SummaryRow label="Rasmlar" value={`${photos.length} ta`} />
            <SummaryRow label="Material" value={`${mat} m × ${fmt(npm)}`} />
            {dealProducts.length > 0 && <SummaryRow label="Mahsulotlar" value={`${dealProducts.length} ta — ${fmt(productsTotal)}`} />}
            <SummaryRow label="Jami" value={fmt(grandTotal)} bold />
            <SummaryRow label="Zaklat" value={fmt(zaklat)} />
            <SummaryRow label="Qarz" value={fmt(qarz)} color={qarz > 0 ? "#DC2626" : "#059669"} />
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

  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoWrap: { width: 100, height: 100, borderRadius: 12, overflow: "hidden" },
  photoImg: { width: "100%", height: "100%", borderRadius: 12 },
  photoDel: { position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  photoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, borderStyle: "dashed" as any },
  photoBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  photoEmpty: { alignItems: "center", justifyContent: "center", paddingVertical: 40, borderRadius: 16, borderWidth: 1, borderStyle: "dashed" as any },

  tailorList: { gap: 8 },
  tailorBtn: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, alignItems: "center" },
  tailorBtnTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },

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

  summary: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 2 },
  summaryTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 6 },

  bottomBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  prevBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  prevBtnTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  nextBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  nextBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
