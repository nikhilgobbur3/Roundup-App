import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../constants/colors";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface CelebrationOverlayProps {
  paidAmount: number;
  payeeName: string;
  savedAmount: number;
  onDone: () => void;
}

interface Piece {
  x: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  sway: number;
  rotation: number;
}

const CONFETTI_COLORS = [
  "#F5B301",
  "#FFD166",
  "#00C853",
  "#34D399",
  "#FF6B6B",
  "#4ECDC4",
  "#FFE066",
];
const GOLD = "#F5B301";

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

const PIECES: Piece[] = Array.from({ length: 34 }, (_, i) => ({
  x: Math.random() * SCREEN_W,
  delay: i * 30 + Math.random() * 150,
  duration: rand(1800, 2800),
  size: rand(6, 13),
  color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  sway: rand(-60, 60),
  rotation: rand(-360, 360),
}));

function ConfettiPiece({ piece }: { piece: Piece }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: piece.duration, easing: Easing.in(Easing.quad) })
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-30, SCREEN_H + 40]) },
      { translateX: interpolate(progress.value, [0, 1], [0, piece.sway]) },
      { rotate: `${piece.rotation * progress.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: piece.x,
          width: piece.size,
          height: piece.size,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

export default function CelebrationOverlay({
  paidAmount,
  payeeName,
  savedAmount,
  onDone,
}: CelebrationOverlayProps) {
  const checkScale = useSharedValue(0);
  const coinY = useSharedValue(-80);
  const coinOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardTranslate = useSharedValue(24);

  useEffect(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    checkScale.value = withDelay(120, withSpring(1, { damping: 9, stiffness: 160 }));
    coinY.value = withDelay(420, withSpring(0, { damping: 10, stiffness: 160 }));
    coinOpacity.value = withDelay(420, withTiming(1, { duration: 200 }));
    cardOpacity.value = withDelay(180, withTiming(1, { duration: 400 }));
    cardTranslate.value = withDelay(
      180,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const coinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: coinY.value }],
    opacity: coinOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslate.value }],
  }));

  const format = (n: number) => `₹${n.toFixed(2)}`;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0E1B16", "#13241C", "#0A0E0C"]} style={styles.gradient}>
        {PIECES.map((p, i) => (
          <ConfettiPiece key={i} piece={p} />
        ))}

        <View style={styles.content}>
          <Animated.View style={[styles.checkCircle, checkStyle]}>
            <Ionicons name="checkmark" size={48} color="#0A0E0C" />
          </Animated.View>

          <Text style={styles.title}>Payment Successful</Text>
          <Text style={styles.paidLine}>
            {format(paidAmount)} paid to {payeeName}
          </Text>

          {savedAmount > 0 && (
            <Animated.View style={[styles.savedPill, coinStyle]}>
              <View style={styles.coin}>
                <Ionicons name="trophy" size={16} color="#0A0E0C" />
              </View>
              <Text style={styles.savedText}>+{format(savedAmount)} invested in savings</Text>
            </Animated.View>
          )}

          <Animated.View style={[styles.card, cardStyle]}>
            <Ionicons name="trending-up" size={18} color={GOLD} />
            <View style={styles.cardText}>
              <Text style={styles.cardLabel}>Small change, big future</Text>
              <Text style={styles.cardSub}>Every roundup grows your wealth silently</Text>
            </View>
          </Animated.View>

          <Pressable style={styles.doneButton} onPress={onDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
  },
  piece: {
    position: "absolute",
    top: 0,
    borderRadius: 3,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: "#F2F5F3",
  },
  paidLine: {
    fontSize: typography.sizes.lg,
    color: "#9AA6A0",
    marginTop: spacing.sm,
  },
  savedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(245,179,1,0.14)",
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(245,179,1,0.4)",
  },
  coin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  savedText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: GOLD,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    width: "100%",
    maxWidth: 320,
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: "#F2F5F3",
  },
  cardSub: {
    fontSize: typography.sizes.xs,
    color: "#9AA6A0",
    marginTop: 2,
  },
  doneButton: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.sm + 4,
    marginTop: spacing.xxl,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#0A0E0C",
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
});
