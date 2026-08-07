import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { colors } from "../../constants/colors";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuthStore } from "../../stores/auth-store";
import { clearToken, clearUser } from "../../services/storage/secure-store";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await Promise.all([clearToken(), clearUser()]);
    clearAuth();
    router.replace("/(auth)/login");
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={colors.primary} />
        </View>
        <Text style={styles.name}>{user?.name ?? "User"}</Text>
        <Text style={styles.email}>{user?.email ?? ""}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.row}>
          <Ionicons name="person-outline" size={22} color={colors.text.secondary} />
          <Text style={styles.rowText}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </View>

        <View style={styles.row}>
          <Ionicons name="notifications-outline" size={22} color={colors.text.secondary} />
          <Text style={styles.rowText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </View>

        <View style={styles.row}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.text.secondary} />
          <Text style={styles.rowText}>Security</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>

        <View style={styles.row}>
          <Ionicons name="help-circle-outline" size={22} color={colors.text.secondary} />
          <Text style={styles.rowText}>Help Center</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </View>

        <View style={styles.row}>
          <Ionicons name="information-circle-outline" size={22} color={colors.text.secondary} />
          <Text style={styles.rowText}>About</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </View>
      </View>

      <Pressable style={styles.logoutButton} onPress={() => setShowLogoutModal(true)}>
        <Ionicons name="log-out-outline" size={22} color={colors.error} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>

      <View style={styles.versionRow}>
        <Text style={styles.versionText}>RoundUp v1.0.0</Text>
      </View>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalMessage}>Are you sure you want to sign out?</Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmButton} onPress={handleLogout}>
                <Text style={styles.modalConfirmText}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  name: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  email: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 1,
    gap: spacing.sm + 4,
  },
  rowText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.error,
  },
  versionRow: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  versionText: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    width: "85%",
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  modalMessage: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.inverse,
  },
});
