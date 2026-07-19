import { api } from "./client";
import type { Merchant, Transaction, TransactionRequest } from "../../types";

export const merchantsApi = {
  getByCode: (code: string) =>
    api.get<Merchant>(`/api/merchants/${code}`),

  payMerchant: (code: string, data: TransactionRequest) =>
    api.post<Transaction>(`/api/merchants/pay?code=${code}`, data),
};
