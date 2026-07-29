import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { SignOutButton } from "./SignOutButton";

export default async function ReporterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <>
      <header className="nav">
        <div className="inner">
          <nav className="row" style={{ gap: 8 }}>
            <Link href="/zgloszenia">Zgłoszenia</Link>
            <Link href="/zgloszenia/nowe">Nowe zgłoszenie</Link>
          </nav>
          <div className="row" style={{ gap: 12 }}>
            <span className="muted" aria-label="Zalogowany użytkownik">
              {user.name}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
