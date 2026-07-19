import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "../stores/auth-store";
import { getToken } from "../services/storage/secure-store";
import { api } from "../services/api/client";
import { colors } from "../constants/colors";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: false },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const user = await api.get<{ id: number; name: string; email: string; balance: number; savings: number }>("/api/auth/me");
          setAuth(user, token);
          return;
        } catch {
          await clearAuth();
        }
      }
      clearAuth();
    })();
  }, []);

  return <>{children}</>;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    setReady(true);

    Notifications.requestPermissionsAsync();

    notificationListener.current = Notifications.addNotificationReceivedListener(
      () => {}
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      () => {}
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
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
