import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";

const C = Colors.light;

type Priority = "high" | "medium" | "low";
type NotifType = "overdue" | "upcoming" | "debt" | "stock";

interface NotifItem {
  type: NotifType;
  priority: Priority;
  title: string;
  body: string;
}

const TYPE_CONFIG: Record<NotifType, { icon: string; bg: string; text: string }> = {
  overdue:  { icon: "alert-circle",   bg: "#FEE2E2", text: "#DC2626" },
  upcoming: { icon: "clock",          bg: "#FEF3C7", text: "#D97706" },
  debt:     { icon: "credit-card",    bg: "#EDE9FE", text: "#7C3AED" },
  stock:    { icon: "package",        bg: "#DBEAFE", text: "#2563EB" },
};

const TYPE_LABEL: Record<NotifType, string> = {
  overdue:  "Muddati o'tgan",
  upcoming: "Yaqin muddat",
  debt:     "Qarz eslatma",
  stock:    "Kam qoldiq",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  high:   "Yuqori",
  medium: "O'rta",
  low:    "Past",
};

export default function XabarnomalarScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotifType | "all">("all");

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  const { data: items = [], isLoading } = useQuery<NotifItem[]>({
    queryKey: ["notifications"],
    queryFn: () => apiReq("/notifications"),
    refetchInterval: 60000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["notifications"] });
    setRefreshing(false);
  }, [qc]);

  const filtered = filter === "all" ? items : items.filter(i => i.type === filter);
  const highCount = items.filter(i => i.priority === "high").length;

  const FILTERS: { key: NotifType | "all"; label: string }[] = [
    { key: "all",      label: `Barchasi (${items.length})` },
    { key: "overdue",  label: "Muddati o'tgan" },
    { key: "upcoming", label: "Yaqin muddat" },
    { key: "debt",     label: "Qarz" },
    { key: "stock",    label: "Ombor" },
  ];

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: topPadding + 12 }]}>
        <Text style={s.title}>Xabarnomalar</Text>
        {highCount > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{highCount} muhim</Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterBar}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[s.chip, filter === f.key && s.chipActive]}
          >
            <Text style={[s.chipTxt, filter === f.key && s.chipTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {isLoading && (
          <View style={s.center}>
            <ActivityIndicator color={C.primary} />
            <Text style={s.loadTxt}>Yuklanmoqda...</Text>
          </View>
        )}

        {!isLoading && filtered.length === 0 && (
          <View style={s.center}>
            <Feather name="bell-off" size={48} color={C.textSecondary} />
            <Text style={s.emptyTxt}>Xabarnomalar yo'q</Text>
            <Text style={s.emptySubTxt}>Hamma narsa tartibda!</Text>
          </View>
        )}

        {filtered.map((item, idx) => {
          const cfg = TYPE_CONFIG[item.type];
          return (
            <View key={idx} style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[s.iconBox, { backgroundColor: cfg.bg }]}>
                <Feather name={cfg.icon as any} size={20} color={cfg.text} />
              </View>
              <View style={s.cardContent}>
                <View style={s.cardTop}>
                  <Text style={[s.typeLabel, { color: cfg.text }]}>{TYPE_LABEL[item.type]}</Text>
                  <View style={[s.priorityBadge, { backgroundColor: item.priority === "high" ? "#FEE2E2" : item.priority === "medium" ? "#FEF3C7" : "#F0FDF4" }]}>
                    <Text style={[s.priorityTxt, { color: item.priority === "high" ? "#DC2626" : item.priority === "medium" ? "#D97706" : "#16A34A" }]}>
                      {PRIORITY_LABEL[item.priority]}
                    </Text>
                  </View>
                </View>
                <Text style={[s.cardTitle, { color: C.text }]}>{item.title}</Text>
                <Text style={[s.cardBody, { color: C.textSecondary }]}>{item.body}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: C.text, flex: 1 },
  badge: { backgroundColor: "#FEE2E2", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#DC2626" },
  filterBar: { maxHeight: 48, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F1F5F9", height: 36 },
  chipActive: { backgroundColor: C.primary },
  chipTxt: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  chipTxtActive: { color: "#fff" },
  card: { flexDirection: "row", padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1, gap: 4 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  priorityBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  priorityTxt: { fontSize: 11, fontFamily: "Inter_500Medium" },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardBody: { fontSize: 13, fontFamily: "Inter_400Regular" },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  loadTxt: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  emptyTxt: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  emptySubTxt: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary },
});
