import { redirect } from "next/navigation";
import { getSessionUserOrNull } from "@/lib/dal";

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
  return <main className="centered-card">{children}</main>;
}
