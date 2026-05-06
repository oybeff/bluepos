import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Modal,
  FlatList, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiReq } from "@/lib/api";
import DateInput, { buildDateISO } from "@/components/DateInput";

const C = Colors.light;

const DEBT_SMS_TEXT = "Hurmatli mijoz, sizda parda xaridi bo'yicha qarzdorlik mavjud.\nTo'lovni imkon qadar tezroq amalga oshirishingizni so'raymiz.\nDo'kon: AL AMIN PARDALAR UYI\nTel: +998911741424";

interface QarzDaftar {
  id: number; ism: string; telefon: string | null;
  tur: "olindi" | "berildi"; narsa: string; summa: number | null;
  qaytarishSana: string | null; status: "ochiq" | "yopildi" | "qisman";
  qolganSumma: number | null; izoh: string | null; createdAt: string;
  tolovlar: { id: number; summa: number; izoh: string | null; createdAt: string }[];
  tolanganJami: number;
}

interface Stats {
  jami: number; olindi: number; berildi: number; ochiq: number;
  yopildi: number; muddatiOtgan: number; olindiJami: number; berildiJami: number;
}

function fmt(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short", year: "numeric" });
}
function isOverdue(d: string | null | undefined, status: string) {
  if (!d || status !== "ochiq") return false;
  return new Date(d) < new Date();
}

type Tab = "barchasi" | "olindi" | "berildi";
type SortBy = "yangi" | "eski" | "muddat";

