import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/api";

type Status = "pending" | "approved" | "rejected" | "error";

export default function RegisterPendingScreen() {
  const insets = useSafeAreaInsets();
  const { id, username } = useLocalSearchParams<{ id: string; username: string }>();
  const C = Colors.light;
  const [status, setStatus] = useState<Status>("pending");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    checkStatus();
    intervalRef.current = setInterval(checkStatus, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [id]);

  async function checkStatus() {
    try {
      const base = getApiUrl();
      const res = await fetch(`${base}/api/auth/register-status/${id}`);
      if (!res.ok) { setStatus("error"); return; }
      const data = await res.json();
      setStatus(data.status as Status);
      if (data.status === "approved" || data.status === "rejected") {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch {
      setStatus("error");
    }
  }

  const isPending = status === "pending";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  return (
    <View style={[st.container, { backgroundColor: C.primary }]}>
      <View style={[st.inner, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>

        <View style={st.iconWrap}>
          {isPending && <ActivityIndicator size="large" color="#fff" />}
          {isApproved && <Feather name="check-circle" size={72} color="#4ade80" />}
          {isRejected && <Feather name="x-circle" size={72} color="#f87171" />}
          {status === "error" && <Feather name="wifi-off" size={72} color="rgba(255,255,255,0.6)" />}
        </View>

        <View style={[st.card]}>
          {isPending && (
            <>
              <Text style={[st.title, { color: C.text }]}>So'rov yuborildi</Text>
              <Text style={[st.sub, { color: C.textSecondary }]}>
                Admin tasdiqlashini kuting. Tasdiqlangandan so'ng tizimga kirishingiz mumkin bo'ladi.
              </Text>
              <View style={st.statusRow}>
                <View style={[st.dot, { backgroundColor: "#f59e0b" }]} />
                <Text style={[st.statusTxt, { color: C.textSecondary }]}>Ko'rib chiqilmoqda...</Text>
              </View>
            </>
          )}

          {isApproved && (
            <>
              <Text style={[st.title, { color: C.text }]}>Tasdiqlandi!</Text>
              <Text style={[st.sub, { color: C.textSecondary }]}>
                Hisobingiz faollashtirildi. Endi tizimga kirishingiz mumkin.
              </Text>
              <TouchableOpacity
                style={[st.btn, { backgroundColor: C.primary }]}
                onPress={() => router.replace("/login")}
              >
                <Feather name="log-in" size={18} color="#fff" />
                <Text style={st.btnTxt}>Kirish</Text>
              </TouchableOpacity>
            </>
          )}

          {isRejected && (
            <>
              <Text style={[st.title, { color: C.text }]}>Rad etildi</Text>
              <Text style={[st.sub, { color: C.textSecondary }]}>
                So'rovingiz rad etildi. Boshqa login bilan qayta urinib ko'ring yoki admin bilan bog'laning.
              </Text>
              <TouchableOpacity
                style={[st.btn, { backgroundColor: C.primary }]}
                onPress={() => router.replace("/register")}
              >
                <Feather name="refresh-cw" size={18} color="#fff" />
                <Text style={st.btnTxt}>Qayta urinish</Text>
              </TouchableOpacity>
            </>
          )}

          {status === "error" && (
            <>
              <Text style={[st.title, { color: C.text }]}>Xato</Text>
              <Text style={[st.sub, { color: C.textSecondary }]}>
                Server bilan aloqa yo'q. Internetni tekshiring.
              </Text>
              <TouchableOpacity
                style={[st.btn, { backgroundColor: C.primary }]}
                onPress={checkStatus}
              >
                <Feather name="refresh-cw" size={18} color="#fff" />
                <Text style={st.btnTxt}>Qayta tekshirish</Text>
              </TouchableOpacity>
            </>
          )}

          {(isPending || status === "error") && (
            <TouchableOpacity style={st.backBtn} onPress={() => router.replace("/login")}>
              <Feather name="arrow-left" size={15} color={C.primary} />
              <Text style={[st.backTxt, { color: C.primary }]}>Kirishga qaytish</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={st.infoRow}>
          <Feather name="shield" size={13} color="rgba(255,255,255,0.7)" />
          <Text style={st.infoTxt}>
            Login: <Text style={{ fontFamily: "Inter_600SemiBold" }}>{username}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 32 },
  iconWrap: { height: 80, alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%", backgroundColor: "#fff", borderRadius: 24,
    padding: 24, gap: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 8,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  btn: { height: 52, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnTxt: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  backBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  backTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoTxt: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
});
