import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl, Modal,
  ScrollView, Alert, Linking, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import { fmtDate as fmtDateUz, fmtDateNum, fmtDayMonth, fmtNum } from "../../lib/date-utils";

const C = Colors.light;
const fmt = (n: number) => fmtNum(Math.round(n)) + " so'm";
const fmtDate = (d: string | null) =>
  d ? fmtDayMonth(new Date(d)) : null;

const STATUSES = [
  { key: "yangi", label: "🆕 Yangi", color: "#3B82F6" },
  { key: "tikuvda", label: "🧵 Tikuvda", color: "#8B5CF6" },
  { key: "tayyor", label: "✅ Tayyor", color: "#10B981" },
  { key: "ornatilmoqda", label: "🔧 O'rnatilmoqda", color: "#F59E0B" },
  { key: "yopildi", label: "🏁 Yopildi", color: "#22C55E" },
  { key: "bekor", label: "❌ Bekor", color: "#DC2626" },
];
const NEXT: Record<string, string> = { yangi: "tikuvda", tikuvda: "tayyor", tayyor: "ornatilmoqda", ornatilmoqda: "yopildi" };
const PREV: Record<string, string> = { tikuvda: "yangi", tayyor: "tikuvda", ornatilmoqda: "tayyor", yopildi: "ornatilmoqda" };

