import { Stack } from "expo-router";
import { colors } from "../../constants/colors";

export default function TransactionLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerTintColor: colors.primary }}>
      <Stack.Screen name="add" options={{ title: "Add Expense", presentation: "modal" }} />
    </Stack>
  );
}
