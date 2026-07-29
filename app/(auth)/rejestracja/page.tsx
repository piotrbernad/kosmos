import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await props.searchParams;
  return (
    <div className="card stack-lg">
      <div>
        <h1>Załóż konto</h1>
        <p className="muted">
          Konto jest aktywne natychmiast po rejestracji. Nie wysyłamy maili.
        </p>
      </div>
      <RegisterForm nextUrl={next} />
      <div className="muted" style={{ textAlign: "center" }}>
        Masz już konto?{" "}
        <Link href={`/logowanie${next ? `?next=${encodeURIComponent(next)}` : ""}`}>
          Zaloguj się
        </Link>
      </div>
    </div>
  );
}
