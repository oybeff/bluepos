import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Platform } from "react-native";
import { router } from "expo-router";
import { setAuthTokenGetter } from "@/lib/api-client";
import { setOnUnauthorized } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  branchId: number | null;
  linkedWorkerId?: number | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuth();
  }, []);

  async function loadAuth() {
    try {
      const storedToken = await AsyncStorage.getItem("auth_token");
      const storedUser = await AsyncStorage.getItem("auth_user");
      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        setToken(storedToken);
        setUser(parsedUser);
        setAuthTokenGetter(() => storedToken);
      }
    } catch {
      // ignore parse errors
    } finally {
      setIsLoading(false);
    }
  }

  const login = useCallback(async (newToken: string, newUser: AuthUser) => {
    queryClient.clear();
    await AsyncStorage.setItem("auth_token", newToken);
    await AsyncStorage.setItem("auth_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setAuthTokenGetter(() => newToken);
  }, []);

  const logout = useCallback(async () => {
    queryClient.clear();
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
    setAuthTokenGetter(() => null);
    if (Platform.OS === "web") {
      (window as any).location.href = "/login";
    } else {
      router.replace("/login" as any);
    }
  }, []);

  // Register 401 handler — auto-logout when token expires
  useEffect(() => {
    let shown = false;
    setOnUnauthorized(() => {
      if (shown) return;
      shown = true;
      Alert.alert(
        "Sessiya tugadi",
        "Token muddati tugagan. Iltimos, qayta kiring.",
        [{ text: "OK", onPress: () => logout() }]
      );
    });
    return () => setOnUnauthorized(null);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
