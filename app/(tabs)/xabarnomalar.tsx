import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const DEBT_SMS_TEXT = "Hurmatli mijoz, sizda parda xaridi bo'yicha qarzdorlik mavjud.\nTo'lovni imkon qadar tezroq amalga oshirishingizni so'raymiz.\nDo'kon: AL AMIN PARDALAR UYI\nTel: +998911741424";

const SCHEDULER_KEY = "last_scheduler_date";

export default function XabarnomalarScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotifType | "all">("all");
  const [smsSending, setSmsSending] = useState(false);
  const [schedulerResult, setSchedulerResult] = useState<string | null>(null);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  const { data: items = [], isLoading } = useQuery<NotifItem[]>({
    queryKey: ["notifications"],
    queryFn: () => apiReq("/notifications"),
    refetchInterval: 60000,
  });

  // ─── Avtomatik scheduler: kun bir marta ishga tushadi ────────────────────
  useEffect(() => {
    async function runSchedulerIfNeeded() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const lastRun = await AsyncStorage.getItem(SCHEDULER_KEY);
        if (lastRun === today) return;

        const res: any = await apiReq("/notifications/scheduler/check", { method: "POST", body: JSON.stringify({ message: DEBT_SMS_TEXT }) }).catch(() => null);
        if (res?.sent > 0) {
          setSchedulerResult(`Bugun ${res.sent} ta mijozga qarz eslatmasi SMS yuborildi`);
        }
        await AsyncStorage.setItem(SCHEDULER_KEY, today);
      } catch {}
    }
    runSchedulerIfNeeded();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["notifications"] });
    setRefreshing(false);
  }, [qc]);

  async function sendDebtSms() {
    setSmsSending(true);
    try {
      const res: any = await apiReq("/notifications/send-debt-alerts", { method: "POST", body: JSON.stringify({ message: DEBT_SMS_TEXT }) });
      if (res.warning) {
        Alert.alert("⚠️ SMS sozlanmagan", res.warning + "\n\nSuper Admin > SMS Sozlamalar bo'limidan Eskiz login va parolini kiriting.");
      } else if (res.success) {
        Alert.alert("✅ SMS yuborildi!", `${res.sent} ta mijozga qarz eslatmasi yuborildi`);
      } else {
        Alert.alert("SMS haqida", res.message || res.error || "Noma'lum xato");
      }
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setSmsSending(false); }
  }

  const filtered = filter === "all" ? items : items.filter(i => i.type === filter);
  const highCount = items.filter(i => i.priority === "high").length;
  const overdueCount = items.filter(i => i.type === "overdue").length;

  const FILTERS: { key: NotifType | "all"; label: string }[] = [
    { key: "all",      label: `Barchasi (${items.length})` },
    { key: "overdue",  label: `Muddati o'tgan (${overdueCount})` },
    { key: "upcoming", label: "Yaqin muddat" },
    { key: "debt",     label: "Qarz" },
    { key: "stock",    label: "Ombor" },
  ];

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: topPadding + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Xabarnomalar</Text>
          {highCount > 0 && (
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#DC2626" }}>
              {highCount} ta muddati o'tgan qarz
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[s.smsBtn, smsSending && { opacity: 0.6 }]}
          onPress={sendDebtSms}
          disabled={smsSending}
        >
          {smsSending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="send" size={14} color="#fff" />
              <Text style={s.smsBtnTxt}>Qarz SMS</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Scheduler result notification */}
      {schedulerResult ? (
        <View style={[s.schedulerBanner, { backgroundColor: "#F0FDF4" }]}>
          <Feather name="check-circle" size={14} color="#16A34A" />
          <Text style={[s.schedulerTxt, { color: "#16A34A" }]}>{schedulerResult}</Text>
          <TouchableOpacity onPress={() => setSchedulerResult(null)}>
            <Feather name="x" size={14} color="#16A34A" />
          </TouchableOpacity>
        </View>
      ) : null}

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

        {/* Info about auto SMS */}
        {items.length > 0 && (
          <View style={[s.infoBanner, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Feather name="info" size={14} color={C.textSecondary} />
            <Text style={[s.infoTxt, { color: C.textSecondary }]}>
              "Qarz SMS" tugmasi orqali muddati o'tgan va bugungi qarzlar uchun avtomatik SMS yuboriladi.
              SMS yuborish uchun Super Admin &gt; SMS Sozlamalar bo'limidan Eskiz sozlamalarini kiriting.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: C.text },
  smsBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#DC2626", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  smsBtnTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  schedulerBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10 },
  schedulerTxt: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
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
  infoBanner: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  infoTxt: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
