import { redirect } from "next/navigation";
import { getSessionUserOrNull } from "@/lib/dal";

export default async function HomePage() {
  const user = await getSessionUserOrNull();
  if (!user) redirect("/logowanie");
  if (user.role === "admin") redirect("/admin/zgloszenia");
  redirect("/zgloszenia");
}
