import {create} from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export const useAuth = create<AuthState>(set => ({
  isAuthenticated: false,
  login: () => set({isAuthenticated: true}),
  logout: () => set({isAuthenticated: false}),
}));
