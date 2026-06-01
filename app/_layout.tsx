import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useCallback } from "react";
import { Alert, Platform } from "react-native";
import * as Updates from "expo-updates";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/auth";

if (process.env.EXPO_PUBLIC_DOMAIN) {
  const d = process.env.EXPO_PUBLIC_DOMAIN;
  setBaseUrl(d.startsWith("http") ? d : `https://${d}`);
}

SplashScreen.preventAutoHideAsync();

// queryClient imported from @/lib/query-client

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/login", "/register", "/register-pending"];

function AuthGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    const isPublic = PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"));

    if (!user && !isPublic) {
      router.replace("/login" as any);
    }
  }, [user, isLoading, pathname]);

  return null;
}

function useOTAUpdates() {
  const checkForUpdate = useCallback(async () => {
    if (__DEV__) return;
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch {}
  }, []);

  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);
}

function RootLayoutNav() {
  useOTAUpdates();
  return (
    <>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="register-pending" />
        <Stack.Screen name="deal/[id]/index" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="deal/[id]/edit" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="new-deal" options={{ animation: "slide_from_bottom", presentation: "modal" }} />
        <Stack.Screen name="scanner" options={{ animation: "slide_from_bottom", presentation: "modal" }} />
        <Stack.Screen name="payment-qr" options={{ animation: "slide_from_bottom", presentation: "modal" }} />
        <Stack.Screen name="super-admin" options={{ animation: "slide_from_right", headerShown: false }} />
        <Stack.Screen name="hisobot" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="low-stock" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="katalog" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="supplier-order" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="chevar-panel" options={{ animation: "fade" }} />
        <Stack.Screen name="haydovchi-panel" options={{ animation: "fade" }} />
        <Stack.Screen name="printer-settings" options={{ animation: "slide_from_right" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
