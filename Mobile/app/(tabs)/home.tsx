import { useRef, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useNavigation } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { colors } from "../../constants/colors";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { CURRENCY } from "../../constants/currency";
import { useAuthStore } from "../../stores/auth-store";
import { useTransactionStore } from "../../stores/transaction-store";
import { parseClipboard, markAsSeen } from "../../utils/clipboard-parser";
import type { Transaction } from "../../types";

function formatCurrency(amount: number): string {
  return `${CURRENCY.symbol}${amount.toFixed(2)}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const { transactions, fetchTransactions, addTransaction } = useTransactionStore();
  const checkingRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          style={styles.qrButton}
          onPress={() => router.push("/qr/scan")}
        >
          <Ionicons name="qr-code-outline" size={22} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
      checkClipboard();
    }, [])
  );

  const checkClipboard = async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const text = await Clipboard.getStringAsync();
      const result = parseClipboard(text);
      if (result) {
        markAsSeen(result.raw);
        await addTransaction(result.amount, result.merchant ?? "Auto-detected");
        await fetchTransactions();
      }
    } catch {
    } finally {
      checkingRef.current = false;
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.name ?? "there"}</Text>
        <Text style={styles.subtitle}>Your RoundUp account</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your Wealth</Text>
        <Text style={styles.balanceAmount}>
          {formatCurrency(user?.savings ?? 0)}
        </Text>
        <View style={styles.balanceMeta}>
          <View style={styles.balanceMetaItem}>
            <Ionicons name="save-outline" size={16} color={colors.text.inverse} />
            <Text style={styles.balanceMetaText}>
              Saved up with roundups
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <Text style={styles.autoHint}>Auto-detected from clipboard</Text>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>
              Copy a bank SMS or UPI confirmation, then open RoundUp to auto-detect it
            </Text>
          </View>
        ) : (
          <View style={styles.transactionList}>
            {transactions.map((t: Transaction) => (
              <View
                key={t.id}
                style={[
                  styles.transactionRow,
                  t.type === "ROUNDUP_SAVING" && styles.savingRow,
                ]}
              >
                <View style={styles.transactionIcon}>
                  <Ionicons
                    name={t.type === "ROUNDUP_SAVING" ? "save-outline" : "cart-outline"}
                    size={22}
                    color={t.type === "ROUNDUP_SAVING" ? colors.secondary : colors.text.primary}
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDesc}>{t.description}</Text>
                  <Text style={styles.transactionDate}>
                    {new Date(t.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    t.type === "ROUNDUP_SAVING" && styles.savingAmount,
                  ]}
                >
                  {t.type === "ROUNDUP_SAVING" ? "+" : "-"}
                  {formatCurrency(t.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  greeting: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  qrButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.inverse,
    opacity: 0.8,
  },
  balanceAmount: {
    fontSize: typography.sizes.display,
    fontWeight: typography.weights.bold,
    color: colors.text.inverse,
    marginTop: spacing.xs,
  },
  balanceMeta: {
    marginTop: spacing.md,
    flexDirection: "row",
  },
  balanceMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  balanceMetaText: {
    fontSize: typography.sizes.sm,
    color: colors.text.inverse,
    opacity: 0.85,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  autoHint: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  transactionList: {
    gap: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    gap: spacing.sm + 2,
  },
  savingRow: {
    backgroundColor: "#F0FFF0",
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  transactionDate: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.error,
  },
  savingAmount: {
    color: colors.secondary,
  },
});
