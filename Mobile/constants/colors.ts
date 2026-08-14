export const colors = {
  primary: "#0A84FF",
  primaryDark: "#0060CC",
  secondary: "#30D158",
  secondaryDark: "#248A3D",
  background: "#FFFFFF",
  surface: "#F2F2F7",
  surfaceElevated: "#FFFFFF",
  border: "#C6C6C8",
  error: "#FF453A",
  warning: "#FF9F0A",
  text: {
    primary: "#1C1C1E",
    secondary: "#8E8E93",
    tertiary: "#C6C6C8",
    inverse: "#FFFFFF",
  },
  tabBar: {
    background: "#FFFFFF",
    active: "#0A84FF",
    inactive: "#8E8E93",
  },
  hero: {
    start: "#0B1526",
    mid: "#123258",
    end: "#0A84FF",
    glow: "rgba(10,132,255,0.35)",
    accent: "#F5B301",
    ring: "rgba(255,255,255,0.09)",
    textMuted: "rgba(255,255,255,0.72)",
  },
  stat: {
    background: "#F7F8FB",
    iconTint: "#EAF2FF",
  },
  row: {
    background: "#FFFFFF",
    roundup: "#E9F9EF",
    roundupText: "#1E9E4F",
  },
  shadow: "#0A84FF",
} as const;

export type ColorKeys = keyof typeof colors;
