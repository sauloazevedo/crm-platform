"use client";

import { Amplify } from "aws-amplify";
import {
  fetchAuthSession,
  getCurrentUser,
  type AuthUser,
  type ResetPasswordOutput,
  type SignInOutput,
  type SignUpOutput,
} from "aws-amplify/auth";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAmplifyAuthRuntimeConfig } from "../lib/amplify-auth-config";
import { handleResetPassword, handleSignIn, handleSignOut, handleSignUp } from "../services/auth";

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

type AuthContextValue = {
  user: SessionUser | null;
  userSession: Awaited<ReturnType<typeof fetchAuthSession>> | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  checkUser: () => Promise<void>;
  refreshSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<SignInOutput>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<SignUpOutput>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<ResetPasswordOutput>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let isAmplifyConfigured = false;

function configureAmplify() {
  if (isAmplifyConfigured) {
    return;
  }

  const config = getAmplifyAuthRuntimeConfig();
  if (!config) {
    return;
  }

  Amplify.configure(
    {
      Auth: {
        Cognito: {
          userPoolId: config.userPoolId,
          userPoolClientId: config.userPoolClientId,
          loginWith: {
            email: true,
          },
        },
      },
    },
    { ssr: true }
  );

  isAmplifyConfigured = true;
}

function mapUser(user: AuthUser, idTokenPayload?: Record<string, unknown>): SessionUser {
  return {
    id: user.userId,
    sub: user.userId,
    email: typeof idTokenPayload?.email === "string" ? idTokenPayload.email : undefined,
    firstName: typeof idTokenPayload?.given_name === "string" ? idTokenPayload.given_name : undefined,
    lastName: typeof idTokenPayload?.family_name === "string" ? idTokenPayload.family_name : undefined,
    sessionToken:
      typeof idTokenPayload?.["custom:session_token"] === "string"
        ? idTokenPayload["custom:session_token"]
        : undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [userSession, setUserSession] = useState<Awaited<ReturnType<typeof fetchAuthSession>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const isConfigured = Boolean(getAmplifyAuthRuntimeConfig());

  async function refreshSession() {
    if (!isConfigured) {
      setUser(null);
      setUserSession(null);
      setIsLoading(false);
      return;
    }

    try {
      const [session, currentUser] = await Promise.all([fetchAuthSession(), getCurrentUser()]);
      const payload = session.tokens?.idToken?.payload as Record<string, unknown> | undefined;

      setUserSession(session);
      setUser({
        ...mapUser(currentUser, payload),
        idToken: session.tokens?.idToken?.toString(),
        accessToken: session.tokens?.accessToken?.toString(),
      });
    } catch (error) {
      console.error("[AuthContext] check session error:", error);
      setUser(null);
      setUserSession(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function checkUser() {
    setIsLoading(true);
    await refreshSession();
  }

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    configureAmplify();
    void checkUser();
  }, [isConfigured]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const isPublicRoute =
      pathname === "/" || pathname === "/login" || pathname === "/sign-in" || pathname === "/reset-password";

    if (user && isPublicRoute && pathname !== "/") {
      router.replace("/dashboard");
      return;
    }

    if (!user && !isPublicRoute) {
      router.replace("/login");
    }
  }, [isLoading, pathname, router, user]);

  async function signIn(email: string, password: string) {
    const result = await handleSignIn(email, password);
    await checkUser();
    return result;
  }

  async function signUp(email: string, password: string, firstName?: string, lastName?: string) {
    return handleSignUp(email, password, firstName, lastName);
  }

  async function signOut() {
    if (isConfigured) {
      await handleSignOut();
    }

    setUser(null);
    setUserSession(null);
    router.replace("/login");
    router.refresh();
  }

  async function resetPassword(email: string) {
    return handleResetPassword(email);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      userSession,
      isAuthenticated: Boolean(user),
      isLoading,
      isConfigured,
      checkUser,
      refreshSession,
      signIn,
      signUp,
      signOut,
      resetPassword,
    }),
    [isConfigured, isLoading, user, userSession]
  );

  return <AuthContext.Provider value={value}>{!isLoading ? children : null}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
