import { requireUser } from "@/lib/dal";
import { KosmosLogo } from "@/app/_components/KosmosLogo";
import { NavPill } from "@/app/_components/NavPill";
import { SignOutButton } from "./SignOutButton";

export default async function ReporterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <>
      <header className="app-header">
        <div className="inner">
          <KosmosLogo href="/zgloszenia" />
          <nav className="nav-pills">
            <NavPill href="/zgloszenia" excludePrefixes={["/zgloszenia/nowe"]}>
              Zgłoszenia
            </NavPill>
            <NavPill href="/zgloszenia/nowe">Nowe zgłoszenie</NavPill>
          </nav>
          <div className="header-right">
            <span className="user-name" aria-label="Zalogowany użytkownik">
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
