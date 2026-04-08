"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../../contexts/auth-context";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isReady) {
      return;
    }

    if (!auth.isConfigured || !auth.isAuthenticated) {
      router.replace("/login");
    }
  }, [auth.isAuthenticated, auth.isConfigured, auth.isReady, router]);

  if (!auth.isReady) {
    return null;
  }

  if (!auth.isConfigured || !auth.isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
