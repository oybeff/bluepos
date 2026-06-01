import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Share, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import Colors from "@/constants/colors";
import { fmtDateNum, fmtNum } from "../lib/date-utils";

const C = Colors.light;

function fmt(n: number) {
  return fmtNum(Math.round(n || 0)) + " so'm";
}

export default function PaymentQRScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    dealId: string;
    amount: string;
    clientName: string;
    phone: string;
  }>();

  const [activeTab, setActiveTab] = useState<"payme" | "click" | "info">("payme");

  const amount = parseFloat(params.amount || "0");
  const dealId = params.dealId || "0";
  const clientName = params.clientName || "Noma'lum";
  const phone = params.phone || "";

  // QR content for different systems
  const infoQr = JSON.stringify({
    type: "blupos_payment",
    deal: dealId,
    amount: amount,
    client: clientName,
    date: new Date().toISOString().slice(0, 10),
  });

  // Payme format (merchant ID needed for real payments — placeholder used here)
  const paymeUrl = `https://checkout.paycom.uz/?amount=${Math.round(amount * 100)}&account[deal_id]=${dealId}`;

  // Click format
  const clickUrl = `https://my.click.uz/services/pay/?service_id=0&merchant_id=0&amount=${amount}&transaction_param=${dealId}`;

  const qrValue = activeTab === "payme" ? paymeUrl : activeTab === "click" ? clickUrl : infoQr;

  async function handleShare() {
    try {
      await Share.share({
        message: `💳 To'lov ma'lumotlari\n\nMijoz: ${clientName}${phone ? "\nTel: " + phone : ""}\nBitim #${dealId}\nSumma: ${fmt(amount)}\n\nPayme: ${paymeUrl}\nClick: ${clickUrl}`,
        title: `Bitim #${dealId} to'lov`,
      });
    } catch { /* ignore */ }
  }

  const tabs: { key: "payme" | "click" | "info"; label: string; color: string }[] = [
    { key: "payme", label: "Payme", color: "#00AAFF" },
    { key: "click", label: "Click", color: "#F58220" },
    { key: "info", label: "Ma'lumot", color: C.primary },
  ];

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: C.card }]} onPress={() => router.back()}>
          <Feather name="x" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: C.text }]}>QR To'lov</Text>
          <Text style={[s.subtitle, { color: C.textSecondary }]}>Bitim #{dealId}</Text>
        </View>
        <TouchableOpacity style={[s.shareBtn, { backgroundColor: C.surface }]} onPress={handleShare}>
          <Feather name="share-2" size={18} color={C.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Amount card */}
        <View style={[s.amountCard, { backgroundColor: C.primary }]}>
          <Text style={s.amountLabel}>To'lov summasi</Text>
          <Text style={s.amountValue}>{fmt(amount)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Feather name="user" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={s.amountClient}>{clientName}</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={[s.tabs, { backgroundColor: C.surface }]}>
          {tabs.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tab, activeTab === t.key && { backgroundColor: "#fff", borderRadius: 10 }]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[s.tabTxt, { color: activeTab === t.key ? t.color : C.textSecondary }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* QR Code */}
        <View style={[s.qrCard, { backgroundColor: C.card }]}>
          <View style={[s.qrWrap, { borderColor: C.border }]}>
            <QRCode
              value={qrValue}
              size={220}
              color="#1F2937"
              backgroundColor="#fff"
              ecl="M"
            />
          </View>

          {activeTab === "payme" && (
            <View style={[s.badge, { backgroundColor: "#E0F2FE" }]}>
              <View style={[s.badgeDot, { backgroundColor: "#00AAFF" }]} />
              <Text style={[s.badgeTxt, { color: "#0369A1" }]}>
                Payme ilovasidan skanerlang
              </Text>
            </View>
          )}
          {activeTab === "click" && (
            <View style={[s.badge, { backgroundColor: "#FFF7ED" }]}>
              <View style={[s.badgeDot, { backgroundColor: "#F58220" }]} />
              <Text style={[s.badgeTxt, { color: "#92400E" }]}>
                Click ilovasidan skanerlang
              </Text>
            </View>
          )}
          {activeTab === "info" && (
            <View style={[s.badge, { backgroundColor: C.surface }]}>
              <View style={[s.badgeDot, { backgroundColor: C.primary }]} />
              <Text style={[s.badgeTxt, { color: C.textSecondary }]}>
                Bitim ma'lumotlari QR kodi
              </Text>
            </View>
          )}
        </View>

        {/* Payment Details */}
        <View style={[s.detailsCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.detailsTitle, { color: C.text }]}>To'lov ma'lumotlari</Text>
          <DetailRow label="Mijoz" value={clientName} />
          {phone ? <DetailRow label="Telefon" value={phone} /> : null}
          <DetailRow label="Bitim raqami" value={`#${dealId}`} />
          <DetailRow label="Summa" value={fmt(amount)} bold color="#059669" />
          <DetailRow label="Sana" value={fmtDateNum(new Date())} />
        </View>

        {/* Instructions */}
        <View style={[s.infoBox, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
          <Feather name="info" size={15} color="#D97706" />
          <Text style={[s.infoTxt, { color: "#92400E" }]}>
            To'lov qilinganidan so'ng kassada tasdiqlash esdan chiqmasin
          </Text>
        </View>

        {/* Share button */}
        <TouchableOpacity
          style={[s.shareFullBtn, { backgroundColor: C.primary }]}
          onPress={handleShare}
        >
          <Feather name="share-2" size={18} color="#fff" />
          <Text style={s.shareFullBtnTxt}>To'lov ma'lumotini ulashish</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}>
      <Text style={{ fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" }}>{label}</Text>
      <Text style={{ fontSize: 13, color: color || C.text, fontFamily: bold ? "Inter_700Bold" : "Inter_500Medium" }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  shareBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },

  amountCard: { marginHorizontal: 16, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 16 },
  amountLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" },
  amountValue: { fontSize: 32, color: "#fff", fontFamily: "Inter_700Bold", marginTop: 4 },
  amountClient: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_500Medium" },

  tabs: { flexDirection: "row", marginHorizontal: 16, borderRadius: 14, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center" },
  tabTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  qrCard: { alignItems: "center", marginHorizontal: 16, borderRadius: 20, padding: 24, gap: 16, marginBottom: 16 },
  qrWrap: { padding: 16, borderRadius: 16, borderWidth: 1, backgroundColor: "#fff" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeTxt: { fontSize: 12, fontFamily: "Inter_500Medium" },

  detailsCard: {
    marginHorizontal: 16, borderRadius: 16, borderWidth: 1,
    padding: 16, marginBottom: 12,
  },
  detailsTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 8 },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    marginHorizontal: 16, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16,
  },
  infoTxt: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },

  shareFullBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginHorizontal: 16, paddingVertical: 15, borderRadius: 16,
  },
  shareFullBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
