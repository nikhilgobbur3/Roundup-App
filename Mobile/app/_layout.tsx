import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuthStore } from "../stores/auth-store";
import { getToken, getUser, clearToken, clearUser } from "../services/storage/secure-store";
import { api, ApiError } from "../services/api/client";
import { colors } from "../constants/colors";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: false },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    (async () => {
      const [token, cachedUser] = await Promise.all([getToken(), getUser()]);

      if (token && cachedUser) {
        setAuth(cachedUser, token);

        try {
          const freshUser = await api.get<{ id: number; name: string; email: string; balance: number; savings: number }>("/api/auth/me");
          setAuth(freshUser, token);
        } catch (err) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            await Promise.all([clearToken(), clearUser()]);
            clearAuth();
          }
        }
        return;
      }

      if (token) {
        try {
          const user = await api.get<{ id: number; name: string; email: string; balance: number; savings: number }>("/api/auth/me");
          setAuth(user, token);
          return;
        } catch (err) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            await clearToken();
          }
        }
      }

      clearAuth();
    })();
  }, []);

  return <>{children}</>;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </AuthGate>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
});
