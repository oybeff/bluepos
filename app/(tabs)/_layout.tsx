import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/auth";

const ADMIN_ROLES = ["manager", "super_admin", "owner", "admin", "shop_owner"];

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const safeAreaInsets = useSafeAreaInsets();
  const isDark = colorScheme === "dark";
  const isWeb = Platform.OS === "web";
  const C = isDark ? Colors.dark : Colors.light;
  const { user } = useAuth();
  const isAdmin = user ? ADMIN_ROLES.includes(user.role) : false;
  const isSeller = user?.role === "seller";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: C.border,
          elevation: 0,
          shadowColor: C.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 1,
          shadowRadius: 8,
          paddingBottom: safeAreaInsets.bottom,
          ...(isWeb ? { height: 80 } : { height: 64 + safeAreaInsets.bottom }),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Inter_600SemiBold",
          marginTop: -2,
        },
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "#0F172A" : "#FFFFFF" }]} />
        ),
      }}
    >
      {/* Position 1: Statistika — always visible */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Statistika",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSt.activeWrap : null}>
              <Feather name="bar-chart-2" size={21} color={color} />
            </View>
          ),
        }}
      />

      {/* Position 2: Sotuv (seller) or Mijoz oldiga (admin) */}
      <Tabs.Screen
        name="sotuv"
        options={{
          title: "Sotuv",
          href: isSeller ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSt.activeWrap : null}>
              <Feather name="shopping-cart" size={21} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="mijoz-oldiga"
        options={{
          title: "Mijoz oldiga",
          href: isSeller ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSt.activeWrap : null}>
              <Feather name="user-check" size={21} color={color} />
            </View>
          ),
        }}
      />

      {/* Position 3: Calculator — always visible (center) */}
      <Tabs.Screen
        name="calculator"
        options={{
          title: "Hisoblash",
          tabBarIcon: ({ color, focused }) => (
            <View style={[tabSt.centerBtn, { backgroundColor: focused ? C.primary : C.primary + "18" }]}>
              <Feather name="scissors" size={22} color={focused ? "#fff" : C.primary} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />

      {/* Position 4: Mahsulotlar (seller) or Oldi-berdi (admin) */}
      <Tabs.Screen
        name="mahsulotlar"
        options={{
          title: "Mahsulotlar",
          href: isSeller ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSt.activeWrap : null}>
              <Feather name="box" size={21} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="oldi-berdi"
        options={{
          title: "Kirim",
          href: isSeller ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSt.activeWrap : null}>
              <Feather name="package" size={21} color={color} />
            </View>
          ),
        }}
      />

      {/* Position 5: Davomat (seller) or Rasxodlar (admin) */}
      <Tabs.Screen
        name="davomat"
        options={{
          title: "Davomat",
          href: isSeller ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSt.activeWrap : null}>
              <Feather name="user-check" size={21} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="rasxodlar"
        options={{
          title: "Rasxodlar",
          href: isSeller ? null : (isAdmin ? undefined : null),
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabSt.activeWrap : null}>
              <Feather name="trending-down" size={21} color={color} />
            </View>
          ),
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen name="lidlar"         options={{ href: null }} />
      <Tabs.Screen name="hisobot"        options={{ href: null }} />
      <Tabs.Screen name="xabarnomalar"   options={{ href: null }} />
      <Tabs.Screen name="mijoz"          options={{ href: null }} />
      <Tabs.Screen name="orders"         options={{ href: null }} />
      <Tabs.Screen name="kassa"          options={{ href: null }} />
      <Tabs.Screen name="ombor-harakati" options={{ href: null }} />
      <Tabs.Screen name="invoice"        options={{ href: null }} />
      <Tabs.Screen name="kanban"         options={{ href: null }} />
      <Tabs.Screen name="jadval"         options={{ href: null }} />
      <Tabs.Screen name="profile"        options={{ href: null }} />
      <Tabs.Screen name="qarz-daftar"    options={{ href: null }} />
      <Tabs.Screen name="mijozlar"       options={{ href: null }} />
      <Tabs.Screen name="xodimlar"       options={{ href: null }} />
      <Tabs.Screen name="shaxsiy-xarajatlar" options={{ href: null }} />
    </Tabs>
  );
}

const tabSt = StyleSheet.create({
  activeWrap: {
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    padding: 4,
  },
  centerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
