import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import { useAuth } from "@/context/auth";

const C = Colors.light;

interface Shop {
  id: number; name: string; address: string; phone: string;
  isActive: boolean; subscriptionActive: boolean; balance: number;
  contactPerson: string | null; createdAt: string;
  owner: { id: number; username: string; fullName: string; isActive: boolean } | null;
  userCount: number;
}
interface SmsSettings { smsProvider: string; eskizLogin: string | null; eskizPassword: string | null; eskizFrom: string; devsmApiKey: string | null; devsmPassword: string | null; devsmFrom?: string; }
interface SmsLog { id: number; phone: string; matn: string; status: string; createdAt: string; }
interface SmsTemplate { id: number; nomi: string; matn: string; tur: string; faol: boolean; }
interface Server { id: number; name: string; url: string; description: string | null; isActive: number; isPrimary: number; lastStatus: string | null; lastChecked: string | null; }
interface Customer { id: number; fullName: string; phone: string; address: string | null; totalDebt: number; createdAt: string; }
interface DebtAlert { id: number; mijozIsm: string | null; mijozPhone: string | null; qarzSumma: number | null; qaytarishMuddati: string | null; status: string; }

type Tab = "dokonlar" | "arizalar" | "infratuzilma" | "sms" | "shablonlar" | "mijozlar" | "ishchilar" | "buyurtmalar";
type ModalType = "create" | "creds" | "topup" | "template" | "server" | "shop_sms" | "approve" | null;

interface ShopRequest {
  id: number; telegramUserId: string; telegramUsername: string | null; telegramChatId: string;
  shopName: string; phone: string; requestedMonths: number; status: string;
  approvedMonths: number | null; adminNote: string | null; shopId: number | null; createdAt: string;
}

type Worker = { id: number; fullName: string; phone: string | null; role: string; oylikStavka: number | null; isActive: number; activeDealCount: number; createdAt: string | null; };
const WORKER_ROLES: Record<string, { label: string; color: string }> = {
  tailor:    { label: "Chevar",    color: "#8B5CF6" },
  installer: { label: "Haydovchi", color: "#059669" },
  manager:   { label: "Menejer",  color: "#3B82F6" },
};
const DEAL_STATUSES = ["barchasi","yangi","tikuvda","tayyor","ornatilmoqda","yopildi"] as const;
const DEAL_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  barchasi:     { label: "Barchasi",       color: "#6B7280" },
  yangi:        { label: "Yangi",          color: "#6366F1" },
  tikuvda:      { label: "Tikuvda",        color: "#F59E0B" },
  tayyor:       { label: "Tayyor",         color: "#10B981" },
  ornatilmoqda: { label: "O'rnatilmoqda",  color: "#3B82F6" },
  yopildi:      { label: "Yopildi",        color: "#6B7280" },
};

function fmt(n: number) { return new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0)) + " so'm"; }
function ago(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Bugun"; if (days === 1) return "Kecha"; return `${days} kun oldin`;
}

