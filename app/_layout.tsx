import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@/lib/api-client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/auth";

if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="deal/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="new-deal" options={{ animation: "slide_from_bottom", presentation: "modal" }} />
      <Stack.Screen name="scanner" options={{ animation: "slide_from_bottom", presentation: "modal" }} />
      <Stack.Screen name="payment-qr" options={{ animation: "slide_from_bottom", presentation: "modal" }} />
      <Stack.Screen name="super-admin" options={{ animation: "slide_from_right", headerShown: false }} />
      <Stack.Screen name="hisobot" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="low-stock" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="katalog" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="supplier-order" options={{ animation: "slide_from_right" }} />
    </Stack>
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
