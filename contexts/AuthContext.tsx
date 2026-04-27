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
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getAmplifyAuthRuntimeConfig } from "../lib/amplify-auth-config";
import { getCurrentUserProfile } from "../lib/crm-api";
import { handleResetPassword, handleSignIn, handleSignOut, handleSignUp } from "../services/auth";

export type SessionUser = {
  id: string;
  sub: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  workspaceId?: string | null;
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
const AUTH_TIMEOUT_MS = 9000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(message));
    }, AUTH_TIMEOUT_MS);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

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

function isUnauthenticatedError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "UserUnAuthenticatedException"
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [userSession, setUserSession] = useState<Awaited<ReturnType<typeof fetchAuthSession>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const isConfigured = Boolean(getAmplifyAuthRuntimeConfig());
  const sessionCheckIdRef = useRef(0);
  const hasBootstrappedRef = useRef(false);

  function rejectSession(message: string, error?: unknown) {
    if (error) {
      console.warn(`[AuthContext] ${message}`, error);
    } else {
      console.warn(`[AuthContext] ${message}`);
    }

    if (isConfigured) {
      void handleSignOut().catch((signOutError) => {
        console.warn("[AuthContext] failed to sign out invalid session:", signOutError);
      });
    }

    setUser(null);
    setUserSession(null);
  }

  async function refreshSession() {
    const sessionCheckId = ++sessionCheckIdRef.current;
    const shouldApplySession = () => sessionCheckId === sessionCheckIdRef.current;

    if (!isConfigured) {
      if (shouldApplySession()) {
        setUser(null);
        setUserSession(null);
        setIsLoading(false);
        hasBootstrappedRef.current = true;
      }
      return;
    }

    try {
      let session = await withTimeout(fetchAuthSession(), "Session check timed out.");

      if (!session.tokens) {
        if (shouldApplySession()) {
          setUser(null);
          setUserSession(null);
        }
        return;
      }

      let currentUser = await withTimeout(getCurrentUser(), "Current user check timed out.");
      let payload = session.tokens?.idToken?.payload as Record<string, unknown> | undefined;
      let mappedUser = {
        ...mapUser(currentUser, payload),
        idToken: session.tokens?.idToken?.toString(),
        accessToken: session.tokens?.accessToken?.toString(),
      };

      if (!mappedUser.sessionToken) {
        session = await withTimeout(
          fetchAuthSession({ forceRefresh: true }),
          "Forced session refresh timed out."
        );

        if (!session.tokens) {
          if (shouldApplySession()) {
            setUser(null);
            setUserSession(null);
          }
          return;
        }

        currentUser = await withTimeout(getCurrentUser(), "Current user check timed out.");
        payload = session.tokens?.idToken?.payload as Record<string, unknown> | undefined;
        mappedUser = {
          ...mapUser(currentUser, payload),
          idToken: session.tokens?.idToken?.toString(),
          accessToken: session.tokens?.accessToken?.toString(),
        };

        if (!mappedUser.sessionToken) {
          if (shouldApplySession()) {
            rejectSession("missing custom:session_token claim after forced refresh.");
          }
          return;
        }
      }

      const controller = new AbortController();
      const profileTimeout = window.setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

      const userProfile = await getCurrentUserProfile({
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${mappedUser.idToken ?? mappedUser.accessToken ?? ""}`,
          "Content-Type": "application/json",
          "x-session-token": mappedUser.sessionToken,
        },
      })
        .catch((error) => {
          if (shouldApplySession()) {
            rejectSession("user profile validation failed.", error);
          }
          return null;
        })
        .finally(() => window.clearTimeout(profileTimeout));

      if (!userProfile?.user) {
        return;
      }

      if (shouldApplySession()) {
        setUserSession(session);
        setUser({
          ...mappedUser,
          email: userProfile?.user.email ?? mappedUser.email,
          firstName: userProfile?.user.firstName ?? mappedUser.firstName,
          lastName: userProfile?.user.lastName ?? mappedUser.lastName,
          role: userProfile?.user.role ?? mappedUser.role,
          workspaceId: userProfile?.user.workspaceId ?? null,
        });
      }
    } catch (error) {
      if (!isUnauthenticatedError(error)) {
        console.error("[AuthContext] check session error:", error);
      }

      if (shouldApplySession()) {
        setUser(null);
        setUserSession(null);
      }
    } finally {
      if (shouldApplySession()) {
        hasBootstrappedRef.current = true;
        setIsLoading(false);
      }
    }
  }

  async function checkUser() {
    if (!hasBootstrappedRef.current && !user) {
      setIsLoading(true);
    }

    await refreshSession();
  }

  useEffect(() => {
    let isActive = true;
    const safetyTimer = window.setTimeout(() => {
      if (!isActive) {
        return;
      }

      console.warn("[AuthContext] initial session bootstrap timed out.");
      setUser(null);
      setUserSession(null);
      setIsLoading(false);
    }, AUTH_TIMEOUT_MS + 2000);

    if (!isConfigured) {
      setIsLoading(false);
      window.clearTimeout(safetyTimer);
      return;
    }

    configureAmplify();
    void checkUser().finally(() => {
      window.clearTimeout(safetyTimer);
    });

    return () => {
      isActive = false;
      window.clearTimeout(safetyTimer);
    };
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