export default function SuperAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user, logout } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const [activeTab, setActiveTab] = useState<Tab>("dokonlar");
  const [modal, setModal] = useState<ModalType>(null);
  const [shopSmsForm, setShopSmsForm] = useState<Record<string, string>>({ smsProvider: "eskiz", eskizLogin: "", eskizPassword: "", eskizFrom: "4546", devsmApiKey: "", devsmFrom: "Bluepos" });
  const [shopSmsLoading, setShopSmsLoading] = useState(false);
  const [shopSmsTestPhone, setShopSmsTestPhone] = useState("");
  const [shopSmsTestLoading, setShopSmsTestLoading] = useState(false);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [editTpl, setEditTpl] = useState<SmsTemplate | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", phone: "", address: "", ownerUsername: "", ownerPassword: "", ownerFullName: "" });
  const [credsForm, setCredsForm] = useState({ username: "", password: "" });
  const [topupAmount, setTopupAmount] = useState("");
  const [tplForm, setTplForm] = useState({ nomi: "", matn: "", tur: "umumiy" });
  const [serverForm, setServerForm] = useState({ name: "", url: "", description: "" });
  const [smsSettingsForm, setSmsSettingsForm] = useState<Record<string, string>>({ smsProvider: "eskiz", eskizLogin: "", eskizPassword: "", eskizFrom: "4546", devsmApiKey: "", devsmPassword: "", devsmFrom: "Bluepos", telegramBotToken: "", telegramAdminChatId: "" });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [checkingServer, setCheckingServer] = useState<number | null>(null);
  const [dealStatusFilter, setDealStatusFilter] = useState<string>("barchasi");
  const [togglingWorker, setTogglingWorker] = useState<number | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ShopRequest | null>(null);
  const [approveForm, setApproveForm] = useState({ months: "1", ownerUsername: "", ownerPassword: "", adminNote: "" });
  const [rejectNote, setRejectNote] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [botInfo, setBotInfo] = useState<any>(null);
  const [botInfoLoading, setBotInfoLoading] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState(false);

  if (user?.role !== "super_admin") {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <Feather name="lock" size={40} color="#DC2626" />
        <Text style={[s.noAccessTitle, { color: C.text }]}>Ruxsat yo'q</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: C.primary }}>Orqaga</Text></TouchableOpacity>
      </View>
    );
  }

  const { data: shops = [], isLoading: shopsLoading } = useQuery<Shop[]>({
    queryKey: ["super-admin-shops"],
    queryFn: async () => await apiReq("/super-admin/shops") as Shop[],
  });
  const { data: stats } = useQuery<any>({
    queryKey: ["super-admin-stats"],
    queryFn: async () => await apiReq("/super-admin/stats") as any,
  });
  const { data: servers = [], isLoading: serversLoading, refetch: refetchServers } = useQuery<Server[]>({
    queryKey: ["super-admin-servers"],
    queryFn: async () => await apiReq("/super-admin/servers") as Server[],
    enabled: activeTab === "infratuzilma",
  });
  const { data: smsSettings } = useQuery<SmsSettings>({
    queryKey: ["sms-settings-super"],
    queryFn: async () => await apiReq("/settings") as SmsSettings,
    enabled: activeTab === "sms",
  });
  const { data: templates = [], isLoading: tplLoading, refetch: refetchTpl } = useQuery<SmsTemplate[]>({
    queryKey: ["sms-templates"],
    queryFn: async () => await apiReq("/sms/templates") as SmsTemplate[],
    enabled: activeTab === "shablonlar",
  });
  const { data: logs = [] } = useQuery<SmsLog[]>({
    queryKey: ["sms-logs"],
    queryFn: async () => await apiReq("/sms/logs") as SmsLog[],
    enabled: activeTab === "sms",
  });
  const { data: allCustomers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["sa-customers"],
    queryFn: () => apiReq<Customer[]>("/customers"),
    enabled: activeTab === "mijozlar",
  });
  const { data: debtAlerts = [], isLoading: alertsLoading, refetch: refetchAlerts } = useQuery<DebtAlert[]>({
    queryKey: ["sa-debt-alerts"],
    queryFn: () => apiReq<DebtAlert[]>("/notifications/debt-alerts"),
    enabled: activeTab === "mijozlar",
  });
  const { data: allWorkers = [], isLoading: workersLoading, refetch: refetchWorkers } = useQuery<Worker[]>({
    queryKey: ["sa-workers"],
    queryFn: () => apiReq<Worker[]>("/workers?all=true"),
    enabled: activeTab === "ishchilar",
  });
  const { data: allDeals = [], isLoading: dealsLoading } = useQuery<any[]>({
    queryKey: ["sa-all-deals", dealStatusFilter],
    queryFn: () => apiReq<any[]>(`/worker-panel/all-deals?status=${dealStatusFilter}`),
    enabled: activeTab === "buyurtmalar",
  });
  const { data: shopRequests = [], isLoading: requestsLoading, refetch: refetchRequests } = useQuery<ShopRequest[]>({
    queryKey: ["sa-shop-requests"],
    queryFn: () => apiReq<ShopRequest[]>("/super-admin/shop-requests"),
    enabled: activeTab === "arizalar",
    refetchInterval: activeTab === "arizalar" ? 30000 : false,
  });

  useEffect(() => {
    if (smsSettings && !settingsLoaded) {
      setSmsSettingsForm({
        smsProvider: smsSettings.smsProvider || "eskiz",
        eskizLogin: smsSettings.eskizLogin || "",
        eskizPassword: smsSettings.eskizPassword || "",
        eskizFrom: smsSettings.eskizFrom || "4546",
        devsmApiKey: smsSettings.devsmApiKey || "",
        devsmPassword: smsSettings.devsmPassword || "",
        devsmFrom: (smsSettings as any).devsmFrom || "Bluepos",
        telegramBotToken: (smsSettings as any).telegramBotToken || "",
        telegramAdminChatId: (smsSettings as any).telegramAdminChatId || "",
      });
      setSettingsLoaded(true);
    }
  }, [smsSettings, settingsLoaded]);

  const createMut = useMutation({
    mutationFn: () => apiReq("/super-admin/shops", { method: "POST", body: JSON.stringify(createForm) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["super-admin-shops", "super-admin-stats"] }); setModal(null); Alert.alert("✅", "Do'kon yaratildi!"); },
    onError: (e: any) => Alert.alert("Xato", e.message),
  });
  const topupMut = useMutation({
    mutationFn: () => apiReq(`/super-admin/shops/${selectedShop?.id}/topup`, { method: "PATCH", body: JSON.stringify({ summa: parseFloat(topupAmount) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["super-admin-shops", "super-admin-stats"] }); setModal(null); Alert.alert("✅", "Balans to'ldirildi!"); },
    onError: (e: any) => Alert.alert("Xato", e.message),
  });
  const credsMut = useMutation({
    mutationFn: () => apiReq(`/super-admin/shops/${selectedShop?.id}/credentials`, { method: "PATCH", body: JSON.stringify({ username: credsForm.username || undefined, password: credsForm.password || undefined }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["super-admin-shops"] }); setModal(null); Alert.alert("✅", "Login/Parol yangilandi!"); },
    onError: (e: any) => Alert.alert("Xato", e.message),
  });
  const toggleMut = useMutation({
    mutationFn: (id: number) => apiReq(`/super-admin/shops/${id}/toggle`, { method: "PATCH", body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["super-admin-shops", "super-admin-stats"] }),
  });
  const tplCreateMut = useMutation({
    mutationFn: () => apiReq("/sms/templates", { method: "POST", body: JSON.stringify({ ...tplForm, faol: true }) }),
    onSuccess: () => { refetchTpl(); setModal(null); Alert.alert("✅", "Shablon yaratildi!"); },
    onError: (e: any) => Alert.alert("Xato", e.message),
  });
  const tplUpdateMut = useMutation({
    mutationFn: () => apiReq(`/sms/templates/${editTpl?.id}`, { method: "PUT", body: JSON.stringify({ ...tplForm, faol: true }) }),
    onSuccess: () => { refetchTpl(); setModal(null); Alert.alert("✅", "Shablon yangilandi!"); },
    onError: (e: any) => Alert.alert("Xato", e.message),
  });
  const tplDeleteMut = useMutation({
    mutationFn: (id: number) => apiReq(`/sms/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => refetchTpl(),
  });
  const serverCreateMut = useMutation({
    mutationFn: () => apiReq("/super-admin/servers", { method: "POST", body: JSON.stringify(serverForm) }),
    onSuccess: () => { refetchServers(); setModal(null); Alert.alert("✅", "Server qo'shildi!"); },
    onError: (e: any) => Alert.alert("Xato", e.message),
  });
  const serverToggleMut = useMutation({
    mutationFn: (id: number) => apiReq(`/super-admin/servers/${id}/toggle`, { method: "PATCH", body: JSON.stringify({}) }),
    onSuccess: () => refetchServers(),
  });
  const serverSetPrimaryMut = useMutation({
    mutationFn: (id: number) => apiReq(`/super-admin/servers/${id}/set-primary`, { method: "PATCH", body: JSON.stringify({}) }),
    onSuccess: () => { refetchServers(); Alert.alert("✅", "Asosiy server o'zgartirildi!"); },
  });
  const serverDeleteMut = useMutation({
    mutationFn: (id: number) => apiReq(`/super-admin/servers/${id}`, { method: "DELETE" }),
    onSuccess: () => refetchServers(),
  });

  async function saveSettings() {
    setSavingSettings(true);
    try {
      await apiReq("/settings", { method: "PATCH", body: JSON.stringify(smsSettingsForm) });
      Alert.alert("✅", "SMS sozlamalar saqlandi!");
      setSettingsLoaded(false);
      qc.invalidateQueries({ queryKey: ["sms-settings-super"] });
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setSavingSettings(false); }
  }

  async function sendTestSms() {
    if (!testPhone) return;
    setTestLoading(true);
    try {
      const res = await apiReq("/sms/test", { method: "POST", body: JSON.stringify({ phone: testPhone }) }) as any;
      Alert.alert(res.success ? "✅ Test yuborildi" : "❌ Xato", res.success ? testPhone : (res.error || "Noma'lum xato"));
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setTestLoading(false); }
  }

  async function checkServer(id: number) {
    setCheckingServer(id);
    try {
      const res = await apiReq(`/super-admin/servers/${id}/check`, { method: "POST", body: JSON.stringify({}) }) as any;
      Alert.alert(res.status === "online" ? "✅ Online" : "❌ Offline", `Server holati: ${res.status}`);
      refetchServers();
    } catch { Alert.alert("Xato", "Tekshirishda xato"); }
    finally { setCheckingServer(null); }
  }

  async function loadBotInfo() {
    setBotInfoLoading(true);
    try {
      const data = await apiReq<any>("/super-admin/telegram/bot-info");
      setBotInfo(data);
    } catch { setBotInfo(null); }
    finally { setBotInfoLoading(false); }
  }

  async function setWebhook() {
    setSettingWebhook(true);
    try {
      const domain = await apiReq<any>("/health").catch(() => null);
      const baseUrl = (domain as any)?.apiUrl || "";
      const webhookUrl = `${baseUrl}/api/telegram/webhook`;
      const res = await apiReq<any>("/super-admin/telegram/set-webhook", { method: "POST", body: JSON.stringify({ webhookUrl }) });
      if (res?.ok) Alert.alert("✅", `Webhook o'rnatildi!\n${webhookUrl}`);
      else Alert.alert("Xato", res?.description ?? "Noma'lum xato");
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setSettingWebhook(false); }
  }

  async function approveRequest() {
    if (!selectedRequest) return;
    try {
      const res = await apiReq<any>(`/super-admin/shop-requests/${selectedRequest.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          months: parseInt(approveForm.months) || 1,
          ownerUsername: approveForm.ownerUsername || undefined,
          ownerPassword: approveForm.ownerPassword || undefined,
          adminNote: approveForm.adminNote || undefined,
        }),
      });
      setModal(null);
      qc.invalidateQueries({ queryKey: ["sa-shop-requests", "super-admin-shops", "super-admin-stats"] });
      const months = parseInt(approveForm.months) || 1;
      Alert.alert("✅ Tasdiqlandi!", `Login: ${res.username}\nParol: ${res.password}\nObuna: ${months} oy`);
    } catch (e: any) { Alert.alert("Xato", e.message); }
  }

  async function rejectRequest(id: number, note: string) {
    setRejectingId(id);
    try {
      await apiReq(`/super-admin/shop-requests/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ adminNote: note || undefined }),
      });
      refetchRequests();
      Alert.alert("✅", "Ariza rad etildi. Foydalanuvchiga xabar yuborildi.");
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setRejectingId(null); }
  }

  // ─── ARIZALAR ──────────────────────────────────────────────
  function renderArizalar() {
    const pending = shopRequests.filter(r => r.status === "pending");
    const done = shopRequests.filter(r => r.status !== "pending");

    const statusColor: Record<string, string> = { pending: "#F59E0B", approved: "#10B981", rejected: "#EF4444" };
    const statusLabel: Record<string, string> = { pending: "Kutilmoqda", approved: "Tasdiqlandi", rejected: "Rad etildi" };
    const monthLabel = (m: number) => m === 1 ? "1 oy" : m === 3 ? "3 oy" : m === 12 ? "12 oy" : `${m} oy`;

    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }}>
        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { lbl: "Jami arizalar", val: shopRequests.length, color: C.primary },
            { lbl: "Kutilmoqda", val: pending.length, color: "#F59E0B" },
            { lbl: "Tasdiqlandi", val: shopRequests.filter(r => r.status === "approved").length, color: "#10B981" },
            { lbl: "Rad etildi", val: shopRequests.filter(r => r.status === "rejected").length, color: "#EF4444" },
          ].map((st, i) => (
            <View key={i} style={[s.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
              <Text style={[s.statLbl, { color: C.textSecondary }]}>{st.lbl}</Text>
            </View>
          ))}
        </View>

        {requestsLoading && <ActivityIndicator color={C.primary} />}

        {/* Pending requests */}
        {pending.length > 0 && (
          <>
            <Text style={[s.mLbl, { color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.8 }]}>
              Kutilayotgan arizalar ({pending.length})
            </Text>
            {pending.map(r => (
              <View key={r.id} style={[s.card, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A", borderWidth: 1 }]}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  <View style={[s.shopDot, { backgroundColor: "#F59E0B", marginTop: 4 }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.shopName, { color: "#92400E" }]}>{r.shopName}</Text>
                    <Text style={[s.shopMeta, { color: "#78350F" }]}>
                      📞 {r.phone}  ·  @{r.telegramUsername ?? r.telegramUserId}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <View style={{ backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: "#D97706", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                          ⏳ So'ralgan: {monthLabel(r.requestedMonths)}
                        </Text>
                      </View>
                      <Text style={[s.shopMeta, { color: C.textSecondary }]}>{ago(r.createdAt)}</Text>
                    </View>
                  </View>
                </View>
                <View style={[s.shopActions, { borderTopColor: "#FDE68A", marginTop: 10 }]}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#D1FAE5", flex: 1 }]}
                    onPress={() => {
                      setSelectedRequest(r);
                      setApproveForm({ months: String(r.requestedMonths), ownerUsername: "", ownerPassword: "", adminNote: "" });
                      setModal("approve");
                    }}>
                    <Feather name="check-circle" size={15} color="#059669" />
                    <Text style={[s.actionBtnTxt, { color: "#059669" }]}>Tasdiqlash</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#FEE2E2", flex: 1 }]}
                    onPress={() => Alert.alert("Rad etish", `"${r.shopName}" arizasini rad etmoqchimisiz?`, [
                      { text: "Bekor" },
                      { text: "Rad etish", style: "destructive", onPress: () => rejectRequest(r.id, "") },
                    ])}
                    disabled={rejectingId === r.id}>
                    {rejectingId === r.id
                      ? <ActivityIndicator color="#DC2626" size="small" />
                      : <><Feather name="x-circle" size={15} color="#DC2626" /><Text style={[s.actionBtnTxt, { color: "#DC2626" }]}>Rad</Text></>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Done requests */}
        {done.length > 0 && (
          <>
            <Text style={[s.mLbl, { color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 8 }]}>
              Ko'rib chiqilganlar
            </Text>
            {done.map(r => (
              <View key={r.id} style={[s.shopCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[s.shopDot, { backgroundColor: statusColor[r.status] ?? "#6B7280" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.shopName, { color: C.text }]}>{r.shopName}</Text>
                    <Text style={[s.shopMeta, { color: C.textSecondary }]}>
                      📞 {r.phone}  ·  @{r.telegramUsername ?? r.telegramUserId}
                    </Text>
                  </View>
                  <View>
                    <View style={{ backgroundColor: r.status === "approved" ? "#D1FAE5" : "#FEE2E2", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: statusColor[r.status] ?? "#6B7280", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                        {statusLabel[r.status] ?? r.status}
                      </Text>
                    </View>
                    {r.status === "approved" && r.approvedMonths && (
                      <Text style={{ color: C.textSecondary, fontSize: 11, marginTop: 2, textAlign: "right" }}>
                        {monthLabel(r.approvedMonths)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {shopRequests.length === 0 && !requestsLoading && (
          <View style={[s.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Feather name="inbox" size={32} color={C.textSecondary} />
            <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hali ariza yo'q</Text>
            <Text style={[s.shopMeta, { color: C.textSecondary, textAlign: "center", marginTop: 4 }]}>
              Telegram bot orqali do'kon egalari ariza yuborsa shu yerda ko'rinadi
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  async function openShopSms(shop: Shop) {
    setSelectedShop(shop);
    setShopSmsTestPhone("");
    setShopSmsLoading(true);
    try {
      const data = await apiReq<Record<string, string>>(`/super-admin/shops/${shop.id}/sms-settings`);
      setShopSmsForm({
        smsProvider: data.smsProvider || "eskiz",
        eskizLogin: data.eskizLogin || "",
        eskizPassword: data.eskizPassword || "",
        eskizFrom: data.eskizFrom || "4546",
        devsmApiKey: data.devsmApiKey || "",
        devsmFrom: data.devsmFrom || "Bluepos",
      });
    } catch { /* use defaults */ }
    finally { setShopSmsLoading(false); }
    setModal("shop_sms");
  }

  async function saveShopSms() {
    if (!selectedShop) return;
    setShopSmsLoading(true);
    try {
      await apiReq(`/super-admin/shops/${selectedShop.id}/sms-settings`, { method: "PATCH", body: JSON.stringify(shopSmsForm) });
      Alert.alert("✅", "Do'kon SMS sozlamalari saqlandi!");
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setShopSmsLoading(false); }
  }

  async function testShopSms() {
    if (!selectedShop || !shopSmsTestPhone) return;
    setShopSmsTestLoading(true);
    try {
      const res = await apiReq<any>(`/super-admin/shops/${selectedShop.id}/test-sms`, { method: "POST", body: JSON.stringify({ phone: shopSmsTestPhone }) });
      Alert.alert(res.success ? "✅ Test SMS yuborildi!" : "❌ Xato", res.success ? `${shopSmsTestPhone} ga yuborildi` : (res.error || "Noma'lum xato"));
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setShopSmsTestLoading(false); }
  }

  const provider = smsSettingsForm.smsProvider;
  const shopSmsProvider = shopSmsForm.smsProvider;

  // ─── DO'KONLAR ─────────────────────────────────────────────
  function renderDokonlar() {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }}>
        {stats && (
          <View style={s.statsRow}>
            {[
              { lbl: "Do'konlar", val: stats.totalShops, color: C.primary },
              { lbl: "Faol", val: stats.activeShops, color: "#10B981" },
              { lbl: "Bloklangan", val: stats.inactiveShops, color: "#EF4444" },
              { lbl: "Foydalanuvchi", val: stats.totalUsers, color: "#F59E0B" },
            ].map((st, i) => (
              <View key={i} style={[s.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
                <Text style={[s.statLbl, { color: C.textSecondary }]}>{st.lbl}</Text>
              </View>
            ))}
          </View>
        )}
        {shopsLoading && <ActivityIndicator color={C.primary} />}
        {shops.map(shop => (
          <View key={shop.id} style={[s.shopCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={s.shopCardTop}>
              <View style={[s.shopDot, { backgroundColor: shop.isActive ? "#10B981" : "#EF4444" }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.shopName, { color: C.text }]}>{shop.name}</Text>
                <Text style={[s.shopMeta, { color: C.textSecondary }]}>{shop.phone}{shop.address ? " · " + shop.address : ""}</Text>
                <Text style={[s.shopMeta, { color: C.textSecondary }]}>
                  Admin: <Text style={{ color: C.primary }}>{shop.owner?.username || "—"}</Text> · {shop.userCount} user
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s.shopBalance, { color: shop.balance > 0 ? "#10B981" : C.textSecondary }]}>{fmt(shop.balance)}</Text>
                <Text style={[s.shopMeta, { color: C.textSecondary }]}>{ago(shop.createdAt)}</Text>
              </View>
            </View>
            <View style={[s.shopActions, { borderTopColor: C.border }]}>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#D1FAE5" }]}
                onPress={() => { setSelectedShop(shop); setTopupAmount(""); setModal("topup"); }}>
                <Feather name="dollar-sign" size={15} color="#059669" />
                <Text style={[s.actionBtnTxt, { color: "#059669" }]}>Balans</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#EEF2FF" }]}
                onPress={() => { setSelectedShop(shop); setCredsForm({ username: shop.owner?.username || "", password: "" }); setModal("creds"); }}>
                <Feather name="key" size={15} color={C.primary} />
                <Text style={[s.actionBtnTxt, { color: C.primary }]}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#F0F9FF" }]}
                onPress={() => openShopSms(shop)}>
                <Feather name="message-circle" size={15} color="#0284C7" />
                <Text style={[s.actionBtnTxt, { color: "#0284C7" }]}>SMS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: shop.isActive ? "#FEE2E2" : "#D1FAE5" }]}
                onPress={() => Alert.alert(shop.isActive ? "Bloklash" : "Ochish", `"${shop.name}" ni ${shop.isActive ? "bloklamoqchi" : "faollashtirishni"} istaysizmi?`, [
                  { text: "Bekor" }, { text: "Ha", onPress: () => toggleMut.mutate(shop.id) },
                ])}>
                <Feather name={shop.isActive ? "toggle-right" : "toggle-left"} size={15} color={shop.isActive ? "#DC2626" : "#059669"} />
                <Text style={[s.actionBtnTxt, { color: shop.isActive ? "#DC2626" : "#059669" }]}>{shop.isActive ? "Blok" : "Ochish"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {shops.length === 0 && !shopsLoading && (
          <View style={[s.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Feather name="shopping-bag" size={32} color={C.textSecondary} />
            <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hali do'kon yo'q</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ─── INFRATUZILMA ──────────────────────────────────────────
  function renderInfratuzilma() {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }}>
        <View style={[s.infoBanner, { backgroundColor: "#EEF2FF", borderColor: C.border }]}>
          <Feather name="server" size={16} color={C.primary} />
          <Text style={[s.infoBannerTxt, { color: C.primary, flex: 1 }]}>
            Serverlarni bu yerdan boshqarishingiz, holat tekshirishingiz va asosiy serverni almashtirishingiz mumkin.
          </Text>
        </View>

        {serversLoading && <ActivityIndicator color={C.primary} />}

        {servers.map(sv => {
          const isOnline = sv.lastStatus === "online";
          const isOffline = sv.lastStatus === "offline";
          const statusColor = isOnline ? "#10B981" : isOffline ? "#EF4444" : "#F59E0B";
          const statusLabel = isOnline ? "Online" : isOffline ? "Offline" : "Noma'lum";
          return (
            <View key={sv.id} style={[s.serverCard, { backgroundColor: C.card, borderColor: sv.isPrimary ? C.primary : C.border, borderWidth: sv.isPrimary ? 2 : 1 }]}>
              <View style={s.serverCardTop}>
                <View style={[s.serverIconWrap, { backgroundColor: sv.isActive ? "#EEF2FF" : "#F3F4F6" }]}>
                  <Feather name="server" size={20} color={sv.isActive ? C.primary : C.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[s.serverName, { color: C.text }]}>{sv.name}</Text>
                    {!!sv.isPrimary && (
                      <View style={[s.primaryBadge, { backgroundColor: C.primary }]}>
                        <Text style={s.primaryBadgeTxt}>ASOSIY</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.serverUrl, { color: C.primary }]} numberOfLines={1}>{sv.url}</Text>
                  {sv.description ? <Text style={[s.serverDesc, { color: C.textSecondary }]}>{sv.description}</Text> : null}
                </View>
                <View style={[s.statusDot, { backgroundColor: statusColor }]} />
              </View>

              <View style={[s.serverStatus, { borderTopColor: C.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="activity" size={13} color={statusColor} />
                  <Text style={[s.serverStatusTxt, { color: statusColor }]}>{statusLabel}</Text>
                  {sv.lastChecked && (
                    <Text style={[s.serverLastCheck, { color: C.textSecondary }]}>
                      · {new Date(sv.lastChecked).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  )}
                </View>
              </View>

              <View style={[s.serverActions, { borderTopColor: C.border }]}>
                <TouchableOpacity style={[s.srvBtn, { backgroundColor: "#EEF2FF" }]}
                  onPress={() => checkServer(sv.id)} disabled={checkingServer === sv.id}>
                  {checkingServer === sv.id
                    ? <ActivityIndicator size="small" color={C.primary} />
                    : <Feather name="refresh-cw" size={14} color={C.primary} />}
                  <Text style={[s.srvBtnTxt, { color: C.primary }]}>Tekshirish</Text>
                </TouchableOpacity>

                {!sv.isPrimary && (
                  <TouchableOpacity style={[s.srvBtn, { backgroundColor: "#D1FAE5" }]}
                    onPress={() => Alert.alert("Asosiy qilish", `"${sv.name}" ni asosiy server sifatida belgilash?`, [
                      { text: "Bekor" }, { text: "Ha", onPress: () => serverSetPrimaryMut.mutate(sv.id) },
                    ])}>
                    <Feather name="star" size={14} color="#059669" />
                    <Text style={[s.srvBtnTxt, { color: "#059669" }]}>Asosiy</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[s.srvBtn, { backgroundColor: sv.isActive ? "#FEE2E2" : "#D1FAE5" }]}
                  onPress={() => serverToggleMut.mutate(sv.id)}>
                  <Feather name={sv.isActive ? "pause" : "play"} size={14} color={sv.isActive ? "#DC2626" : "#059669"} />
                  <Text style={[s.srvBtnTxt, { color: sv.isActive ? "#DC2626" : "#059669" }]}>{sv.isActive ? "O'chirish" : "Yoqish"}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.srvBtn, { backgroundColor: "#FEE2E2" }]}
                  onPress={() => Alert.alert("O'chirish", `"${sv.name}" ni o'chirishni istaysizmi?`, [
                    { text: "Bekor" }, { text: "O'chirish", style: "destructive", onPress: () => serverDeleteMut.mutate(sv.id) },
                  ])}>
                  <Feather name="trash-2" size={14} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {servers.length === 0 && !serversLoading && (
          <View style={[s.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Feather name="server" size={32} color={C.textSecondary} />
            <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hali server qo'shilmagan</Text>
            <Text style={[s.emptySubTxt, { color: C.textSecondary }]}>+ tugmasi orqali yangi server qo'shing</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ─── SMS SOZLAMALAR ────────────────────────────────────────
  function renderSms() {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }}>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>SMS Provider</Text>
          <View style={s.providerRow}>
            {["devsms", "eskiz"].map(p => (
              <TouchableOpacity key={p}
                style={[s.providerBtn, { borderColor: provider === p ? C.primary : C.border, backgroundColor: provider === p ? "#EEF2FF" : C.card }]}
                onPress={() => setSmsSettingsForm(f => ({ ...f, smsProvider: p }))}>
                <Feather name={p === "devsms" ? "smartphone" : "zap"} size={16} color={provider === p ? C.primary : C.textSecondary} />
                <Text style={[s.providerBtnTxt, { color: provider === p ? C.primary : C.textSecondary }]}>
                  {p === "devsms" ? "DevSMS.uz" : "Eskiz.uz"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {provider === "devsms" ? (
            <>
              <View style={[s.infoBanner, { backgroundColor: "#F0FDF4" }]}>
                <Feather name="info" size={13} color="#059669" />
                <Text style={[s.infoBannerTxt, { color: "#059669" }]}>devsms.uz dan API kalit va parol oling.</Text>
              </View>
              <SmsField label="DevSMS API kaliti" value={smsSettingsForm.devsmApiKey ?? ""} onChange={v => setSmsSettingsForm(f => ({ ...f, devsmApiKey: v }))} placeholder="API kalit..." />
              <SmsField label="DevSMS Parol" value={smsSettingsForm.devsmPassword ?? ""} onChange={v => setSmsSettingsForm(f => ({ ...f, devsmPassword: v }))} placeholder="Parol..." secure />
              <SmsField label="Yuboruvchi nomi" value={smsSettingsForm.devsmFrom ?? "Bluepos"} onChange={v => setSmsSettingsForm(f => ({ ...f, devsmFrom: v }))} placeholder="Bluepos" />
            </>
          ) : (
            <>
              <View style={[s.infoBanner, { backgroundColor: "#EEF2FF" }]}>
                <Feather name="info" size={13} color="#6366F1" />
                <Text style={[s.infoBannerTxt, { color: "#6366F1" }]}>notify.eskiz.uz dan ro'yxatdan o'ting va email/parolni kiriting.</Text>
              </View>
              <SmsField label="Eskiz Email (login)" value={smsSettingsForm.eskizLogin ?? ""} onChange={v => setSmsSettingsForm(f => ({ ...f, eskizLogin: v }))} placeholder="email@example.com" />
              <SmsField label="Eskiz Parol" value={smsSettingsForm.eskizPassword ?? ""} onChange={v => setSmsSettingsForm(f => ({ ...f, eskizPassword: v }))} placeholder="Parol..." secure />
              <SmsField label="Yuboruvchi ID (from)" value={smsSettingsForm.eskizFrom ?? "4546"} onChange={v => setSmsSettingsForm(f => ({ ...f, eskizFrom: v }))} placeholder="4546" />
            </>
          )}

          <TouchableOpacity style={[s.saveBtn, { backgroundColor: savingSettings ? C.border : C.primary }]}
            onPress={saveSettings} disabled={savingSettings}>
            {savingSettings ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnTxt}>Saqlash</Text>}
          </TouchableOpacity>
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>Test SMS yuborish</Text>
          <View style={s.testRow}>
            <TextInput style={[s.testInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
              value={testPhone} onChangeText={setTestPhone}
              placeholder="+998901234567" placeholderTextColor={C.textSecondary} keyboardType="phone-pad" />
            <TouchableOpacity style={[s.testBtn, { backgroundColor: C.primary }]} onPress={sendTestSms} disabled={testLoading || !testPhone}>
              {testLoading ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="send" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Telegram Bot Settings */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#0088CC22", alignItems: "center", justifyContent: "center" }}>
              <Feather name="send" size={14} color="#0088CC" />
            </View>
            <Text style={[s.cardTitle, { color: C.text, marginBottom: 0 }]}>Telegram Bot</Text>
          </View>

          <View style={[s.infoBanner, { backgroundColor: "#E0F2FE" }]}>
            <Feather name="info" size={13} color="#0284C7" />
            <Text style={[s.infoBannerTxt, { color: "#0284C7" }]}>
              @BotFather dan bot yarating, tokenni va admin chat ID sini kiriting. Do'kon egalari /start orqali ariza yuboradi.
            </Text>
          </View>

          <SmsField label="Bot Token" value={smsSettingsForm.telegramBotToken ?? ""}
            onChange={v => setSmsSettingsForm(f => ({ ...f, telegramBotToken: v }))}
            placeholder="1234567890:AAF..." secure />
          <SmsField label="Admin Chat ID" value={smsSettingsForm.telegramAdminChatId ?? ""}
            onChange={v => setSmsSettingsForm(f => ({ ...f, telegramAdminChatId: v }))}
            placeholder="-100123456789 yoki 123456789" />

          <TouchableOpacity style={[s.saveBtn, { backgroundColor: savingSettings ? C.border : "#0284C7", marginBottom: 8 }]}
            onPress={saveSettings} disabled={savingSettings}>
            {savingSettings ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnTxt}>Bot sozlamalarini saqlash</Text>}
          </TouchableOpacity>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: "#EEF2FF", paddingVertical: 10, justifyContent: "center" }]}
              onPress={loadBotInfo} disabled={botInfoLoading}>
              {botInfoLoading ? <ActivityIndicator color={C.primary} size="small" />
                : <><Feather name="user" size={14} color={C.primary} /><Text style={[s.actionBtnTxt, { color: C.primary }]}>Bot ma'lumoti</Text></>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: "#F0FDF4", paddingVertical: 10, justifyContent: "center" }]}
              onPress={setWebhook} disabled={settingWebhook}>
              {settingWebhook ? <ActivityIndicator color="#059669" size="small" />
                : <><Feather name="link" size={14} color="#059669" /><Text style={[s.actionBtnTxt, { color: "#059669" }]}>Webhook ulash</Text></>}
            </TouchableOpacity>
          </View>

          {botInfo?.result && (
            <View style={{ marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: "#F0FDF4" }}>
              <Text style={{ color: "#166534", fontFamily: "Inter_600SemiBold" }}>✅ Bot ulangan</Text>
              <Text style={{ color: "#166534", fontSize: 12 }}>@{botInfo.result.username} — {botInfo.result.first_name}</Text>
            </View>
          )}
          {botInfo && !botInfo.result && (
            <View style={{ marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: "#FEF2F2" }}>
              <Text style={{ color: "#DC2626", fontSize: 12 }}>❌ Bot ulanmagan. Token to'g'riligini tekshiring.</Text>
            </View>
          )}
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>SMS Loglar ({logs.length})</Text>
          {logs.slice(0, 30).map(log => (
            <View key={log.id} style={[s.logRow, { borderBottomColor: C.border }]}>
              <View style={[s.logDot, { backgroundColor: log.status === "sent" ? "#10B981" : "#EF4444" }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.logPhone, { color: C.text }]}>{log.phone}</Text>
                <Text style={[s.logMatn, { color: C.textSecondary }]} numberOfLines={1}>{log.matn}</Text>
              </View>
              <Text style={[s.logTime, { color: C.textSecondary }]}>
                {new Date(log.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          ))}
          {logs.length === 0 && <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hali log yo'q</Text>}
        </View>
      </ScrollView>
    );
  }

  // ─── MIJOZLAR ──────────────────────────────────────────────
  const [bulkSmsText, setBulkSmsText] = useState("");
  const [bulkSmsSending, setBulkSmsSending] = useState(false);
  const [alertSending, setAlertSending] = useState(false);

  const debtorCount = allCustomers.filter(c => (c.totalDebt || 0) > 0).length;
  const totalDebtSum = allCustomers.reduce((s, c) => s + (c.totalDebt || 0), 0);

  async function sendBulkSms() {
    if (!bulkSmsText.trim()) { Alert.alert("SMS matnini kiriting"); return; }
    setBulkSmsSending(true);
    try {
      const res = await apiReq<any>("/customers/sms-campaign", { method: "POST", body: JSON.stringify({ matn: bulkSmsText }) });
      Alert.alert("✅ Yuborildi!", `${res.sent}/${res.total} mijozga SMS yuborildi`);
      setBulkSmsText("");
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setBulkSmsSending(false); }
  }

  async function sendDebtReminders() {
    setAlertSending(true);
    try {
      const res = await apiReq<any>("/notifications/send-debt-alerts", { method: "POST", body: JSON.stringify({}) });
      Alert.alert("✅ Yuborildi!", `${res.sent} ta qarz eslatmasi yuborildi`);
      refetchAlerts();
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setAlertSending(false); }
  }

  function renderMijozlar() {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }}>
        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { lbl: "Jami mijozlar", val: allCustomers.length, color: C.primary },
            { lbl: "Qarzdorlar", val: debtorCount, color: "#EF4444" },
            { lbl: "2 kun ichida", val: debtAlerts.length, color: "#F59E0B" },
            { lbl: "Jami qarz", val: null, extra: totalDebtSum > 0 ? fmt(totalDebtSum) : "0", color: "#10B981" },
          ].map((st, i) => (
            <View key={i} style={[s.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
              {st.val !== null ? (
                <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
              ) : (
                <Text style={[s.statVal, { color: st.color, fontSize: 12 }]}>{st.extra}</Text>
              )}
              <Text style={[s.statLbl, { color: C.textSecondary }]}>{st.lbl}</Text>
            </View>
          ))}
        </View>

        {/* Debt alerts */}
        {debtAlerts.length > 0 && (
          <View style={[s.card, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={[s.cardTitle, { color: "#92400E" }]}>Yaqinlashayotgan to'lovlar ({debtAlerts.length})</Text>
              <TouchableOpacity onPress={sendDebtReminders} disabled={alertSending}
                style={[s.saveBtn, { backgroundColor: "#D97706", paddingHorizontal: 12, height: 36 }]}>
                {alertSending ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={[s.saveBtnTxt, { fontSize: 12 }]}>SMS eslatma</Text>
                )}
              </TouchableOpacity>
            </View>
            {debtAlerts.map(d => {
              const days = d.qaytarishMuddati ? Math.ceil((new Date(d.qaytarishMuddati).getTime() - Date.now()) / 86400000) : null;
              return (
                <View key={d.id} style={[s.logRow, { borderBottomColor: "#FDE68A" }]}>
                  <View style={[s.logDot, { backgroundColor: days !== null && days <= 0 ? "#EF4444" : "#F59E0B" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.logPhone, { color: "#78350F" }]}>{d.mijozIsm || "Noma'lum"} · {d.mijozPhone}</Text>
                    <Text style={[s.logMatn, { color: "#92400E" }]}>
                      Qarz: {fmt(d.qarzSumma ?? 0)} · {d.qaytarishMuddati ?? "—"}
                      {days !== null ? ` (${days <= 0 ? Math.abs(days) + " kun o'tgan" : days + " kun qoldi"})` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Bulk SMS */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>Aksiya SMS (barcha {allCustomers.length} mijozga)</Text>
          <Text style={[s.mLbl, { color: C.textSecondary }]}>&#123;ism&#125; - mijoz ismi almashadi</Text>
          <TextInput style={[s.mTextArea, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
            value={bulkSmsText} onChangeText={setBulkSmsText}
            placeholder="SMS matnini kiriting..." placeholderTextColor={C.textSecondary}
            multiline numberOfLines={3} />
          <TouchableOpacity style={[s.saveBtn, { backgroundColor: bulkSmsSending ? C.border : "#059669" }]}
            onPress={sendBulkSms} disabled={bulkSmsSending || !bulkSmsText.trim()}>
            {bulkSmsSending ? <ActivityIndicator color="#fff" size="small" /> : (
              <Text style={s.saveBtnTxt}>Barchaga yuborish</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Customer list */}
        <Text style={[s.mLbl, { color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.8 }]}>
          Mijozlar ro'yxati
        </Text>
        {customersLoading && <ActivityIndicator color={C.primary} />}
        {allCustomers.slice(0, 20).map(c => (
          <View key={c.id} style={[s.logRow, { borderBottomColor: C.border, paddingVertical: 10 }]}>
            <View style={[s.logDot, { backgroundColor: (c.totalDebt || 0) > 0 ? "#EF4444" : "#10B981", width: 10, height: 10, borderRadius: 5 }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.logPhone, { color: C.text }]}>{c.fullName}</Text>
              <Text style={[s.logMatn, { color: C.textSecondary }]}>{c.phone}{c.address ? ` · ${c.address}` : ""}</Text>
            </View>
            {(c.totalDebt || 0) > 0 && (
              <Text style={{ color: "#DC2626", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{fmt(c.totalDebt)}</Text>
            )}
          </View>
        ))}
        {allCustomers.length === 0 && !customersLoading && (
          <View style={[s.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Feather name="users" size={32} color={C.textSecondary} />
            <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hali mijoz yo'q</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ─── ISHCHILAR ─────────────────────────────────────────────
  async function toggleWorker(worker: Worker) {
    setTogglingWorker(worker.id);
    try {
      await apiReq(`/workers/${worker.id}`, { method: "PUT", body: JSON.stringify({ isActive: worker.isActive ? 0 : 1 }) });
      refetchWorkers();
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setTogglingWorker(null); }
  }

  function renderIshchilar() {
    const tailors   = allWorkers.filter(w => w.role === "tailor");
    const installers = allWorkers.filter(w => w.role === "installer");
    const managers  = allWorkers.filter(w => w.role === "manager");
    const totalActive = allWorkers.filter(w => w.isActive).length;

    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }}>
        {/* Summary */}
        <View style={s.statsRow}>
          {[
            { lbl: "Jami xodim",  val: allWorkers.length,  color: C.primary },
            { lbl: "Faol",        val: totalActive,         color: "#10B981" },
            { lbl: "Chevar",      val: tailors.length,      color: "#8B5CF6" },
            { lbl: "Haydovchi",   val: installers.length,   color: "#059669" },
          ].map((st, i) => (
            <View key={i} style={[s.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
              <Text style={[s.statLbl, { color: C.textSecondary }]}>{st.lbl}</Text>
            </View>
          ))}
        </View>

        {workersLoading && <ActivityIndicator color={C.primary} />}

        {([
          { list: tailors,   label: "🧵 Chevarlar",    color: "#8B5CF6" },
          { list: installers, label: "🚗 Haydovchilar", color: "#059669" },
          { list: managers,  label: "👔 Menejerlar",   color: "#3B82F6" },
        ] as { list: Worker[]; label: string; color: string }[]).map(group => (
          group.list.length > 0 ? (
            <View key={group.label}>
              <Text style={[s.wGroupTitle, { color: group.color }]}>{group.label} ({group.list.length})</Text>
              {group.list.map(w => (
                <View key={w.id} style={[s.wCard, { backgroundColor: C.card, borderColor: w.isActive ? C.border : "#FEE2E2" }]}>
                  <View style={[s.wIconWrap, { backgroundColor: group.color + "15" }]}>
                    <Feather name={w.role === "tailor" ? "scissors" : w.role === "installer" ? "truck" : "briefcase"} size={18} color={group.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.wName, { color: C.text }]}>{w.fullName}</Text>
                    <Text style={[s.wMeta, { color: C.textSecondary }]}>
                      {w.phone || "Telefon yo'q"} · {w.activeDealCount} ta faol ish
                    </Text>
                    {w.oylikStavka ? (
                      <Text style={[s.wMeta, { color: "#10B981" }]}>Stavka: {fmt(w.oylikStavka)}</Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View style={[s.wBadge, { backgroundColor: w.isActive ? "#D1FAE5" : "#FEE2E2" }]}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: w.isActive ? "#059669" : "#DC2626" }}>
                        {w.isActive ? "Faol" : "Bloklangan"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[s.wToggleBtn, { backgroundColor: w.isActive ? "#FEE2E2" : "#D1FAE5" }]}
                      onPress={() => toggleWorker(w)}
                      disabled={togglingWorker === w.id}
                    >
                      {togglingWorker === w.id
                        ? <ActivityIndicator size="small" color={w.isActive ? "#DC2626" : "#059669"} />
                        : <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: w.isActive ? "#DC2626" : "#059669" }}>
                            {w.isActive ? "Bloklash" : "Ochish"}
                          </Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null
        ))}

        {allWorkers.length === 0 && !workersLoading && (
          <View style={[s.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Feather name="users" size={32} color={C.textSecondary} />
            <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hali xodim qo'shilmagan</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ─── BUYURTMALAR ───────────────────────────────────────────
  function renderBuyurtmalar() {
    const totalNarx = allDeals.reduce((s: number, d: any) => s + (d.totalNarx || 0), 0);
    const totalQarz = allDeals.reduce((s: number, d: any) => s + (d.qarzSumma || 0), 0);

    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 100 }}>
        {/* Status filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {DEAL_STATUSES.map(st => {
              const info = DEAL_STATUS_LABELS[st];
              const active = dealStatusFilter === st;
              return (
                <TouchableOpacity
                  key={st}
                  style={[s.dealFilterBtn, { backgroundColor: active ? info.color : C.card, borderColor: active ? info.color : C.border }]}
                  onPress={() => setDealStatusFilter(st)}
                >
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: active ? "#fff" : C.textSecondary }}>
                    {info.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Summary row */}
        <View style={s.statsRow}>
          {[
            { lbl: "Buyurtmalar", val: String(allDeals.length),     color: C.primary },
            { lbl: "Jami summa",  val: fmt(totalNarx),              color: "#10B981" },
            { lbl: "Jami qarz",   val: totalQarz > 0 ? fmt(totalQarz) : "Yo'q", color: totalQarz > 0 ? "#EF4444" : C.textSecondary },
          ].map((st, i) => (
            <View key={i} style={[s.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[{ fontSize: 14, fontFamily: "Inter_700Bold", color: st.color }]}>{st.val}</Text>
              <Text style={[s.statLbl, { color: C.textSecondary }]}>{st.lbl}</Text>
            </View>
          ))}
        </View>

        {dealsLoading && <ActivityIndicator color={C.primary} />}

        {allDeals.map((d: any) => {
          const stInfo = DEAL_STATUS_LABELS[d.status] || { label: d.status, color: "#6B7280" };
          const date = d.createdAt ? new Date(d.createdAt).toLocaleDateString("uz-UZ") : "—";
          return (
            <View key={d.id} style={[s.dealCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={s.dealCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.dealName, { color: C.text }]}>{d.mijozIsm || "Noma'lum"}</Text>
                  <Text style={[s.dealMeta, { color: C.textSecondary }]}>#{d.id} · {date} · {d.mijozPhone || ""}</Text>
                </View>
                <View style={[s.dealBadge, { backgroundColor: stInfo.color + "20" }]}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: stInfo.color }}>{stInfo.label}</Text>
                </View>
              </View>
              <View style={s.dealInfoRow}>
                {d.totalNarx ? (
                  <View style={s.dealInfoItem}>
                    <Text style={[s.dealInfoLbl, { color: C.textSecondary }]}>Jami</Text>
                    <Text style={[s.dealInfoVal, { color: "#10B981" }]}>{fmt(d.totalNarx)}</Text>
                  </View>
                ) : null}
                {d.qarzSumma > 0 ? (
                  <View style={s.dealInfoItem}>
                    <Text style={[s.dealInfoLbl, { color: C.textSecondary }]}>Qarz</Text>
                    <Text style={[s.dealInfoVal, { color: "#EF4444" }]}>{fmt(d.qarzSumma)}</Text>
                  </View>
                ) : null}
                {d.totalMaterial ? (
                  <View style={s.dealInfoItem}>
                    <Text style={[s.dealInfoLbl, { color: C.textSecondary }]}>Material</Text>
                    <Text style={[s.dealInfoVal, { color: "#8B5CF6" }]}>{d.totalMaterial.toFixed(1)} m²</Text>
                  </View>
                ) : null}
                {d.manzil ? (
                  <View style={[s.dealInfoItem, { flex: 2 }]}>
                    <Text style={[s.dealInfoLbl, { color: C.textSecondary }]}>Manzil</Text>
                    <Text style={[s.dealInfoVal, { color: C.text, fontSize: 12 }]} numberOfLines={1}>{d.manzil}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}

        {allDeals.length === 0 && !dealsLoading && (
          <View style={[s.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Feather name="shopping-bag" size={32} color={C.textSecondary} />
            <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Bu statusda buyurtma yo'q</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ─── SHABLONLAR ────────────────────────────────────────────
  function renderShablonlar() {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 100 }}>
        {tplLoading && <ActivityIndicator color={C.primary} />}
        {!tplLoading && templates.length === 0 && (
          <View style={[s.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Feather name="message-circle" size={32} color={C.textSecondary} />
            <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hali shablon yo'q</Text>
          </View>
        )}
        {templates.map(t => (
          <View key={t.id} style={[s.tplCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={s.tplHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[s.tplName, { color: C.text }]}>{t.nomi}</Text>
                <View style={[s.tplBadge, { backgroundColor: "#EEF2FF" }]}>
                  <Text style={[s.tplBadgeTxt, { color: C.primary }]}>{t.tur}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={[s.tplActionBtn, { backgroundColor: "#EEF2FF" }]}
                  onPress={() => { setEditTpl(t); setTplForm({ nomi: t.nomi, matn: t.matn, tur: t.tur }); setModal("template"); }}>
                  <Feather name="edit-2" size={14} color={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[s.tplActionBtn, { backgroundColor: "#FEE2E2" }]}
                  onPress={() => Alert.alert("O'chirish", `"${t.nomi}" ni o'chirishni istaysizmi?`, [
                    { text: "Bekor" }, { text: "O'chirish", style: "destructive", onPress: () => tplDeleteMut.mutate(t.id) },
                  ])}>
                  <Feather name="trash-2" size={14} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={[s.tplBody, { backgroundColor: C.surface }]}>
              <Text style={[s.tplBodyTxt, { color: C.textSecondary }]}>{t.matn}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: topPad, backgroundColor: C.card, borderBottomColor: C.border }]}>
        <View style={[s.headerIcon, { backgroundColor: C.primary }]}>
          <Feather name="shield" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: C.text }]}>Super Admin</Text>
          <Text style={[s.headerSub, { color: C.textSecondary }]}>{user?.username}</Text>
        </View>
        <TouchableOpacity style={[s.logoutBtn, { backgroundColor: "#FEE2E2" }]}
          onPress={() => Alert.alert("Chiqish", "Profildan chiqmoqchimisiz?", [
            { text: "Bekor" },
            { text: "Chiqish", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); } },
          ])}>
          <Feather name="log-out" size={16} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.tabsWrap, { backgroundColor: C.card, borderBottomColor: C.border }]}
        contentContainerStyle={s.tabs}>
        {[
          { key: "dokonlar" as Tab,     lbl: "Do'konlar",    icon: "shopping-bag" as const },
          { key: "arizalar" as Tab,     lbl: "Arizalar",     icon: "inbox" as const, badge: shopRequests.filter(r => r.status === "pending").length },
          { key: "infratuzilma" as Tab, lbl: "Infratuzilma", icon: "server" as const },
          { key: "buyurtmalar" as Tab,  lbl: "Buyurtmalar",  icon: "list" as const },
          { key: "ishchilar" as Tab,    lbl: "Ishchilar",    icon: "users" as const },
          { key: "mijozlar" as Tab,     lbl: "Mijozlar",     icon: "user" as const },
          { key: "sms" as Tab,          lbl: "SMS/Bot",      icon: "message-square" as const },
          { key: "shablonlar" as Tab,   lbl: "Shablonlar",   icon: "message-circle" as const },
        ].map(t => (
          <TouchableOpacity key={t.key}
            style={[s.tabBtn, activeTab === t.key && { borderBottomWidth: 2.5, borderBottomColor: C.primary }]}
            onPress={() => setActiveTab(t.key)}>
            <View style={{ position: "relative" }}>
              <Feather name={t.icon} size={14} color={activeTab === t.key ? C.primary : C.textSecondary} />
              {(t as any).badge > 0 && (
                <View style={{ position: "absolute", top: -4, right: -6, backgroundColor: "#EF4444", borderRadius: 6, width: 12, height: 12, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 8, fontFamily: "Inter_700Bold" }}>{(t as any).badge}</Text>
                </View>
              )}
            </View>
            <Text style={[s.tabBtnTxt, { color: activeTab === t.key ? C.primary : C.textSecondary }]}>{t.lbl}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === "dokonlar" && renderDokonlar()}
      {activeTab === "arizalar" && renderArizalar()}
      {activeTab === "infratuzilma" && renderInfratuzilma()}
      {activeTab === "sms" && renderSms()}
      {activeTab === "shablonlar" && renderShablonlar()}
      {activeTab === "mijozlar" && renderMijozlar()}
      {activeTab === "ishchilar" && renderIshchilar()}
      {activeTab === "buyurtmalar" && renderBuyurtmalar()}

      {(activeTab === "dokonlar" || activeTab === "shablonlar" || activeTab === "infratuzilma") && (
        <TouchableOpacity style={[s.fab, { backgroundColor: C.primary, bottom: insets.bottom + 20 }]}
          onPress={() => {
            if (activeTab === "dokonlar") { setCreateForm({ name: "", phone: "", address: "", ownerUsername: "", ownerPassword: "", ownerFullName: "" }); setModal("create"); }
            else if (activeTab === "shablonlar") { setEditTpl(null); setTplForm({ nomi: "", matn: "", tur: "umumiy" }); setModal("template"); }
            else if (activeTab === "infratuzilma") { setServerForm({ name: "", url: "", description: "" }); setModal("server"); }
          }}>
          <Feather name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ─── MODALS ─── */}
      <MModal visible={modal === "create"} title="Yangi do'kon" onClose={() => setModal(null)}>
        <View style={{ gap: 12 }}>
          <MField label="Do'kon nomi *" value={createForm.name} onChange={v => setCreateForm(f => ({ ...f, name: v }))} placeholder="Parda Plus" />
          <MField label="Telefon *" value={createForm.phone} onChange={v => setCreateForm(f => ({ ...f, phone: v }))} placeholder="+998901234567" keyboard="phone-pad" />
          <MField label="Manzil" value={createForm.address} onChange={v => setCreateForm(f => ({ ...f, address: v }))} placeholder="Shahar, ko'cha" />
          <MField label="Ega to'liq ismi" value={createForm.ownerFullName} onChange={v => setCreateForm(f => ({ ...f, ownerFullName: v }))} placeholder="To'liq ismi" />
          <View style={[s.divider, { borderTopColor: C.border }]} />
          <Text style={[s.dividerLbl, { color: C.textSecondary }]}>ADMIN KIRISH MA'LUMOTLARI</Text>
          <MField label="Login *" value={createForm.ownerUsername} onChange={v => setCreateForm(f => ({ ...f, ownerUsername: v }))} placeholder="pardaplus_admin" />
          <MField label="Parol *" value={createForm.ownerPassword} onChange={v => setCreateForm(f => ({ ...f, ownerPassword: v }))} placeholder="Kamida 6 ta belgi" secure />
          <TouchableOpacity style={[s.modalSaveBtn, { backgroundColor: createMut.isPending ? C.border : C.primary }]}
            onPress={() => createMut.mutate()} disabled={createMut.isPending}>
            {createMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSaveBtnTxt}>Yaratish</Text>}
          </TouchableOpacity>
        </View>
      </MModal>

      <MModal visible={modal === "topup"} title={`Balans: ${selectedShop?.name}`} onClose={() => setModal(null)}>
        <View style={{ gap: 12 }}>
          <Text style={[s.mLbl, { color: C.textSecondary }]}>Joriy balans: <Text style={{ color: "#10B981" }}>{fmt(selectedShop?.balance ?? 0)}</Text></Text>
          <MField label="Miqdor (so'm)" value={topupAmount} onChange={setTopupAmount} placeholder="100000" keyboard="numeric" />
          <TouchableOpacity style={[s.modalSaveBtn, { backgroundColor: topupMut.isPending ? C.border : "#10B981" }]}
            onPress={() => topupMut.mutate()} disabled={topupMut.isPending}>
            {topupMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSaveBtnTxt}>To'ldirish</Text>}
          </TouchableOpacity>
        </View>
      </MModal>

      <MModal visible={modal === "creds"} title="Login/Parol o'zgartirish" onClose={() => setModal(null)}>
        <View style={{ gap: 12 }}>
          <MField label="Yangi login" value={credsForm.username} onChange={v => setCredsForm(f => ({ ...f, username: v }))} placeholder="username" />
          <MField label="Yangi parol" value={credsForm.password} onChange={v => setCredsForm(f => ({ ...f, password: v }))} placeholder="Yangi parol" secure />
          <TouchableOpacity style={[s.modalSaveBtn, { backgroundColor: credsMut.isPending ? C.border : C.primary }]}
            onPress={() => credsMut.mutate()} disabled={credsMut.isPending}>
            {credsMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSaveBtnTxt}>Saqlash</Text>}
          </TouchableOpacity>
        </View>
      </MModal>

      <MModal visible={modal === "template"} title={editTpl ? "Shablonni tahrirlash" : "Yangi shablon"} onClose={() => setModal(null)}>
        <View style={{ gap: 12 }}>
          <MField label="Nomi *" value={tplForm.nomi} onChange={v => setTplForm(f => ({ ...f, nomi: v }))} placeholder="Xarid tasdiqlandi" />
          <MField label="Shablon turi" value={tplForm.tur} onChange={v => setTplForm(f => ({ ...f, tur: v }))} placeholder="umumiy / xarid / eslatma" />
          <View>
            <Text style={[s.mLbl, { color: C.textSecondary }]}>Matn *</Text>
            <TextInput style={[s.mTextArea, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
              value={tplForm.matn} onChangeText={v => setTplForm(f => ({ ...f, matn: v }))}
              placeholder="SMS matni..." placeholderTextColor={C.textSecondary}
              multiline numberOfLines={4} />
          </View>
          <TouchableOpacity style={[s.modalSaveBtn, { backgroundColor: C.primary }]}
            onPress={() => editTpl ? tplUpdateMut.mutate() : tplCreateMut.mutate()}
            disabled={tplCreateMut.isPending || tplUpdateMut.isPending}>
            <Text style={s.modalSaveBtnTxt}>{editTpl ? "Saqlash" : "Yaratish"}</Text>
          </TouchableOpacity>
        </View>
      </MModal>

      <MModal visible={modal === "server"} title="Yangi server qo'shish" onClose={() => setModal(null)}>
        <View style={{ gap: 12 }}>
          <MField label="Server nomi *" value={serverForm.name} onChange={v => setServerForm(f => ({ ...f, name: v }))} placeholder="Asosiy server" />
          <MField label="Server URL *" value={serverForm.url} onChange={v => setServerForm(f => ({ ...f, url: v }))} placeholder="https://api.example.com" keyboard="url" />
          <MField label="Tavsif" value={serverForm.description} onChange={v => setServerForm(f => ({ ...f, description: v }))} placeholder="Ixtiyoriy tavsif" />
          <TouchableOpacity style={[s.modalSaveBtn, { backgroundColor: serverCreateMut.isPending ? C.border : C.primary }]}
            onPress={() => serverCreateMut.mutate()} disabled={serverCreateMut.isPending}>
            {serverCreateMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSaveBtnTxt}>Qo'shish</Text>}
          </TouchableOpacity>
        </View>
      </MModal>

      {/* ─── Approve Shop Request Modal ─── */}
      <MModal visible={modal === "approve"} title={`Tasdiqlash: ${selectedRequest?.shopName ?? ""}`} onClose={() => setModal(null)}>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
          <View style={{ gap: 14 }}>
            {selectedRequest && (
              <View style={{ backgroundColor: "#F0FDF4", borderRadius: 10, padding: 12, gap: 4 }}>
                <Text style={{ color: "#166534", fontFamily: "Inter_600SemiBold" }}>📌 {selectedRequest.shopName}</Text>
                <Text style={{ color: "#166534", fontSize: 13 }}>📞 {selectedRequest.phone}</Text>
                <Text style={{ color: "#166534", fontSize: 13 }}>
                  👤 @{selectedRequest.telegramUsername ?? selectedRequest.telegramUserId}
                </Text>
                <Text style={{ color: "#166534", fontSize: 13 }}>
                  ⏳ So'ralgan: {selectedRequest.requestedMonths === 1 ? "1 oy" : selectedRequest.requestedMonths === 3 ? "3 oy" : `${selectedRequest.requestedMonths} oy`}
                </Text>
              </View>
            )}

            {/* Subscription months selector */}
            <View style={{ gap: 6 }}>
              <Text style={[s.mLbl, { color: C.textSecondary }]}>Obuna muddati (tasdiqlash)</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {[
                  { val: "1", lbl: "1 oy" },
                  { val: "3", lbl: "3 oy" },
                  { val: "12", lbl: "12 oy" },
                ].map(opt => (
                  <TouchableOpacity key={opt.val}
                    style={{ flex: 1, minWidth: 70, paddingVertical: 10, borderRadius: 8, alignItems: "center",
                      backgroundColor: approveForm.months === opt.val ? C.primary : C.surface,
                      borderWidth: 1, borderColor: approveForm.months === opt.val ? C.primary : C.border }}
                    onPress={() => setApproveForm(f => ({ ...f, months: opt.val }))}>
                    <Text style={{ color: approveForm.months === opt.val ? "#fff" : C.text, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                      {opt.lbl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <SmsField label="Login (ixtiyoriy)" value={approveForm.ownerUsername}
              onChange={v => setApproveForm(f => ({ ...f, ownerUsername: v }))} placeholder="pardaplus_admin (avtomatik)" />
            <SmsField label="Parol (ixtiyoriy)" value={approveForm.ownerPassword}
              onChange={v => setApproveForm(f => ({ ...f, ownerPassword: v }))} placeholder="(avtomatik yaratiladi)" secure />
            <SmsField label="Izoh (ixtiyoriy)" value={approveForm.adminNote}
              onChange={v => setApproveForm(f => ({ ...f, adminNote: v }))} placeholder="Foydalanuvchiga izoh..." />

            <TouchableOpacity style={[s.modalSaveBtn, { backgroundColor: C.primary }]} onPress={approveRequest}>
              <Feather name="check-circle" size={16} color="#fff" />
              <Text style={s.modalSaveBtnTxt}>Tasdiqlash va do'kon ochish</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </MModal>

      {/* ─── Per-shop SMS Settings Modal ─── */}
      <MModal visible={modal === "shop_sms"} title={`SMS: ${selectedShop?.name ?? ""}`} onClose={() => setModal(null)}>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
          <View style={{ gap: 14 }}>
            {shopSmsLoading && <ActivityIndicator color={C.primary} />}

            {/* Provider selector */}
            <View style={{ gap: 6 }}>
              <Text style={[s.mLbl, { color: C.textSecondary }]}>SMS Provayder</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[{ key: "eskiz", lbl: "Eskiz.uz" }, { key: "devsms", lbl: "DevSMS.uz" }].map(p => (
                  <TouchableOpacity key={p.key}
                    style={[s.actionBtn, { flex: 1, justifyContent: "center", paddingVertical: 10,
                      backgroundColor: shopSmsProvider === p.key ? C.primary : C.surface,
                      borderWidth: 1, borderColor: shopSmsProvider === p.key ? C.primary : C.border }]}
                    onPress={() => setShopSmsForm(f => ({ ...f, smsProvider: p.key }))}>
                    <Text style={{ color: shopSmsProvider === p.key ? "#fff" : C.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {p.lbl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Eskiz fields */}
            {shopSmsProvider === "eskiz" && (
              <>
                <SmsField label="Eskiz Email" value={shopSmsForm.eskizLogin} onChange={v => setShopSmsForm(f => ({ ...f, eskizLogin: v }))} placeholder="email@example.com" />
                <SmsField label="Eskiz Parol" value={shopSmsForm.eskizPassword} onChange={v => setShopSmsForm(f => ({ ...f, eskizPassword: v }))} placeholder="••••••••" secure />
                <SmsField label="From ID (sender name)" value={shopSmsForm.eskizFrom} onChange={v => setShopSmsForm(f => ({ ...f, eskizFrom: v }))} placeholder="4546" />
              </>
            )}

            {/* DevSMS fields */}
            {shopSmsProvider === "devsms" && (
              <>
                <SmsField label="DevSMS API Kalit (Bearer)" value={shopSmsForm.devsmApiKey} onChange={v => setShopSmsForm(f => ({ ...f, devsmApiKey: v }))} placeholder="API key..." secure />
                <SmsField label="Yuboruvchi nomi" value={shopSmsForm.devsmFrom} onChange={v => setShopSmsForm(f => ({ ...f, devsmFrom: v }))} placeholder="Bluepos" />
              </>
            )}

            {/* Save */}
            <TouchableOpacity style={[s.modalSaveBtn, { backgroundColor: shopSmsLoading ? C.border : C.primary }]}
              onPress={saveShopSms} disabled={shopSmsLoading}>
              {shopSmsLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSaveBtnTxt}>Saqlash</Text>}
            </TouchableOpacity>

            {/* Test SMS */}
            <View style={[s.divider, { borderTopColor: C.border, marginVertical: 4 }]} />
            <Text style={[s.dividerLbl, { color: C.textSecondary }]}>SINOV SMS</Text>
            <SmsField label="Test telefon raqami" value={shopSmsTestPhone} onChange={setShopSmsTestPhone} placeholder="+998901234567" />
            <TouchableOpacity style={[s.modalSaveBtn, { backgroundColor: shopSmsTestLoading || !shopSmsTestPhone ? C.border : "#059669" }]}
              onPress={testShopSms} disabled={shopSmsTestLoading || !shopSmsTestPhone}>
              {shopSmsTestLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSaveBtnTxt}>Test SMS yuborish</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </MModal>
    </View>
  );
}

function SmsField({ label, value, onChange, placeholder, secure }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; secure?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.mLbl, { color: C.textSecondary }]}>{label}</Text>
      <TextInput style={[s.mInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
        value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.textSecondary}
        secureTextEntry={!!secure} autoCapitalize="none" />
    </View>
  );
}

function MModal({ visible, title, onClose, children }: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalBox, { backgroundColor: C.card }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: C.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={C.textSecondary} /></TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function MField({ label, value, onChange, placeholder, secure, keyboard }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; secure?: boolean; keyboard?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.mLbl, { color: C.textSecondary }]}>{label}</Text>
      <TextInput style={[s.mInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
        value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.textSecondary}
        secureTextEntry={!!secure} keyboardType={(keyboard || "default") as any} autoCapitalize="none" />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16,
    paddingBottom: 14, borderBottomWidth: 1,
  },
  headerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  logoutBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  noAccessTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  tabsWrap: { borderBottomWidth: 1, maxHeight: 50 },
  tabs: { flexDirection: "row", paddingHorizontal: 4 },
  tabBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 14, marginHorizontal: 2,
  },
  tabBtnTxt: { fontSize: 13, fontFamily: "Inter_500Medium" },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, gap: 4 },
  statVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  shopCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  shopCardTop: { flexDirection: "row", gap: 12, padding: 14, alignItems: "flex-start" },
  shopDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  shopName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  shopMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  shopBalance: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  shopActions: { flexDirection: "row", borderTopWidth: 1, gap: 1 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10,
  },
  actionBtnTxt: { fontSize: 12, fontFamily: "Inter_500Medium" },
  serverCard: { borderRadius: 14, overflow: "hidden" },
  serverCardTop: { flexDirection: "row", gap: 12, padding: 14, alignItems: "flex-start" },
  serverIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  serverName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  serverUrl: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  serverDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  primaryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  primaryBadgeTxt: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  serverStatus: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1 },
  serverStatusTxt: { fontSize: 12, fontFamily: "Inter_500Medium" },
  serverLastCheck: { fontSize: 11, fontFamily: "Inter_400Regular" },
  serverActions: { flexDirection: "row", borderTopWidth: 1, gap: 1 },
  srvBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 9,
  },
  srvBtnTxt: { fontSize: 11, fontFamily: "Inter_500Medium" },
  infoBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12,
    borderRadius: 10, borderWidth: 1,
  },
  infoBannerTxt: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  providerRow: { flexDirection: "row", gap: 10 },
  providerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1.5 },
  providerBtnTxt: { fontSize: 13, fontFamily: "Inter_500Medium" },
  saveBtn: { height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saveBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  testRow: { flexDirection: "row", gap: 10 },
  testInput: { flex: 1, height: 46, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  testBtn: { width: 46, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  logRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 0.5 },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logPhone: { fontSize: 13, fontFamily: "Inter_500Medium" },
  logMatn: { fontSize: 12, fontFamily: "Inter_400Regular" },
  logTime: { fontSize: 11 },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: "center", gap: 10 },
  emptyTxt: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
  emptySubTxt: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  tplCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tplHeader: { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 12 },
  tplName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tplBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4, alignSelf: "flex-start" },
  tplBadgeTxt: { fontSize: 11, fontFamily: "Inter_500Medium" },
  tplActionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tplBody: { padding: 12 },
  tplBodyTxt: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  fab: {
    position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalBox: { width: "100%", maxWidth: 420, borderRadius: 20, padding: 24, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  mLbl: { fontSize: 12, fontFamily: "Inter_500Medium" },
  mInput: { height: 46, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  mTextArea: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingTop: 10, fontSize: 14, minHeight: 100, textAlignVertical: "top" },
  modalSaveBtn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalSaveBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  divider: { borderTopWidth: 1, marginVertical: 4 },
  dividerLbl: { fontSize: 11, fontFamily: "Inter_500Medium" },
  wGroupTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 8, marginBottom: 6 },
  wCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8,
  },
  wIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  wName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  wMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  wBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  wToggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  dealFilterBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5,
  },
  dealCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  dealCardTop: { flexDirection: "row", alignItems: "flex-start", padding: 12, gap: 10 },
  dealName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  dealMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  dealBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  dealInfoRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    paddingHorizontal: 12, paddingBottom: 12,
  },
  dealInfoItem: { alignItems: "flex-start", minWidth: 80 },
  dealInfoLbl: { fontSize: 10, fontFamily: "Inter_400Regular" },
  dealInfoVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
});
