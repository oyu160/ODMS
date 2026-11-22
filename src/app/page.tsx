import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Administrator zuwhun tohirgoo hiideg tul barimtiin jagsaalt ruu
  redirect(user.permissions.has("document.create") || user.permissions.has("document.resolve") ? "/dashboard" : "/documents");
}
