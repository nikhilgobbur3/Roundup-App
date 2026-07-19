import { api } from "./client";
import type { Transaction, TransactionRequest, BalanceResponse } from "../../types";

export const transactionsApi = {
  create: (data: TransactionRequest) =>
    api.post<Transaction>("/api/transactions", data),

  list: () =>
    api.get<Transaction[]>("/api/transactions"),

  getBalance: () =>
    api.get<BalanceResponse>("/api/transactions/balance"),
};
