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
} as const;

export type ColorKeys = keyof typeof colors;
