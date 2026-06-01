import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform, Modal,
  Pressable, Alert, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { erpApiReq, InstagramLead, LeadStats } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { fmtDateTime } from "../../lib/date-utils";

const C = Colors.light;

type StatusFilter = "barchasi" | "yangi" | "bog'lanildi" | "deal" | "bekor";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  yangi:        { label: "Yangi",        color: "#3B82F6", bg: "#EFF6FF",  icon: "star" },
  "bog'lanildi":{ label: "Bog'lanildi",  color: "#F59E0B", bg: "#FFFBEB",  icon: "phone-call" },
  deal:         { label: "Deal",         color: "#10B981", bg: "#ECFDF5",  icon: "check-circle" },
  bekor:        { label: "Bekor",        color: "#EF4444", bg: "#FEF2F2",  icon: "x-circle" },
};

export default function LidlarScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const [filter, setFilter] = useState<StatusFilter>("barchasi");
  const [selected, setSelected] = useState<InstagramLead | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["instagram-leads", filter],
    queryFn: () => {
      const qs = filter !== "barchasi" ? `?status=${filter}` : "";
      return erpApiReq<{ leads: InstagramLead[]; total: number }>(`/erp/leads${qs}`);
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["instagram-leads-stats"],
    queryFn: () => erpApiReq<LeadStats>("/erp/leads/stats"),
  });

  const leads = leadsData?.leads ?? [];

  const claimMut = useMutation({
    mutationFn: (id: number) =>
      erpApiReq(`/erp/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ assigned_to: user?.id }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instagram-leads"] });
      qc.invalidateQueries({ queryKey: ["instagram-leads-stats"] });
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      erpApiReq(`/erp/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instagram-leads"] });
      qc.invalidateQueries({ queryKey: ["instagram-leads-stats"] });
      setSelected(null);
    },
  });

  const toDealMut = useMutation({
    mutationFn: (id: number) =>
      erpApiReq(`/erp/leads/${id}/to-deal`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instagram-leads"] });
      qc.invalidateQueries({ queryKey: ["instagram-leads-stats"] });
      setSelected(null);
      Alert.alert("Tayyor", "Lid deal'ga aylantildi");
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["instagram-leads"] }),
      qc.invalidateQueries({ queryKey: ["instagram-leads-stats"] }),
    ]);
    setRefreshing(false);
  };

  const filters: { key: StatusFilter; label: string; count?: number }[] = [
    { key: "barchasi", label: "Barchasi", count: stats?.jami },
    { key: "yangi", label: "Yangi", count: stats?.yangi },
    { key: "bog'lanildi", label: "Bog'lanildi", count: stats?.boglanildi },
    { key: "deal", label: "Deal", count: stats?.deal },
    { key: "bekor", label: "Bekor", count: stats?.bekor },
  ];

  const renderLead = ({ item }: { item: InstagramLead }) => {
    const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.yangi;
    return (
      <TouchableOpacity
        style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}
        activeOpacity={0.7}
        onPress={() => setSelected(item)}
      >
        <View style={[st.cardIcon, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon as any} size={18} color={cfg.color} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[st.cardName, { color: C.text }]} numberOfLines={1}>{item.ism}</Text>
          <Text style={[st.cardSub, { color: C.textSecondary }]} numberOfLines={1}>
            {item.telefon} {item.xizmat_turi ? `• ${item.xizmat_turi}` : ""}
          </Text>
          {item.assigned_name && (
            <Text style={[st.cardSub, { color: "#8B5CF6" }]}>
              <Feather name="user" size={10} color="#8B5CF6" /> {item.assigned_name}
            </Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={[st.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[st.badgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={[st.cardSub, { color: C.textSecondary, fontSize: 10 }]}>
            {fmtDateTime(item.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[st.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 12 }]}>
        <Text style={[st.headerTitle, { color: C.text }]}>Instagram Lidlar</Text>
        {stats && (
          <View style={st.statsRow}>
            <View style={[st.statChip, { backgroundColor: "#EFF6FF" }]}>
              <Text style={[st.statNum, { color: "#3B82F6" }]}>{stats.bugun}</Text>
              <Text style={[st.statLabel, { color: "#3B82F6" }]}>bugun</Text>
            </View>
            <View style={[st.statChip, { backgroundColor: "#ECFDF5" }]}>
              <Text style={[st.statNum, { color: "#10B981" }]}>{stats.hafta}</Text>
              <Text style={[st.statLabel, { color: "#10B981" }]}>hafta</Text>
            </View>
            <View style={[st.statChip, { backgroundColor: "#FFFBEB" }]}>
              <Text style={[st.statNum, { color: "#F59E0B" }]}>{stats.yangi}</Text>
              <Text style={[st.statLabel, { color: "#F59E0B" }]}>kutmoqda</Text>
            </View>
          </View>
        )}
      </View>

      {/* Filters */}
      <View style={st.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filters}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          keyExtractor={f => f.key}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[st.filterBtn, filter === f.key && st.filterActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[st.filterTxt, filter === f.key && st.filterTxtActive]}>
                {f.label} {f.count != null ? `(${f.count})` : ""}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* List */}
      {isLoading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={l => String(l.id)}
          renderItem={renderLead}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={st.emptyBox}>
              <Feather name="instagram" size={40} color={C.textSecondary} />
              <Text style={[st.emptyTxt, { color: C.textSecondary }]}>Lidlar yo'q</Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={st.overlay} onPress={() => setSelected(null)} />
        <View style={[st.modal, { backgroundColor: C.card, paddingBottom: insets.bottom + 20 }]}>
          {selected && <LeadDetail
            lead={selected}
            userId={user?.id}
            onClose={() => setSelected(null)}
            onClaim={() => claimMut.mutate(selected.id)}
            onStatus={(s) => statusMut.mutate({ id: selected.id, status: s })}
            onToDeal={() => {
              Alert.alert(
                "Dealga aylantirish",
                `${selected.ism} ni deal'ga aylantirasizmi?`,
                [
                  { text: "Bekor", style: "cancel" },
                  { text: "Ha", onPress: () => toDealMut.mutate(selected.id) },
                ]
              );
            }}
            loading={claimMut.isPending || statusMut.isPending || toDealMut.isPending}
          />}
        </View>
      </Modal>
    </View>
  );
}

function LeadDetail({ lead, userId, onClose, onClaim, onStatus, onToDeal, loading }: {
  lead: InstagramLead;
  userId?: number;
  onClose: () => void;
  onClaim: () => void;
  onStatus: (s: string) => void;
  onToDeal: () => void;
  loading: boolean;
}) {
  const cfg = STATUS_CFG[lead.status] ?? STATUS_CFG.yangi;
  const isMine = lead.assigned_to === userId;
  const isNew = lead.status === "yangi";

  return (
    <View style={{ gap: 16 }}>
      <View style={st.modalHeader}>
        <Text style={[st.modalTitle, { color: C.text }]}>Lid tafsilotlari</Text>
        <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={C.textSecondary} /></TouchableOpacity>
      </View>

      <View style={[st.detailCard, { borderColor: C.border }]}>
        <DetailRow icon="user" label="Ism" value={lead.ism} />
        <DetailRow icon="phone" label="Telefon" value={lead.telefon} onPress={() => Linking.openURL(`tel:${lead.telefon}`)} />
        {lead.manzil && <DetailRow icon="map-pin" label="Manzil" value={lead.manzil} />}
        {lead.xizmat_turi && <DetailRow icon="tag" label="Xizmat turi" value={lead.xizmat_turi} />}
        {lead.izoh && <DetailRow icon="message-circle" label="Izoh" value={lead.izoh} />}
        <DetailRow icon="clock" label="Yaratilgan" value={fmtDateTime(lead.created_at)} />
        <View style={st.detailRow}>
          <Feather name="flag" size={14} color={cfg.color} />
          <Text style={[st.detailLabel, { color: C.textSecondary }]}>Holat</Text>
          <View style={[st.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[st.badgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        {lead.assigned_name && (
          <DetailRow icon="user-check" label="Mas'ul" value={lead.assigned_name} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} />
      ) : (
        <View style={{ gap: 8 }}>
          {!lead.assigned_to && (
            <TouchableOpacity style={[st.actionBtn, { backgroundColor: "#4F46E5" }]} onPress={onClaim}>
              <Feather name="user-plus" size={16} color="#fff" />
              <Text style={st.actionBtnTxt}>Olish (men mas'ulman)</Text>
            </TouchableOpacity>
          )}
          {isNew && (
            <TouchableOpacity style={[st.actionBtn, { backgroundColor: "#F59E0B" }]} onPress={() => onStatus("bog'lanildi")}>
              <Feather name="phone-call" size={16} color="#fff" />
              <Text style={st.actionBtnTxt}>Bog'lanildi</Text>
            </TouchableOpacity>
          )}
          {lead.status !== "deal" && lead.status !== "bekor" && (
            <TouchableOpacity style={[st.actionBtn, { backgroundColor: "#10B981" }]} onPress={onToDeal}>
              <Feather name="check-circle" size={16} color="#fff" />
              <Text style={st.actionBtnTxt}>Dealga aylantirish</Text>
            </TouchableOpacity>
          )}
          {lead.status !== "bekor" && lead.status !== "deal" && (
            <TouchableOpacity style={[st.actionBtn, { backgroundColor: "#EF4444" }]} onPress={() => onStatus("bekor")}>
              <Feather name="x-circle" size={16} color="#fff" />
              <Text style={st.actionBtnTxt}>Bekor qilish</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function DetailRow({ icon, label, value, onPress }: { icon: string; label: string; value: string; onPress?: () => void }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={st.detailRow} onPress={onPress} activeOpacity={0.6}>
      <Feather name={icon as any} size={14} color={C.textSecondary} />
      <Text style={[st.detailLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[st.detailValue, { color: onPress ? "#4F46E5" : C.text }]} numberOfLines={2}>{value}</Text>
    </Wrapper>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: C.card },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  statChip: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center" },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2 },
  filterRow: { paddingVertical: 8, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.background },
  filterActive: { backgroundColor: "#4F46E5" },
  filterTxt: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  filterTxtActive: { color: "#fff" },
  card: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  emptyBox: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 10 },
  emptyTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  detailCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailLabel: { fontSize: 12, fontFamily: "Inter_500Medium", width: 80 },
  detailValue: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, padding: 14 },
  actionBtnTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
