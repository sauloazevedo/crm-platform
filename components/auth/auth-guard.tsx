"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./auth-guard.module.css";

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

  if (auth.isLoading && auth.isAuthenticated) {
    return <>{children}</>;
  }

  if (auth.isLoading) {
    return (
      <main className={styles.loadingPage}>
        <section className={styles.loadingCard}>
          <span aria-hidden="true" />
          <p>Checking your secure session...</p>
        </section>
      </main>
    );
  }

  if (!auth.isConfigured || !auth.isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
