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

const schema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function SignupScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const res = await api.post<AuthResponse>("/api/auth/signup", {
        name: data.name,
        email: data.email,
        password: data.password,
      });
      await saveToken(res.token);
      setAuth({ id: res.userId, name: res.name, email: res.email }, res.token);
      router.replace("/(tabs)/home");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("email", { message: "Email already registered" });
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
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            Start rounding up your spare change
          </Text>

          <View style={styles.form}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.field}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Your name"
                    autoCapitalize="words"
                    accessibilityLabel="Name"
                  />
                  {errors.name && (
                    <Text style={styles.error}>{errors.name.message}</Text>
                  )}
                </View>
              )}
            />

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
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
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

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.field}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Repeat your password"
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      accessibilityLabel="Confirm Password"
                    />
                    <Pressable
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeButton}
                      accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      <Ionicons
                        name={showConfirmPassword ? "eye-off" : "eye"}
                        size={22}
                        color={colors.text.secondary}
                      />
                    </Pressable>
                  </View>
                  {errors.confirmPassword && (
                    <Text style={styles.error}>
                      {errors.confirmPassword.message}
                    </Text>
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
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.link}>
              Already have an account?{" "}
              <Text style={styles.linkBold}>Sign In</Text>
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
