import { redirect } from "next/navigation";
import { getSessionUserOrNull } from "@/lib/dal";
import { KosmosLogo } from "@/app/_components/KosmosLogo";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // If the visitor is already signed in, don't show login/register again —
  // send them to their home surface.
  const user = await getSessionUserOrNull();
  if (user) {
    redirect(user.role === "admin" ? "/admin/zgloszenia" : "/zgloszenia");
  }
  return (
    <main className="centered-card">
      <div style={{ width: "100%", maxWidth: 452 }}>
        <div style={{ marginBottom: 22 }}>
          <KosmosLogo size="lg" />
        </div>
        {children}
      </div>
    </main>
  );
}
