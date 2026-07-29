import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await props.searchParams;
  return (
    <div className="card stack-lg">
      <div>
        <h1>Zaloguj się</h1>
        <p className="muted">Podaj swój email i hasło.</p>
      </div>
      <LoginForm nextUrl={next} />
      <div className="muted" style={{ textAlign: "center" }}>
        Nie masz konta?{" "}
        <Link href={`/rejestracja${next ? `?next=${encodeURIComponent(next)}` : ""}`}>
          Zarejestruj się
        </Link>
      </div>
    </div>
  );
}
