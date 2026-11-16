import { requireUser, can } from "@/lib/auth";
import { shellCounts } from "@/lib/counters";
import { Sidebar, type NavItem } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { NavProgress } from "@/components/shell/nav-progress";
import { Suspense } from "react";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const c = await shellCounts(user);

  const main: NavItem[] = [];
  const hasWorkRole = user.permissions.has("document.create") || user.permissions.has("document.resolve") || user.permissions.has("document.review");
  if (hasWorkRole) main.push({ href: "/dashboard", label: "Хяналтын самбар", icon: "LayoutGrid" });
  main.push({ href: "/documents", label: "Баримт бичиг", icon: "FileText" });
  if (can(user, "document.review")) main.push({ href: "/reviews", label: "Хяналт, баталгаажуулалт", icon: "CircleCheck", badge: c.reviews });
  if (hasWorkRole) main.push({ href: "/assignments", label: "Хуваарилалт", icon: "UserPlus", badge: c.assignments, danger: can(user, "document.assign") });
  if (can(user, "document.archive") || can(user, "document.view_all")) main.push({ href: "/archive", label: "Архив", icon: "Archive" });
  if (can(user, "report.view")) main.push({ href: "/reports", label: "Тайлан", icon: "BarChart3" });

  const admin: NavItem[] = [];
  if (can(user, "settings.manage")) admin.push({ href: "/settings", label: "Баримтын тохиргоо", icon: "Settings" });
  if (can(user, "user.manage")) admin.push({ href: "/users", label: "Хэрэглэгч ба хэлтэс", icon: "Users" });
  if (can(user, "user.manage")) admin.push({ href: "/roles", label: "Эрх ба зөвшөөрөл", icon: "Lock" });
  if (can(user, "audit.view")) admin.push({ href: "/audit", label: "Үйлдлийн бүртгэл", icon: "Clock" });

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only z-50 rounded-lg bg-navy-800 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Үндсэн агуулга руу шилжих</a>
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <Sidebar main={main} admin={admin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          name={user.fullName}
          initials={user.initials}
          subtitle={`${user.roles.map((r) => r.name).join(", ")} · ${user.departmentName}`}
          unread={c.unread}
          notifications={c.notifications}
        />
        <main id="main" className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
