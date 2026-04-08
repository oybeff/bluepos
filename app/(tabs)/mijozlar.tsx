import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Modal,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import { router } from "expo-router";

const C = Colors.light;

interface Customer {
  id: number; fullName: string; phone: string; address: string | null;
  notes: string | null; totalDebt: number; isActive: number; createdAt: string;
}
interface SmsTemplate { id: number; nomi: string; matn: string; tur: string; faol: boolean; }
interface ClientDeal {
  id: number; mijozIsm: string | null; mijozPhone: string | null; manzil: string | null;
  totalNarx: number | null; qarzSumma: number | null; zaklatSumma: number | null;
  qaytarishMuddati: string | null; status: string; createdAt: string;
}

function fmt(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}
function daysLeft(d: string | null): number | null {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

type View2 = "list" | "detail" | "sms";

export default function MijozlarScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const [view, setView2] = useState<View2>("list");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | "sms" | "deal" | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", address: "", notes: "" });
  const [smsText, setSmsText] = useState("");
  const [selectedTpl, setSelectedTpl] = useState<number | null>(null);
  const [smsSending, setSmsSending] = useState(false);

  const { data: customers = [], isLoading, refetch } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => apiReq<Customer[]>("/customers"),
  });

  const { data: templates = [] } = useQuery<SmsTemplate[]>({
    queryKey: ["sms-templates-list"],
    queryFn: () => apiReq<SmsTemplate[]>("/sms/templates"),
  });

  const { data: deals = [] } = useQuery<ClientDeal[]>({
    queryKey: ["client-deals-list"],
    queryFn: () => apiReq<ClientDeal[]>("/client-deals"),
    enabled: view === "list",
  });

  const { data: customerDetail } = useQuery<Customer & { deals: ClientDeal[] }>({
    queryKey: ["customer-detail", selected?.id],
    queryFn: () => apiReq(`/customers/${selected?.id}`) as Promise<Customer & { deals: ClientDeal[] }>,
    enabled: !!selected && view === "detail",
  });

  const addMut = useMutation({
    mutationFn: () => apiReq("/customers", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); setModal(null); Alert.alert("✅", "Mijoz qo'shildi!"); },
    onError: (e: any) => Alert.alert("Xato", e.message),
  });

  const editMut = useMutation({
    mutationFn: () => apiReq(`/customers/${selected?.id}`, { method: "PUT", body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers", "customer-detail"] }); setModal(null); Alert.alert("✅", "Yangilandi!"); },
    onError: (e: any) => Alert.alert("Xato", e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiReq(`/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); setView2("list"); setSelected(null); },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.fullName.toLowerCase().includes(q) || (c.phone || "").includes(q)
    );
  }, [customers, search]);

  const debtAlerts = useMemo(() => {
    return deals.filter(d => {
      if (!d.qarzSumma || d.qarzSumma <= 0) return false;
      if (d.status !== "active") return false;
      const days = daysLeft(d.qaytarishMuddati);
      return days !== null && days >= 0 && days <= 3;
    }).slice(0, 5);
  }, [deals]);

  async function sendBulkSms() {
    const text = smsText.trim();
    if (!text) { Alert.alert("SMS matni kiriting"); return; }
    setSmsSending(true);
    try {
      const res = await apiReq<any>("/customers/sms-campaign", {
        method: "POST",
        body: JSON.stringify({ matn: text, templateId: selectedTpl || undefined }),
      });
      if (res.warning) {
        Alert.alert("⚠️ SMS sozlanmagan", res.warning);
      } else {
        Alert.alert("✅ SMS yuborildi!", `${res.sent}/${res.total} mijozga SMS yuborildi`);
      }
      setModal(null); setSmsText(""); setSelectedTpl(null);
    } catch (e: any) { Alert.alert("Xato", e.message); }
    finally { setSmsSending(false); }
  }

  async function sendDebtReminders() {
    try {
      const res = await apiReq<any>("/notifications/send-debt-alerts", { method: "POST", body: JSON.stringify({}) });
      Alert.alert("✅", `${res.sent} ta qarz eslatmasi yuborildi`);
    } catch (e: any) { Alert.alert("Xato", e.message); }
  }

  function openAdd() {
    setForm({ fullName: "", phone: "", address: "", notes: "" });
    setModal("add");
  }

  function openEdit(c: Customer) {
    setForm({ fullName: c.fullName, phone: c.phone, address: c.address || "", notes: c.notes || "" });
    setModal("edit");
  }

  function openDetail(c: Customer) {
    setSelected(c); setView2("detail");
  }

  function goBack() {
    setView2("list"); setSelected(null);
  }

  // ─── DETAIL VIEW ──────────────────────────────────────────────────────────
  if (view === "detail" && selected) {
    const cDeals = customerDetail?.deals ?? [];
    const totalDebt = cDeals.filter(d => d.status === "active").reduce((s, d) => s + (d.qarzSumma || 0), 0);

    return (
      <View style={[st.root, { backgroundColor: C.background }]}>
        <View style={[st.header, { paddingTop: topPad, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={goBack} style={st.backBtn}>
            <Feather name="arrow-left" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[st.title, { color: C.text }]} numberOfLines={1}>{selected.fullName}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => openEdit(selected)} style={[st.iconBtn, { backgroundColor: C.primary + "18" }]}>
              <Feather name="edit-2" size={16} color={C.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert("O'chirish", "Mijozni o'chirmoqchimisiz?", [
              { text: "Bekor" }, { text: "Ha", style: "destructive", onPress: () => deleteMut.mutate(selected.id) }
            ])} style={[st.iconBtn, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="trash-2" size={16} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }}>
          {/* Info card */}
          <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={[st.avatar, { backgroundColor: C.primary + "20" }]}>
                <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: C.primary }}>
                  {selected.fullName[0]?.toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.customerName, { color: C.text }]}>{selected.fullName}</Text>
                <Text style={[st.customerPhone, { color: C.primary }]}>{selected.phone}</Text>
                {selected.address ? <Text style={[st.customerSub, { color: C.textSecondary }]}>{selected.address}</Text> : null}
              </View>
            </View>
            {totalDebt > 0 && (
              <View style={[st.debtBadge, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
                <Feather name="alert-circle" size={14} color="#DC2626" />
                <Text style={{ color: "#DC2626", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                  Joriy qarz: {fmt(totalDebt)}
                </Text>
              </View>
            )}
            {selected.notes ? (
              <View style={[st.noteBox, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
                <Feather name="file-text" size={13} color="#D97706" />
                <Text style={{ color: "#92400E", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 }}>{selected.notes}</Text>
              </View>
            ) : null}
          </View>

          {/* Deals */}
          <Text style={[st.sectionLabel, { color: C.textSecondary }]}>Bitimlar tarixi</Text>
          {cDeals.length === 0 ? (
            <View style={[st.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <Feather name="shopping-bag" size={28} color={C.textSecondary} />
              <Text style={{ color: C.textSecondary, fontFamily: "Inter_400Regular" }}>Hali bitim yo'q</Text>
            </View>
          ) : cDeals.map(d => {
            const days = daysLeft(d.qaytarishMuddati);
            const isOverdue = days !== null && days < 0;
            const isSoon = days !== null && days >= 0 && days <= 3;
            return (
              <View key={d.id} style={[st.dealCard, { backgroundColor: C.card, borderColor: isOverdue ? "#FCA5A5" : isSoon ? "#FDE68A" : C.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[st.dealId, { color: C.textSecondary }]}>#{d.id} · {fmtDate(d.createdAt)}</Text>
                  <View style={[st.statusBadge, { backgroundColor: d.status === "paid" ? "#D1FAE5" : d.status === "active" ? "#EEF2FF" : "#F3F4F6" }]}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: d.status === "paid" ? "#059669" : d.status === "active" ? C.primary : C.textSecondary }}>
                      {d.status === "paid" ? "To'langan" : d.status === "active" ? "Faol" : "Bekor"}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                  <Text style={[{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>{fmt(d.totalNarx)}</Text>
                  {(d.qarzSumma ?? 0) > 0 && (
                    <Text style={{ color: "#DC2626", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Qarz: {fmt(d.qarzSumma)}</Text>
                  )}
                </View>
                {d.qaytarishMuddati && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Feather name="calendar" size={12} color={isOverdue ? "#DC2626" : isSoon ? "#D97706" : C.textSecondary} />
                    <Text style={{ fontSize: 12, color: isOverdue ? "#DC2626" : isSoon ? "#D97706" : C.textSecondary, fontFamily: "Inter_500Medium" }}>
                      {fmtDate(d.qaytarishMuddati)}
                      {days !== null && ` (${isOverdue ? Math.abs(days) + " kun o'tdi" : days === 0 ? "Bugun!" : days + " kun qoldi"})`}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Edit modal */}
        <Modal visible={modal === "edit"} animationType="slide" transparent>
          <View style={st.overlay}>
            <View style={[st.modalBox, { backgroundColor: C.card }]}>
              <Text style={[st.modalTitle, { color: C.text }]}>Mijozni tahrirlash</Text>
              {(["fullName", "phone", "address", "notes"] as const).map(f => (
                <View key={f} style={{ gap: 4 }}>
                  <Text style={[st.fieldLabel, { color: C.textSecondary }]}>
                    {f === "fullName" ? "To'liq ism" : f === "phone" ? "Telefon" : f === "address" ? "Manzil" : "Izoh"}
                  </Text>
                  <TextInput
                    style={[st.input, { color: C.text, borderColor: C.border }]}
                    value={form[f]} onChangeText={v => setForm(p => ({ ...p, [f]: v }))}
                    keyboardType={f === "phone" ? "phone-pad" : "default"}
                    multiline={f === "notes"} />
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <TouchableOpacity onPress={() => setModal(null)} style={[st.btn, { backgroundColor: C.border, flex: 1 }]}>
                  <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold" }}>Bekor</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => editMut.mutate()} disabled={editMut.isPending}
                  style={[st.btn, { backgroundColor: C.primary, flex: 2 }]}>
                  {editMut.isPending ? <ActivityIndicator color="#fff" size="small" /> :
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>Saqlash</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <View style={[st.root, { backgroundColor: C.background }]}>
      <View style={[st.header, { paddingTop: topPad, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[st.title, { color: C.text }]}>Mijozlar bazasi</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={() => setModal("sms")} style={[st.iconBtn, { backgroundColor: "#D1FAE5" }]}>
            <Feather name="send" size={16} color="#059669" />
          </TouchableOpacity>
          <TouchableOpacity onPress={openAdd} style={[st.iconBtn, { backgroundColor: C.primary }]}>
            <Feather name="user-plus" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={[st.searchWrap, { borderBottomColor: C.border }]}>
        <View style={[st.searchBox, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Feather name="search" size={16} color={C.textSecondary} />
          <TextInput
            style={[st.searchInput, { color: C.text }]}
            value={search} onChangeText={setSearch}
            placeholder="Ism yoki telefon qidirish..."
            placeholderTextColor={C.textSecondary} />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={C.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Debt alerts banner */}
      {debtAlerts.length > 0 && (
        <TouchableOpacity onPress={sendDebtReminders}
          style={[st.alertBanner, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
          <Feather name="bell" size={15} color="#D97706" />
          <Text style={{ color: "#92400E", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
            {debtAlerts.length} ta mijozning to'lov muddati yaqinlashmoqda
          </Text>
          <Text style={{ color: "#D97706", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>SMS yuborish</Text>
        </TouchableOpacity>
      )}

      {/* Stats row */}
      <View style={[st.statsRow, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <View style={st.statItem}>
          <Text style={[st.statVal, { color: C.primary }]}>{customers.length}</Text>
          <Text style={[st.statLbl, { color: C.textSecondary }]}>Jami</Text>
        </View>
        <View style={[st.statDivider, { backgroundColor: C.border }]} />
        <View style={st.statItem}>
          <Text style={[st.statVal, { color: "#DC2626" }]}>
            {customers.filter(c => (c.totalDebt || 0) > 0).length}
          </Text>
          <Text style={[st.statLbl, { color: C.textSecondary }]}>Qarzdor</Text>
        </View>
        <View style={[st.statDivider, { backgroundColor: C.border }]} />
        <View style={st.statItem}>
          <Text style={[st.statVal, { color: "#10B981" }]}>
            {customers.filter(c => (c.totalDebt || 0) === 0).length}
          </Text>
          <Text style={[st.statLbl, { color: C.textSecondary }]}>Tozа</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Feather name="users" size={48} color={C.textSecondary} />
          <Text style={{ color: C.textSecondary, fontFamily: "Inter_400Regular", fontSize: 15 }}>
            {search ? "Topilmadi" : "Hali mijoz yo'q"}
          </Text>
          {!search && (
            <TouchableOpacity onPress={openAdd} style={[st.btn, { backgroundColor: C.primary, paddingHorizontal: 20 }]}>
              <Feather name="user-plus" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Mijoz qo'shish</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: insets.bottom + 100 }}
          renderItem={({ item: c }) => (
            <TouchableOpacity onPress={() => openDetail(c)}
              style={[st.customerCard, { backgroundColor: C.card, borderColor: (c.totalDebt || 0) > 0 ? "#FCA5A5" : C.border }]}>
              <View style={[st.avatar, { backgroundColor: C.primary + "18", width: 44, height: 44, borderRadius: 22 }]}>
                <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: C.primary }}>
                  {c.fullName[0]?.toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.customerName, { color: C.text, fontSize: 14 }]}>{c.fullName}</Text>
                <Text style={[st.customerPhone, { color: C.primary, fontSize: 12 }]}>{c.phone}</Text>
                {c.address ? <Text style={[st.customerSub, { color: C.textSecondary, fontSize: 11 }]} numberOfLines={1}>{c.address}</Text> : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                {(c.totalDebt || 0) > 0 ? (
                  <View style={[st.debtChip, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={{ color: "#DC2626", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{fmt(c.totalDebt)}</Text>
                  </View>
                ) : (
                  <View style={[st.debtChip, { backgroundColor: "#D1FAE5" }]}>
                    <Text style={{ color: "#059669", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>Qarzsiz</Text>
                  </View>
                )}
                <Feather name="chevron-right" size={14} color={C.textSecondary} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Add Modal */}
      <Modal visible={modal === "add"} animationType="slide" transparent>
        <View style={st.overlay}>
          <View style={[st.modalBox, { backgroundColor: C.card }]}>
            <Text style={[st.modalTitle, { color: C.text }]}>Yangi mijoz</Text>
            {(["fullName", "phone", "address", "notes"] as const).map(f => (
              <View key={f} style={{ gap: 4 }}>
                <Text style={[st.fieldLabel, { color: C.textSecondary }]}>
                  {f === "fullName" ? "To'liq ism *" : f === "phone" ? "Telefon *" : f === "address" ? "Manzil" : "Izoh"}
                </Text>
                <TextInput
                  style={[st.input, { color: C.text, borderColor: C.border }]}
                  value={form[f]} onChangeText={v => setForm(p => ({ ...p, [f]: v }))}
                  keyboardType={f === "phone" ? "phone-pad" : "default"}
                  multiline={f === "notes"} />
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setModal(null)} style={[st.btn, { backgroundColor: C.border, flex: 1 }]}>
                <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold" }}>Bekor</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => addMut.mutate()} disabled={addMut.isPending || !form.fullName || !form.phone}
                style={[st.btn, { backgroundColor: C.primary, flex: 2, opacity: (!form.fullName || !form.phone) ? 0.5 : 1 }]}>
                {addMut.isPending ? <ActivityIndicator color="#fff" size="small" /> :
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>Qo'shish</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bulk SMS Modal */}
      <Modal visible={modal === "sms"} animationType="slide" transparent>
        <View style={st.overlay}>
          <View style={[st.modalBox, { backgroundColor: C.card }]}>
            <Text style={[st.modalTitle, { color: C.text }]}>Aksiya SMS yuborish</Text>
            <Text style={[st.fieldLabel, { color: C.textSecondary }]}>Barcha {customers.length} ta mijozga SMS yuboriladi</Text>

            {templates.filter(t => t.tur === "aksiya").length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={[st.fieldLabel, { color: C.textSecondary }]}>Shablon tanlash</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row" }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {templates.filter(t => t.tur === "aksiya").map(t => (
                      <TouchableOpacity key={t.id} onPress={() => { setSelectedTpl(t.id); setSmsText(t.matn); }}
                        style={[st.tplChip, { backgroundColor: selectedTpl === t.id ? C.primary : C.surface, borderColor: selectedTpl === t.id ? C.primary : C.border }]}>
                        <Text style={{ color: selectedTpl === t.id ? "#fff" : C.text, fontSize: 12, fontFamily: "Inter_500Medium" }}>{t.nomi}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            <View style={{ gap: 4 }}>
              <Text style={[st.fieldLabel, { color: C.textSecondary }]}>SMS matni ({"{ism}"} - mijoz ism almashadi)</Text>
              <TextInput
                style={[st.input, { color: C.text, borderColor: C.border, minHeight: 80, textAlignVertical: "top", paddingTop: 10 }]}
                value={smsText} onChangeText={t => { setSmsText(t); setSelectedTpl(null); }}
                placeholder="SMS matnini kiriting..." placeholderTextColor={C.textSecondary}
                multiline numberOfLines={4} />
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity onPress={() => { setModal(null); setSmsText(""); setSelectedTpl(null); }}
                style={[st.btn, { backgroundColor: C.border, flex: 1 }]}>
                <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold" }}>Bekor</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={sendBulkSms} disabled={smsSending || !smsText.trim()}
                style={[st.btn, { backgroundColor: "#059669", flex: 2, opacity: !smsText.trim() ? 0.5 : 1 }]}>
                {smsSending ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Feather name="send" size={15} color="#fff" />
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>Yuborish</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold" },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  searchWrap: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },

  alertBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, paddingHorizontal: 14, borderBottomWidth: 1 },

  statsRow: { flexDirection: "row", borderBottomWidth: 1, paddingVertical: 10 },
  statItem: { flex: 1, alignItems: "center" },
  statVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, marginVertical: 4 },

  customerCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  customerName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  customerPhone: { fontFamily: "Inter_500Medium", fontSize: 13 },
  customerSub: { fontFamily: "Inter_400Regular", fontSize: 12 },
  debtChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },

  card: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 10 },
  debtBadge: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 10, borderWidth: 1 },
  noteBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 8, borderRadius: 10, borderWidth: 1 },

  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8 },

  dealCard: { borderRadius: 12, borderWidth: 1.5, padding: 12, gap: 4 },
  dealId: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },

  emptyCard: { alignItems: "center", gap: 8, padding: 32, borderRadius: 14, borderWidth: 1 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14, maxHeight: "85%" },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 12 },

  tplChip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
});
