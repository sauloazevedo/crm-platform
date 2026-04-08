"use client";

import {
  fetchAuthSession,
  getCurrentUser,
  signOut as amplifySignOut,
  type AuthUser,
} from "aws-amplify/auth";
import { Amplify } from "aws-amplify";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue, type SessionUser } from "../contexts/auth-context";
import { getAmplifyAuthRuntimeConfig } from "../lib/amplify-auth-config";

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
  const email = typeof idTokenPayload?.email === "string" ? idTokenPayload.email : undefined;
  const firstName =
    typeof idTokenPayload?.given_name === "string" ? idTokenPayload.given_name : undefined;
  const lastName =
    typeof idTokenPayload?.family_name === "string" ? idTokenPayload.family_name : undefined;
  const sessionToken =
    typeof idTokenPayload?.["custom:session_token"] === "string"
      ? idTokenPayload["custom:session_token"]
      : undefined;

  return {
    id: user.userId,
    sub: user.userId,
    email,
    firstName,
    lastName,
    sessionToken,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const isConfigured = Boolean(getAmplifyAuthRuntimeConfig());

  useEffect(() => {
    if (!isConfigured) {
      setIsReady(true);
      return;
    }

    configureAmplify();
    void refreshSession();
  }, [isConfigured]);

  async function refreshSession() {
    if (!isConfigured) {
      setUser(null);
      setIsReady(true);
      return;
    }

    try {
      const [currentUser, session] = await Promise.all([getCurrentUser(), fetchAuthSession()]);
      const payload = session.tokens?.idToken?.payload as Record<string, unknown> | undefined;
      const mappedUser = mapUser(currentUser, payload);

      setUser({
        ...mappedUser,
        idToken: session.tokens?.idToken?.toString(),
        accessToken: session.tokens?.accessToken?.toString(),
      });
    } catch {
      setUser(null);
    } finally {
      setIsReady(true);
    }
  }

  async function logout() {
    if (!isConfigured) {
      setUser(null);
      return;
    }

    await amplifySignOut();
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      isConfigured,
      isAuthenticated: Boolean(user),
      user,
      refreshSession,
      logout,
    }),
    [isConfigured, isReady, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
