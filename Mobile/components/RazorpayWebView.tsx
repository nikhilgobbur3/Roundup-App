import { useRef, useCallback } from "react";
import { Modal, View, StyleSheet, ActivityIndicator, Text } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "../constants/colors";

interface RazorpayWebViewProps {
  visible: boolean;
  keyId: string;
  orderId: string;
  amount: number;
  name: string;
  description: string;
  onSuccess: (data: { razorpay_payment_id: string; razorpay_signature: string; razorpay_order_id: string }) => void;
  onError: (error: { code: string; description: string }) => void;
  onClose: () => void;
}

const CHECKOUT_HTML = (keyId: string, orderId: string, amount: number, name: string, description: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8f9fa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .pay-btn {
      background: #0A84FF;
      color: white;
      border: none;
      border-radius: 12px;
      padding: 16px 32px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      max-width: 320px;
    }
    .pay-btn:active { opacity: 0.8; }
    .info {
      text-align: center;
      color: #666;
      margin-top: 16px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div style="text-align:center">
    <h2 style="margin-bottom:8px">${name}</h2>
    <p style="color:#666;margin-bottom:24px">${description}</p>
    <button class="pay-btn" id="rzp-btn">Pay ₹${(amount / 100).toFixed(2)}</button>
    <p class="info">Secure payment via Razorpay</p>
  </div>
  <script>
    var options = {
      key: "${keyId}",
      amount: "${amount}",
      currency: "INR",
      name: "${name}",
      description: "${description}",
      order_id: "${orderId}",
      handler: function (response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "success",
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature
        }));
      },
      prefill: { name: "", email: "", contact: "" },
      notes: {},
      theme: { color: "#0A84FF" },
      modal: {
        ondismiss: function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "dismissed"
          }));
        }
      }
    };

    document.getElementById("rzp-btn").onclick = function (e) {
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "error",
          code: response.error.code || "PAYMENT_FAILED",
          description: response.error.description || "Payment failed"
        }));
      });
      rzp.open();
      e.preventDefault();
    };
  </script>
</body>
</html>
`;

export default function RazorpayWebView({
  visible,
  keyId,
  orderId,
  amount,
  name,
  description,
  onSuccess,
  onError,
  onClose,
}: RazorpayWebViewProps) {
  const webViewRef = useRef<WebView>(null);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "success") {
        onSuccess({
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
          razorpay_order_id: data.razorpay_order_id,
        });
      } else if (data.type === "error") {
        onError({ code: data.code, description: data.description });
      } else if (data.type === "dismissed") {
        onClose();
      }
    } catch {
      onError({ code: "PARSE_ERROR", description: "Failed to parse payment response" });
    }
  }, [onSuccess, onError, onClose]);

  const html = CHECKOUT_HTML(keyId, orderId, amount, name, description);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html }}
          onMessage={handleMessage}
          javaScriptEnabled
          style={styles.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading Razorpay...</Text>
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  webview: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
});
