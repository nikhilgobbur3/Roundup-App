import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/colors";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { CURRENCY } from "../../constants/currency";
import { merchantsApi } from "../../services/api/merchants";
import { paymentsApi } from "../../services/api/payments";
import { useTransactionStore } from "../../stores/transaction-store";
import { DUMMY_PAYMENTS } from "../../constants/config";
import RazorpayWebView from "../../components/RazorpayWebView";
import CelebrationOverlay from "../../components/CelebrationOverlay";

type Step = "form" | "processing" | "done";

export default function PayScreen() {
  const router = useRouter();
  const { type, code, pn, am, pa } = useLocalSearchParams<{
    type: string;
    code?: string;
    pn?: string;
    am?: string;
    pa?: string;
  }>();
  const { fetchTransactions, addTransaction } = useTransactionStore();

  const [payeeName, setPayeeName] = useState(pn || code || "Merchant");
  const [upiId, setUpiId] = useState(pa || "");
  const [amount, setAmount] = useState(am || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("form");

  const [showCheckout, setShowCheckout] = useState(false);
  const [orderData, setOrderData] = useState<{
    orderId: string;
    keyId: string;
    amount: number;
  } | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const roundedAmount =
    amount && !isNaN(numAmount)
      ? Math.ceil(numAmount / CURRENCY.roundUpTo) * CURRENCY.roundUpTo
      : 0;
  const roundupAmount = roundedAmount - numAmount;

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

  const handlePay = async () => {
    setError("");
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    if (DUMMY_PAYMENTS) {
      setLoading(true);
      setTimeout(async () => {
        setLoading(false);
        try {
          await addTransaction(
            numAmount,
            `Payment to ${payeeName}`
          );
          await fetchTransactions();
          setStep("done");
        } catch (err: any) {
          setError(
            err?.message && err.message !== "Network request failed"
              ? `Payment failed: ${err.message}`
              : "Payment failed to record. Check your internet connection and try again."
          );
          setStep("form");
        }
      }, 1500);
      return;
    }

    setLoading(true);
    try {
      const amountPaise = Math.round(numAmount * 100);
      const description = `Payment to ${payeeName}`;
      const order = await paymentsApi.createOrder(amountPaise, description);
      setOrderData(order);
      setShowCheckout(true);
    } catch (err: any) {
      setError(err?.message || "Failed to create order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = useCallback(async (data: {
    razorpay_payment_id: string;
    razorpay_signature: string;
    razorpay_order_id: string;
  }) => {
    setShowCheckout(false);
    setStep("processing");

    try {
      const description = `Payment to ${payeeName}`;
      await paymentsApi.verifyPayment({
        orderId: orderData!.orderId,
        paymentId: data.razorpay_payment_id,
        signature: data.razorpay_signature,
        amount: numAmount,
        description,
      });
      await fetchTransactions();
      setStep("done");
    } catch (err: any) {
      setError(err?.message || "Payment verification failed.");
      setStep("form");
    }
  }, [orderData, payeeName, roundedAmount, fetchTransactions]);

  const handleError = useCallback((err: { code: string; description: string }) => {
    setShowCheckout(false);
    if (err.code !== "PAYMENT_CANCELLED" && err.code !== "payment_failed") {
      setError(err.description || "Payment failed. Please try again.");
    }
    setStep("form");
  }, []);

  const handleClose = useCallback(() => {
    setShowCheckout(false);
  }, []);

  if (step === "done") {
    return (
      <CelebrationOverlay
        paidAmount={numAmount}
        payeeName={payeeName}
        savedAmount={roundupAmount}
        onDone={() => router.replace("/(tabs)/home")}
      />
    );
  }

  if (step === "processing") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.waitingTitle}>Verifying payment...</Text>
        <Text style={styles.waitingText}>
          Please wait while we confirm your payment
        </Text>
      </View>
    );
  }

  return (
    <>
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
            onPress={handlePay}
            disabled={loading || !numAmount}
          >
            <Ionicons name="card-outline" size={18} color={colors.text.inverse} />
            <Text style={styles.payButtonText}>
              Pay {numAmount > 0 ? `${CURRENCY.symbol}${numAmount.toFixed(2)}` : ""}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {orderData && (
        <RazorpayWebView
          visible={showCheckout}
          keyId={orderData.keyId}
          orderId={orderData.orderId}
          amount={orderData.amount}
          name="RoundUp"
          description={`Payment to ${payeeName}`}
          onSuccess={handleSuccess}
          onError={handleError}
          onClose={handleClose}
        />
      )}
    </>
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
