"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (auth.isLoading) {
      return;
    }

    if (!auth.isConfigured || !auth.isAuthenticated) {
      router.replace("/login");
    }
  }, [auth.isAuthenticated, auth.isConfigured, auth.isLoading, router]);

  if (auth.isLoading) {
    return null;
  }

  if (!auth.isConfigured || !auth.isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
