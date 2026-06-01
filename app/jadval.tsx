import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Linking,
  RefreshControl, StyleSheet, Platform, Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { getApiUrl } from "@/lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fmtDate as fmtDateUtil, fmtNum } from "../lib/date-utils";

interface Deal {
  id: number;
  mijozIsm: string | null;
  mijozPhone: string | null;
  manzil: string | null;
  status: string;
  effectiveDate: string | null;
  ornatishSanasi: string | null;
  tayyorBolishKuni: string | null;
  installerName: string | null;
  ornatishTuri: string | null;
  ornatishNarx: number;
  totalNarx: number;
  ornatishIzoh: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  yangi:        { label: "Yangi",         color: "#3b82f6", bg: "#eff6ff" },
  tikuvda:      { label: "Tikuvda",       color: "#7c3aed", bg: "#f5f3ff" },
  tayyor:       { label: "Tayyor",        color: "#059669", bg: "#ecfdf5" },
  ornatilmoqda: { label: "O'rnatilmoqda", color: "#d97706", bg: "#fffbeb" },
  yopildi:      { label: "Yopildi ✓",    color: "#16a34a", bg: "#f0fdf4" },
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return fmtDateUtil(d, { month: "long" });
}
function formatTime(d: string | null) {
  if (!d) return "";
  const date = new Date(d);
  const h = date.getHours(), m = date.getMinutes();
  if (h === 0 && m === 0) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function formatMoney(n: number) {
  return fmtNum(Math.round(n)) + " so'm";
}
function isToday(d: string | null) {
  if (!d) return false;
  return new Date(d).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
}
function isTomorrow(d: string | null) {
  if (!d) return false;
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  return new Date(d).toISOString().slice(0, 10) === tom.toISOString().slice(0, 10);
}

function openNavigation(address: string, app: "yandex" | "google") {
  const encoded = encodeURIComponent(address);
  const url = app === "yandex"
    ? `https://maps.yandex.com/?text=${encoded}`
    : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  Linking.openURL(url).catch(() => {
    Alert.alert("Xato", "Xaritani ochib bo'lmadi");
  });
}
function callPhone(phone: string) {
  Linking.openURL(`tel:${phone}`).catch(() => {
    Alert.alert("Xato", "Qo'ng'iroq qilib bo'lmadi");
  });
}

export default function JadvalScreen() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"today" | "tomorrow" | "all">("today");

  const loadDeals = async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const now = new Date();
      const from = now.toISOString().slice(0, 10);
      const to7 = new Date(now);
      to7.setDate(to7.getDate() + 14);
      const to = to7.toISOString().slice(0, 10);
      const url = `${getApiUrl()}/api/installer/schedule?from=${from}&to=${to}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("API xato");
      const data = await res.json();
      setDeals(Array.isArray(data) ? data : []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDeals();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDeals();
  };

  const markDone = async (deal: Deal) => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      await fetch(`${getApiUrl()}/api/installer/schedule/${deal.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "yopildi" }),
      });
      loadDeals();
    } catch (e) {
      Alert.alert("Xato", "Holat o'zgartirib bo'lmadi");
    }
  };

  const filtered = deals.filter(d => {
    if (filter === "today") return isToday(d.effectiveDate);
    if (filter === "tomorrow") return isTomorrow(d.effectiveDate);
    return true;
  });

  const todayCount = deals.filter(d => isToday(d.effectiveDate)).length;
  const tomorrowCount = deals.filter(d => isTomorrow(d.effectiveDate)).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>O'rnatish jadvali</Text>
        <Text style={styles.headerSub}>Yaqin 2 hafta</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {[
          { key: "today", label: "Bugun", count: todayCount },
          { key: "tomorrow", label: "Ertaga", count: tomorrowCount },
          { key: "all", label: "Hammasi", count: deals.length },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => setFilter(tab.key as any)}
          >
            <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.filterBadge, filter === tab.key && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, filter === tab.key && styles.filterBadgeTextActive]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Yuklanmoqda...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color="#e2e8f0" />
            <Text style={styles.emptyTitle}>
              {filter === "today" ? "Bugun o'rnatish yo'q" :
               filter === "tomorrow" ? "Ertaga o'rnatish yo'q" : "Jadvaling bo'sh"}
            </Text>
            <Text style={styles.emptySubtitle}>Admin panel orqali buyurtmalar tayinlanadi</Text>
          </View>
        ) : (
          <View style={styles.cards}>
            {filtered.map((deal) => {
              const st = STATUS_LABELS[deal.status] || STATUS_LABELS.yangi;
              const isDone = deal.status === "yopildi";
              const isUrgent = deal.status === "ornatilmoqda";
              const time = formatTime(deal.effectiveDate);

              return (
                <View
                  key={deal.id}
                  style={[
                    styles.card,
                    isDone && styles.cardDone,
                    isUrgent && styles.cardUrgent,
                  ]}
                >
                  {/* Header row */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.color + "40" }]}>
                        <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                      </View>
                      {isUrgent && isToday(deal.effectiveDate) && (
                        <View style={styles.urgentBadge}>
                          <Text style={styles.urgentText}>⚡ Bugun</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.dateChip}>
                      {time ? (
                        <Text style={styles.dateChipText}>{time}</Text>
                      ) : (
                        <Text style={styles.dateChipText}>{formatDate(deal.effectiveDate)}</Text>
                      )}
                    </View>
                  </View>

                  {/* Client name */}
                  <Text style={styles.clientName}>{deal.mijozIsm || "Noma'lum mijoz"}</Text>

                  {/* Info rows */}
                  {deal.manzil && (
                    <View style={styles.infoRow}>
                      <Ionicons name="location-outline" size={15} color="#94a3b8" />
                      <Text style={styles.infoText} numberOfLines={2}>{deal.manzil}</Text>
                    </View>
                  )}
                  {deal.mijozPhone && (
                    <View style={styles.infoRow}>
                      <Ionicons name="call-outline" size={15} color="#94a3b8" />
                      <TouchableOpacity onPress={() => callPhone(deal.mijozPhone!)}>
                        <Text style={[styles.infoText, styles.phoneText]}>{deal.mijozPhone}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {deal.installerName && (
                    <View style={styles.infoRow}>
                      <Ionicons name="person-outline" size={15} color="#94a3b8" />
                      <Text style={styles.infoText}>{deal.installerName}</Text>
                    </View>
                  )}
                  {deal.ornatishIzoh && (
                    <View style={styles.infoRow}>
                      <Ionicons name="document-text-outline" size={15} color="#94a3b8" />
                      <Text style={[styles.infoText, styles.noteText]}>{deal.ornatishIzoh}</Text>
                    </View>
                  )}

                  {/* Price */}
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Buyurtma:</Text>
                    <Text style={styles.priceValue}>{formatMoney(deal.totalNarx)}</Text>
                    {deal.ornatishNarx > 0 && (
                      <>
                        <Text style={styles.priceSep}>·</Text>
                        <Text style={styles.priceLabel}>O'rnatish:</Text>
                        <Text style={styles.priceValue}>{formatMoney(deal.ornatishNarx)}</Text>
                      </>
                    )}
                  </View>

                  {/* Action buttons */}
                  {deal.manzil && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.yandexBtn]}
                        onPress={() => openNavigation(deal.manzil!, "yandex")}
                      >
                        <Ionicons name="navigate" size={15} color="#fff" />
                        <Text style={styles.actionBtnText}>Yandex</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.googleBtn]}
                        onPress={() => openNavigation(deal.manzil!, "google")}
                      >
                        <Ionicons name="navigate" size={15} color="#fff" />
                        <Text style={styles.actionBtnText}>Google</Text>
                      </TouchableOpacity>
                      {!isDone && (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.doneBtn]}
                          onPress={() =>
                            Alert.alert(
                              "Tasdiqlash",
                              "O'rnatish tugallandimi?",
                              [
                                { text: "Yo'q", style: "cancel" },
                                { text: "Ha, tugadi ✓", onPress: () => markDone(deal) },
                              ]
                            )
                          }
                        >
                          <Ionicons name="checkmark-circle" size={15} color="#fff" />
                          <Text style={styles.actionBtnText}>Tugadi</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  headerSub: { fontSize: 13, color: "#94a3b8", marginTop: 2 },

  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  filterTabActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  filterTabText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  filterTabTextActive: { color: "#fff" },
  filterBadge: {
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignItems: "center",
  },
  filterBadgeActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  filterBadgeText: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  filterBadgeTextActive: { color: "#fff" },

  scroll: { flex: 1 },
  cards: { paddingHorizontal: 20, gap: 12 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardDone: { borderColor: "#bbf7d0", opacity: 0.8 },
  cardUrgent: { borderColor: "#fbbf24" },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  urgentBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fbbf2440",
  },
  urgentText: { fontSize: 11, fontWeight: "700", color: "#d97706" },
  dateChip: {
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dateChipText: { fontSize: 11, fontWeight: "600", color: "#64748b" },

  clientName: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 8 },

  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4 },
  infoText: { fontSize: 13, color: "#64748b", flex: 1, lineHeight: 18 },
  phoneText: { color: "#6366f1", fontWeight: "600" },
  noteText: { fontStyle: "italic", color: "#94a3b8" },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingTop: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    marginBottom: 10,
    flexWrap: "wrap",
  },
  priceLabel: { fontSize: 11, color: "#94a3b8" },
  priceValue: { fontSize: 12, fontWeight: "700", color: "#334155" },
  priceSep: { color: "#cbd5e1", marginHorizontal: 2 },

  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 12,
  },
  actionBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  yandexBtn: { backgroundColor: "#f59e0b" },
  googleBtn: { backgroundColor: "#3b82f6" },
  doneBtn: { backgroundColor: "#10b981" },

  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#94a3b8", textAlign: "center" },
  emptySubtitle: { fontSize: 13, color: "#cbd5e1", textAlign: "center" },
  emptyText: { fontSize: 14, color: "#94a3b8" },
});
