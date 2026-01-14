import { create } from 'zustand';
import { User, Organization } from '../types';
import { authApi, organizationsApi } from '../services/api';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; full_name: string; organization_name: string }) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  organization: null,
  isLoading: false,
  isAuthenticated: false,
  isHydrated: false,

  initialize: async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      set({ isLoading: true });
      try {
        await get().fetchUser();
      } catch {
        // Token invalid, clear it
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      } finally {
        set({ isLoading: false, isHydrated: true });
      }
    } else {
      set({ isHydrated: true });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login(email, password);
      const { access_token, refresh_token } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      await get().fetchUser();
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const response = await authApi.register(data);
      const { tokens } = response.data;
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
      await get().fetchUser();
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, organization: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    const [userResponse, orgResponse] = await Promise.all([
      authApi.me(),
      organizationsApi.getCurrent(),
    ]);
    set({
      user: userResponse.data,
      organization: orgResponse.data,
      isAuthenticated: true,
    });
  },
}));
