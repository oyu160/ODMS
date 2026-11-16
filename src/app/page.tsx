import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Администратор зөвхөн тохиргоо хийдэг тул баримтын жагсаалт руу
  redirect(user.permissions.has("document.create") || user.permissions.has("document.resolve") ? "/dashboard" : "/documents");
}
