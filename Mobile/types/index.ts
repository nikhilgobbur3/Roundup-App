export interface User {
  id: number;
  name: string;
  email: string;
  balance: number;
  savings: number;
}

export interface AuthResponse {
  token: string;
  userId: number;
  name: string;
  email: string;
  balance: number;
  savings: number;
}

export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface Transaction {
  id: number;
  userId: number;
  amount: number;
  description: string;
  date: string;
  type: "EXPENSE" | "ROUNDUP_SAVING";
  roundupAmount: number | null;
}

export interface TransactionRequest {
  amount: number;
  description: string;
}

export interface BalanceResponse {
  balance: number;
  savings: number;
}

export interface Merchant {
  code: string;
  name: string;
  upiId: string;
}

export interface QrPaymentRequest {
  amount: number;
  description: string;
}

export interface PaymentOrder {
  orderId: string;
  keyId: string;
  amount: number;
}

export interface PaymentVerifyRequest {
  orderId: string;
  paymentId: string;
  signature: string;
  amount: number;
  description: string;
}
