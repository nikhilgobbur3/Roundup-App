import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../../constants/colors";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { CURRENCY } from "../../constants/currency";
import { useTransactionStore } from "../../stores/transaction-store";

export default function AddTransactionScreen() {
  const router = useRouter();
  const { addTransaction } = useTransactionStore();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!description.trim()) {
      setError("Enter a description");
      return;
    }

    setIsSubmitting(true);
    try {
      await addTransaction(numAmount, description.trim());
      router.back();
    } catch {
      setError("Something went wrong. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flex}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Add Expense</Text>
          <Text style={styles.subtitle}>
            We'll round it up to the nearest {CURRENCY.symbol}10 and save the spare change
          </Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Amount ({CURRENCY.symbol})</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                accessibilityLabel="Amount"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="What did you spend on?"
                accessibilityLabel="Description"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.preview}>
              <Text style={styles.previewTitle}>RoundUp Preview</Text>
              {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 ? (
                <>
                  <Text style={styles.previewRow}>
                    Purchase: <Text style={styles.previewBold}>{CURRENCY.symbol}{parseFloat(amount).toFixed(2)}</Text>
                  </Text>
                  <Text style={styles.previewRow}>
                    Rounded to: <Text style={styles.previewBold}>{CURRENCY.symbol}{Math.ceil(parseFloat(amount) / 10) * 10}</Text>
                  </Text>
                  <Text style={styles.previewRow}>
                    Spare change saved:{" "}
                    <Text style={styles.previewHighlight}>
                      {CURRENCY.symbol}{(Math.ceil(parseFloat(amount) / 10) * 10 - parseFloat(amount)).toFixed(2)}
                    </Text>
                  </Text>
                </>
              ) : (
                <Text style={styles.previewHint}>Enter an amount to see the roundup</Text>
              )}
            </View>

            <Pressable
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text style={styles.buttonText}>Add Expense</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    backgroundColor: colors.surface,
  },
  error: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    textAlign: "center",
  },
  preview: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  previewTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  previewRow: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  previewBold: {
    fontWeight: typography.weights.semibold,
  },
  previewHighlight: {
    fontWeight: typography.weights.semibold,
    color: colors.secondary,
  },
  previewHint: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: colors.text.inverse,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
});
