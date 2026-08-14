import { useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
} from "react-native";
import Animated, { useSharedValue, useAnimatedScrollHandler } from "react-native-reanimated";
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
import SavingsHero from "../../components/SavingsHero";
import StatPill from "../../components/StatPill";
import TransactionRow from "../../components/TransactionRow";

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const { transactions, isLoading, fetchTransactions, addTransaction, hydrateFromCache } = useTransactionStore();
  const checkingRef = useRef(false);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

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
      hydrateFromCache();
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

  const savingsTxns = transactions.filter((t) => t.type === "ROUNDUP_SAVING");
  const totalSaved = savingsTxns.reduce((sum, t) => sum + t.amount, 0);
  const now = new Date();
  const savedThisMonth = savingsTxns
    .filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, t) => sum + t.amount, 0);
  const avgRoundup = savingsTxns.length ? totalSaved / savingsTxns.length : 0;

  const initial = (user?.name ?? "U").charAt(0).toUpperCase();

  return (
    <Animated.ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={fetchTransactions}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name ?? "there"}</Text>
            <Text style={styles.subtitle}>Welcome back to RoundUp</Text>
          </View>
        </View>
      </View>

      <SavingsHero savings={user?.savings ?? 0} scrollY={scrollY} />

      <View style={styles.statsRow}>
        <StatPill
          icon="leaf"
          value={`${savingsTxns.length}`}
          label="Roundups"
          delay={80}
        />
        <StatPill
          icon="calendar"
          value={`${CURRENCY.symbol}${savedThisMonth.toFixed(2)}`}
          label="This month"
          delay={160}
        />
        <StatPill
          icon="trending-up"
          value={`${CURRENCY.symbol}${avgRoundup.toFixed(2)}`}
          label="Avg roundup"
          delay={240}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <View style={styles.autoPill}>
            <Ionicons name="clipboard-outline" size={12} color={colors.text.secondary} />
            <Text style={styles.autoHint}>Auto-detected</Text>
          </View>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <View style={styles.emptyIconRing}>
                <Ionicons name="receipt-outline" size={40} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>
              Copy a bank SMS or UPI confirmation, then open RoundUp to auto-detect it
            </Text>
          </View>
        ) : (
          <View style={styles.transactionList}>
            {transactions.map((t: Transaction, index) => (
              <TransactionRow key={t.id} transaction={t} index={index} />
            ))}
          </View>
        )}
      </View>
    </Animated.ScrollView>
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
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.stat.iconTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
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
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 110,
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
  autoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  autoHint: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    backgroundColor: colors.stat.background,
    borderRadius: 20,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.stat.iconTint,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
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
  },
});
