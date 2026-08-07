import { create } from "zustand";
import type { Transaction } from "../types";
import { transactionsApi } from "../services/api/transactions";
import { useAuthStore } from "./auth-store";

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  fetchTransactions: () => Promise<void>;
  addTransaction: (amount: number, description: string) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  isLoading: false,

  fetchTransactions: async () => {
    set({ isLoading: true });
    try {
      const [transactions, balance] = await Promise.all([
        transactionsApi.list(),
        transactionsApi.getBalance(),
      ]);
      useAuthStore.getState().updateBalance(balance.balance, balance.savings);
      set({ transactions, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addTransaction: async (amount: number, description: string) => {
    await transactionsApi.create({ amount, description });
    const [transactions, balance] = await Promise.all([
      transactionsApi.list(),
      transactionsApi.getBalance(),
    ]);
    useAuthStore.getState().updateBalance(balance.balance, balance.savings);
    set({ transactions });
  },
}));
