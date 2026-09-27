import { createContext, useContext } from "react";

export type AuthUser = {
  profile: {
    name?: string;
    email?: string;
  };
};

export type AppAuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  isConfigured: boolean;
  signinRedirect: () => Promise<void>;
  removeUser: () => Promise<void>;
};

export const AuthContext = createContext<AppAuthState | null>(null);

export const unconfiguredAuthState: AppAuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isConfigured: false,
  signinRedirect: async () => {
    throw new Error(
      "Configure VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID to sign in.",
    );
  },
  removeUser: async () => {},
};

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error(
      "useAuth must be used inside the application AuthProvider.",
    );
  }
  return auth;
}

export function useUser() {
  return useAuth().user;
}
