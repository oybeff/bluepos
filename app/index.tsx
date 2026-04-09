import { Redirect } from "expo-router";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/auth";

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={st.container}>
        <View style={st.content}>
          <View style={st.logoWrap}>
            <Feather name="layers" size={52} color="#fff" />
          </View>
          <Text style={st.appName}>Bluepos</Text>
          <Text style={st.tagline}>Parda do'konlari uchun POS tizimi</Text>
        </View>
        <View style={st.bottom}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
          <Text style={st.loadingText}>Yuklanmoqda...</Text>
        </View>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)" />;
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  appName: {
    fontSize: 36,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  bottom: {
    paddingBottom: 60,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
});
