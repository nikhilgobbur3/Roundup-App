import { api } from "./client";
import type { PaymentOrder, PaymentVerifyRequest, Transaction } from "../../types";

export const paymentsApi = {
  createOrder: (amount: number, description: string) =>
    api.post<PaymentOrder>("/api/payments/order", { amount, description }),

  verifyPayment: (data: PaymentVerifyRequest) =>
    api.post<Transaction>("/api/payments/verify", data),
};
