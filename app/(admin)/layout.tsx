import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { SignOutButton } from "../(reporter)/SignOutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <>
      <header className="nav">
        <div className="inner">
          <nav className="row" style={{ gap: 8 }}>
            <Link href="/admin/zgloszenia">Zgłoszenia</Link>
            <span
              className="muted"
              style={{
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "2px 8px",
                fontSize: 12,
              }}
            >
              Admin
            </span>
          </nav>
          <div className="row" style={{ gap: 12 }}>
            <span className="muted">{user.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
