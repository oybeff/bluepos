import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import { fmtNum } from "../../../lib/date-utils";

const C = Colors.light;

function fmt(n: number) {
  return fmtNum(Math.round(n || 0)) + " so'm";
}

interface Worker { id: number; fullName: string; role: string; }

export default function EditDealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    mijozIsm: "", mijozPhone: "", manzil: "",
    narxPerMetr: "", totalMaterial: "",
    ornatishNarx: "", chevarHaqiPerMetr: "",
    zaklatSumma: "", izoh: "",
    tailorWorkerId: null as number | null,
    installerWorkerId: null as number | null,
  });

  const { data: deal, isLoading } = useQuery<any>({
    queryKey: ["deal", id],
    queryFn: () => apiReq(`/client-deals/${id}`),
    enabled: !!id,
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["workers"],
    queryFn: () => apiReq("/workers"),
  });

  const { data: allProducts = [] } = useQuery<{ id: number; name: string; pricePerUnit: number; price_per_unit?: number; stock: number; unit?: string }[]>({
    queryKey: ["products"],
    queryFn: () => apiReq("/products"),
  });

  const { data: dealProducts = [], refetch: refetchDp } = useQuery<{ id: number; product_name: string; qty: number; unit: string; price_per_unit: number; total: number; product_id: number | null }[]>({
    queryKey: ["deal-products", id],
    queryFn: () => apiReq(`/client-deals/${id}/products`),
    enabled: !!id,
  });

  const [productSearch, setProductSearch] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);

  const filteredProducts = productSearch.trim()
    ? allProducts.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase())
      ).slice(0, 6)
    : [];

  async function addDealProduct(p: { id: number; name: string; pricePerUnit: number; price_per_unit?: number; unit?: string }) {
    setAddingProduct(true);
    try {
      const ppu = p.pricePerUnit || p.price_per_unit || 0;
      await apiReq(`/client-deals/${id}/products`, {
        method: "POST",
        body: JSON.stringify({ product_id: p.id, product_name: p.name, qty: 1, unit: p.unit || "dona", price_per_unit: ppu }),
      });
      await refetchDp();
      setProductSearch("");
    } catch (e: any) {
      Alert.alert("Xato", e.message);
    } finally {
      setAddingProduct(false);
    }
  }

  async function removeDealProduct(dpId: number) {
    try {
      await apiReq(`/client-deals/${id}/products/${dpId}`, { method: "DELETE" });
      await refetchDp();
    } catch (e: any) {
      Alert.alert("Xato", e.message);
    }
  }

  useEffect(() => {
    if (deal) {
      setForm({
        mijozIsm: deal.mijozIsm || "",
        mijozPhone: deal.mijozPhone || "",
        manzil: deal.manzil || "",
        narxPerMetr: String(deal.narxPerMetr || ""),
        totalMaterial: String(deal.totalMaterial || ""),
        ornatishNarx: String(deal.ornatishNarx || ""),
        chevarHaqiPerMetr: String(deal.chevarHaqiPerMetr || ""),
        zaklatSumma: String(deal.zaklatSumma || ""),
        izoh: deal.izoh || "",
        tailorWorkerId: deal.tailorWorkerId,
        installerWorkerId: deal.installerWorkerId,
      });
    }
  }, [deal]);

  const narx = parseFloat(form.narxPerMetr) || 0;
  const material = parseFloat(form.totalMaterial) || 0;
  const totalNarx = narx * material;
  const ornatish = parseFloat(form.ornatishNarx) || 0;
  const chevarPerM = parseFloat(form.chevarHaqiPerMetr) || 0;
  const chevarJami = chevarPerM * material;
  const dpTotal = dealProducts.reduce((s: number, p: any) => s + (p.total || 0), 0);
  const grandTotal = totalNarx + ornatish + chevarJami + dpTotal;
  const zaklat = parseFloat(form.zaklatSumma) || 0;
  const qarz = Math.max(0, grandTotal - zaklat);

  async function handleSave() {
    if (!form.mijozIsm.trim()) { Alert.alert("Mijoz ismini kiriting"); return; }
    setSaving(true);
    try {
      await apiReq(`/client-deals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          mijozIsm: form.mijozIsm.trim(),
          mijozPhone: form.mijozPhone.trim() || null,
          manzil: form.manzil.trim() || null,
          narxPerMetr: narx,
          totalMaterial: material,
          totalNarx,
          ornatishJami: ornatish,
          chevarJami,
          zaklatSumma: zaklat,
          qarzSumma: qarz,
          izoh: form.izoh.trim() || null,
          tailorWorkerId: form.tailorWorkerId,
          installerWorkerId: form.installerWorkerId,
        }),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["deal", id] }),
        qc.invalidateQueries({ queryKey: ["client-deals"] }),
        qc.invalidateQueries({ queryKey: ["deals-recent"] }),
      ]);
      Alert.alert("Saqlandi", "Buyurtma muvaffaqiyatli yangilandi");
      router.back();
    } catch (e: any) {
      Alert.alert("Xato", e.message);
    } finally {
      setSaving(false);
    }
  }

  const tailors = workers.filter(w => w.role === "tailor");
  const installers = workers.filter(w => w.role === "installer");

  if (isLoading) {
    return (
      <View style={[st.root, { backgroundColor: C.background, paddingTop: topPad }]}>
        <ActivityIndicator color={C.primary} style={{ marginTop: 60 }} />
      </View>
    );
  }

  return (
    <View style={[st.root, { backgroundColor: C.background }]}>
      <View style={[st.header, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={[st.backBtn, { backgroundColor: C.card }]}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={[st.title, { color: C.text }]}>Buyurtmani tahrirlash</Text>
        <TouchableOpacity
          style={[st.saveBtn, { opacity: saving ? 0.6 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Feather name="save" size={16} color="#fff" /><Text style={st.saveTxt}>Saqlash</Text></>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 16 }}>
        {/* Mijoz */}
        <View style={[st.card, { borderColor: C.border }]}>
          <Text style={[st.cardTitle, { color: C.text }]}>Mijoz ma'lumotlari</Text>
          <Field label="Ism" value={form.mijozIsm} onChange={v => setForm(f => ({ ...f, mijozIsm: v }))} />
          <Field label="Telefon" value={form.mijozPhone} onChange={v => setForm(f => ({ ...f, mijozPhone: v }))} keyboard="phone-pad" />
          <Field label="Manzil" value={form.manzil} onChange={v => setForm(f => ({ ...f, manzil: v }))} />
        </View>

        {/* Narxlar */}
        <View style={[st.card, { borderColor: C.border }]}>
          <Text style={[st.cardTitle, { color: C.text }]}>Narxlar</Text>
          <Field label="Material (metr)" value={form.totalMaterial} onChange={v => setForm(f => ({ ...f, totalMaterial: v }))} keyboard="numeric" />
          <Field label="Narx (1 metr, so'm)" value={form.narxPerMetr} onChange={v => setForm(f => ({ ...f, narxPerMetr: v }))} keyboard="numeric" />
          <View style={st.calcRow}>
            <Text style={{ color: C.textSecondary, fontSize: 13 }}>Parda summasi:</Text>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 14 }}>{fmt(totalNarx)}</Text>
          </View>
          <Field label="O'rnatish narxi (so'm)" value={form.ornatishNarx} onChange={v => setForm(f => ({ ...f, ornatishNarx: v }))} keyboard="numeric" />
          <Field label="Chevar haqi (1 metr)" value={form.chevarHaqiPerMetr} onChange={v => setForm(f => ({ ...f, chevarHaqiPerMetr: v }))} keyboard="numeric" />
          {chevarJami > 0 && (
            <View style={st.calcRow}>
              <Text style={{ color: C.textSecondary, fontSize: 13 }}>Chevar jami:</Text>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 14 }}>{fmt(chevarJami)}</Text>
            </View>
          )}
        </View>

        {/* To'lov */}
        <View style={[st.card, { borderColor: C.border }]}>
          <Text style={[st.cardTitle, { color: C.text }]}>To'lov</Text>
          <View style={[st.totalCard, { backgroundColor: C.primary }]}>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>Jami summa</Text>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>{fmt(grandTotal)}</Text>
          </View>
          <Field label="Zaklat (oldindan to'lov)" value={form.zaklatSumma} onChange={v => setForm(f => ({ ...f, zaklatSumma: v }))} keyboard="numeric" />
          <View style={st.calcRow}>
            <Text style={{ color: C.textSecondary, fontSize: 13 }}>Qolgan qarz:</Text>
            <Text style={{ color: qarz > 0 ? "#EF4444" : "#10B981", fontWeight: "700", fontSize: 14 }}>{fmt(qarz)}</Text>
          </View>
        </View>

        {/* Ishchilar */}
        {(tailors.length > 0 || installers.length > 0) && (
          <View style={[st.card, { borderColor: C.border }]}>
            <Text style={[st.cardTitle, { color: C.text }]}>Ishchilar</Text>
            {tailors.length > 0 && (
              <>
                <Text style={[st.fieldLabel, { color: C.textSecondary }]}>Tikuvchi</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={[st.workerBtn, { borderColor: !form.tailorWorkerId ? C.primary : C.border, backgroundColor: !form.tailorWorkerId ? C.primary + "15" : C.card }]}
                      onPress={() => setForm(f => ({ ...f, tailorWorkerId: null }))}
                    >
                      <Text style={{ color: !form.tailorWorkerId ? C.primary : C.textSecondary, fontSize: 13 }}>Yo'q</Text>
                    </TouchableOpacity>
                    {tailors.map(w => (
                      <TouchableOpacity
                        key={w.id}
                        style={[st.workerBtn, { borderColor: form.tailorWorkerId === w.id ? C.primary : C.border, backgroundColor: form.tailorWorkerId === w.id ? C.primary + "15" : C.card }]}
                        onPress={() => setForm(f => ({ ...f, tailorWorkerId: w.id }))}
                      >
                        <Text style={{ color: form.tailorWorkerId === w.id ? C.primary : C.text, fontSize: 13 }}>{w.fullName}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
            {installers.length > 0 && (
              <>
                <Text style={[st.fieldLabel, { color: C.textSecondary, marginTop: 12 }]}>O'rnatuvchi</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={[st.workerBtn, { borderColor: !form.installerWorkerId ? C.primary : C.border, backgroundColor: !form.installerWorkerId ? C.primary + "15" : C.card }]}
                      onPress={() => setForm(f => ({ ...f, installerWorkerId: null }))}
                    >
                      <Text style={{ color: !form.installerWorkerId ? C.primary : C.textSecondary, fontSize: 13 }}>Yo'q</Text>
                    </TouchableOpacity>
                    {installers.map(w => (
                      <TouchableOpacity
                        key={w.id}
                        style={[st.workerBtn, { borderColor: form.installerWorkerId === w.id ? C.primary : C.border, backgroundColor: form.installerWorkerId === w.id ? C.primary + "15" : C.card }]}
                        onPress={() => setForm(f => ({ ...f, installerWorkerId: w.id }))}
                      >
                        <Text style={{ color: form.installerWorkerId === w.id ? C.primary : C.text, fontSize: 13 }}>{w.fullName}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        )}

        {/* Izoh */}
        <View style={[st.card, { borderColor: C.border }]}>
          <Text style={[st.cardTitle, { color: C.text }]}>Izoh</Text>
          <TextInput
            style={[st.input, { borderColor: C.border, backgroundColor: C.card, color: C.text, height: 80, textAlignVertical: "top" }]}
            value={form.izoh}
            onChangeText={v => setForm(f => ({ ...f, izoh: v }))}
            placeholder="Qo'shimcha izoh..."
            placeholderTextColor={C.textSecondary}
            multiline
          />
        </View>

        {/* Mahsulotlar */}
        <View style={[st.card, { borderColor: C.border }]}>
          <Text style={[st.cardTitle, { color: C.text }]}>Mahsulotlar</Text>
          <View style={[st.input, { borderColor: C.border, backgroundColor: C.card, flexDirection: "row", alignItems: "center", gap: 8 }]}>
            <Feather name="search" size={16} color={C.textSecondary} />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: C.text }}
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder="Mahsulot qidirish..."
              placeholderTextColor={C.textSecondary}
            />
          </View>
          {filteredProducts.length > 0 && (
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, overflow: "hidden" }}>
              {filteredProducts.map((p, i) => (
                <TouchableOpacity
                  key={p.id}
                  disabled={addingProduct}
                  style={{ flexDirection: "row", alignItems: "center", padding: 10, gap: 8,
                    borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.border }}
                  onPress={() => addDealProduct(p)}
                >
                  <Feather name="plus-circle" size={16} color={C.primary} />
                  <Text style={{ flex: 1, fontSize: 13, color: C.text }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ fontSize: 11, color: C.textSecondary }}>{fmt(p.pricePerUnit || p.price_per_unit || 0)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {dealProducts.length > 0 && (
            <View style={{ gap: 6 }}>
              {dealProducts.map(dp => (
                <View key={dp.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 10, backgroundColor: C.background }}>
                  <Feather name="box" size={14} color="#3B82F6" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }} numberOfLines={1}>{dp.product_name}</Text>
                    <Text style={{ fontSize: 11, color: C.textSecondary }}>{dp.qty} {dp.unit} × {fmt(dp.price_per_unit)} = {fmt(dp.total)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeDealProduct(dp.id)}>
                    <Feather name="trash-2" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChange, keyboard }: {
  label: string; value: string; onChange: (v: string) => void; keyboard?: any;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={[st.fieldLabel, { color: Colors.light.textSecondary }]}>{label}</Text>
      <TextInput
        style={[st.input, { borderColor: Colors.light.border, backgroundColor: Colors.light.card, color: Colors.light.text }]}
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={Colors.light.textSecondary}
        keyboardType={keyboard || "default"}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  title: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#4F46E5", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  saveTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  card: {
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1,
    padding: 16, gap: 12,
  },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginLeft: 2 },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular",
  },
  calcRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 4, paddingVertical: 4,
  },
  totalCard: {
    borderRadius: 14, padding: 16, alignItems: "center", gap: 4,
  },
  workerBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
  },
});
