"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimInvitation } from "@/lib/invitations/actions";

/**
 * Set-password form for the admin invitation claim.
 *
 * The `token` is passed in as a prop so the Server Action receives it as
 * a plain input rather than a URL search param — the URL is the only place
 * the raw token exists, and we want the action's contract to be the same
 * shape whether it's called from this form, a test, or a script.
 */
export function ClaimForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await claimInvitation({ token, password });
      if (!res.ok) {
        // Both `invalid` and `expired_or_used` collapse into the same copy —
        // we do not distinguish so a probe cannot narrow the cause.
        setError(
          "Link jest nieprawidłowy lub wygasł. Poproś administratora o nowy.",
        );
        setPending(false);
        return;
      }
      router.push("/admin/zgloszenia");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Coś poszło nie tak. Spróbuj ponownie za chwilę.");
      setPending(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
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
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Aktywowanie…" : "Ustaw hasło i zaloguj"}
      </button>
    </form>
  );
}
