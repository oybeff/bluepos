import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/api";

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const C = Colors.light;

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [shopName, setShopName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister() {
    if (!fullName.trim() || !username.trim() || !phone.trim() || !password.trim()) {
      Alert.alert("Xato", "Barcha majburiy maydonlarni to'ldiring");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Xato", "Parol kamida 6 ta belgidan iborat bo'lishi kerak");
      return;
    }
    setIsLoading(true);
    try {
      const base = getApiUrl();
      const res = await fetch(`${base}/api/auth/register-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim(),
          phone: phone.trim(),
          shopName: shopName.trim() || undefined,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Xato", data.error || "So'rov yuborishda xato");
        return;
      }
      router.replace({ pathname: "/register-pending", params: { id: String(data.id), username: username.trim() } });
    } catch {
      Alert.alert("Xato", "Server bilan aloqa yo'q. Keyinroq urinib ko'ring.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[st.container, { backgroundColor: C.primary }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[st.scroll, {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
          paddingBottom: insets.bottom + 20,
        }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={st.header}>
          <View style={st.logoWrap}>
            <Feather name="user-plus" size={40} color="#fff" />
          </View>
          <Text style={st.appName}>Bluepos</Text>
          <Text style={st.tagline}>Ro'yxatdan o'tish</Text>
        </View>

        <View style={st.card}>
          <Text style={[st.cardTitle, { color: C.text }]}>Yangi hisob</Text>
          <Text style={[st.cardSub, { color: C.textSecondary }]}>
            So'rovingiz admin tomonidan tasdiqlanadi
          </Text>

          <Field label="To'liq ism *" icon="user" value={fullName} onChange={setFullName}
            placeholder="Ism Familiya" color={C} />
          <Field label="Login (username) *" icon="at-sign" value={username} onChange={setUsername}
            placeholder="username" color={C} autoCapitalize="none" />
          <Field label="Telefon raqam *" icon="phone" value={phone} onChange={setPhone}
            placeholder="+998 90 123 45 67" color={C} keyboardType="phone-pad" />
          <Field label="Do'kon nomi" icon="shopping-bag" value={shopName} onChange={setShopName}
            placeholder="Parda do'koningiz nomi (ixtiyoriy)" color={C} />

          <View style={st.field}>
            <Text style={[st.label, { color: C.textSecondary }]}>Parol *</Text>
            <View style={[st.inputRow, { borderColor: C.border, backgroundColor: C.surface }]}>
              <Feather name="lock" size={18} color={C.textSecondary} />
              <TextInput
                style={[st.input, { color: C.text }]}
                value={password} onChangeText={setPassword}
                placeholder="Kamida 6 belgi" placeholderTextColor={C.textSecondary}
                secureTextEntry={!showPassword} autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={st.eyeBtn}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[st.btn, { backgroundColor: C.primary }, isLoading && { opacity: 0.7 }]}
            onPress={handleRegister} disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={st.btnTxt}>So'rov yuborish</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={16} color={C.primary} />
            <Text style={[st.backTxt, { color: C.primary }]}>Kirishga qaytish</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, icon, value, onChange, placeholder, color: C, autoCapitalize = "words" as any, keyboardType = "default" as any }: any) {
  return (
    <View style={st.field}>
      <Text style={[st.label, { color: C.textSecondary }]}>{label}</Text>
      <View style={[st.inputRow, { borderColor: C.border, backgroundColor: C.surface }]}>
        <Feather name={icon} size={18} color={C.textSecondary} />
        <TextInput
          style={[st.input, { color: C.text }]}
          value={value} onChangeText={onChange}
          placeholder={placeholder} placeholderTextColor={C.textSecondary}
          autoCapitalize={autoCapitalize} keyboardType={keyboardType} autoCorrect={false}
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, gap: 24 },
  header: { alignItems: "center", gap: 8 },
  logoWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  card: {
    backgroundColor: "#fff", borderRadius: 24, padding: 24, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 8,
  },
  cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -6 },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: 12, height: 50, paddingHorizontal: 14, gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", height: 50 },
  eyeBtn: { padding: 4 },
  btn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  btnTxt: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  backBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 },
  backTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
