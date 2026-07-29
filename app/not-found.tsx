import Link from "next/link";

export default function NotFound() {
  return (
    <main className="centered-card">
      <div className="card stack-lg" style={{ textAlign: "center" }}>
        <h1>Nie znaleziono</h1>
        <p className="muted">
          Strona nie istnieje albo nie masz do niej dostępu.
        </p>
        <div>
          <Link href="/" className="btn btn-primary">
            Wróć na stronę główną
          </Link>
        </div>
      </div>
    </main>
  );
}
