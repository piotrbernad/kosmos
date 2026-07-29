"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ nextUrl }: { nextUrl?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await authClient.signIn.email({ email, password });
    if (res.error) {
      // Uniform failure copy — never say which of email/password was wrong.
      setError("Niepoprawny email lub hasło.");
      setPending(false);
      return;
    }
    // Bounce to the requested next URL if it's a safe same-origin path,
    // otherwise let the home page route by role. `startsWith("/")` alone
    // would accept `//attacker.com` (protocol-relative) and `/\evil.com`
    // (Chrome and Firefox both normalize the backslash to `/`), so also
    // reject those explicitly.
    const target =
      nextUrl &&
      nextUrl.startsWith("/") &&
      !nextUrl.startsWith("//") &&
      !nextUrl.startsWith("/\\")
        ? nextUrl
        : "/";
    router.push(target);
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="stack" style={{ gap: 6 }}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <label htmlFor="password">Hasło</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Logowanie…" : "Zaloguj się"}
      </button>
    </form>
  );
}
