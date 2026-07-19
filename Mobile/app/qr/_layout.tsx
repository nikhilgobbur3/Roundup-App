import { Stack } from "expo-router";
import { colors } from "../../constants/colors";

export default function QrLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerTintColor: colors.primary }}>
      <Stack.Screen name="scan" options={{ title: "Scan QR", presentation: "modal" }} />
      <Stack.Screen name="pay" options={{ title: "Confirm Payment", presentation: "modal" }} />
    </Stack>
  );
}
