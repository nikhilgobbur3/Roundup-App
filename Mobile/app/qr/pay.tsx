import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  AppState,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { colors } from "../../constants/colors";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { CURRENCY } from "../../constants/currency";
import { merchantsApi } from "../../services/api/merchants";
import { useTransactionStore } from "../../stores/transaction-store";
import { parseClipboard, markAsSeen } from "../../utils/clipboard-parser";

type Step = "form" | "sent_to_upi" | "auto_detecting" | "done" | "error";

export default function PayScreen() {
  const router = useRouter();
  const { type, code, pn, am, vpa } = useLocalSearchParams<{
    type: string;
    code?: string;
    pn?: string;
    am?: string;
    vpa?: string;
  }>();
  const { addTransaction, fetchTransactions } = useTransactionStore();

  const [payeeName, setPayeeName] = useState(pn || code || "Merchant");
  const [upiId, setUpiId] = useState(vpa || "");
  const [amount, setAmount] = useState(am || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("form");
  const appStateRef = useRef(AppState.currentState);

  const numAmount = parseFloat(amount) || 0;

  useEffect(() => {
    if (type === "merchant" && code) {
      loadMerchant(code);
    }
  }, [type, code]);

  const loadMerchant = async (merchantCode: string) => {
    try {
      const m = await merchantsApi.getByCode(merchantCode);
      setPayeeName(m.name);
      setUpiId(m.upiId);
    } catch {
      setError("Merchant not found");
    }
  };

  const handlePayViaUpi = async () => {
    setError("");
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!upiId) {
      setError("No UPI ID available");
      return;
    }

    const roundedAmount = Math.ceil(numAmount / CURRENCY.roundUpTo) * CURRENCY.roundUpTo;
    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${roundedAmount.toFixed(2)}&cu=INR`;

    setStep("sent_to_upi");

    try {
      const supported = await Linking.canOpenURL("upi://pay");
      if (!supported) {
        setError("No UPI apps found on this device");
        setStep("form");
        return;
      }
      await Linking.openURL(upiLink);
      setupAppStateListener();
    } catch {
      setError("Could not open UPI app");
      setStep("form");
    }
  };

  const setupAppStateListener = () => {
    const subscription = AppState.addEventListener("change", async (nextState) => {
      if (appStateRef.current === "active" && nextState === "active") {
        subscription.remove();
        setStep("auto_detecting");
        await autoDetect();
      }
      appStateRef.current = nextState;
    });

    timeoutRef.current = setTimeout(() => {
      subscription.remove();
      if (step === "sent_to_upi" || step === "auto_detecting") {
        setStep("done");
      }
    }, 120000);
  };

  const autoDetect = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    try {
      const text = await Clipboard.getStringAsync();
      const result = parseClipboard(text);
      if (result) {
        markAsSeen(result.raw);
        await addTransaction(result.amount, result.merchant ?? payeeName);
        await fetchTransactions();
      }
    } catch {
    }
    setStep("done");
  };

  if (step === "done") {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={80} color={colors.secondary} />
        <Text style={styles.successTitle}>Payment Sent</Text>
        <Text style={styles.successText}>
          {CURRENCY.symbol}{(numAmount || parseFloat(am || "0")).toFixed(2)} to {payeeName}
        </Text>
        <Pressable style={styles.backButton} onPress={() => router.replace("/(tabs)/home")}>
          <Text style={styles.backButtonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  if (step === "sent_to_upi") {
    return (
      <View style={styles.center}>
        <Ionicons name="phone-portrait-outline" size={64} color={colors.primary} />
        <Text style={styles.waitingTitle}>Complete payment in your UPI app</Text>
        <Text style={styles.waitingText}>
          After paying, come back to RoundUp and we'll auto-detect it
        </Text>
      </View>
    );
  }

  if (step === "auto_detecting") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.waitingTitle}>Checking for payment...</Text>
        <Text style={styles.waitingText}>
          Looking for transaction confirmation
        </Text>
      </View>
    );
  }

  const roundedAmount =
    amount && !isNaN(numAmount)
      ? Math.ceil(numAmount / CURRENCY.roundUpTo) * CURRENCY.roundUpTo
      : 0;
  const roundupAmount = roundedAmount - numAmount;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.merchantCard}>
        <View style={styles.merchantIcon}>
          <Ionicons name="storefront" size={32} color={colors.primary} />
        </View>
        <Text style={styles.merchantName}>{payeeName}</Text>
        {upiId ? (
          <Text style={styles.merchantUpi}>UPI: {upiId}</Text>
        ) : null}
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Amount ({CURRENCY.symbol})</Text>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
          autoFocus
          accessibilityLabel="Amount"
        />

        {amount && !isNaN(numAmount) && numAmount > 0 && (
          <View style={styles.roundupPreview}>
            <View style={styles.roundupRow}>
              <Text style={styles.roundupLabel}>You'll pay (rounded up)</Text>
              <Text style={styles.roundupValue}>
                {CURRENCY.symbol}{roundedAmount.toFixed(2)}
              </Text>
            </View>
            {roundupAmount > 0 && (
              <View style={styles.roundupRow}>
                <Text style={styles.roundupLabel}>Spare change saved</Text>
                <Text style={styles.roundupHighlight}>
                  +{CURRENCY.symbol}{roundupAmount.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.payButton, loading && styles.payButtonDisabled]}
          onPress={handlePayViaUpi}
          disabled={loading || !upiId}
        >
          <Ionicons name="phone-portrait-outline" size={18} color={colors.text.inverse} />
          <Text style={styles.payButtonText}>Pay via UPI</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  merchantCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  merchantIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  merchantName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  merchantUpi: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  form: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    backgroundColor: colors.surface,
    textAlign: "center",
  },
  roundupPreview: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  roundupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roundupLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  roundupValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  roundupHighlight: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.secondary,
  },
  error: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    textAlign: "center",
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.sm + 4,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  payButtonDisabled: { opacity: 0.6 },
  payButtonText: {
    color: colors.text.inverse,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  backButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
    marginTop: spacing.lg,
  },
  backButtonText: {
    color: colors.text.inverse,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  successTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  successText: {
    fontSize: typography.sizes.lg,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  waitingTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  waitingText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
});
