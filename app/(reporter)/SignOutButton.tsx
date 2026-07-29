"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="btn"
      onClick={async () => {
        await authClient.signOut();
        router.push("/logowanie");
        router.refresh();
      }}
    >
      Wyloguj
    </button>
  );
}
