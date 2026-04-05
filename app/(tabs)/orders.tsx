import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { apiReq } from "@/lib/api";

interface Order {
  id: number;
  orderNumber: string;
  clientName: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Yangi",
  measuring: "O'lchov",
  production: "Ishlab chiqarish",
  ready: "Tayyor",
  installing: "O'rnatish",
  completed: "Bajarildi",
  cancelled: "Bekor qilindi",
};

const STATUS_COLORS: Record<string, string> = {
  new: "#3B82F6",
  measuring: "#8B5CF6",
  production: "#F59E0B",
  ready: "#10B981",
  installing: "#06B6D4",
  completed: "#22C55E",
  cancelled: "#EF4444",
};

const FILTER_STATUSES = [
  { key: "", label: "Barchasi" },
  { key: "new", label: "Yangi" },
  { key: "measuring", label: "O'lchov" },
  { key: "production", label: "Ishlab chiqarish" },
  { key: "ready", label: "Tayyor" },
  { key: "installing", label: "O'rnatish" },
  { key: "completed", label: "Bajarildi" },
];

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(amount)) + " so'm";
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const C = Colors.light;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const params: Record<string, string | number | undefined> = {};
  if (statusFilter) params.status = statusFilter;
  if (user?.role === "measurer" && user.id) params.assignedTo = user.id;
  if (user?.branchId) params.branchId = user.branchId;

  const { data: orders, isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["orders", params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params.status) qs.set("status", String(params.status));
      if (params.assignedTo) qs.set("assignedTo", String(params.assignedTo));
      if (params.branchId) qs.set("branchId", String(params.branchId));
      const q = qs.toString() ? `?${qs.toString()}` : "";
      return apiReq<Order[]>(`/orders${q}`);
    },
    retry: false,
  });

  const filtered = (orders || []).filter(o =>
    search
      ? o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
        o.clientName.toLowerCase().includes(search.toLowerCase())
      : true
  );

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <Text style={[styles.title, { color: C.text }]}>Buyurtmalar</Text>
        <View style={[styles.searchBar, { backgroundColor: C.card, borderColor: C.border }]}>
          <Feather name="search" size={16} color={C.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: C.text, fontFamily: "Inter_400Regular" }]}
            placeholder="Qidirish..."
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
      </View>

      <FlatList
        horizontal
        data={FILTER_STATUSES}
        keyExtractor={i => i.key}
        contentContainerStyle={styles.filters}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              { borderColor: C.border, backgroundColor: statusFilter === item.key ? C.primary : C.card },
            ]}
            onPress={() => setStatusFilter(item.key)}
          >
            <Text style={[
              styles.filterText,
              { color: statusFilter === item.key ? "#fff" : C.textSecondary }
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {isLoading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 90 : 100) }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!filtered.length}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={40} color={C.textSecondary} />
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>Buyurtmalar topilmadi</Text>
            </View>
          }
          renderItem={({ item: order }) => (
            <TouchableOpacity
              style={[styles.orderCard, { backgroundColor: C.card, borderColor: C.border }]}
              activeOpacity={0.75}
            >
              <View style={styles.orderTop}>
                <Text style={[styles.orderNum, { color: C.text }]}>{order.orderNumber}</Text>
                <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[order.status] || "#64748B") + "20" }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[order.status] || "#64748B" }]}>
                    {STATUS_LABELS[order.status] || order.status}
                  </Text>
                </View>
              </View>

              <View style={styles.row}>
                <Feather name="user" size={13} color={C.textSecondary} />
                <Text style={[styles.clientName, { color: C.textSecondary }]}>{order.clientName}</Text>
              </View>

              <View style={styles.orderBottom}>
                <View style={styles.row}>
                  <Feather name="calendar" size={13} color={C.textSecondary} />
                  <Text style={[styles.dateText, { color: C.textSecondary }]}>{formatDate(order.createdAt)}</Text>
                </View>
                <Text style={[styles.amount, { color: C.primary }]}>{formatMoney(order.totalAmount)}</Text>
              </View>

              {order.paidAmount < order.totalAmount && (
                <View style={[styles.debtBanner, { backgroundColor: "#FEF2F2" }]}>
                  <Feather name="alert-circle" size={12} color="#EF4444" />
                  <Text style={[styles.debtText, { color: "#DC2626" }]}>
                    Qarz: {formatMoney(order.totalAmount - order.paidAmount)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, height: 44 },
  filters: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  list: { paddingHorizontal: 20, gap: 12 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  orderCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  orderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderNum: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  clientName: { fontSize: 13, fontFamily: "Inter_400Regular" },
  orderBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  amount: { fontSize: 17, fontFamily: "Inter_700Bold" },
  debtBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  debtText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
