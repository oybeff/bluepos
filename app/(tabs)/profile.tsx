import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Alert, Switch, Modal, TextInput, ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/context/auth";
import { apiReq } from "@/lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  cashier: "Kassir",
  branch_owner: "Filial egasi",
  seller: "Sotuvchi",
  measurer: "O'lchov ustasi",
  installer: "O'rnatuvchi",
  accountant: "Buxgalter",
  tailor: "Tikuvchi",
  chevar: "Chevar (Tikuvchi)",
  haydovchi: "Haydovchi / O'rnatuvchi",
  manager: "Menejer",
};

const NOTIF_KEY = "notif_prefs";
const THEME_KEY = "theme_pref";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const C = Colors.light;

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 90 : 100);

  // Notification prefs
  const [notifDeadlines, setNotifDeadlines] = useState(true);
  const [notifDebt, setNotifDebt] = useState(true);
  const [notifStock, setNotifStock] = useState(false);

  // Password modal
  const [showPwModal, setShowPwModal] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Telegram
  const [tgConnected, setTgConnected] = useState(false);
  const [tgLoading, setTgLoading] = useState(true);

  const checkTgStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await apiReq<{ connected: boolean }>(`/auth/telegram-status/${user.id}`);
      setTgConnected(res.connected);
    } catch { /* ignore */ }
    finally { setTgLoading(false); }
  }, [user?.id]);

  // Notifications modal
  const [showNotifModal, setShowNotifModal] = useState(false);

  useEffect(() => {
    checkTgStatus();
  }, [checkTgStatus]);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then(v => {
      if (v) {
        try {
          const prefs = JSON.parse(v);
          setNotifDeadlines(prefs.deadlines ?? true);
          setNotifDebt(prefs.debt ?? true);
          setNotifStock(prefs.stock ?? false);
        } catch { /* corrupted prefs, use defaults */ }
      }
    });
  }, []);

  async function saveNotifPrefs(deadlines: boolean, debt: boolean, stock: boolean) {
    setNotifDeadlines(deadlines);
    setNotifDebt(debt);
    setNotifStock(stock);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify({ deadlines, debt, stock }));
  }

  function handleLogout() {
    if (Platform.OS === "web") {
      logout();
      return;
    }
    Alert.alert("Chiqish", "Tizimdan chiqmoqchimisiz?", [
      { text: "Bekor qilish", style: "cancel" },
      { text: "Chiqish", style: "destructive", onPress: () => logout() },
    ]);
  }

  async function linkTelegram() {
    if (!user?.username) return;
    const url = `https://t.me/blupos_bot?start=link_${user.username}`;
    await Linking.openURL(url);
    // Poll for connection after user opens bot
    setTimeout(() => checkTgStatus(), 5000);
    setTimeout(() => checkTgStatus(), 10000);
    setTimeout(() => checkTgStatus(), 20000);
  }

  async function unlinkTelegram() {
    if (!user?.id) return;
    Alert.alert("Telegram uzish", "Telegram bildirishnomalarini o'chirmoqchimisiz?", [
      { text: "Bekor qilish", style: "cancel" },
      { text: "Uzish", style: "destructive", onPress: async () => {
        try {
          await apiReq("/auth/unlink-telegram", { method: "POST", body: JSON.stringify({ userId: user.id }) });
          setTgConnected(false);
        } catch { Alert.alert("Xato", "Telegram uzib bo'lmadi"); }
      }},
    ]);
  }

  async function changePassword() {
    if (!oldPw || !newPw || !confirmPw) {
      Alert.alert("Xato", "Barcha maydonlarni to'ldiring");
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert("Xato", "Yangi parollar mos kelmadi");
      return;
    }
    if (newPw.length < 6) {
      Alert.alert("Xato", "Parol kamida 6 ta belgidan iborat bo'lishi kerak");
      return;
    }
    setPwSaving(true);
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      if (!domain) throw new Error("Server sozlanmagan");
      const base = domain.startsWith("http") ? domain : `https://${domain}`;
      const res = await fetch(`${base}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Xato");
      }
      Alert.alert("✅ Muvaffaqiyat", "Parol muvaffaqiyatli o'zgartirildi");
      setShowPwModal(false);
      setOldPw(""); setNewPw(""); setConfirmPw("");
    } catch (e: any) {
      Alert.alert("Xato", e.message || "Parol o'zgarmadi");
    } finally {
      setPwSaving(false);
    }
  }

  const menuItems = [
    ...(user?.role === "super_admin" ? [{
      icon: "settings" as const,
      label: "Super Admin Panel",
      subtitle: "Do'konlar, serverlar va SMS boshqaruvi",
      onPress: () => router.push("/super-admin" as any),
      rightEl: <Feather name="chevron-right" size={18} color="#fff" />,
      _superAdmin: true,
    }] : []),
    {
      icon: "users" as const,
      label: "Mijozlar bazasi",
      subtitle: "Mijozlarni boshqarish va SMS yuborish",
      onPress: () => router.push("/(tabs)/mijozlar" as any),
      rightEl: <Feather name="chevron-right" size={18} color={C.textSecondary} />,
    },
    {
      icon: "user-check" as const,
      label: "Xodimlar",
      subtitle: "Tikuvchi, o'rnatuvchi va menejerlar",
      onPress: () => router.push("/(tabs)/xodimlar" as any),
      rightEl: <Feather name="chevron-right" size={18} color={C.textSecondary} />,
    },
    {
      icon: "trello" as const,
      label: "Kanban (buyurtmalar)",
      subtitle: "Buyurtmalar holati va jarayon",
      onPress: () => router.push("/(tabs)/kanban" as any),
      rightEl: <Feather name="chevron-right" size={18} color={C.textSecondary} />,
    },
    {
      icon: "calendar" as const,
      label: "Ish jadvali",
      subtitle: "O'rnatuvchilar ish tartibi",
      onPress: () => router.push("/(tabs)/jadval" as any),
      rightEl: <Feather name="chevron-right" size={18} color={C.textSecondary} />,
    },
    {
      icon: "bar-chart-2" as const,
      label: "Hisobot",
      subtitle: "Sotuv va mijoz hisobotlari",
      onPress: () => router.push("/(tabs)/hisobot" as any),
      rightEl: <Feather name="chevron-right" size={18} color={C.textSecondary} />,
    },
    {
      icon: "unlock" as const,
      label: "Kassa",
      subtitle: "Kassa smenasi va tranzaksiyalar",
      onPress: () => router.push("/(tabs)/kassa" as any),
      rightEl: <Feather name="chevron-right" size={18} color={C.textSecondary} />,
    },
    {
      icon: "package" as const,
      label: "Ombor",
      subtitle: "Mahsulotlar va harakatlar",
      onPress: () => router.push("/(tabs)/ombor-harakati" as any),
      rightEl: <Feather name="chevron-right" size={18} color={C.textSecondary} />,
    },
    {
      icon: "bell" as const,
      label: "Bildirishnomalar",
      subtitle: "Muddat va qarz eslatmalari",
      onPress: () => setShowNotifModal(true),
      rightEl: <Feather name="chevron-right" size={18} color={C.textSecondary} />,
    },
    {
      icon: "shield" as const,
      label: "Parolni o'zgartirish",
      subtitle: "Xavfsizlik uchun vaqti-vaqti bilan o'zgartiring",
      onPress: () => setShowPwModal(true),
      rightEl: <Feather name="chevron-right" size={18} color={C.textSecondary} />,
    },
    {
      icon: "printer" as const,
      label: "Printer sozlamalari",
      subtitle: "Termal chek va barcode label printer",
      onPress: () => router.push("/printer-settings" as any),
      rightEl: <Feather name="chevron-right" size={18} color={C.textSecondary} />,
    },
    {
      icon: "help-circle" as const,
      label: "Yordam",
      subtitle: "Bluepos foydalanish bo'yicha",
      onPress: () => Alert.alert("Yordam", "Muammo bo'lsa, admin bilan bog'laning.\n\nBot: @blupos_bot"),
      rightEl: <Feather name="chevron-right" size={18} color={C.textSecondary} />,
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.background }]}
      contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: C.text }]}>Profil</Text>

      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: C.primary }]}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{(user?.fullName || "U").charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.fullName}</Text>
          <Text style={styles.profileRole}>{ROLE_LABELS[user?.role || ""] || user?.role}</Text>
          <Text style={styles.profileUsername}>@{user?.username}</Text>
        </View>
      </View>

      {/* Info card */}
      <View style={[styles.infoCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.infoTitle, { color: C.text }]}>Ma'lumotlar</Text>
        <InfoRow icon="user" label="Ism" value={user?.fullName || ""} C={C} />
        <InfoRow icon="at-sign" label="Login" value={user?.username || ""} C={C} />
        <InfoRow icon="briefcase" label="Lavozim" value={ROLE_LABELS[user?.role || ""] || user?.role || ""} C={C} last />
      </View>

      {/* Telegram connection */}
      {(user?.role === "admin" || user?.role === "super_admin" || user?.role === "branch_owner") && (
        <View style={[styles.tgCard, { backgroundColor: tgConnected ? "#F0FDF4" : "#EFF6FF", borderColor: tgConnected ? "#86EFAC" : "#BFDBFE" }]}>
          <Feather name="send" size={18} color={tgConnected ? "#16A34A" : "#3B82F6"} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.tgTitle, { color: tgConnected ? "#15803D" : "#1E40AF" }]}>
              {tgConnected ? "Telegram ulangan" : "Telegram bildirishnomalar"}
            </Text>
            <Text style={[styles.tgDesc, { color: tgConnected ? "#16A34A" : "#3B82F6" }]}>
              {tgConnected
                ? "Yangi ro'yxatdan o'tish va buyurtmalar haqida xabar olasiz"
                : "Ulanib, Telegram orqali bildirishnomalarni oling"}
            </Text>
          </View>
          {tgLoading ? (
            <ActivityIndicator size="small" color={C.primary} />
          ) : tgConnected ? (
            <TouchableOpacity onPress={unlinkTelegram} style={styles.tgUnlinkBtn}>
              <Text style={styles.tgUnlinkTxt}>Uzish</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={linkTelegram} style={[styles.tgLinkBtn, { backgroundColor: "#3B82F6" }]}>
              <Text style={styles.tgLinkTxt}>Ulash</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Notification prefs quick summary */}
      <View style={[styles.notifSummary, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
        <Feather name="bell" size={16} color="#3B82F6" />
        <View style={{ flex: 1 }}>
          <Text style={styles.notifSummaryTitle}>Bildirishnoma sozlamalari</Text>
          <Text style={styles.notifSummaryText}>
            {[
              notifDeadlines && "Muddatlar",
              notifDebt && "Qarz",
              notifStock && "Ombor",
            ].filter(Boolean).join(" · ") || "O'chirilgan"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowNotifModal(true)}>
          <Text style={styles.notifEdit}>Tahrirlash</Text>
        </TouchableOpacity>
      </View>

      {/* Super Admin Panel — alohida tugma */}
      {user?.role === "super_admin" && (
        <TouchableOpacity
          style={[styles.superAdminBtn, { backgroundColor: C.primary }]}
          onPress={() => router.push("/super-admin" as any)}
          activeOpacity={0.85}
        >
          <View style={styles.superAdminIconWrap}>
            <Feather name="settings" size={20} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.superAdminLabel}>Super Admin Panel</Text>
            <Text style={styles.superAdminSub}>Do'konlar · Serverlar · SMS boshqaruvi</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Menu card */}
      <View style={[styles.menuCard, { backgroundColor: C.card, borderColor: C.border }]}>
        {menuItems.filter((item: any) => !item._superAdmin).map((item, i, arr) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuItem, { borderBottomColor: C.border, borderBottomWidth: i < arr.length - 1 ? 1 : 0 }]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: C.surface }]}>
              <Feather name={item.icon} size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: C.text }]}>{item.label}</Text>
              {item.subtitle && <Text style={[styles.menuSub, { color: C.textSecondary }]}>{item.subtitle}</Text>}
            </View>
            {item.rightEl}
          </TouchableOpacity>
        ))}
      </View>

      {/* App info */}
      <View style={[styles.appInfo, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.appName, { color: C.text }]}>Bluepos</Text>
        <Text style={[styles.appVersion, { color: C.textSecondary }]}>Versiya 1.0.0 · O'zbekiston uchun</Text>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: "#EF4444", backgroundColor: "#FEF2F2" }]}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Feather name="log-out" size={18} color="#EF4444" />
        <Text style={[styles.logoutText, { color: "#EF4444" }]}>Tizimdan chiqish</Text>
      </TouchableOpacity>

      {/* Notification settings modal */}
      <Modal visible={showNotifModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalWrap, { backgroundColor: C.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: C.border }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>Bildirishnomalar</Text>
            <TouchableOpacity onPress={() => setShowNotifModal(false)}>
              <Feather name="x" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 12 }}>
            <Text style={[styles.modalDesc, { color: C.textSecondary }]}>
              Qaysi bildirishnomalarni ko'rmoqchisiz?
            </Text>
            <ToggleRow
              icon="clock"
              label="Muddatlar eslatmasi"
              desc="Tayyor bo'lish kuni yaqin bitimlar haqida"
              value={notifDeadlines}
              onChange={(v: boolean) => saveNotifPrefs(v, notifDebt, notifStock)}
              C={C}
            />
            <ToggleRow
              icon="credit-card"
              label="Qarz eslatmasi"
              desc="Qarz qaytarish kuni yaqin bo'lganda"
              value={notifDebt}
              onChange={(v: boolean) => saveNotifPrefs(notifDeadlines, v, notifStock)}
              C={C}
            />
            <ToggleRow
              icon="package"
              label="Ombor ogohlantirishlari"
              desc="Mahsulot omborda kam qolsa"
              value={notifStock}
              onChange={(v: boolean) => saveNotifPrefs(notifDeadlines, notifDebt, v)}
              C={C}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Password change modal */}
      <Modal visible={showPwModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalWrap, { backgroundColor: C.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: C.border }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>Parolni o'zgartirish</Text>
            <TouchableOpacity onPress={() => setShowPwModal(false)}>
              <Feather name="x" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14 }}>
            <PwField label="Hozirgi parol" value={oldPw} onChange={setOldPw} C={C} />
            <PwField label="Yangi parol" value={newPw} onChange={setNewPw} C={C} />
            <PwField label="Yangi parolni tasdiqlang" value={confirmPw} onChange={setConfirmPw} C={C} />
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: pwSaving ? C.primary + "80" : C.primary }]}
              onPress={changePassword}
              disabled={pwSaving}
              activeOpacity={0.8}
            >
              {pwSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Saqlash</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, C, last }: any) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: C.border, borderBottomWidth: last ? 0 : 1 }]}>
      <Feather name={icon} size={16} color={C.textSecondary} />
      <Text style={[styles.infoLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: C.text }]}>{value}</Text>
    </View>
  );
}

function ToggleRow({ icon, label, desc, value, onChange, C }: any) {
  return (
    <View style={[styles.toggleRow, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={[styles.toggleIcon, { backgroundColor: C.primary + "15" }]}>
        <Feather name={icon} size={18} color={C.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleLabel, { color: C.text }]}>{label}</Text>
        <Text style={[styles.toggleDesc, { color: C.textSecondary }]}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: C.border, true: C.primary + "80" }}
        thumbColor={value ? C.primary : C.textSecondary}
      />
    </View>
  );
}

function PwField({ label, value, onChange, C }: any) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary }}>{label}</Text>
      <View style={[styles.pwRow, { borderColor: C.border, backgroundColor: C.surface }]}>
        <TextInput
          style={[styles.pwInput, { color: C.text }]}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholderTextColor={C.textSecondary}
          placeholder="••••••"
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => setShow(!show)} style={{ paddingHorizontal: 12 }}>
          <Feather name={show ? "eye-off" : "eye"} size={18} color={C.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", paddingHorizontal: 20, marginBottom: 20 },
  profileCard: { marginHorizontal: 20, borderRadius: 20, padding: 24, flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  avatarLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold" },
  profileInfo: { gap: 4 },
  profileName: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  profileRole: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Inter_500Medium" },
  profileUsername: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "Inter_400Regular" },
  infoCard: { marginHorizontal: 20, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  infoTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  infoLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  notifSummary: {
    marginHorizontal: 20, marginBottom: 12, borderRadius: 14, borderWidth: 1,
    padding: 14, flexDirection: "row", alignItems: "center", gap: 10,
  },
  notifSummaryTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E40AF" },
  notifSummaryText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#3B82F6", marginTop: 2 },
  notifEdit: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#3B82F6" },
  menuCard: { marginHorizontal: 20, borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 12 },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  menuSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  appInfo: { marginHorizontal: 20, borderRadius: 16, borderWidth: 1, padding: 16, alignItems: "center", gap: 4, marginBottom: 12 },
  appName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  appVersion: { fontSize: 13, fontFamily: "Inter_400Regular" },
  logoutBtn: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1.5, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 },
  logoutText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modalWrap: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 24, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalDesc: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 4 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  toggleIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  toggleLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  toggleDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  pwRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12 },
  pwInput: { flex: 1, height: 48, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  saveBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  superAdminBtn: {
    marginHorizontal: 20, borderRadius: 16, padding: 16, marginBottom: 12,
    flexDirection: "row", alignItems: "center", gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  superAdminIconWrap: {
    width: 44, height: 44, borderRadius: 13, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  superAdminLabel: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  superAdminSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  tgCard: {
    marginHorizontal: 20, marginBottom: 12, borderRadius: 14, borderWidth: 1,
    padding: 14, flexDirection: "row", alignItems: "center", gap: 10,
  },
  tgTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tgDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  tgLinkBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  tgLinkTxt: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tgUnlinkBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  tgUnlinkTxt: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium" },
});
