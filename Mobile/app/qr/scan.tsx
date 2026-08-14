import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { colors } from "../../constants/colors";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

function ScanLine() {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withRepeat(
      withTiming(230, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return <Animated.View style={[styles.scanLine, style]} />;
}

function parseUpiQr(data: string): Record<string, string> | null {
  if (!data.startsWith("upi://pay")) return null;
  try {
    const url = new URL(data);
    const params: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { params[k] = v; });
    return params;
  } catch {
    const parts = data.split("?");
    if (parts.length < 2) return null;
    const params: Record<string, string> = {};
    parts[1].split("&").forEach((p) => {
      const [k, ...v] = p.split("=");
      if (k) params[k] = decodeURIComponent(v.join("="));
    });
    return params;
  }
}

function WebScanner({ onScan }: { onScan: (code: string) => void }) {
  const [manualCode, setManualCode] = useState("");

  const handleFileUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        try {
          const jsqr = require("jsqr");
          const code = jsqr(imageData.data, imageData.width, imageData.height);
          if (code) onScan(code.data);
        } catch {}
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <View style={styles.center}>
      <Ionicons name="qr-code-outline" size={80} color={colors.primary} />
      <Text style={[styles.permissionTitle, { marginTop: spacing.lg }]}>Pay via UPI</Text>
      <Text style={styles.permissionText}>
        Enter merchant code or UPI ID
      </Text>

      <View style={styles.webInputRow}>
        <TextInput
          style={styles.webInput}
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="e.g. COFFEE01 or upi@bank"
          autoCapitalize="characters"
        />
        <Pressable
          style={styles.goButton}
          onPress={() => manualCode.trim() && onScan(manualCode.trim())}
        >
          <Text style={styles.goButtonText}>Go</Text>
        </Pressable>
      </View>

      <Text style={styles.orText}>or</Text>

      <label
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: spacing.md,
          cursor: "pointer",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <Ionicons name="image-outline" size={20} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: typography.sizes.md, fontWeight: typography.weights.medium }}>
          Upload QR Code Image
        </Text>
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />
      </label>
    </View>
  );
}

function NativeScanner({ onScan }: { onScan: (code: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <LinearGradient
          colors={[colors.hero.start, colors.hero.mid, colors.hero.end]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={styles.permissionIconWrap}
        >
          <Ionicons name="camera-outline" size={34} color="#FFFFFF" />
        </LinearGradient>
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          Allow camera access to scan merchant QR codes
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={
          scanned
            ? undefined
            : ({ data }) => {
                setScanned(true);
                onScan(data);
              }
        }
      />
      <View style={styles.overlay}>
        <View style={styles.frameWrap}>
          <View style={styles.frame} />
          {!scanned && <ScanLine />}
        </View>
        <Text style={styles.hint}>Point camera at merchant QR code</Text>
      </View>

      {scanned && (
        <Pressable style={styles.rescanButton} onPress={() => setScanned(false)}>
          <Text style={styles.rescanText}>Tap to Scan Again</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function ScanScreen() {
  const router = useRouter();

  const handleScan = (data: string) => {
    const trimmed = data.trim();

    // roundup:// scheme
    if (trimmed.startsWith("roundup://pay?merchant=")) {
      const code = trimmed.replace("roundup://pay?merchant=", "").split("&")[0];
      router.replace(`/qr/pay?type=merchant&code=${encodeURIComponent(code)}`);
      return;
    }

    // UPI QR code
    const upi = parseUpiQr(trimmed);
    if (upi && upi.pa) {
      const params = new URLSearchParams();
      params.set("type", "upi");
      params.set("pa", upi.pa);
      if (upi.pn) params.set("pn", upi.pn);
      if (upi.am) params.set("am", upi.am);
      if (upi.tn) params.set("tn", upi.tn);
      router.replace(`/qr/pay?${params.toString()}`);
      return;
    }

    // Merchant code or UPI ID typed manually
    const isUpiId = trimmed.includes("@");
    if (isUpiId) {
      const params = new URLSearchParams();
      params.set("type", "upi");
      params.set("pa", trimmed);
      if (trimmed.includes("@")) {
        params.set("pn", trimmed.split("@")[0]);
      }
      router.replace(`/qr/pay?${params.toString()}`);
    } else {
      router.replace(`/qr/pay?type=merchant&code=${encodeURIComponent(trimmed)}`);
    }
  };

  if (Platform.OS === "web") {
    return <WebScanner onScan={handleScan} />;
  }

  return <NativeScanner onScan={handleScan} />;
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
  camera: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  frameWrap: {
    width: 250,
    height: 250,
    justifyContent: "center",
    overflow: "hidden",
  },
  frame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: "#FFF",
    borderRadius: 24,
    backgroundColor: "transparent",
  },
  scanLine: {
    position: "absolute",
    top: 0,
    left: 10,
    right: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.secondary,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  hint: {
    color: "#FFF",
    fontSize: typography.sizes.sm,
    marginTop: spacing.lg,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    overflow: "hidden",
  },
  webInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
    marginTop: spacing.md,
  },
  webInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    backgroundColor: colors.surface,
  },
  goButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
  },
  goButtonText: {
    color: colors.text.inverse,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  orText: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    marginVertical: spacing.md,
  },
  permissionIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  permissionTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  permissionText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
  },
  permissionButtonText: {
    color: colors.text.inverse,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  rescanButton: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    backgroundColor: "rgba(10,132,255,0.92)",
    borderRadius: 14,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
  },
  rescanText: {
    color: colors.text.inverse,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
});