export default function QarzDaftarScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const [tab, setTab] = useState<Tab>("barchasi");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("yangi");
  const [showModal, setShowModal] = useState<"create" | "detail" | "tolov" | "sms" | null>(null);
  const [selected, setSelected] = useState<QarzDaftar | null>(null);
  const [smsSelected, setSmsSelected] = useState<Set<number>>(new Set());
  const [smsSending, setSmsSending] = useState(false);
  const [form, setForm] = useState({ ism: "", telefon: "", tur: "olindi" as "olindi" | "berildi", narsa: "", summa: "", izoh: "" });
  const [dateDay, setDateDay] = useState("");
  const [dateMonth, setDateMonth] = useState("");
  const [dateYear, setDateYear] = useState("");
  const [tolovSumma, setTolovSumma] = useState("");
  const [tolovIzoh, setTolovIzoh] = useState("");

  const { data: qarzlar = [], isLoading } = useQuery<QarzDaftar[]>({
    queryKey: ["qarz-daftar"],
    queryFn: async () => await apiReq("/qarz-daftar") as QarzDaftar[],
  });
  const { data: stats } = useQuery<Stats>({
    queryKey: ["qarz-daftar-stats"],
    queryFn: async () => await apiReq("/qarz-daftar/stats") as Stats,
  });

  function refreshQarzDaftar() {
    qc.invalidateQueries({ queryKey: ["qarz-daftar"] });
    qc.invalidateQueries({ queryKey: ["qarz-daftar-stats"] });
  }

  const createMut = useMutation({
    mutationFn: () => apiReq("/qarz-daftar", {
      method: "POST",
      body: JSON.stringify({ ...form, summa: form.summa || null, qaytarishSana: buildDateISO(dateDay, dateMonth, dateYear) }),
    }),
    onSuccess: () => { refreshQarzDaftar(); setShowModal(null); Alert.alert("✅", "Qarz qo'shildi!"); resetForm(); },
    onError: (e: any) => Alert.alert("Xato", e.message),
  });
  const tolovMut = useMutation({
    mutationFn: () => apiReq(`/qarz-daftar/${selected?.id}/tolov`, { method: "POST", body: JSON.stringify({ summa: parseFloat(tolovSumma), izoh: tolovIzoh || null }) }),
    onSuccess: async () => {
      refreshQarzDaftar();
      setShowModal(null);
      Alert.alert("✅", "To'lov qo'shildi!");
      setTolovSumma(""); setTolovIzoh("");
    },
    onError: (e: any) => Alert.alert("Xato", e.message),
  });
  const yopishMut = useMutation({
    mutationFn: (id: number) => apiReq(`/qarz-daftar/${id}/yopish`, { method: "PATCH", body: "{}" }),
    onSuccess: () => { refreshQarzDaftar(); setShowModal(null); },
    onError: (e: any) => Alert.alert("Xato", e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiReq(`/qarz-daftar/${id}`, { method: "DELETE" }),
    onSuccess: () => { refreshQarzDaftar(); setShowModal(null); },
  });

  function resetForm() { setForm({ ism: "", telefon: "", tur: "olindi", narsa: "", summa: "", izoh: "" }); setDateDay(""); setDateMonth(""); setDateYear(""); }

  // SMS
  const smsEligible = useMemo(() => qarzlar.filter(q => q.telefon && (q.status === "ochiq" || q.status === "qisman")), [qarzlar]);

  function openSmsModal() {
    setSmsSelected(new Set());
    setShowModal("sms");
  }
  function toggleSmsSelect(id: number) {
    setSmsSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAllSms() {
    if (smsSelected.size === smsEligible.length) {
      setSmsSelected(new Set());
    } else {
      setSmsSelected(new Set(smsEligible.map(q => q.id)));
    }
  }
  async function sendSmsToSelected() {
    if (smsSelected.size === 0) return;
    setSmsSending(true);
    let sent = 0, failed = 0;
    try {
      for (const id of smsSelected) {
        const q = qarzlar.find(x => x.id === id);
        if (!q?.telefon) continue;
        try {
          await apiReq("/sms/send", { method: "POST", body: JSON.stringify({ phone: q.telefon, message: DEBT_SMS_TEXT }) });
          sent++;
        } catch { failed++; }
      }
      setShowModal(null);
      Alert.alert("✅ SMS yuborildi", `${sent} ta mijozga SMS yuborildi${failed ? `\n${failed} ta xato` : ""}`);
    } catch { Alert.alert("Xato", "SMS yuborishda xato"); }
    finally { setSmsSending(false); }
  }

  const filtered = useMemo(() => {
    let list = qarzlar;
    if (tab === "olindi") list = list.filter(q => q.tur === "olindi");
    if (tab === "berildi") list = list.filter(q => q.tur === "berildi");
    if (search) list = list.filter(q => q.ism.toLowerCase().includes(search.toLowerCase()) || q.narsa.toLowerCase().includes(search.toLowerCase()));
    if (sortBy === "yangi") list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortBy === "eski") list = [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (sortBy === "muddat") list = [...list].sort((a, b) => {
      if (!a.qaytarishSana) return 1;
      if (!b.qaytarishSana) return -1;
      return new Date(a.qaytarishSana).getTime() - new Date(b.qaytarishSana).getTime();
    });
    return list;
  }, [qarzlar, tab, search, sortBy]);

  function getStatusStyle(q: QarzDaftar) {
    if (q.status === "yopildi") return { bg: "#D1FAE5", color: "#059669", label: "Yopildi" };
    if (q.status === "qisman") return { bg: "#FEF3C7", color: "#D97706", label: "Qisman" };
    if (isOverdue(q.qaytarishSana, q.status)) return { bg: "#FEE2E2", color: "#DC2626", label: "Muddati o'tgan" };
    return { bg: "#EEF2FF", color: C.primary, label: "Ochiq" };
  }

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: C.text }]}>Qarz daftar</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>Oldi-berdi hisoboti</Text>
        </View>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: "#DC2626" }]} onPress={openSmsModal}>
          <Feather name="message-circle" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: C.primary }]} onPress={() => { resetForm(); setShowModal("create"); }}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {stats && (
        <View style={[s.statsRow, { paddingHorizontal: 16 }]}>
          <View style={[s.statCard, { backgroundColor: "#EEF2FF", flex: 1.2 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="arrow-down-left" size={14} color={C.primary} />
              <Text style={[s.statLbl, { color: C.primary }]}>Olindi</Text>
            </View>
            <Text style={[s.statVal, { color: C.primary }]}>{fmt(stats.olindiJami)}</Text>
            <Text style={[s.statCount, { color: C.textSecondary }]}>{stats.olindi} ta</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: "#FEF3C7", flex: 1.2 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="arrow-up-right" size={14} color="#D97706" />
              <Text style={[s.statLbl, { color: "#D97706" }]}>Berildi</Text>
            </View>
            <Text style={[s.statVal, { color: "#D97706" }]}>{fmt(stats.berildiJami)}</Text>
            <Text style={[s.statCount, { color: C.textSecondary }]}>{stats.berildi} ta</Text>
          </View>
          {stats.muddatiOtgan > 0 && (
            <View style={[s.statCard, { backgroundColor: "#FEE2E2", flex: 1 }]}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={[s.statVal, { color: "#DC2626", fontSize: 18 }]}>{stats.muddatiOtgan}</Text>
              <Text style={[s.statCount, { color: "#DC2626" }]}>Muddati</Text>
            </View>
          )}
        </View>
      )}

      {/* Tabs */}
      <View style={[s.tabRow, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        {(["barchasi", "olindi", "berildi"] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && { borderBottomWidth: 2.5, borderBottomColor: C.primary }]} onPress={() => setTab(t)}>
            <Text style={[s.tabBtnTxt, { color: tab === t ? C.primary : C.textSecondary }]}>
              {t === "barchasi" ? "Barchasi" : t === "olindi" ? "Olindi" : "Berildi"}
              {t === "barchasi" && stats ? ` (${stats.ochiq})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search + Sort */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        <View style={[s.searchBox, { backgroundColor: C.card, borderColor: C.border }]}>
          <Feather name="search" size={15} color={C.textSecondary} />
          <TextInput style={[s.searchInput, { color: C.text }]} value={search} onChangeText={setSearch} placeholder="Ism yoki narsa qidirish..." placeholderTextColor={C.textSecondary} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["yangi", "eski", "muddat"] as SortBy[]).map(k => (
            <TouchableOpacity key={k} style={[s.sortBtn, { backgroundColor: sortBy === k ? C.primary : C.card, borderColor: sortBy === k ? C.primary : C.border }]} onPress={() => setSortBy(k)}>
              <Text style={[s.sortBtnTxt, { color: sortBy === k ? "#fff" : C.textSecondary }]}>
                {k === "yangi" ? "Yangi" : k === "eski" ? "Eski" : "Muddat bo'yicha"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {isLoading ? <ActivityIndicator color={C.primary} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: insets.bottom + 100 }}
          ListEmptyComponent={() => (
            <View style={[s.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <Feather name="book" size={36} color={C.textSecondary} />
              <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Hali qarz yo'q</Text>
              <TouchableOpacity style={[s.emptyBtn, { backgroundColor: C.primary }]} onPress={() => { resetForm(); setShowModal("create"); }}>
                <Text style={s.emptyBtnTxt}>Birinchi qarzni kiriting</Text>
              </TouchableOpacity>
            </View>
          )}
          renderItem={({ item: q }) => {
            const st = getStatusStyle(q);
            const overdue = isOverdue(q.qaytarishSana, q.status);
            return (
              <TouchableOpacity
                style={[s.card, { backgroundColor: C.card, borderColor: overdue ? "#FECACA" : C.border }]}
                onPress={() => { setSelected(q); setShowModal("detail"); }}
                activeOpacity={0.75}
              >
                {overdue && (
                  <View style={[s.overdueBar, { backgroundColor: "#FEE2E2" }]}>
                    <Feather name="alert-triangle" size={12} color="#DC2626" />
                    <Text style={s.overdueBarTxt}>Muddati o'tgan — {fmtDate(q.qaytarishSana)}</Text>
                  </View>
                )}
                <View style={s.cardTop}>
                  <View style={[s.turBadge, { backgroundColor: q.tur === "olindi" ? "#EEF2FF" : "#FEF3C7" }]}>
                    <Feather name={q.tur === "olindi" ? "arrow-down-left" : "arrow-up-right"} size={14} color={q.tur === "olindi" ? C.primary : "#D97706"} />
                    <Text style={[s.turBadgeTxt, { color: q.tur === "olindi" ? C.primary : "#D97706" }]}>
                      {q.tur === "olindi" ? "Olindi" : "Berildi"}
                    </Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[s.statusBadgeTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                <View style={s.cardBody}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[s.cardIsmTxt, { color: C.text }]}>{q.ism}</Text>
                    <Text style={[s.cardNarsaTxt, { color: C.textSecondary }]}>{q.narsa}</Text>
                    {q.telefon && <Text style={[s.cardTelTxt, { color: C.primary }]}>{q.telefon}</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    {q.summa ? <Text style={[s.cardSummaTxt, { color: C.text }]}>{fmt(q.summa)}</Text> : null}
                    {q.status === "qisman" && q.qolganSumma ? (
                      <Text style={[s.cardQolganTxt, { color: "#D97706" }]}>Qoldi: {fmt(q.qolganSumma)}</Text>
                    ) : null}
                    {q.qaytarishSana && !overdue && (
                      <Text style={[s.cardDateTxt, { color: C.textSecondary }]}>
                        <Feather name="calendar" size={10} /> {fmtDate(q.qaytarishSana)}
                      </Text>
                    )}
                  </View>
                </View>

                {q.status === "ochiq" || q.status === "qisman" ? (
                  <View style={[s.cardFooter, { borderTopColor: C.border }]}>
                    <TouchableOpacity
                      style={[s.cardAction, { backgroundColor: "#ECFDF5" }]}
                      onPress={() => { setSelected(q); setTolovSumma(q.qolganSumma ? String(Math.round(q.qolganSumma)) : ""); setShowModal("tolov"); }}
                    >
                      <Feather name="check-circle" size={13} color="#059669" />
                      <Text style={[s.cardActionTxt, { color: "#059669" }]}>To'landi</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.cardAction, { backgroundColor: "#EEF2FF" }]}
                      onPress={() => Alert.alert("Yopish", `"${q.ism}" qarzini to'liq yopish?`, [
                        { text: "Bekor" }, { text: "Yopish", onPress: () => yopishMut.mutate(q.id) },
                      ])}
                    >
                      <Feather name="x-circle" size={13} color={C.primary} />
                      <Text style={[s.cardActionTxt, { color: C.primary }]}>Yopish</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { backgroundColor: C.primary, bottom: insets.bottom + 20 }]}
        onPress={() => { resetForm(); setShowModal("create"); }}
      >
        <Feather name="plus" size={22} color="#fff" />
      </TouchableOpacity>

      {/* ─── CREATE MODAL ─── */}
      <Modal visible={showModal === "create"} transparent animationType="slide" onRequestClose={() => setShowModal(null)}>
        <View style={s.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowModal(null)} />
          <View style={[s.sheet, { backgroundColor: C.card, paddingBottom: insets.bottom + 20 }]}>
            <View style={[s.sheetHeader, { borderBottomColor: C.border }]}>
              <Text style={[s.sheetTitle, { color: C.text }]}>Yangi qarz</Text>
              <TouchableOpacity onPress={() => setShowModal(null)}><Feather name="x" size={20} color={C.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
              {/* Tur tanlash */}
              <View style={{ gap: 6 }}>
                <Text style={[s.fieldLbl, { color: C.textSecondary }]}>Tur *</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {(["olindi", "berildi"] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[s.turBtn, {
                        flex: 1,
                        borderColor: form.tur === t ? (t === "olindi" ? C.primary : "#D97706") : C.border,
                        backgroundColor: form.tur === t ? (t === "olindi" ? "#EEF2FF" : "#FEF3C7") : C.card,
                      }]}
                      onPress={() => setForm(f => ({ ...f, tur: t }))}
                    >
                      <Feather name={t === "olindi" ? "arrow-down-left" : "arrow-up-right"} size={16} color={form.tur === t ? (t === "olindi" ? C.primary : "#D97706") : C.textSecondary} />
                      <Text style={[s.turBtnTxt, { color: form.tur === t ? (t === "olindi" ? C.primary : "#D97706") : C.textSecondary }]}>
                        {t === "olindi" ? "Oldim (menga berishdi)" : "Berdim (men berdim)"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Field label="Ism / Kompaniya *" value={form.ism} onChange={v => setForm(f => ({ ...f, ism: v }))} placeholder="Masalan: Jasur" />
              <Field label="Telefon" value={form.telefon} onChange={v => setForm(f => ({ ...f, telefon: v }))} placeholder="+998901234567" keyboard="phone-pad" />
              <Field label="Narsa nomi *" value={form.narsa} onChange={v => setForm(f => ({ ...f, narsa: v }))} placeholder="Pul, material, baget, tovar..." />
              <Field label="Miqdor / Summa (so'm)" value={form.summa} onChange={v => setForm(f => ({ ...f, summa: v }))} placeholder="300000" keyboard="numeric" />

              {/* Qaytarish sanasi */}
              <DateInput
                label="Qaytarish muddati"
                day={dateDay} month={dateMonth} year={dateYear}
                onChangeDay={setDateDay} onChangeMonth={setDateMonth} onChangeYear={setDateYear}
              />

              <Field label="Izoh" value={form.izoh} onChange={v => setForm(f => ({ ...f, izoh: v }))} multiline />

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: createMut.isPending || !form.ism || !form.narsa ? C.border : C.primary }]}
                onPress={() => createMut.mutate()}
                disabled={createMut.isPending || !form.ism || !form.narsa}
              >
                {createMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Saqlash</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── DETAIL MODAL ─── */}
      <Modal visible={showModal === "detail" && !!selected} transparent animationType="slide" onRequestClose={() => setShowModal(null)}>
        <View style={s.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowModal(null)} />
          <View style={[s.sheet, { backgroundColor: C.card, paddingBottom: insets.bottom + 20 }]}>
            <View style={[s.sheetHeader, { borderBottomColor: C.border }]}>
              <Text style={[s.sheetTitle, { color: C.text }]}>{selected?.ism}</Text>
              <TouchableOpacity onPress={() => setShowModal(null)}><Feather name="x" size={20} color={C.textSecondary} /></TouchableOpacity>
            </View>
            {selected && (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <InfoChip icon={selected.tur === "olindi" ? "arrow-down-left" : "arrow-up-right"} label={selected.tur === "olindi" ? "Olindi" : "Berildi"} color={selected.tur === "olindi" ? C.primary : "#D97706"} bg={selected.tur === "olindi" ? "#EEF2FF" : "#FEF3C7"} />
                  <InfoChip icon="tag" label={selected.narsa} color={C.text} bg={C.surface} />
                  {selected.status === "yopildi" && <InfoChip icon="check-circle" label="Yopildi" color="#059669" bg="#D1FAE5" />}
                </View>
                {selected.summa ? (
                  <View style={[s.detailSumma, { backgroundColor: C.surface }]}>
                    <Text style={[s.detailSummaLbl, { color: C.textSecondary }]}>Umumiy summa</Text>
                    <Text style={[s.detailSummaVal, { color: C.text }]}>{fmt(selected.summa)}</Text>
                    {selected.tolanganJami > 0 && (
                      <>
                        <View style={[s.detailRow, { borderTopColor: C.border }]}>
                          <Text style={[s.detailRowLbl, { color: "#059669" }]}>To'landi:</Text>
                          <Text style={[s.detailRowVal, { color: "#059669" }]}>{fmt(selected.tolanganJami)}</Text>
                        </View>
                        <View style={s.detailRow}>
                          <Text style={[s.detailRowLbl, { color: "#D97706" }]}>Qoldi:</Text>
                          <Text style={[s.detailRowVal, { color: "#D97706" }]}>{fmt(selected.qolganSumma)}</Text>
                        </View>
                      </>
                    )}
                  </View>
                ) : null}
                {selected.qaytarishSana && (
                  <View style={[s.detailRowInline, { backgroundColor: isOverdue(selected.qaytarishSana, selected.status) ? "#FEE2E2" : C.surface }]}>
                    <Feather name="calendar" size={14} color={isOverdue(selected.qaytarishSana, selected.status) ? "#DC2626" : C.textSecondary} />
                    <Text style={[s.detailRowInlineTxt, { color: isOverdue(selected.qaytarishSana, selected.status) ? "#DC2626" : C.text }]}>
                      Qaytarish muddati: <Text style={{ fontFamily: "Inter_700Bold" }}>{fmtDate(selected.qaytarishSana)}</Text>
                      {isOverdue(selected.qaytarishSana, selected.status) && "  ⚠️ Muddati o'tgan!"}
                    </Text>
                  </View>
                )}
                {selected.izoh ? (
                  <View style={[s.detailRowInline, { backgroundColor: C.surface }]}>
                    <Feather name="message-square" size={14} color={C.textSecondary} />
                    <Text style={[s.detailRowInlineTxt, { color: C.text }]}>{selected.izoh}</Text>
                  </View>
                ) : null}
                {/* To'lovlar tarixi */}
                {selected.tolovlar.length > 0 && (
                  <View style={{ gap: 6 }}>
                    <Text style={[s.sectionTitle, { color: C.text }]}>To'lovlar tarixi</Text>
                    {selected.tolovlar.map(t => (
                      <View key={t.id} style={[s.tolovRow, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                        <Feather name="check" size={14} color="#059669" />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.tolovSumma, { color: "#059669" }]}>{fmt(t.summa)}</Text>
                          {t.izoh && <Text style={[s.tolovIzoh, { color: "#6EE7B7" }]}>{t.izoh}</Text>}
                        </View>
                        <Text style={[s.tolovDate, { color: C.textSecondary }]}>{fmtDate(t.createdAt)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {/* Actions */}
                {(selected.status === "ochiq" || selected.status === "qisman") && (
                  <View style={{ gap: 10 }}>
                    <TouchableOpacity
                      style={[s.saveBtn, { backgroundColor: "#059669" }]}
                      onPress={() => { setTolovSumma(selected.qolganSumma ? String(Math.round(selected.qolganSumma)) : ""); setTolovIzoh(""); setShowModal("tolov"); }}
                    >
                      <Feather name="check-circle" size={16} color="#fff" />
                      <Text style={s.saveBtnTxt}>To'lov qo'shish</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.saveBtn, { backgroundColor: C.primary }]}
                      onPress={() => Alert.alert("Yopish", "Qarzni to'liq yopish?", [
                        { text: "Bekor" }, { text: "Yopish", onPress: () => yopishMut.mutate(selected.id) },
                      ])}
                    >
                      <Feather name="x-circle" size={16} color="#fff" />
                      <Text style={s.saveBtnTxt}>To'liq yopish</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity
                  style={[s.deleteBtn, { borderColor: "#FECACA" }]}
                  onPress={() => Alert.alert("O'chirish", `"${selected.ism}" qarzini o'chirish?`, [
                    { text: "Bekor" }, { text: "O'chirish", style: "destructive", onPress: () => deleteMut.mutate(selected.id) },
                  ])}
                >
                  <Feather name="trash-2" size={14} color="#DC2626" />
                  <Text style={[s.deleteBtnTxt, { color: "#DC2626" }]}>O'chirish</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── TO'LOV MODAL ─── */}
      <Modal visible={showModal === "tolov"} transparent animationType="slide" onRequestClose={() => setShowModal(null)}>
        <View style={s.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowModal(null)} />
          <View style={[s.sheet, { backgroundColor: C.card, paddingBottom: insets.bottom + 20 }]}>
            <View style={[s.sheetHeader, { borderBottomColor: C.border }]}>
              <Text style={[s.sheetTitle, { color: C.text }]}>To'lov qo'shish</Text>
              <TouchableOpacity onPress={() => setShowModal(null)}><Feather name="x" size={20} color={C.textSecondary} /></TouchableOpacity>
            </View>
            <View style={{ padding: 16, gap: 14 }}>
              {selected?.qolganSumma && selected.qolganSumma > 0 && (
                <View style={[s.detailRowInline, { backgroundColor: "#FEF3C7" }]}>
                  <Feather name="info" size={14} color="#D97706" />
                  <Text style={[s.detailRowInlineTxt, { color: "#D97706" }]}>Qolgan qarz: <Text style={{ fontFamily: "Inter_700Bold" }}>{fmt(selected.qolganSumma)}</Text></Text>
                </View>
              )}
              <Field label="To'lov miqdori *" value={tolovSumma} onChange={setTolovSumma} keyboard="numeric" placeholder="0" />
              <Field label="Izoh" value={tolovIzoh} onChange={setTolovIzoh} multiline />
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: tolovMut.isPending || !tolovSumma ? C.border : "#059669" }]}
                onPress={() => tolovMut.mutate()}
                disabled={tolovMut.isPending || !tolovSumma}
              >
                {tolovMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Saqlash</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── SMS MODAL ─── */}
      <Modal visible={showModal === "sms"} transparent animationType="slide" onRequestClose={() => setShowModal(null)}>
        <View style={s.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowModal(null)} />
          <View style={[s.sheet, { backgroundColor: C.card, paddingBottom: insets.bottom + 20 }]}>
            <View style={[s.sheetHeader, { borderBottomColor: C.border }]}>
              <Text style={[s.sheetTitle, { color: C.text }]}>SMS yuborish</Text>
              <TouchableOpacity onPress={() => setShowModal(null)}><Feather name="x" size={20} color={C.textSecondary} /></TouchableOpacity>
            </View>
            <View style={{ padding: 16, gap: 12 }}>
              {/* Select all */}
              <TouchableOpacity style={[s.selectAllBtn, { borderColor: C.border, backgroundColor: smsSelected.size === smsEligible.length && smsEligible.length > 0 ? "#EEF2FF" : C.card }]} onPress={selectAllSms}>
                <Feather name={smsSelected.size === smsEligible.length && smsEligible.length > 0 ? "check-square" : "square"} size={18} color={C.primary} />
                <Text style={[s.selectAllTxt, { color: C.text }]}>Barchasini tanlash ({smsEligible.length} ta)</Text>
              </TouchableOpacity>

              {smsEligible.length === 0 ? (
                <View style={{ alignItems: "center", padding: 20 }}>
                  <Feather name="info" size={24} color={C.textSecondary} />
                  <Text style={{ color: C.textSecondary, fontSize: 13, marginTop: 8, textAlign: "center" }}>Telefon raqami bor ochiq qarzlar yo'q</Text>
                </View>
              ) : (
                <FlatList
                  data={smsEligible}
                  keyExtractor={i => i.id.toString()}
                  style={{ maxHeight: 350 }}
                  contentContainerStyle={{ gap: 8 }}
                  renderItem={({ item: q }) => {
                    const isChecked = smsSelected.has(q.id);
                    return (
                      <TouchableOpacity
                        style={[s.smsItem, { borderColor: isChecked ? C.primary : C.border, backgroundColor: isChecked ? "#EEF2FF" : C.card }]}
                        onPress={() => toggleSmsSelect(q.id)}
                        activeOpacity={0.7}
                      >
                        <Feather name={isChecked ? "check-square" : "square"} size={18} color={isChecked ? C.primary : C.textSecondary} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[s.smsItemName, { color: C.text }]}>{q.ism}</Text>
                          <Text style={{ fontSize: 11, color: C.primary, fontFamily: "Inter_400Regular" }}>{q.telefon}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          {q.qolganSumma ? <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#D97706" }}>{fmt(q.qolganSumma)}</Text> : q.summa ? <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: C.text }}>{fmt(q.summa)}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}

              {/* Send button */}
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: smsSending || smsSelected.size === 0 ? C.border : "#DC2626" }]}
                onPress={sendSmsToSelected}
                disabled={smsSending || smsSelected.size === 0}
              >
                {smsSending ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Feather name="send" size={16} color="#fff" />
                    <Text style={s.saveBtnTxt}>SMS yuborish ({smsSelected.size} ta)</Text>
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

function Field({ label, value, onChange, placeholder, keyboard, multiline, type }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: any; multiline?: boolean; type?: string;
}) {
  return (
    <View style={{ gap: 4 }}>
      {!!label && <Text style={[s.fieldLbl, { color: C.textSecondary }]}>{label}</Text>}
      <TextInput
        style={[s.fieldInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }, multiline && { height: 80, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textSecondary}
        keyboardType={keyboard}
        multiline={multiline}
      />
    </View>
  );
}

function InfoChip({ icon, label, color, bg }: { icon: any; label: string; color: string; bg: string }) {
  return (
    <View style={[s.infoChip, { backgroundColor: bg }]}>
      <Feather name={icon} size={13} color={color} />
      <Text style={[s.infoChipTxt, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, gap: 10 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  statCard: { borderRadius: 14, padding: 10, gap: 2, alignItems: "center" },
  statLbl: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statCount: { fontSize: 10, fontFamily: "Inter_400Regular" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, marginBottom: 0 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabBtnTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  sortBtn: { borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 6 },
  sortBtnTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  overdueBar: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
  overdueBarTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#DC2626" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, paddingBottom: 8 },
  turBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  turBadgeTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardBody: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 12 },
  cardIsmTxt: { fontSize: 15, fontFamily: "Inter_700Bold" },
  cardNarsaTxt: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardTelTxt: { fontSize: 11, fontFamily: "Inter_500Medium" },
  cardSummaTxt: { fontSize: 16, fontFamily: "Inter_700Bold" },
  cardQolganTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardDateTxt: { fontSize: 11, fontFamily: "Inter_400Regular" },
  cardFooter: { flexDirection: "row", gap: 8, padding: 10, borderTopWidth: 1 },
  cardAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 7, borderRadius: 8 },
  cardActionTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 30, alignItems: "center", gap: 12, marginTop: 20 },
  emptyTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBtnTxt: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  fab: { position: "absolute", right: 20, width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  turBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 2 },
  turBtnTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  dateBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  dateBtnTxt: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  fieldLbl: { fontSize: 11, fontFamily: "Inter_500Medium" },
  fieldInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: "Inter_400Regular" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  saveBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  deleteBtnTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  detailSumma: { borderRadius: 12, padding: 14, gap: 6 },
  detailSummaLbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
  detailSummaVal: { fontSize: 24, fontFamily: "Inter_700Bold" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 6, borderTopWidth: 1 },
  detailRowLbl: { fontSize: 12, fontFamily: "Inter_400Regular" },
  detailRowVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  detailRowInline: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10 },
  detailRowInlineTxt: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  tolovRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  tolovSumma: { fontSize: 13, fontFamily: "Inter_700Bold" },
  tolovIzoh: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tolovDate: { fontSize: 10, fontFamily: "Inter_400Regular" },
  infoChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  infoChipTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  selectAllBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  selectAllTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  smsItem: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  smsItemName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
