import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Platform } from "react-native";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";

const C = Colors.light;

interface Product {
  id: number;
  name: string;
  category: string;
  pricePerUnit: number;
  stock: number;
  minStock: number;
  unit: string;
  rang: string | null;
  material: string | null;
  barcode: string | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0)) + " so'm";
}

function urgencyLevel(p: Product): "critical" | "warning" | "ok" {
  if (p.stock <= 0) return "critical";
  if (p.stock <= p.minStock * 0.5) return "critical";
  if (p.stock <= p.minStock) return "warning";
  return "ok";
}

const URGENCY = {
  critical: { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626", label: "Tugagan", icon: "alert-circle" as const },
  warning: { bg: "#FFFBEB", border: "#FDE68A", text: "#D97706", label: "Kam qoldi", icon: "alert-triangle" as const },
  ok: { bg: "#F0FDF4", border: "#BBF7D0", text: "#059669", label: "Yetarli", icon: "check-circle" as const },
};

export default function LowStockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "critical" | "warning">("all");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: products = [], isLoading, refetch } = useQuery<Product[]>({
    queryKey: ["products-all"],
    queryFn: () => apiReq("/products"),
    select: (data: any) => {
      const list: Product[] = data.products || data || [];
      return list.filter(p => p.stock <= p.minStock || p.stock <= 0);
    },
  });

  async function onRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.category || "").toLowerCase().includes(search.toLowerCase());
    const level = urgencyLevel(p);
    const matchFilter = filter === "all" || filter === level;
    return matchSearch && matchFilter;
  });

  const criticalCount = products.filter(p => urgencyLevel(p) === "critical").length;
  const warningCount = products.filter(p => urgencyLevel(p) === "warning").length;

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: C.card }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: C.text }]}>Kam qoldiq</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>{products.length} ta mahsulot diqqat talab qiladi</Text>
        </View>
      </View>

      {/* Summary pills */}
      <View style={s.pills}>
        <TouchableOpacity style={[s.pill, filter === "all" && { backgroundColor: C.primary }]} onPress={() => setFilter("all")}>
          <Text style={[s.pillTxt, { color: filter === "all" ? "#fff" : C.textSecondary }]}>Hammasi ({products.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.pill, filter === "critical" && { backgroundColor: "#DC2626" }]} onPress={() => setFilter("critical")}>
          <Feather name="alert-circle" size={12} color={filter === "critical" ? "#fff" : "#DC2626"} />
          <Text style={[s.pillTxt, { color: filter === "critical" ? "#fff" : "#DC2626" }]}>Tugagan ({criticalCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.pill, filter === "warning" && { backgroundColor: "#D97706" }]} onPress={() => setFilter("warning")}>
          <Feather name="alert-triangle" size={12} color={filter === "warning" ? "#fff" : "#D97706"} />
          <Text style={[s.pillTxt, { color: filter === "warning" ? "#fff" : "#D97706" }]}>Kam qoldi ({warningCount})</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[s.searchRow, { backgroundColor: C.card, borderColor: C.border }]}>
        <Feather name="search" size={16} color={C.textSecondary} />
        <TextInput
          style={[s.searchInput, { color: C.text }]}
          placeholder="Mahsulot qidirish..."
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
              <Feather name="check-circle" size={48} color="#10B981" />
              <Text style={[s.emptyTitle, { color: C.text }]}>Omboringiz to'la!</Text>
              <Text style={[s.emptyDesc, { color: C.textSecondary }]}>Barcha mahsulotlar minimal qoldiqdan yuqori</Text>
            </View>
          }
          renderItem={({ item: p }) => {
            const level = urgencyLevel(p);
            const u = URGENCY[level];
            const pct = p.minStock > 0 ? Math.min(100, (p.stock / p.minStock) * 100) : 0;
            return (
              <View style={[s.card, { backgroundColor: C.card, borderColor: C.border, borderLeftColor: u.text }]}>
                <View style={s.cardTop}>
                  <View style={[s.urgencyDot, { backgroundColor: u.bg }]}>
                    <Feather name={u.icon} size={16} color={u.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.productName, { color: C.text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[s.productCat, { color: C.textSecondary }]}>
                      {p.category}{p.rang ? " · " + p.rang : ""}{p.material ? " · " + p.material : ""}
                    </Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: u.bg }]}>
                    <Text style={[s.statusBadgeTxt, { color: u.text }]}>{u.label}</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={[s.progressBg, { backgroundColor: C.surface }]}>
                  <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: u.text }]} />
                </View>

                <View style={s.cardBottom}>
                  <View style={s.stockInfo}>
                    <Text style={[s.stockLabel, { color: C.textSecondary }]}>Mavjud:</Text>
                    <Text style={[s.stockValue, { color: u.text }]}>{p.stock} {p.unit}</Text>
                  </View>
                  <View style={s.stockInfo}>
                    <Text style={[s.stockLabel, { color: C.textSecondary }]}>Minimal:</Text>
                    <Text style={[s.stockValue, { color: C.text }]}>{p.minStock} {p.unit}</Text>
                  </View>
                  <View style={s.stockInfo}>
                    <Text style={[s.stockLabel, { color: C.textSecondary }]}>Narx:</Text>
                    <Text style={[s.stockValue, { color: C.text }]}>{fmt(p.pricePerUnit)}</Text>
                  </View>
                </View>

                {p.barcode && (
                  <Text style={[s.barcode, { color: C.textSecondary }]}>
                    <Feather name="bar-chart-2" size={11} color={C.textSecondary} /> {p.barcode}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  pills: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  pillTxt: { fontSize: 12, fontFamily: "Inter_500Medium" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  card: {
    borderRadius: 14, borderWidth: 1, borderLeftWidth: 4, padding: 14, gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  urgencyDot: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  productCat: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  progressBg: { height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 3 },
  cardBottom: { flexDirection: "row", gap: 16 },
  stockInfo: { gap: 1 },
  stockLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  stockValue: { fontSize: 13, fontFamily: "Inter_700Bold" },
  barcode: { fontSize: 11, fontFamily: "Inter_400Regular" },
  empty: { flex: 1, alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
