import { Stack } from "expo-router";
import { colors } from "../../constants/colors";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerBackButtonDisplayMode: "minimal",
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen name="login" options={{ title: "Sign In" }} />
      <Stack.Screen name="signup" options={{ title: "Create Account" }} />
    </Stack>
  );
}
