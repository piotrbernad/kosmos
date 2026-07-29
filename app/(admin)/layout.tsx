import { requireAdmin } from "@/lib/dal";
import { KosmosLogo } from "@/app/_components/KosmosLogo";
import { NavPill } from "@/app/_components/NavPill";
import { SignOutButton } from "../(reporter)/SignOutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <>
      <header className="app-header">
        <div className="inner">
          <KosmosLogo href="/admin/zgloszenia" />
          <nav className="nav-pills">
            <NavPill href="/admin/zgloszenia">Zgłoszenia</NavPill>
          </nav>
          <div className="header-right">
            <span className="role-chip">Administrator</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
