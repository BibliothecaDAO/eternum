import { useAccount } from "@starknet-react/core";
import React from "react";
import { create } from "zustand";

interface AuthState {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  isAuthenticated: false,
  login: () => set({ isAuthenticated: true }),
  logout: () => set({ isAuthenticated: false }),
}));

// Hook to sync wallet connection state with auth state
export const useAuthSync = () => {
  const { isConnected } = useAccount();
  const { login, logout } = useAuth();

  // Sync auth state with wallet connection state
  React.useEffect(() => {
    if (isConnected) {
      login();
    } else {
      logout();
    }
  }, [isConnected, login, logout]);
};
