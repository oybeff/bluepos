import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";

const C = Colors.light;

interface Product {
  id: number;
  name: string;
  category: string;
  pricePerUnit: number;
  buyingPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  barcode: string | null;
  rang: string | null;
  material: string | null;
  description: string | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0)) + " so'm";
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Parda": { bg: "#EEF2FF", text: "#4F46E5" },
  "Jalüzi": { bg: "#F0FDF4", text: "#059669" },
  "Karniz": { bg: "#FFF7ED", text: "#D97706" },
  "Aksessuar": { bg: "#FDF4FF", text: "#9333EA" },
  "Ip": { bg: "#ECFDF5", text: "#047857" },
};

function getCatStyle(cat: string) {
  return CATEGORY_COLORS[cat] || { bg: "#F3F4F6", text: "#6B7280" };
}

export default function KatalogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: rawProducts = [], isLoading, refetch } = useQuery<Product[]>({
    queryKey: ["products-catalog"],
    queryFn: async () => {
      const res = await apiReq("/products") as any;
      return res.products || res || [];
    },
  });

  async function onRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  const categories = useMemo(() => {
    const cats = [...new Set(rawProducts.map(p => p.category))].sort();
    return cats;
  }, [rawProducts]);

  const filtered = useMemo(() => {
    return rawProducts.filter(p => {
      const matchCat = !selectedCat || p.category === selectedCat;
      const matchSearch = !search
        || p.name.toLowerCase().includes(search.toLowerCase())
        || (p.barcode || "").includes(search)
        || (p.rang || "").toLowerCase().includes(search.toLowerCase())
        || (p.material || "").toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [rawProducts, search, selectedCat]);

  const inStock = filtered.filter(p => p.stock > 0).length;

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: C.card }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: C.text }]}>Mahsulot katalogi</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>{inStock}/{filtered.length} ta mavjud</Text>
        </View>
        <TouchableOpacity
          style={[s.scanBtn, { backgroundColor: C.surface }]}
          onPress={() => router.push("/scanner" as any)}
        >
          <Feather name="maximize" size={18} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[s.searchRow, { backgroundColor: C.card, borderColor: C.border }]}>
        <Feather name="search" size={16} color={C.textSecondary} />
        <TextInput
          style={[s.searchInput, { color: C.text }]}
          placeholder="Nom, rang, barcode..."
          placeholderTextColor={C.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={C.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category filter */}
      {categories.length > 0 && (
        <FlatList
          horizontal
          data={[null, ...categories]}
          keyExtractor={(item) => item || "all"}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}
          renderItem={({ item }) => {
            const isSelected = selectedCat === item;
            const catStyle = item ? getCatStyle(item) : null;
            return (
              <TouchableOpacity
                style={[s.catChip,
                  isSelected ? { backgroundColor: catStyle?.bg || C.primary, borderColor: catStyle?.text || C.primary } : { backgroundColor: C.card, borderColor: C.border }
                ]}
                onPress={() => setSelectedCat(isSelected ? null : item)}
              >
                <Text style={[s.catChipTxt, { color: isSelected ? (catStyle?.text || C.primary) : C.textSecondary }]}>
                  {item || "Hammasi"}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Products list */}
      {isLoading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="package" size={48} color={C.textSecondary} />
              <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Mahsulot topilmadi</Text>
            </View>
          }
          renderItem={({ item: p }) => {
            const expanded = expandedId === p.id;
            const catStyle = getCatStyle(p.category);
            const stockOk = p.stock > p.minStock;
            const stockLow = p.stock > 0 && p.stock <= p.minStock;
            const stockOut = p.stock <= 0;

            return (
              <TouchableOpacity
                style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}
                onPress={() => setExpandedId(expanded ? null : p.id)}
                activeOpacity={0.85}
              >
                <View style={s.cardMain}>
                  <View style={[s.catBadge, { backgroundColor: catStyle.bg }]}>
                    <Feather name="package" size={20} color={catStyle.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.productName, { color: C.text }]} numberOfLines={expanded ? undefined : 1}>{p.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                      <View style={[s.catTag, { backgroundColor: catStyle.bg }]}>
                        <Text style={[s.catTagTxt, { color: catStyle.text }]}>{p.category}</Text>
                      </View>
                      {p.rang && (
                        <Text style={[s.metaTxt, { color: C.textSecondary }]}>{p.rang}</Text>
                      )}
                      {p.material && (
                        <Text style={[s.metaTxt, { color: C.textSecondary }]}>{p.material}</Text>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[s.price, { color: C.primary }]}>{fmt(p.pricePerUnit)}</Text>
                    <Text style={[s.priceUnit, { color: C.textSecondary }]}>/ {p.unit}</Text>
                  </View>
                </View>

                {/* Stock row */}
                <View style={s.stockRow}>
                  <View style={[s.stockBadge, {
                    backgroundColor: stockOut ? "#FEF2F2" : stockLow ? "#FFFBEB" : "#F0FDF4",
                  }]}>
                    <Feather
                      name={stockOut ? "x-circle" : stockLow ? "alert-triangle" : "check-circle"}
                      size={12}
                      color={stockOut ? "#DC2626" : stockLow ? "#D97706" : "#059669"}
                    />
                    <Text style={[s.stockBadgeTxt, {
                      color: stockOut ? "#DC2626" : stockLow ? "#D97706" : "#059669",
                    }]}>
                      {stockOut ? "Tugagan" : stockLow ? `Kam: ${p.stock} ${p.unit}` : `${p.stock} ${p.unit} mavjud`}
                    </Text>
                  </View>
                  {p.barcode && (
                    <Text style={[s.barcodeSmall, { color: C.textSecondary }]}>{p.barcode}</Text>
                  )}
                  <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={C.textSecondary} />
                </View>

                {/* Expanded details */}
                {expanded && (
                  <View style={[s.expanded, { borderTopColor: C.border }]}>
                    <View style={s.expandedRow}>
                      <View style={s.expandedItem}>
                        <Text style={[s.expandedLbl, { color: C.textSecondary }]}>Sotuv narxi</Text>
                        <Text style={[s.expandedVal, { color: "#059669" }]}>{fmt(p.pricePerUnit)}</Text>
                      </View>
                      <View style={s.expandedItem}>
                        <Text style={[s.expandedLbl, { color: C.textSecondary }]}>Xarid narxi</Text>
                        <Text style={[s.expandedVal, { color: C.primary }]}>{fmt(p.buyingPrice)}</Text>
                      </View>
                      <View style={s.expandedItem}>
                        <Text style={[s.expandedLbl, { color: C.textSecondary }]}>Minimal</Text>
                        <Text style={[s.expandedVal, { color: C.text }]}>{p.minStock} {p.unit}</Text>
                      </View>
                    </View>
                    {p.buyingPrice > 0 && p.pricePerUnit > 0 && (
                      <View style={[s.marginBox, { backgroundColor: C.surface }]}>
                        <Feather name="trending-up" size={13} color={C.primary} />
                        <Text style={[s.marginTxt, { color: C.text }]}>
                          Foyda: <Text style={{ color: C.primary, fontFamily: "Inter_700Bold" }}>{fmt(p.pricePerUnit - p.buyingPrice)}</Text>
                          {"  "}
                          <Text style={{ color: C.textSecondary }}>
                            ({Math.round(((p.pricePerUnit - p.buyingPrice) / p.pricePerUnit) * 100)}%)
                          </Text>
                        </Text>
                      </View>
                    )}
                    {p.description ? (
                      <Text style={[s.desc, { color: C.textSecondary }]}>{p.description}</Text>
                    ) : null}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  scanBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  catChipTxt: { fontSize: 13, fontFamily: "Inter_500Medium" },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardMain: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  catBadge: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  catTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  catTagTxt: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  metaTxt: { fontSize: 11, fontFamily: "Inter_400Regular" },
  price: { fontSize: 14, fontFamily: "Inter_700Bold" },
  priceUnit: { fontSize: 10, fontFamily: "Inter_400Regular" },
  stockRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingBottom: 12,
  },
  stockBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  stockBadgeTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  barcodeSmall: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  expanded: { borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 10 },
  expandedRow: { flexDirection: "row", gap: 16 },
  expandedItem: { gap: 2 },
  expandedLbl: { fontSize: 10, fontFamily: "Inter_400Regular" },
  expandedVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  marginBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 10 },
  marginTxt: { fontSize: 13, fontFamily: "Inter_400Regular" },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  empty: { flex: 1, alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTxt: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
