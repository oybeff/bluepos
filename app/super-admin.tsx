import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Modal,
  FlatList, Switch,
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
interface SmsTemplate { id: number; nomi: string; matn: string; tur: string; faol: boolean; }
interface SmsSettings { smsProvider: string; eskizToken: string | null; eskizFrom: string; devsmApiKey: string | null; devsmPassword: string | null; }
interface SmsLog { id: number; phone: string; matn: string; status: string; createdAt: string; }

type Tab = "dokonlar" | "sms" | "shablonlar";

function fmt(n: number) { return new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0)) + " so'm"; }
function ago(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Bugun";
  if (days === 1) return "Kecha";
  return `${days} kun oldin`;
}

export default function SuperAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user, logout } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const [activeTab, setActiveTab] = useState<Tab>("dokonlar");
  const [modal, setModal] = useState<"create" | "creds" | "topup" | "template" | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [editTpl, setEditTpl] = useState<SmsTemplate | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", phone: "", address: "", ownerUsername: "", ownerPassword: "", ownerFullName: "" });
  const [credsForm, setCredsForm] = useState({ username: "", password: "" });
  const [topupAmount, setTopupAmount] = useState("");
  const [tplForm, setTplForm] = useState({ nomi: "", matn: "", tur: "umumiy" });
  const [smsSettingsForm, setSmsSettingsForm] = useState<Record<string, string>>({ smsProvider: "eskiz", eskizToken: "", eskizFrom: "4546", devsmApiKey: "", devsmPassword: "" });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  if (user?.role !== "super_admin") {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <Feather name="lock" size={40} color="#DC2626" />
        <Text style={[s.noAccessTitle, { color: C.text }]}>Ruxsat yo'q</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: C.primary }}>Orqaga</Text></TouchableOpacity>
      </View>
    );
  }

  // ─── Queries ───────────────────────────────────────────────
  const { data: shops = [], isLoading: shopsLoading, refetch: refetchShops } = useQuery<Shop[]>({
    queryKey: ["super-admin-shops"],
    queryFn: async () => await apiReq("/super-admin/shops") as Shop[],
  });
  const { data: stats } = useQuery<any>({
    queryKey: ["super-admin-stats"],
    queryFn: async () => await apiReq("/super-admin/stats") as any,
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

  useEffect(() => {
    if (smsSettings && !settingsLoaded) {
      setSmsSettingsForm({
        smsProvider: smsSettings.smsProvider || "eskiz",
        eskizToken: smsSettings.eskizToken || "",
        eskizFrom: smsSettings.eskizFrom || "4546",
        devsmApiKey: smsSettings.devsmApiKey || "",
        devsmPassword: smsSettings.devsmPassword || "",
      });
      setSettingsLoaded(true);
    }
  }, [smsSettings, settingsLoaded]);

  // ─── Mutations ─────────────────────────────────────────────
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["super-admin-shops", "super-admin-stats"] }); },
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

  const provider = smsSettingsForm.smsProvider;

  // ─── DO'KONLAR TAB ──────────────────────────────────────────
  function renderDokonlar() {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }}>
        {/* Stats */}
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
              <View style={[s.shopDot, { backgroundColor: shop.isActive && shop.subscriptionActive ? "#10B981" : "#EF4444" }]} />
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
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: "#D1FAE5" }]}
                onPress={() => { setSelectedShop(shop); setTopupAmount(""); setModal("topup"); }}
              >
                <Feather name="dollar-sign" size={15} color="#059669" />
                <Text style={[s.actionBtnTxt, { color: "#059669" }]}>Balans</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: "#EEF2FF" }]}
                onPress={() => { setSelectedShop(shop); setCredsForm({ username: shop.owner?.username || "", password: "" }); setModal("creds"); }}
              >
                <Feather name="key" size={15} color={C.primary} />
                <Text style={[s.actionBtnTxt, { color: C.primary }]}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: shop.isActive ? "#FEE2E2" : "#D1FAE5" }]}
                onPress={() => {
                  Alert.alert(shop.isActive ? "Bloklash" : "Faollashtirish", `${shop.name} ni ${shop.isActive ? "bloklamoqchi" : "faollashtirishni"} istaysizmi?`, [
                    { text: "Bekor" }, { text: "Ha", onPress: () => toggleMut.mutate(shop.id) },
                  ]);
                }}
              >
                <Feather name={shop.isActive ? "toggle-right" : "toggle-left"} size={15} color={shop.isActive ? "#DC2626" : "#059669"} />
                <Text style={[s.actionBtnTxt, { color: shop.isActive ? "#DC2626" : "#059669" }]}>{shop.isActive ? "Blok" : "Ochish"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  // ─── SMS SOZLAMALAR TAB ────────────────────────────────────
  function renderSms() {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }}>
        {/* Provider */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>SMS Provider</Text>
          <View style={s.providerRow}>
            {["eskiz", "devsms"].map(p => (
              <TouchableOpacity
                key={p}
                style={[s.providerBtn, { borderColor: provider === p ? C.primary : C.border, backgroundColor: provider === p ? C.surface : C.card }]}
                onPress={() => setSmsSettingsForm(f => ({ ...f, smsProvider: p }))}
              >
                <Feather name={p === "eskiz" ? "zap" : "smartphone"} size={16} color={provider === p ? C.primary : C.textSecondary} />
                <Text style={[s.providerBtnTxt, { color: provider === p ? C.primary : C.textSecondary }]}>
                  {p === "eskiz" ? "Eskiz.uz" : "DevSMS.uz"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {provider === "eskiz" ? (
            <>
              <SmsField label="Eskiz Token" value={smsSettingsForm.eskizToken ?? ""} onChange={v => setSmsSettingsForm(f => ({ ...f, eskizToken: v }))} placeholder="Bearer token..." />
              <SmsField label="Yuboruvchi nomi" value={smsSettingsForm.eskizFrom ?? "4546"} onChange={v => setSmsSettingsForm(f => ({ ...f, eskizFrom: v }))} placeholder="4546" />
            </>
          ) : (
            <>
              <View style={[s.infoBanner, { backgroundColor: "#EEF2FF" }]}>
                <Feather name="info" size={14} color={C.primary} />
                <Text style={[s.infoBannerTxt, { color: C.primary }]}>DevSMS.uz — O'zbekiston SMS xizmati. devsms.uz saytidan API kalitini oling.</Text>
              </View>
              <SmsField label="DevSMS API kaliti" value={smsSettingsForm.devsmApiKey ?? ""} onChange={v => setSmsSettingsForm(f => ({ ...f, devsmApiKey: v }))} placeholder="API kalit..." />
              <SmsField label="DevSMS Parol" value={smsSettingsForm.devsmPassword ?? ""} onChange={v => setSmsSettingsForm(f => ({ ...f, devsmPassword: v }))} placeholder="Parol..." secure />
            </>
          )}

          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: savingSettings ? C.border : C.primary }]}
            onPress={saveSettings}
            disabled={savingSettings}
          >
            {savingSettings ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnTxt}>Saqlash</Text>}
          </TouchableOpacity>
        </View>

        {/* Test SMS */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>Test SMS</Text>
          <View style={s.testRow}>
            <TextInput
              style={[s.testInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
              value={testPhone}
              onChangeText={setTestPhone}
              placeholder="+998901234567"
              placeholderTextColor={C.textSecondary}
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              style={[s.testBtn, { backgroundColor: C.primary }]}
              onPress={sendTestSms}
              disabled={testLoading || !testPhone}
            >
              {testLoading ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="zap" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Logs */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>SMS Loglar ({logs.length})</Text>
          {logs.slice(0, 20).map(log => (
            <View key={log.id} style={[s.logRow, { borderBottomColor: C.border }]}>
              <View style={[s.logDot, { backgroundColor: log.status === "sent" ? "#10B981" : "#EF4444" }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.logPhone, { color: C.text }]}>{log.phone}</Text>
                <Text style={[s.logMatn, { color: C.textSecondary }]} numberOfLines={1}>{log.matn}</Text>
              </View>
              <Text style={[s.logTime, { color: C.textSecondary }]}>{new Date(log.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}</Text>
            </View>
          ))}
          {logs.length === 0 && <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hali log yo'q</Text>}
        </View>
      </ScrollView>
    );
  }

  // ─── SHABLONLAR TAB ────────────────────────────────────────
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
                <View style={[s.tplBadge, { backgroundColor: C.surface }]}>
                  <Text style={[s.tplBadgeTxt, { color: C.primary }]}>{t.tur}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[s.tplActionBtn, { backgroundColor: "#EEF2FF" }]}
                  onPress={() => { setEditTpl(t); setTplForm({ nomi: t.nomi, matn: t.matn, tur: t.tur }); setModal("template"); }}
                >
                  <Feather name="edit-2" size={14} color={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.tplActionBtn, { backgroundColor: "#FEE2E2" }]}
                  onPress={() => Alert.alert("O'chirish", `"${t.nomi}" ni o'chirishni istaysizmi?`, [
                    { text: "Bekor" }, { text: "O'chirish", style: "destructive", onPress: () => tplDeleteMut.mutate(t.id) },
                  ])}
                >
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
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad, backgroundColor: C.card, borderBottomColor: C.border }]}>
        <View style={[s.headerIcon, { backgroundColor: C.primary }]}>
          <Feather name="shield" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: C.text }]}>Super Admin</Text>
          <Text style={[s.headerSub, { color: C.textSecondary }]}>im_yakuboff98</Text>
        </View>
        <TouchableOpacity
          style={[s.logoutBtn, { backgroundColor: "#FEE2E2" }]}
          onPress={() => Alert.alert("Chiqish", "Profildan chiqmoqchimisiz?", [
            { text: "Bekor" },
            { text: "Chiqish", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); } },
          ])}
        >
          <Feather name="log-out" size={16} color="#DC2626" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[s.tabs, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        {[
          { key: "dokonlar" as Tab, lbl: "Do'konlar", icon: "shopping-bag" as const },
          { key: "sms" as Tab, lbl: "SMS", icon: "message-square" as const },
          { key: "shablonlar" as Tab, lbl: "Shablonlar", icon: "message-circle" as const },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabBtn, activeTab === t.key && { borderBottomWidth: 2.5, borderBottomColor: C.primary }]}
            onPress={() => setActiveTab(t.key)}
          >
            <Feather name={t.icon} size={14} color={activeTab === t.key ? C.primary : C.textSecondary} />
            <Text style={[s.tabBtnTxt, { color: activeTab === t.key ? C.primary : C.textSecondary }]}>{t.lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === "dokonlar" && renderDokonlar()}
      {activeTab === "sms" && renderSms()}
      {activeTab === "shablonlar" && renderShablonlar()}

      {/* FAB */}
      {(activeTab === "dokonlar" || activeTab === "shablonlar") && (
        <TouchableOpacity
          style={[s.fab, { backgroundColor: C.primary, bottom: insets.bottom + 20 }]}
          onPress={() => {
            if (activeTab === "dokonlar") {
              setCreateForm({ name: "", phone: "", address: "", ownerUsername: "", ownerPassword: "", ownerFullName: "" });
              setModal("create");
            } else {
              setEditTpl(null);
              setTplForm({ nomi: "", matn: "", tur: "umumiy" });
              setModal("template");
            }
          }}
        >
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
          <TouchableOpacity
            style={[s.modalSaveBtn, { backgroundColor: createMut.isPending ? C.border : C.primary }]}
            onPress={() => createMut.mutate()}
            disabled={createMut.isPending}
          >
            {createMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSaveBtnTxt}>Do'kon yaratish</Text>}
          </TouchableOpacity>
        </View>
      </MModal>

      <MModal visible={modal === "creds"} title={`🔑 ${selectedShop?.name || ""}`} onClose={() => setModal(null)}>
        <View style={{ gap: 12 }}>
          {selectedShop?.owner && (
            <View style={[s.infoBanner, { backgroundColor: C.surface }]}>
              <Text style={[s.infoBannerTxt, { color: C.text }]}>Joriy admin: <Text style={{ fontFamily: "Inter_700Bold", color: C.primary }}>{selectedShop.owner.username}</Text></Text>
              <Text style={[s.infoBannerTxt, { color: C.textSecondary, fontSize: 11 }]}>Bo'sh qoldirilsa o'zgarmaydi</Text>
            </View>
          )}
          <MField label="Yangi login" value={credsForm.username} onChange={v => setCredsForm(f => ({ ...f, username: v }))} placeholder="Yangi login" />
          <MField label="Yangi parol" value={credsForm.password} onChange={v => setCredsForm(f => ({ ...f, password: v }))} placeholder="Yangi parol" secure />
          <TouchableOpacity
            style={[s.modalSaveBtn, { backgroundColor: credsMut.isPending ? C.border : C.primary }]}
            onPress={() => credsMut.mutate()}
            disabled={credsMut.isPending || (!credsForm.username && !credsForm.password)}
          >
            {credsMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSaveBtnTxt}>Saqlash</Text>}
          </TouchableOpacity>
        </View>
      </MModal>

      <MModal visible={modal === "topup"} title={`💰 ${selectedShop?.name || ""}`} onClose={() => setModal(null)}>
        <View style={{ gap: 12 }}>
          {selectedShop && (
            <View style={[s.infoBanner, { backgroundColor: "#ECFDF5" }]}>
              <Text style={[s.infoBannerTxt, { color: "#059669" }]}>Joriy balans: <Text style={{ fontFamily: "Inter_700Bold" }}>{fmt(selectedShop.balance)}</Text></Text>
            </View>
          )}
          <MField label="To'ldirish miqdori (so'm)" value={topupAmount} onChange={setTopupAmount} keyboard="numeric" placeholder="500000" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[100000, 200000, 500000, 1000000].map(a => (
              <TouchableOpacity key={a} style={[s.quickAmountBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={() => setTopupAmount(String(a))}>
                <Text style={[s.quickAmountTxt, { color: C.primary }]}>{a >= 1000000 ? "1M" : `${a / 1000}K`}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[s.modalSaveBtn, { backgroundColor: topupMut.isPending ? C.border : "#10B981" }]}
            onPress={() => topupMut.mutate()}
            disabled={topupMut.isPending || !topupAmount}
          >
            {topupMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSaveBtnTxt}>To'ldirish</Text>}
          </TouchableOpacity>
        </View>
      </MModal>

      <MModal visible={modal === "template"} title={editTpl ? "Shablonni tahrirlash" : "Yangi shablon"} onClose={() => setModal(null)}>
        <View style={{ gap: 12 }}>
          <MField label="Shablon nomi *" value={tplForm.nomi} onChange={v => setTplForm(f => ({ ...f, nomi: v }))} placeholder="Buyurtma tayyor" />
          <View>
            <Text style={[s.fieldLbl, { color: C.textSecondary }]}>Tur</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                {["umumiy", "buyurtma_tayyor", "eslatma", "qarz", "to'lov"].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.turBtn, { backgroundColor: tplForm.tur === t ? C.primary : C.surface, borderColor: tplForm.tur === t ? C.primary : C.border }]}
                    onPress={() => setTplForm(f => ({ ...f, tur: t }))}
                  >
                    <Text style={[s.turBtnTxt, { color: tplForm.tur === t ? "#fff" : C.textSecondary }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          <View>
            <Text style={[s.fieldLbl, { color: C.textSecondary }]}>Xabar matni *</Text>
            <TextInput
              style={[s.textArea, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
              value={tplForm.matn}
              onChangeText={v => setTplForm(f => ({ ...f, matn: v }))}
              placeholder="Hurmatli mijoz, sizning buyurtmangiz tayyor..."
              placeholderTextColor={C.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={[s.charCount, { color: C.textSecondary }]}>{tplForm.matn.length} ta belgi</Text>
          </View>
          <TouchableOpacity
            style={[s.modalSaveBtn, { backgroundColor: (tplCreateMut.isPending || tplUpdateMut.isPending) ? C.border : "#7C3AED" }]}
            onPress={() => editTpl ? tplUpdateMut.mutate() : tplCreateMut.mutate()}
            disabled={tplCreateMut.isPending || tplUpdateMut.isPending || !tplForm.nomi || !tplForm.matn}
          >
            {(tplCreateMut.isPending || tplUpdateMut.isPending) ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSaveBtnTxt}>Saqlash</Text>}
          </TouchableOpacity>
        </View>
      </MModal>
    </View>
  );
}

function SmsField({ label, value, onChange, placeholder, secure }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; secure?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={[s.fieldLbl, { color: C.textSecondary }]}>{label}</Text>
      <TextInput
        style={[s.fieldInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface, fontFamily: secure ? undefined : "Inter_400Regular" }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textSecondary}
        secureTextEntry={secure}
        autoCapitalize="none"
      />
    </View>
  );
}

function MModal({ visible, title, children, onClose }: { visible: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalSheet, { backgroundColor: C.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[s.modalHeader, { borderBottomColor: C.border }]}>
            <Text style={[s.modalTitle, { color: C.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={C.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MField({ label, value, onChange, placeholder, secure, keyboard }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; secure?: boolean; keyboard?: any }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={[s.fieldLbl, { color: C.textSecondary }]}>{label}</Text>
      <TextInput
        style={[s.fieldInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textSecondary}
        secureTextEntry={secure}
        keyboardType={keyboard}
        autoCapitalize="none"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  noAccessTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  logoutBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  tabBtnTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: "center" },
  statVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  shopCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  shopCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12 },
  shopDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  shopName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  shopMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  shopBalance: { fontSize: 14, fontFamily: "Inter_700Bold" },
  shopActions: { flexDirection: "row", gap: 8, padding: 10, paddingTop: 8, borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10 },
  actionBtnTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  providerRow: { flexDirection: "row", gap: 10 },
  providerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 2, paddingVertical: 10 },
  providerBtnTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10 },
  infoBannerTxt: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  saveBtn: { paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  saveBtnTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  testRow: { flexDirection: "row", gap: 10 },
  testInput: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: "Inter_400Regular" },
  testBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  logRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logPhone: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  logMatn: { fontSize: 11, fontFamily: "Inter_400Regular" },
  logTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 30, alignItems: "center", gap: 10 },
  emptyTxt: { fontSize: 13, fontFamily: "Inter_400Regular" },
  tplCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  tplHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  tplName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  tplBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start", marginTop: 4 },
  tplBadgeTxt: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  tplActionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tplBody: { padding: 10, borderRadius: 10 },
  tplBodyTxt: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  fab: { position: "absolute", right: 20, width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalSaveBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 4 },
  modalSaveBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  fieldLbl: { fontSize: 11, fontFamily: "Inter_500Medium" },
  fieldInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: "Inter_400Regular" },
  divider: { borderTopWidth: 1, marginVertical: 4 },
  dividerLbl: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  quickAmountBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  quickAmountTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  turBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5 },
  turBtnTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  textArea: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 100 },
  charCount: { fontSize: 10, textAlign: "right", fontFamily: "Inter_400Regular", marginTop: 2 },
});
