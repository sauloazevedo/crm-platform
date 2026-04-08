"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useAuth } from "../../contexts/AuthContext";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const auth = useAuth();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        startTransition(async () => {
          await auth.signOut();
          router.replace("/login");
          router.refresh();
        })
      }
      disabled={isPending}
    >
      {isPending ? "Signing out..." : "Logout"}
    </button>
  );
}
