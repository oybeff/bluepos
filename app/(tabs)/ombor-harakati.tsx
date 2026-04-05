import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";

const C = Colors.light;

interface StockMovement {
  id: number;
  productId: number;
  mahsulotNomi: string;
  tur: "kirim" | "chiqim" | "tuzatish";
  miqdor: number;
  birlik: string;
  avvalgiQoldiq: number;
  yangiQoldiq: number;
  sabab: string | null;
  createdAt: string;
}

interface OmborProduct {
  id: number;
  name: string;
  stock: number;
  minStock: number;
  unit: string;
  isLow: boolean;
}

const TUR_COLORS = {
  kirim: { bg: "#D1FAE5", text: "#059669", icon: "arrow-down-left" as const },
  chiqim: { bg: "#FEE2E2", text: "#DC2626", icon: "arrow-up-right" as const },
  tuzatish: { bg: "#FEF3C7", text: "#D97706", icon: "edit-2" as const },
};

function fmt(n: number, unit?: string): string {
  return `${parseFloat(n.toFixed(2))} ${unit ?? ""}`.trim();
}

function fmtDate(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" }) +
    " " + dt.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

type Tab = "harakatlar" | "qoldiq";

export default function OmborHarakatiScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("harakatlar");
  const [search, setSearch] = useState("");
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  const { data: movements = [], isLoading: mvLoading } = useQuery<StockMovement[]>({
    queryKey: ["stock-movements"],
    queryFn: () => apiReq("/ombor/harakati"),
    enabled: activeTab === "harakatlar",
  });

  const { data: products = [], isLoading: prodLoading } = useQuery<OmborProduct[]>({
    queryKey: ["ombor-qoldiq"],
    queryFn: () => apiReq("/ombor/qoldiq"),
    enabled: activeTab === "qoldiq",
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["stock-movements"] }),
      qc.invalidateQueries({ queryKey: ["ombor-qoldiq"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const filteredMovements = movements.filter(m =>
    m.mahsulotNomi.toLowerCase().includes(search.toLowerCase()) ||
    (m.sabab ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = products.filter(p => p.isLow).length;

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: topPadding + 12 }]}>
        <Text style={[s.title, { color: C.text }]}>Ombor harakati</Text>
        {lowStockCount > 0 && (
          <View style={s.lowBadge}>
            <Feather name="alert-triangle" size={12} color="#D97706" />
            <Text style={s.lowBadgeTxt}>{lowStockCount} kam</Text>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { borderColor: C.border }]}>
        {(["harakatlar", "qoldiq"] as Tab[]).map(t => (
          <TouchableOpacity key={t} onPress={() => setActiveTab(t)}
            style={[s.tabBtn, activeTab === t && [s.tabBtnActive, { borderColor: C.primary }]]}>
            <Text style={[s.tabTxt, { color: activeTab === t ? C.primary : C.textSecondary }]}>
              {t === "harakatlar" ? "Harakatlar" : "Joriy qoldiq"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={[s.searchBox, { borderColor: C.border, backgroundColor: C.surface }]}>
        <Feather name="search" size={16} color={C.textSecondary} />
        <TextInput
          style={[s.searchInput, { color: C.text }]}
          placeholder="Qidirish..."
          placeholderTextColor={C.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x-circle" size={16} color={C.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {(mvLoading || prodLoading) && <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />}

        {activeTab === "harakatlar" && !mvLoading && (
          <>
            {filteredMovements.length === 0 && (
              <View style={s.emptyWrap}>
                <Feather name="inbox" size={40} color={C.textSecondary} />
                <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Harakatlar topilmadi</Text>
              </View>
            )}
            {filteredMovements.map(mv => {
              const clr = TUR_COLORS[mv.tur];
              return (
                <View key={mv.id} style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <View style={[s.mvIcon, { backgroundColor: clr.bg }]}>
                    <Feather name={clr.icon} size={16} color={clr.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.mvName, { color: C.text }]}>{mv.mahsulotNomi}</Text>
                    <Text style={[s.mvSabab, { color: C.textSecondary }]} numberOfLines={1}>
                      {mv.sabab ?? mv.tur}
                    </Text>
                    <Text style={[s.mvDate, { color: C.textSecondary }]}>{fmtDate(mv.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[s.mvAmount, { color: clr.text }]}>
                      {mv.tur === "kirim" ? "+" : "-"}{fmt(mv.miqdor, mv.birlik)}
                    </Text>
                    <Text style={[s.mvQoldiq, { color: C.textSecondary }]}>
                      → {fmt(mv.yangiQoldiq, mv.birlik)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {activeTab === "qoldiq" && !prodLoading && (
          <>
            {filteredProducts.length === 0 && (
              <View style={s.emptyWrap}>
                <Feather name="package" size={40} color={C.textSecondary} />
                <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Mahsulotlar topilmadi</Text>
              </View>
            )}
            {filteredProducts.map(p => (
              <View key={p.id} style={[s.card, { backgroundColor: C.surface, borderColor: p.isLow ? "#FCA5A5" : C.border }]}>
                <View style={[s.mvIcon, { backgroundColor: p.isLow ? "#FEE2E2" : "#EFF6FF" }]}>
                  <Feather name="package" size={16} color={p.isLow ? "#DC2626" : C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.mvName, { color: C.text }]}>{p.name}</Text>
                  <Text style={[s.mvSabab, { color: C.textSecondary }]}>
                    Min. qoldiq: {fmt(p.minStock, p.unit)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[s.mvAmount, { color: p.isLow ? "#DC2626" : "#059669" }]}>
                    {fmt(p.stock, p.unit)}
                  </Text>
                  {p.isLow && (
                    <View style={s.lowTag}>
                      <Text style={s.lowTagTxt}>Kam!</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  lowBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF3C7", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  lowBadgeTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#D97706" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 16, marginBottom: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderColor: "transparent" },
  tabBtnActive: {},
  tabTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  mvIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  mvName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  mvSabab: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  mvDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  mvAmount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  mvQoldiq: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyWrap: { alignItems: "center", gap: 10, paddingVertical: 60 },
  emptyTxt: { fontSize: 15, fontFamily: "Inter_400Regular" },
  lowTag: { backgroundColor: "#FEE2E2", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 3 },
  lowTagTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#DC2626" },
});
