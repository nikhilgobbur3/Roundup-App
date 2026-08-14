import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";

interface StatPillProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  delay: number;
}

export default function StatPill({ icon, value, label, delay }: StatPillProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(350)} style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.stat.background,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.stat.iconTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  label: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
});
