import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { login } from "@/lib/api";
import { useAuth } from "@/context/auth";
import Colors from "@/constants/colors";

const BIOMETRIC_KEY = "biometric_enabled";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login: authLogin } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<"fingerprint" | "face" | "none">("none");
  const [hasToken, setHasToken] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const C = Colors.light;

  const triggerBiometric = useCallback(async (tokenOverride?: string) => {
    setBiometricLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Ilovaga kirish",
        fallbackLabel: "Parol bilan kirish",
        cancelLabel: "Bekor qilish",
        disableDeviceFallback: false,
      });
      if (result.success) {
        const token = tokenOverride || await AsyncStorage.getItem("auth_token");
        const userStr = await AsyncStorage.getItem("auth_user");
        if (token && userStr) {
          try {
            await authLogin(token, JSON.parse(userStr));
            router.replace("/(tabs)");
          } catch {
            Alert.alert("Xato", "Saqlangan ma'lumot buzilgan. Parol bilan kiring.");
          }
        } else {
          Alert.alert("Xato", "Token topilmadi. Parol bilan kiring.");
        }
      }
    } catch {
      // ignore
    } finally {
      setBiometricLoading(false);
    }
  }, [authLogin]);

  useEffect(() => {
    (async () => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const enabled = await AsyncStorage.getItem(BIOMETRIC_KEY);
        const token = await AsyncStorage.getItem("auth_token");
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const avail = compatible && enrolled;
        setBiometricAvailable(avail);
        setBiometricEnabled(enabled === "true");
        setHasToken(!!token);
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType("face");
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType("fingerprint");
        }
        if (avail && enabled === "true" && token) {
          setTimeout(() => triggerBiometric(token), 700);
        }
      } catch { /* ignore */ }
    })();
  }, [triggerBiometric]);

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Xato", "Login va parolni kiriting");
      return;
    }
    setIsLoading(true);
    try {
      const result = await login(username.trim(), password);
      await AsyncStorage.setItem("auth_user", JSON.stringify(result.user));
      await authLogin(result.token, result.user as Parameters<typeof authLogin>[1]);
      const isSuperAdmin = (result.user as any)?.role === "super_admin";
      const destination = isSuperAdmin ? "/super-admin" : "/(tabs)";
      if (biometricAvailable && !biometricEnabled && !isSuperAdmin) {
        const lbl = biometricType === "face" ? "Face ID" : biometricType === "fingerprint" ? "barmoq izi" : "biometrik";
        Alert.alert(
          biometricType === "face" ? "Face ID yoqilsinmi?" : "Barmoq izi yoqilsinmi?",
          `Keyingi safar ${lbl} bilan tezroq kirishni xohlaysizmi?`,
          [
            { text: "Yo'q", style: "cancel", onPress: () => router.replace(destination as any) },
            { text: "Ha", onPress: async () => { await AsyncStorage.setItem(BIOMETRIC_KEY, "true"); router.replace(destination as any); } },
          ]
        );
      } else {
        router.replace(destination as any);
      }
    } catch (err: any) {
      const msg = err?.message?.includes("Network")
        ? "Serverga ulanib bo'lmadi. Internetni tekshiring."
        : err?.message || "Login yoki parol noto'g'ri";
      Alert.alert("Xato", msg);
    } finally {
      setIsLoading(false);
    }
  }

  const bioIcon = biometricType === "face" ? "smile" as const : "activity" as const;
  const bioLabel = biometricType === "face" ? "Face ID" : "Barmoq izi";

  return (
    <KeyboardAvoidingView
      style={[st.container, { backgroundColor: C.primary }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[st.scroll, {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20),
        }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={st.header}>
          <View style={st.logoWrap}>
            <Feather name="layers" size={48} color="#fff" />
          </View>
          <Text style={st.appName}>Bluepos</Text>
          <Text style={st.tagline}>Parda do'konlari uchun POS tizimi</Text>
        </View>

        <View style={st.card}>
          <Text style={[st.cardTitle, { color: C.text }]}>Kirish</Text>

          <View style={st.field}>
            <Text style={[st.label, { color: C.textSecondary }]}>Login</Text>
            <View style={[st.inputRow, { borderColor: C.border, backgroundColor: C.surface }]}>
              <Feather name="user" size={18} color={C.textSecondary} />
              <TextInput
                style={[st.input, { color: C.text }]}
                value={username} onChangeText={setUsername}
                placeholder="username" placeholderTextColor={C.textSecondary}
                autoCapitalize="none" autoCorrect={false}
              />
            </View>
          </View>

          <View style={st.field}>
            <Text style={[st.label, { color: C.textSecondary }]}>Parol</Text>
            <View style={[st.inputRow, { borderColor: C.border, backgroundColor: C.surface }]}>
              <Feather name="lock" size={18} color={C.textSecondary} />
              <TextInput
                style={[st.input, { color: C.text }]}
                value={password} onChangeText={setPassword}
                placeholder="••••••" placeholderTextColor={C.textSecondary}
                secureTextEntry={!showPassword} autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={st.eyeBtn}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[st.loginBtn, { backgroundColor: C.primary }, isLoading && { opacity: 0.7 }]}
            onPress={handleLogin} disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={st.loginBtnTxt}>Kirish</Text>}
          </TouchableOpacity>

          {biometricAvailable && biometricEnabled && hasToken && (
            <TouchableOpacity
              style={[st.bioBtn, { borderColor: C.primary, backgroundColor: C.surface }]}
              onPress={() => triggerBiometric()} disabled={biometricLoading}
            >
              {biometricLoading
                ? <ActivityIndicator color={C.primary} size="small" />
                : <>
                    <Feather name={bioIcon} size={22} color={C.primary} />
                    <Text style={[st.bioBtnTxt, { color: C.primary }]}>{bioLabel} bilan kirish</Text>
                  </>
              }
            </TouchableOpacity>
          )}

          <View style={st.divider}>
            <View style={[st.dividerLine, { backgroundColor: C.border }]} />
            <Text style={[st.dividerTxt, { color: C.textSecondary }]}>yoki</Text>
            <View style={[st.dividerLine, { backgroundColor: C.border }]} />
          </View>

          <TouchableOpacity
            style={[st.registerBtn, { borderColor: C.primary, backgroundColor: C.surface }]}
            onPress={() => router.push("/register")}
          >
            <Feather name="user-plus" size={20} color={C.primary} />
            <Text style={[st.registerBtnTxt, { color: C.primary }]}>Ro'yxatdan o'tish</Text>
          </TouchableOpacity>

          <View style={st.hint}>
            <Feather name="shield" size={13} color={C.textSecondary} />
            <Text style={[st.hintTxt, { color: C.textSecondary }]}>Ma'lumotlaringiz himoyalangan</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, gap: 32 },
  header: { alignItems: "center", gap: 8 },
  logoWrap: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
  appName: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff" },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", textAlign: "center" },
  card: {
    backgroundColor: "#fff", borderRadius: 24, padding: 24, gap: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 8,
  },
  cardTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 4 },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: 12, height: 52, paddingHorizontal: 14, gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", height: 52 },
  eyeBtn: { padding: 4 },
  loginBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  loginBtnTxt: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  bioBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, height: 52, borderRadius: 14, borderWidth: 1.5,
  },
  bioBtnTxt: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerTxt: { fontSize: 13, fontFamily: "Inter_400Regular" },
  registerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, height: 52, borderRadius: 14, borderWidth: 1.5,
  },
  registerBtnTxt: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  hint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  hintTxt: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
