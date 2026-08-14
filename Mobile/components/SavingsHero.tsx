import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";
import { CURRENCY } from "../constants/currency";

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const previousRef = useRef(0);

  useEffect(() => {
    const from = previousRef.current;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        previousRef.current = target;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

interface SavingsHeroProps {
  savings: number;
  scrollY: SharedValue<number>;
}

export default function SavingsHero({ savings, scrollY }: SavingsHeroProps) {
  const displayValue = useCountUp(savings);
  const glow = useSharedValue(0.35);

  useEffect(() => {
    glow.value = withRepeat(
      withTiming(0.6, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: interpolate(glow.value, [0.35, 0.6], [0.9, 1.1]) }],
  }));

  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(scrollY.value, [0, 180], [1, 0.96], Extrapolation.CLAMP),
      },
      {
        translateY: interpolate(scrollY.value, [0, 180], [0, -10], Extrapolation.CLAMP),
      },
    ],
  }));

  const formatted = displayValue.toFixed(2);

  return (
    <Animated.View style={[styles.wrap, parallaxStyle]}>
      <LinearGradient
        colors={[colors.hero.start, colors.hero.mid, colors.hero.end]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={styles.card}
      >
        <Animated.View style={[styles.glow, glowStyle]} />
        <View style={[styles.orb, styles.orbOne]} />
        <View style={[styles.orb, styles.orbTwo]} />
        <View style={[styles.orb, styles.orbThree]} />

        <View style={styles.labelRow}>
          <View style={styles.labelPill}>
            <Ionicons name="sparkles" size={14} color={colors.hero.accent} />
            <Text style={styles.label}>Your Wealth</Text>
          </View>
          <View style={styles.trendPill}>
            <Ionicons name="trending-up" size={13} color="#FFFFFF" />
            <Text style={styles.trendText}>Roundups</Text>
          </View>
        </View>

        <Text style={styles.amount}>
          {CURRENCY.symbol}
          {formatted}
        </Text>
        <Text style={styles.caption}>Saved up automatically, one roundup at a time</Text>

        <View style={styles.footer}>
          <Ionicons name="wallet-outline" size={16} color={colors.hero.textMuted} />
          <Text style={styles.footerText}>Grows with every purchase</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  card: {
    borderRadius: 24,
    padding: spacing.lg,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  glow: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.hero.glow,
  },
  orb: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.hero.ring,
  },
  orbOne: {
    top: -50,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  orbTwo: {
    bottom: -70,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  orbThree: {
    top: 24,
    right: 40,
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 20,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  label: {
    color: "#FFFFFF",
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(48,209,88,0.18)",
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  trendText: {
    color: "#FFFFFF",
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  amount: {
    fontSize: typography.sizes.display,
    fontWeight: typography.weights.bold,
    color: "#FFFFFF",
    marginTop: spacing.md,
    letterSpacing: -1,
  },
  caption: {
    fontSize: typography.sizes.sm,
    color: colors.hero.textMuted,
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.hero.ring,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.hero.textMuted,
  },
});
