"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="centered-card">
      <div className="card stack-lg" style={{ textAlign: "center" }}>
        <h1>Coś poszło nie tak</h1>
        <p className="muted">
          Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.
        </p>
        <div>
          <button className="btn btn-primary" onClick={() => reset()}>
            Spróbuj ponownie
          </button>
        </div>
      </div>
    </main>
  );
}
