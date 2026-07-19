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
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { colors } from "../../constants/colors";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { api, ApiError } from "../../services/api/client";
import { saveToken } from "../../services/storage/secure-store";
import { useAuthStore } from "../../stores/auth-store";
import type { AuthResponse } from "../../types";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const res = await api.post<AuthResponse>("/api/auth/login", data);
      await saveToken(res.token);
      setAuth({ id: res.userId, name: res.name, email: res.email }, res.token);
      router.replace("/(tabs)/home");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("root", { message: "Invalid email or password" });
      } else {
        setError("root", {
          message: "Something went wrong. Check your connection.",
        });
      }
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your RoundUp account</Text>

          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Email"
                  />
                  {errors.email && (
                    <Text style={styles.error}>{errors.email.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Your password"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      accessibilityLabel="Password"
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off" : "eye"}
                        size={22}
                        color={colors.text.secondary}
                      />
                    </Pressable>
                  </View>
                  {errors.password && (
                    <Text style={styles.error}>{errors.password.message}</Text>
                  )}
                </View>
              )}
            />

            {errors.root && (
              <Text style={styles.rootError}>{errors.root.message}</Text>
            )}

            <Pressable
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={() => router.push("/(auth)/signup")}>
            <Text style={styles.link}>
              Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
            </Text>
          </Pressable>
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
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
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  eyeButton: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
  },
  error: {
    fontSize: typography.sizes.xs,
    color: colors.error,
  },
  rootError: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    textAlign: "center",
    paddingVertical: spacing.sm,
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
  link: {
    textAlign: "center",
    marginTop: spacing.lg,
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  linkBold: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
});
