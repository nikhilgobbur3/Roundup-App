import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInLeft } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";
import { CURRENCY } from "../constants/currency";
import type { Transaction } from "../types";

function formatCurrency(amount: number): string {
  return `${CURRENCY.symbol}${amount.toFixed(2)}`;
}

function formatShort(amount: number): string {
  return `+${CURRENCY.symbol}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

interface TransactionRowProps {
  transaction: Transaction;
  index: number;
}

export default function TransactionRow({ transaction, index }: TransactionRowProps) {
  const isSaving = transaction.type === "ROUNDUP_SAVING";
  const roundup = transaction.roundupAmount ?? 0;

  return (
    <Animated.View
      entering={FadeInLeft.delay(index * 50).duration(320)}
      style={[styles.row, isSaving && styles.savingRow]}
    >
      <View style={[styles.iconWrap, isSaving && styles.savingIconWrap]}>
        <Ionicons
          name={isSaving ? "save-outline" : "card-outline"}
          size={20}
          color={isSaving ? colors.row.roundupText : colors.primary}
        />
      </View>

      <View style={styles.info}>
        <Text style={styles.description} numberOfLines={1}>
          {transaction.description}
        </Text>
        <Text style={styles.date}>
          {new Date(transaction.date).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: new Date(transaction.date).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
          })}
        </Text>
      </View>

      {!isSaving && roundup > 0 && (
        <View style={styles.roundupBadge}>
          <Text style={styles.roundupBadgeText}>{formatShort(roundup)}</Text>
        </View>
      )}

      <Text style={[styles.amount, isSaving && styles.savingAmount]}>
        {isSaving ? "+" : "-"}
        {formatCurrency(transaction.amount)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.row.background,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    gap: spacing.sm + 2,
    borderRadius: 14,
    marginBottom: spacing.sm,
  },
  savingRow: {
    backgroundColor: colors.row.roundup,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.stat.iconTint,
    alignItems: "center",
    justifyContent: "center",
  },
  savingIconWrap: {
    backgroundColor: colors.row.roundup,
  },
  info: {
    flex: 1,
  },
  description: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  date: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  roundupBadge: {
    backgroundColor: colors.row.roundup,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  roundupBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.row.roundupText,
  },
  amount: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  savingAmount: {
    color: colors.row.roundupText,
  },
});
