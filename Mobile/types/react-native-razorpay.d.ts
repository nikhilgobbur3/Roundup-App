declare module "react-native-razorpay" {
  interface RazorpayOptions {
    key: string;
    amount: number;
    currency?: string;
    name: string;
    description?: string;
    order_id?: string;
    prefill?: {
      email?: string;
      contact?: string;
      name?: string;
    };
    theme?: {
      color?: string;
    };
    modal?: {
      confirm_close?: boolean;
      ondismiss?: () => void;
    };
  }

  interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  interface RazorpayErrorResponse {
    code: string;
    description: string;
  }

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccessResponse>;
    onExternalWalletSelection(callback: (data: { method: string }) => void): void;
  };

  export default RazorpayCheckout;
}
