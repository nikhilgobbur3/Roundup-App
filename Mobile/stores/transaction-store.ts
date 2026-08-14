import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Transaction } from "../types";
import { transactionsApi } from "../services/api/transactions";
import { useAuthStore } from "./auth-store";

const CACHE_KEY = "roundup:transactions-cache";

interface CacheShape {
  transactions: Transaction[];
  balance: number;
  savings: number;
  updatedAt: number;
}

async function writeCache(transactions: Transaction[], balance: number, savings: number) {
  try {
    const cache: CacheShape = { transactions, balance, savings, updatedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // cache writes must never break the UI flow
  }
}

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  hydrateFromCache: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  addTransaction: (amount: number, description: string) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  isLoading: false,

  hydrateFromCache: async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const cache = JSON.parse(raw) as CacheShape;
      if (!Array.isArray(cache.transactions)) return;
      useAuthStore.getState().updateBalance(cache.balance, cache.savings);
      set({ transactions: cache.transactions, isLoading: false });
    } catch {
      // corrupt or missing cache is fine; fall back to network
    }
  },

  fetchTransactions: async () => {
    set({ isLoading: true });
    try {
      const [transactions, balance] = await Promise.all([
        transactionsApi.list(),
        transactionsApi.getBalance(),
      ]);
      useAuthStore.getState().updateBalance(balance.balance, balance.savings);
      set({ transactions, isLoading: false });
      await writeCache(transactions, balance.balance, balance.savings);
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
    await writeCache(transactions, balance.balance, balance.savings);
  },
}));
