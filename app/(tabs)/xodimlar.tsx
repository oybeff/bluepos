import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";

const C = Colors.light;

type Role = "tailor" | "installer" | "manager";
type Worker = {
  id: number;
  fullName: string;
  role: Role;
  phone: string | null;
  isActive: boolean;
  activeDealCount?: number;
};

const ROLES: { key: Role; label: string; icon: string; color: string }[] = [
  { key: "tailor",    label: "Tikuvchi",     icon: "scissors",  color: "#8B5CF6" },
  { key: "installer", label: "O'rnatuvchi",  icon: "tool",      color: "#F59E0B" },
  { key: "manager",   label: "Menejer",      icon: "user",      color: "#3B82F6" },
];

const EMPTY: Omit<Worker, "id" | "activeDealCount"> = {
  fullName: "", role: "tailor", phone: "", isActive: true,
};

const EMPTY_ACC = { createAccount: false, username: "", password: "" };

export default function XodimlarScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [accNew, setAccNew] = useState({ ...EMPTY_ACC });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Role | "all">("all");

  const { data: workers = [], refetch } = useQuery<Worker[]>({
    queryKey: ["workers-all"],
    queryFn: () => apiReq("/workers?all=true"),
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY });
    setAccNew({ ...EMPTY_ACC });
    setShowModal(true);
  }

  function openEdit(w: Worker) {
    setEditing(w);
    setForm({ fullName: w.fullName, role: w.role, phone: w.phone || "", isActive: w.isActive });
    setShowModal(true);
  }

  async function save() {
    if (!form.fullName.trim()) { Alert.alert("Ism kiriting"); return; }
    if (!editing && accNew.createAccount) {
      if (!accNew.username.trim()) { Alert.alert("Login kiriting"); return; }
      if (accNew.password.length < 6) { Alert.alert("Parol kamida 6 belgi bo'lishi kerak"); return; }
    }
    setSaving(true);
    try {
      if (editing) {
        await apiReq(`/workers/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        const result: any = await apiReq("/workers", {
          method: "POST",
          body: JSON.stringify(form),
        });
        if (accNew.createAccount && result?.id) {
          await apiReq(`/workers/${result.id}/create-account`, {
            method: "POST",
            body: JSON.stringify({ username: accNew.username, password: accNew.password }),
          });
        }
      }
      setShowModal(false);
      await qc.invalidateQueries({ queryKey: ["workers-all"] });
      await qc.invalidateQueries({ queryKey: ["workers"] });
      refetch();
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setSaving(false); }
  }

  async function del(w: Worker) {
    Alert.alert(
      "O'chirish",
      `${w.fullName}ni o'chirmoqchimisiz?`,
      [
        { text: "Bekor", style: "cancel" },
        { text: "O'chirish", style: "destructive", onPress: async () => {
          try {
            await apiReq(`/workers/${w.id}`, { method: "DELETE" });
            await qc.invalidateQueries({ queryKey: ["workers-all"] });
            await qc.invalidateQueries({ queryKey: ["workers"] });
            refetch();
          } catch (e: any) { Alert.alert("Xato", e.message); }
        }},
      ]
    );
  }

  const [showAccModal, setShowAccModal] = useState(false);
  const [accWorker, setAccWorker] = useState<Worker | null>(null);
  const [accForm, setAccForm] = useState({ username: "", password: "" });
  const [accSaving, setAccSaving] = useState(false);

  function openCreateAccount(w: Worker) {
    setAccWorker(w);
    setAccForm({ username: "", password: "" });
    setShowAccModal(true);
  }

  async function createAccount() {
    if (!accWorker) return;
    if (!accForm.username.trim() || !accForm.password.trim()) {
      Alert.alert("Maydonlarni to'ldiring");
      return;
    }
    setAccSaving(true);
    try {
      await apiReq(`/workers/${accWorker.id}/create-account`, {
        method: "POST",
        body: JSON.stringify(accForm),
      });
      Alert.alert("✅ Muvaffaqiyatli", `${accWorker.fullName} uchun hisob yaratildi`);
      setShowAccModal(false);
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setAccSaving(false); }
  }

  async function toggleActive(w: Worker) {
    try {
      await apiReq(`/workers/${w.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !w.isActive }),
      });
      await qc.invalidateQueries({ queryKey: ["workers-all"] });
      await qc.invalidateQueries({ queryKey: ["workers"] });
      refetch();
    } catch (e: any) { Alert.alert("Xato", e.message); }
  }

  const filtered = filter === "all" ? workers : workers.filter(w => w.role === filter);
  const counts = ROLES.reduce((acc, r) => { acc[r.key] = workers.filter(w => w.role === r.key).length; return acc; }, {} as Record<string, number>);

  return (
    <View style={[st.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[st.title, { color: C.text }]}>Xodimlar</Text>
          <Text style={[st.sub, { color: C.textSecondary }]}>{workers.length} ta xodim</Text>
        </View>
        <TouchableOpacity style={[st.addBtn, { backgroundColor: C.primary }]} onPress={openAdd} activeOpacity={0.85}>
          <Feather name="user-plus" size={18} color="#fff" />
          <Text style={st.addBtnTxt}>Qo'shish</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 80 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 8 }}>
        <TouchableOpacity
          style={[st.statCard, { backgroundColor: filter === "all" ? C.primary : C.card, borderColor: C.border }]}
          onPress={() => setFilter("all")}
        >
          <Text style={[st.statNum, { color: filter === "all" ? "#fff" : C.text }]}>{workers.length}</Text>
          <Text style={[st.statLabel, { color: filter === "all" ? "rgba(255,255,255,0.8)" : C.textSecondary }]}>Barchasi</Text>
        </TouchableOpacity>
        {ROLES.map(r => (
          <TouchableOpacity
            key={r.key}
            style={[st.statCard, { backgroundColor: filter === r.key ? r.color : C.card, borderColor: C.border }]}
            onPress={() => setFilter(r.key)}
          >
            <Text style={[st.statNum, { color: filter === r.key ? "#fff" : C.text }]}>{counts[r.key] || 0}</Text>
            <Text style={[st.statLabel, { color: filter === r.key ? "rgba(255,255,255,0.8)" : C.textSecondary }]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {filtered.length === 0 ? (
          <View style={st.empty}>
            <Feather name="users" size={48} color={C.border} />
            <Text style={[st.emptyTxt, { color: C.textSecondary }]}>Xodim topilmadi</Text>
          </View>
        ) : (
          filtered.map(w => {
            const roleInfo = ROLES.find(r => r.key === w.role) ?? ROLES[0];
            return (
              <View key={w.id} style={[st.card, { backgroundColor: C.card, borderColor: C.border, opacity: w.isActive ? 1 : 0.55 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[st.avatar, { backgroundColor: roleInfo.color + "20" }]}>
                    <Text style={[st.avatarTxt, { color: roleInfo.color }]}>{w.fullName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[st.name, { color: C.text }]}>{w.fullName}</Text>
                      {!w.isActive && (
                        <View style={[st.inactiveBadge, { backgroundColor: "#FEE2E2" }]}>
                          <Text style={{ fontSize: 10, color: "#EF4444", fontFamily: "Inter_600SemiBold" }}>Faol emas</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <View style={[st.roleBadge, { backgroundColor: roleInfo.color + "15" }]}>
                        <Feather name={roleInfo.icon as any} size={11} color={roleInfo.color} />
                        <Text style={[st.roleLabel, { color: roleInfo.color }]}>{roleInfo.label}</Text>
                      </View>
                      {w.phone ? (
                        <Text style={[st.phone, { color: C.textSecondary }]}>{w.phone}</Text>
                      ) : null}
                    </View>
                    {(w.activeDealCount ?? 0) > 0 && (
                      <Text style={[st.dealCount, { color: C.primary }]}>
                        {w.activeDealCount} ta faol buyurtma
                      </Text>
                    )}
                  </View>
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity style={[st.iconBtn, { backgroundColor: C.primary + "12" }]} onPress={() => openEdit(w)}>
                      <Feather name="edit-2" size={15} color={C.primary} />
                    </TouchableOpacity>
                    {(w.role === "tailor" || w.role === "installer") && (
                      <TouchableOpacity style={[st.iconBtn, { backgroundColor: "#EFF6FF" }]} onPress={() => openCreateAccount(w)}>
                        <Feather name="user-plus" size={15} color="#3B82F6" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[st.iconBtn, { backgroundColor: w.isActive ? "#FEF3C7" : "#DCFCE7" }]} onPress={() => toggleActive(w)}>
                      <Feather name={w.isActive ? "pause" : "play"} size={15} color={w.isActive ? "#F59E0B" : "#22C55E"} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[st.iconBtn, { backgroundColor: "#FEE2E2" }]} onPress={() => del(w)}>
                      <Feather name="trash-2" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={[st.modalWrap, { backgroundColor: C.background }]}>
          <View style={[st.modalHeader, { borderBottomColor: C.border }]}>
            <Text style={[st.modalTitle, { color: C.text }]}>{editing ? "Tahrirlash" : "Yangi xodim"}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Feather name="x" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Text style={[st.fLabel, { color: C.textSecondary }]}>To'liq ism *</Text>
            <TextInput
              style={[st.input, { borderColor: C.border, backgroundColor: C.surface, color: C.text }]}
              value={form.fullName}
              onChangeText={v => setForm(f => ({ ...f, fullName: v }))}
              placeholder="Abdullayev Jamshid"
              placeholderTextColor={C.textSecondary}
            />

            <Text style={[st.fLabel, { color: C.textSecondary }]}>Telefon</Text>
            <TextInput
              style={[st.input, { borderColor: C.border, backgroundColor: C.surface, color: C.text }]}
              value={form.phone ?? undefined}
              onChangeText={v => setForm(f => ({ ...f, phone: v }))}
              placeholder="+998 90 123 45 67"
              placeholderTextColor={C.textSecondary}
              keyboardType="phone-pad"
            />

            <Text style={[st.fLabel, { color: C.textSecondary }]}>Lavozim</Text>
            <View style={{ gap: 8 }}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[st.roleBtn, {
                    borderColor: form.role === r.key ? r.color : C.border,
                    backgroundColor: form.role === r.key ? r.color + "15" : C.surface,
                  }]}
                  onPress={() => setForm(f => ({ ...f, role: r.key }))}
                >
                  <View style={[st.roleIcon, { backgroundColor: r.color + "20" }]}>
                    <Feather name={r.icon as any} size={16} color={r.color} />
                  </View>
                  <Text style={{ fontFamily: "Inter_600SemiBold", color: form.role === r.key ? r.color : C.text, fontSize: 14 }}>
                    {r.label}
                  </Text>
                  {form.role === r.key && <Feather name="check-circle" size={18} color={r.color} style={{ marginLeft: "auto" }} />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Hisob yaratish toggle (faqat yangi xodim uchun) */}
            {!editing && (form.role === "tailor" || form.role === "installer") && (
              <View>
                <View style={[st.accToggleRow, { borderColor: accNew.createAccount ? C.primary : C.border, backgroundColor: accNew.createAccount ? C.primary + "08" : C.surface }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text }]}>Ilovaga kirish hisobi yaratish</Text>
                    <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 2 }]}>
                      {form.role === "tailor" ? "Chevar paneli" : "Haydovchi paneli"}ga kirish uchun
                    </Text>
                  </View>
                  <Switch
                    value={accNew.createAccount}
                    onValueChange={v => setAccNew(a => ({ ...a, createAccount: v }))}
                    trackColor={{ false: C.border, true: C.primary + "80" }}
                    thumbColor={accNew.createAccount ? C.primary : "#ccc"}
                  />
                </View>
                {accNew.createAccount && (
                  <View style={{ gap: 12, marginTop: 12 }}>
                    <View>
                      <Text style={[st.fLabel, { color: C.textSecondary }]}>Login (foydalanuvchi nomi) *</Text>
                      <TextInput
                        style={[st.input, { borderColor: C.border, backgroundColor: C.surface, color: C.text, marginTop: 6 }]}
                        value={accNew.username}
                        onChangeText={v => setAccNew(a => ({ ...a, username: v }))}
                        placeholder="masalan: jamshid_chevar"
                        placeholderTextColor={C.textSecondary}
                        autoCapitalize="none"
                      />
                    </View>
                    <View>
                      <Text style={[st.fLabel, { color: C.textSecondary }]}>Parol *</Text>
                      <TextInput
                        style={[st.input, { borderColor: C.border, backgroundColor: C.surface, color: C.text, marginTop: 6 }]}
                        value={accNew.password}
                        onChangeText={v => setAccNew(a => ({ ...a, password: v }))}
                        placeholder="Kamida 6 ta belgi"
                        placeholderTextColor={C.textSecondary}
                        secureTextEntry
                      />
                    </View>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[st.submitBtn, { backgroundColor: C.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={save}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <><Feather name="check" size={18} color="#fff" /><Text style={st.submitTxt}>{editing ? "Saqlash" : "Qo'shish"}</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Hisob yaratish Modal */}
      <Modal visible={showAccModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAccModal(false)}>
        <View style={[st.modalWrap, { backgroundColor: C.background }]}>
          <View style={[st.modalHeader, { borderBottomColor: C.border }]}>
            <View>
              <Text style={[st.modalTitle, { color: C.text }]}>Hisob yaratish</Text>
              {accWorker && <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 }}>{accWorker.fullName}</Text>}
            </View>
            <TouchableOpacity onPress={() => setShowAccModal(false)}>
              <Feather name="x" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20, gap: 16 }}>
            <View style={[{ backgroundColor: "#EFF6FF", borderRadius: 12, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }]}>
              <Feather name="info" size={16} color="#3B82F6" />
              <Text style={{ fontSize: 12, color: "#1D4ED8", fontFamily: "Inter_400Regular", flex: 1 }}>
                {accWorker?.role === "tailor" ? "Tikuvchi → Chevar roli" : "O'rnatuvchi → Haydovchi roli"} bo'ladi. Xodim bu login/parol bilan ilovaga kiradi.
              </Text>
            </View>
            <Text style={[st.fLabel, { color: C.textSecondary }]}>Foydalanuvchi nomi *</Text>
            <TextInput
              style={[st.input, { borderColor: C.border, backgroundColor: C.surface, color: C.text }]}
              value={accForm.username}
              onChangeText={v => setAccForm(f => ({ ...f, username: v }))}
              placeholder="masalan: jamshid_chevar"
              placeholderTextColor={C.textSecondary}
              autoCapitalize="none"
            />
            <Text style={[st.fLabel, { color: C.textSecondary }]}>Parol *</Text>
            <TextInput
              style={[st.input, { borderColor: C.border, backgroundColor: C.surface, color: C.text }]}
              value={accForm.password}
              onChangeText={v => setAccForm(f => ({ ...f, password: v }))}
              placeholder="Kamida 6 ta belgi"
              placeholderTextColor={C.textSecondary}
              secureTextEntry
            />
            <TouchableOpacity
              style={[st.submitBtn, { backgroundColor: "#3B82F6", opacity: accSaving ? 0.7 : 1 }]}
              onPress={createAccount}
              disabled={accSaving}
            >
              {accSaving
                ? <ActivityIndicator color="#fff" />
                : <><Feather name="user-check" size={18} color="#fff" /><Text style={st.submitTxt}>Hisob yaratish</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingBottom: 12, gap: 12,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  addBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  statCard: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1,
    alignItems: "center", minWidth: 80,
  },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  card: {
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
  },
  avatarTxt: { fontSize: 20, fontFamily: "Inter_700Bold" },
  name: { fontSize: 15, fontFamily: "Inter_700Bold" },
  roleBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  roleLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  phone: { fontSize: 12, fontFamily: "Inter_400Regular" },
  dealCount: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  inactiveBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },

  empty: { alignItems: "center", paddingTop: 80, gap: 14 },
  emptyTxt: { fontSize: 15, fontFamily: "Inter_400Regular" },

  modalWrap: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  fLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: -8 },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: "Inter_400Regular",
  },
  roleBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1.5,
  },
  roleIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 15, borderRadius: 14, marginTop: 8,
  },
  submitTxt: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  accToggleRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1.5, marginTop: 4,
  },
});
