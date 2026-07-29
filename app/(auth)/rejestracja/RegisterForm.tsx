"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function RegisterForm({ nextUrl }: { nextUrl?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await authClient.signUp.email({ name, email, password });
    if (res.error) {
      setError(res.error.message ?? "Nie udało się założyć konta.");
      setPending(false);
      return;
    }
    // Better Auth auto-signs-in on successful registration.
    const target = nextUrl && nextUrl.startsWith("/") ? nextUrl : "/zgloszenia";
    router.push(target);
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="stack" style={{ gap: 6 }}>
        <label htmlFor="name">Imię i nazwisko</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={1}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
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
        <label htmlFor="password">Hasło (min. 8 znaków)</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Zakładanie konta…" : "Załóż konto"}
      </button>
    </form>
  );
}
