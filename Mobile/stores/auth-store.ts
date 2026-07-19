import { create } from "zustand";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  updateBalance: (balance: number, savings: number) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  setAuth: (user, token) => set({ user, token, isLoading: false }),
  clearAuth: () => set({ user: null, token: null, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  updateBalance: (balance, savings) =>
    set((state) => ({
      user: state.user ? { ...state.user, balance, savings } : null,
    })),
}));