export default function KanbanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeStatus, setActiveStatus] = useState("yangi");
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [showMarshrut, setShowMarshrut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const { data: deals = [], isLoading, refetch } = useQuery({
    queryKey: ["client-deals"],
    queryFn: () => apiReq("/client-deals"),
    refetchInterval: 30000,
  });

  const filtered = (deals as any[]).filter(d => (d.status || "yangi") === activeStatus);
  const statusInfo = STATUSES.find(s => s.key === activeStatus)!;
  const counts: Record<string, number> = {};
  STATUSES.forEach(s => { counts[s.key] = (deals as any[]).filter(d => (d.status || "yangi") === s.key).length; });

  async function changeStatus(deal: any, newStatus: string) {
    setUpdatingId(deal.id);
    try {
      await apiReq(`/kanban/${deal.id}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
      qc.invalidateQueries({ queryKey: ["client-deals"] });
      if (selectedDeal?.id === deal.id) setSelectedDeal({ ...selectedDeal, status: newStatus });
    } catch { Alert.alert("Xato", "Holat o'zgarmadi"); }
    finally { setUpdatingId(null); }
  }

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View>
          <Text style={[styles.title, { color: C.text }]}>Kanban</Text>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>{(deals as any[]).length} ta bitim</Text>
        </View>
        <TouchableOpacity
          style={[styles.marshtrutBtn, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B" }]}
          onPress={() => setShowMarshrut(true)}
        >
          <Feather name="map" size={16} color="#F59E0B" />
          <Text style={[styles.marshruttText, { color: "#F59E0B" }]}>Marshrut</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={STATUSES}
        keyExtractor={s => s.key}
        contentContainerStyle={styles.tabs}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item: s }) => (
          <TouchableOpacity
            style={[styles.tab, { backgroundColor: activeStatus === s.key ? s.color : C.card, borderColor: activeStatus === s.key ? s.color : C.border }]}
            onPress={() => setActiveStatus(s.key)}
          >
            <Text style={[styles.tabLabel, { color: activeStatus === s.key ? "#fff" : C.textSecondary }]}>{s.label}</Text>
            {counts[s.key] > 0 && (
              <View style={[styles.tabCount, { backgroundColor: activeStatus === s.key ? "rgba(255,255,255,0.3)" : C.primary + "20" }]}>
                <Text style={[styles.tabCountText, { color: activeStatus === s.key ? "#fff" : C.primary }]}>{counts[s.key]}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      <View style={[styles.colHeader, { backgroundColor: statusInfo.color + "12" }]}>
        <View style={[styles.dot, { backgroundColor: statusInfo.color }]} />
        <Text style={[styles.colTitle, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        <Text style={[styles.colCount, { color: statusInfo.color }]}>{filtered.length} ta</Text>
      </View>

      {isLoading ? <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: botPad }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>📭</Text>
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>Bu holatda bitim yo'q</Text>
            </View>
          }
          renderItem={({ item: deal }) => (
            <TouchableOpacity
              style={[styles.dealCard, { backgroundColor: C.card, borderColor: C.border, borderLeftColor: statusInfo.color }]}
              onPress={() => setSelectedDeal(deal)}
              activeOpacity={0.75}
            >
              <View style={styles.dealTop}>
                <Text style={[styles.dealId, { color: C.text }]}>#{deal.id} — {deal.mijozIsm || "Noma'lum"}</Text>
                {updatingId === deal.id && <ActivityIndicator size="small" color={C.primary} />}
              </View>
              {deal.mijozPhone && (
                <View style={styles.dealRow}>
                  <Feather name="phone" size={12} color={C.textSecondary} />
                  <Text style={[styles.dealSub, { color: C.textSecondary }]}>{deal.mijozPhone}</Text>
                </View>
              )}
              {deal.manzil && (
                <View style={styles.dealRow}>
                  <Feather name="map-pin" size={12} color={C.textSecondary} />
                  <Text style={[styles.dealSub, { color: C.textSecondary }]} numberOfLines={1}>{deal.manzil}</Text>
                </View>
              )}
              <View style={[styles.dealBottom, { borderTopColor: C.border }]}>
                <Text style={[styles.dealAmount, { color: statusInfo.color }]}>{fmt(deal.totalNarx || 0)}</Text>
                {deal.tayyorBolishKuni && (
                  <Text style={[styles.dealDate, { color: C.textSecondary }]}>📅 {fmtDate(deal.tayyorBolishKuni)}</Text>
                )}
              </View>
              <View style={styles.quickActions}>
                {PREV[deal.status || "yangi"] && (
                  <TouchableOpacity style={[styles.qBtn, { borderColor: C.border }]}
                    onPress={() => changeStatus(deal, PREV[deal.status || "yangi"])}>
                    <Feather name="arrow-left" size={14} color={C.textSecondary} />
                    <Text style={[styles.qBtnText, { color: C.textSecondary }]}>
                      {STATUSES.find(s => s.key === PREV[deal.status || "yangi"])?.label.replace(/^[^\s]+\s/, "")}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.qBtn, { borderColor: C.primary, backgroundColor: C.surface }]}
                  onPress={() => router.push(`/deal/${deal.id}` as any)}
                >
                  <Feather name="eye" size={13} color={C.primary} />
                  <Text style={[styles.qBtnText, { color: C.primary }]}>Batafsil</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                {NEXT[deal.status || "yangi"] && (
                  <TouchableOpacity style={[styles.qBtn, { borderColor: statusInfo.color, backgroundColor: statusInfo.color + "15" }]}
                    onPress={() => changeStatus(deal, NEXT[deal.status || "yangi"])}>
                    <Text style={[styles.qBtnText, { color: statusInfo.color }]}>
                      {STATUSES.find(s => s.key === NEXT[deal.status || "yangi"])?.label.replace(/^[^\s]+\s/, "")}
                    </Text>
                    <Feather name="arrow-right" size={14} color={statusInfo.color} />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Deal detail modal */}
      <Modal visible={!!selectedDeal} animationType="slide" presentationStyle="pageSheet">
        {selectedDeal && (
          <DealDetail
            deal={selectedDeal}
            onClose={() => setSelectedDeal(null)}
            onStatusChange={(s) => changeStatus(selectedDeal, s)}
          />
        )}
      </Modal>

      {/* Marshrut modal */}
      <Modal visible={showMarshrut} animationType="slide" presentationStyle="pageSheet">
        <MarshrutScreen onClose={() => setShowMarshrut(false)} />
      </Modal>
    </View>
  );
}

// ─── Deal Detail ────────────────────────────────────────────────────────────

function DealDetail({ deal, onClose, onStatusChange }: { deal: any; onClose: () => void; onStatusChange: (s: string) => void }) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const statusInfo = STATUSES.find(s => s.key === (deal.status || "yangi")) || STATUSES[0];
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sharingPhotos, setSharingPhotos] = useState(false);

  const { data: photos = [], refetch: refetchPhotos } = useQuery<any[]>({
    queryKey: ["deal-photos", deal.id],
    queryFn: () => apiReq(`/client-deals/${deal.id}/photos`),
  });

  async function pickAndUpload() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Ruxsat kerak", "Galereya uchun ruxsat berilmagan");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: true,
      quality: 0.5,
      base64: true,
    });
    if (result.canceled) return;
    setUploadingPhoto(true);
    try {
      for (const asset of result.assets) {
        if (!asset.base64) continue;
        const mimeType = asset.mimeType || "image/jpeg";
        const photoData = `data:${mimeType};base64,${asset.base64}`;
        await apiReq(`/client-deals/${deal.id}/photos`, {
          method: "POST",
          body: JSON.stringify({ photoData, caption: "" }),
        });
      }
      await refetchPhotos();
      Alert.alert("✅ Rasm yuklandi!");
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Rasm yuklanmadi");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Ruxsat kerak", "Kamera uchun ruxsat berilmagan"); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
    if (result.canceled || !result.assets[0]?.base64) return;
    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const mimeType = asset.mimeType || "image/jpeg";
      await apiReq(`/client-deals/${deal.id}/photos`, {
        method: "POST",
        body: JSON.stringify({ photoData: `data:${mimeType};base64,${asset.base64}` }),
      });
      await refetchPhotos();
      Alert.alert("✅ Rasm saqlandi!");
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Rasm saqlanmadi");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function deletePhoto(photoId: number) {
    Alert.alert("Rasmni o'chirish", "Ishonchingiz komilmi?", [
      { text: "Bekor", style: "cancel" },
      {
        text: "O'chirish", style: "destructive",
        onPress: async () => {
          await apiReq(`/photos/${photoId}`, { method: "DELETE" });
          await refetchPhotos();
        },
      },
    ]);
  }

  async function sharePhotosToTelegram() {
    setSharingPhotos(true);
    try {
      const result = await apiReq<any>(`/client-deals/${deal.id}/share-telegram`, { method: "POST", body: JSON.stringify({}) });
      if (result.results?.length > 0) {
        Alert.alert("✅ Yuborildi!", result.results.map((r: any) => `${r.workerName}`).join(", ") + " ga yuborildi");
      } else {
        Alert.alert("⚠️", "Telegram bog'langan xodim topilmadi");
      }
    } catch (e: any) {
      Alert.alert("Xato", "Telegram yuborishda muammo");
    } finally {
      setSharingPhotos(false);
    }
  }

  return (
    <View style={[styles.modal, { backgroundColor: C.background }]}>
      <View style={[styles.modalHeader, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={onClose}>
          <Feather name="x" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.modalTitle, { color: C.text }]}>#{deal.id} Bitim</Text>
        <View style={[styles.statusPill, { backgroundColor: statusInfo.color }]}>
          <Text style={styles.statusPillText}>{statusInfo.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.modalBody, { paddingBottom: insets.bottom + 30 }]}>
        {/* Mijoz */}
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>👤 Mijoz</Text>
          {deal.mijozIsm && <DR icon="user" label={deal.mijozIsm} />}
          {deal.mijozPhone && (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${deal.mijozPhone}`)}>
              <DR icon="phone" label={deal.mijozPhone} color={C.primary} />
            </TouchableOpacity>
          )}
          {deal.manzil && (
            <TouchableOpacity onPress={() => deal.mapsLink ? Linking.openURL(deal.mapsLink) : Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(deal.manzil)}`)}>
              <DR icon="map-pin" label={deal.manzil} color={C.primary} />
            </TouchableOpacity>
          )}
          {deal.tayyorBolishKuni && <DR icon="calendar" label={`Tayyor: ${fmtDateNum(new Date(deal.tayyorBolishKuni))}`} />}
        </View>

        {/* Moliya */}
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>💰 Moliya</Text>
          {deal.totalMaterial > 0 && <DR icon="layers" label={`Material: ${Number(deal.totalMaterial).toFixed(2)} m²`} />}
          {deal.totalNarx > 0 && <DR icon="tag" label={`Parda: ${fmt(deal.totalNarx)}`} />}
          {deal.ornatishNarx > 0 && <DR icon="tool" label={`O'rnatish (${deal.ornatishTuri || ""}): ${fmt(deal.ornatishNarx)}`} />}
          {deal.chevarJami > 0 && <DR icon="scissors" label={`Chevar: ${fmt(deal.chevarJami)}`} />}
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: C.text }]}>JAMI</Text>
            <Text style={[styles.totalValue, { color: C.primary }]}>
              {fmt((deal.totalNarx || 0) + (deal.ornatishNarx || 0) + (deal.chevarJami || 0))}
            </Text>
          </View>
          {deal.zaklatSumma > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: C.textSecondary }]}>Qarz</Text>
              <Text style={[styles.totalValue, { color: "#EF4444", fontSize: 16 }]}>{fmt(deal.qarzSumma || 0)}</Text>
            </View>
          )}
        </View>

        {/* Foto galereya */}
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>📸 Bajarilgan ishlar</Text>
            <Text style={[styles.photoCount, { color: C.textSecondary }]}>{photos.length} ta</Text>
          </View>

          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {photos.map((p: any) => (
                <TouchableOpacity key={p.id} onLongPress={() => deletePhoto(p.id)} activeOpacity={0.85}>
                  <Image
                    source={{ uri: p.photoData }}
                    style={styles.photoThumb}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.photoActions}>
            <TouchableOpacity
              style={[styles.photoBtn, { borderColor: C.border, flex: 1 }]}
              onPress={takePhoto}
              disabled={uploadingPhoto}
            >
              <Feather name="camera" size={16} color={C.primary} />
              <Text style={[styles.photoBtnText, { color: C.primary }]}>Kamera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoBtn, { borderColor: C.border, flex: 1 }]}
              onPress={pickAndUpload}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto
                ? <ActivityIndicator size="small" color={C.primary} />
                : <Feather name="image" size={16} color={C.primary} />}
              <Text style={[styles.photoBtnText, { color: C.primary }]}>Galereya</Text>
            </TouchableOpacity>
          </View>

          {photos.length > 0 && (
            <TouchableOpacity
              style={[styles.telegramShareBtn, { backgroundColor: "#229ED920" }]}
              onPress={sharePhotosToTelegram}
              disabled={sharingPhotos}
            >
              {sharingPhotos
                ? <ActivityIndicator size="small" color="#229ED9" />
                : <Feather name="send" size={16} color="#229ED9" />}
              <Text style={[styles.telegramShareText, { color: "#229ED9" }]}>
                Telegramga yuborish (chevar + usta)
              </Text>
            </TouchableOpacity>
          )}

          {photos.length === 0 && (
            <Text style={[styles.emptyPhotos, { color: C.textSecondary }]}>
              Rasm yuklash uchun Kamera yoki Galereya tugmasini bosing.{"\n"}Rasmni o'chirish uchun uzoq bosing.
            </Text>
          )}
        </View>

        {/* Status */}
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>📋 Holat</Text>
          {STATUSES.map(s => (
            <TouchableOpacity
              key={s.key}
              style={[styles.statusOpt, { borderColor: (deal.status || "yangi") === s.key ? s.color : C.border, backgroundColor: (deal.status || "yangi") === s.key ? s.color + "15" : C.surface }]}
              onPress={() => { onStatusChange(s.key); onClose(); }}
            >
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text style={[styles.statusOptText, { color: (deal.status || "yangi") === s.key ? s.color : C.text }]}>{s.label}</Text>
              {(deal.status || "yangi") === s.key && <Feather name="check" size={16} color={s.color} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Marshrut (Installer Route) ─────────────────────────────────────────────

function MarshrutScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: route = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["installer-route"],
    queryFn: () => apiReq("/installer/route"),
  });

  async function onRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  function openAllInMaps() {
    const withAddress = (route as any[]).filter(d => d.manzil);
    if (withAddress.length === 0) { Alert.alert("Manzil yo'q", "Birorta bitimda manzil kiritilmagan"); return; }

    if (withAddress.length === 1) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(withAddress[0].manzil)}`);
      return;
    }

    // Multi-stop optimized route: first = origin, last = destination, middle = waypoints
    const origin = encodeURIComponent(withAddress[0].manzil);
    const destination = encodeURIComponent(withAddress[withAddress.length - 1].manzil);
    const waypoints = withAddress.slice(1, -1).map((d: any) => encodeURIComponent(d.manzil)).join("|");
    const url = waypoints.length > 0
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    Linking.openURL(url);
  }

  function openSingleInMaps(deal: any) {
    if (deal.mapsLink) { Linking.openURL(deal.mapsLink); return; }
    if (deal.manzil) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deal.manzil)}`);
      return;
    }
    Alert.alert("Manzil kiritilmagan");
  }

  const today = fmtDateUz(new Date(), { month: "long", year: true });

  return (
    <View style={[styles.modal, { backgroundColor: C.background }]}>
      <View style={[styles.modalHeader, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={onClose}>
          <Feather name="x" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.modalTitle, { color: C.text }]}>🗺️ Marshrut</Text>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>{today}</Text>
        </View>
        {(route as any[]).some(d => d.manzil) && (
          <TouchableOpacity
            style={[styles.mapsAllBtn, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B" }]}
            onPress={openAllInMaps}
          >
            <Feather name="navigation" size={14} color="#F59E0B" />
            <Text style={[styles.mapsAllText, { color: "#F59E0B" }]}>Hammasi</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 30, gap: 10 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        >
          {(route as any[]).length === 0 && (
            <View style={[styles.empty, { marginTop: 60 }]}>
              <Text style={{ fontSize: 48 }}>🎉</Text>
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>Bugun o'rnatish yo'q!</Text>
            </View>
          )}

          {(route as any[]).map((deal: any, idx: number) => {
            const s = STATUSES.find(s => s.key === (deal.status || "yangi")) || STATUSES[2];
            return (
              <View key={deal.id} style={[styles.routeCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={styles.routeTop}>
                  <View style={[styles.routeNum, { backgroundColor: s.color }]}>
                    <Text style={styles.routeNumText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dealId, { color: C.text }]}>{deal.mijozIsm || `Bitim #${deal.id}`}</Text>
                    <Text style={[styles.dealSub, { color: C.textSecondary }]}>{deal.mijozPhone || ""}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: s.color }]}>
                    <Text style={styles.statusPillText}>{s.label.replace(/^[^\s]+\s/, "")}</Text>
                  </View>
                </View>

                {deal.manzil && (
                  <View style={[styles.routeManzil, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Feather name="map-pin" size={14} color="#EF4444" />
                    <Text style={[styles.routeManzilText, { color: C.text }]} numberOfLines={2}>{deal.manzil}</Text>
                  </View>
                )}

                <View style={styles.routeActions}>
                  {deal.mijozPhone && (
                    <TouchableOpacity
                      style={[styles.routeBtn, { borderColor: C.border }]}
                      onPress={() => Linking.openURL(`tel:${deal.mijozPhone}`)}
                    >
                      <Feather name="phone" size={14} color={C.primary} />
                      <Text style={[styles.routeBtnText, { color: C.primary }]}>Qo'ng'iroq</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.routeBtn, { borderColor: "#F59E0B", backgroundColor: "#F59E0B20" }]}
                    onPress={() => openSingleInMaps(deal)}
                  >
                    <Feather name="navigation" size={14} color="#F59E0B" />
                    <Text style={[styles.routeBtnText, { color: "#F59E0B" }]}>Maps</Text>
                  </TouchableOpacity>
                  {deal.tayyorBolishKuni && (
                    <Text style={[styles.dealDate, { color: C.textSecondary }]}>
                      📅 {fmtDate(deal.tayyorBolishKuni)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function DR({ icon, label, color }: { icon: any; label: string; color?: string }) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: Colors.light.border }]}>
      <Feather name={icon} size={14} color={color || Colors.light.textSecondary} />
      <Text style={[styles.detailText, { color: color || Colors.light.text }]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  marshtrutBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  marshruttText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabs: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  tabLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  tabCountText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  colHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  colTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  colCount: { fontSize: 13, fontFamily: "Inter_700Bold" },
  dealCard: { borderRadius: 16, borderWidth: 1, borderLeftWidth: 4, padding: 14, marginBottom: 10, gap: 6 },
  dealTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dealId: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  dealRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dealSub: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  dealBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 1, marginTop: 4 },
  dealAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  dealDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  quickActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  qBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  qBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", flex: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  modalBody: { paddingHorizontal: 16, gap: 12, paddingTop: 8 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  photoCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  detailText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  divider: { height: 1, marginVertical: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  totalValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statusOpt: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5, marginBottom: 4 },
  statusOptText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  photoThumb: { width: 100, height: 100, borderRadius: 12 },
  photoActions: { flexDirection: "row", gap: 10 },
  photoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 12, borderWidth: 1.5 },
  photoBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  telegramShareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, marginTop: 4 },
  telegramShareText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyPhotos: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18, paddingVertical: 8 },
  routeCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  routeTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeNum: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  routeNumText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  routeManzil: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  routeManzilText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  routeActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  routeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  mapsAllBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  mapsAllText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
