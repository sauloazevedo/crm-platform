import { createContext, useContext } from "react";

export type SessionUser = {
  id: string;
  sub: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  sessionToken?: string;
  idToken?: string;
  accessToken?: string;
};

export type AuthContextValue = {
  isReady: boolean;
  isConfigured: boolean;
  isAuthenticated: boolean;
  user: SessionUser | null;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
